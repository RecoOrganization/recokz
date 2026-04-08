import { createTRPCRouter } from "@/shared/lib/trpc/server";
import { protectedProcedure } from "@/shared/lib/trpc/server";
import { z } from "zod";
import { DocumentType, BankDocumentType, ReportStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { parse } from "@/shared/lib/parse";
import { ai } from "@/server/ai";
import { parseDateTime, areSameDate } from "@/shared/lib/parse-date-time";
import { parseAmount } from "@/shared/lib/amount";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { mergeKnpTransactions } from "./lib/merge-knp-transactions";
import { extractDateFromPaymentPurpose } from "@/modules/reports/form/steps/lib/extract-date-from-payment-purpose";

dayjs.extend(utc);
dayjs.extend(timezone);

const reconciliationInclude = {
  include: {
    bankTransaction: { include: { document: true } },
    crmTransaction: { include: { document: true } },
    type: true,
  },
} as const;

function matchesBankFilter(
  meta: unknown,
  bank: "Kaspi" | "Halyk",
): boolean {
  if (!meta || typeof meta !== "object" || !("bank" in meta)) return false;
  if ((meta as { bank?: string }).bank !== bank) return false;
  if (bank === "Halyk") {
    const purpose = String(
      (meta as Record<string, unknown>)["Назначение платежа"] ?? "",
    );
    if (purpose.includes("Расчеты по карточкам")) return false;
  }
  return true;
}

function extractKnp190Dates(
  transactions: {
    meta: unknown;
  }[],
  bank: "Kaspi" | "Halyk",
): dayjs.Dayjs[] {
  const dates: dayjs.Dayjs[] = [];
  for (const tx of transactions) {
    const meta = tx.meta as Record<string, unknown> | null;
    if (!meta) continue;
    if (meta.bank !== bank) continue;

    if (bank === "Kaspi") {
      const knp = String(meta["КНП"] ?? "");
      if (knp !== "190") continue;
      const purpose =
        typeof meta["Назначение платежа"] === "string"
          ? meta["Назначение платежа"]
          : undefined;
      const d = extractDateFromPaymentPurpose(purpose);
      if (d && d.isValid()) dates.push(d.startOf("day"));
    } else {
      if (typeof meta.date === "string") {
        const d = dayjs(meta.date).startOf("day");
        if (d.isValid()) dates.push(d);
      } else if (typeof meta["Дата"] === "string") {
        const d = dayjs(meta["Дата"]).startOf("day");
        if (d.isValid()) dates.push(d);
      }
    }
  }
  return dates;
}

const fileInput = z.object({
  fileContent: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
});

async function parseExcelToRows(base64: string, maxSizeMb = 3) {
  const fileBuffer = Buffer.from(base64, "base64");
  if (fileBuffer.length > maxSizeMb * 1024 * 1024) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Файл слишком большой. Максимум ${maxSizeMb}MB`,
    });
  }
  return { fileBuffer, rows: await parse(fileBuffer) };
}

export const bankStatementRouter = createTRPCRouter({
  getRows: protectedProcedure
    .input(z.object({ bank: z.enum(["Kaspi", "Halyk"]) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.organizationId;
      if (!orgId) {
        return {
          rows: [] as const,
          crmDocumentIdByReportId: {} as Record<string, string | null>,
        };
      }

      const transactions = await ctx.prisma.transaction.findMany({
        where: {
          organizationId: orgId,
          document: {
            type: DocumentType.bank,
            bankDocumentType: BankDocumentType.bank_statement,
          },
        },
        include: {
          document: {
            include: {
              report: true,
            },
          },
        },
        orderBy: { date: "desc" },
      });

      const filtered = transactions.filter((t) =>
        matchesBankFilter(t.meta, input.bank),
      );

      const reportIds = [
        ...new Set(
          filtered.map((t) => t.document?.reportId).filter(Boolean) as string[],
        ),
      ];

      const crmDocumentIdByReportId: Record<string, string | null> = {};
      for (const rid of reportIds) {
        const crmDoc = await ctx.prisma.document.findFirst({
          where: {
            reportId: rid,
            type: DocumentType.crm,
          },
          orderBy: { createdAt: "asc" },
        });
        crmDocumentIdByReportId[rid] = crmDoc?.id ?? null;
      }

      const rows = await Promise.all(
        filtered.map(async (bankTransaction) => {
          const reportId = bankTransaction.document!.reportId;
          const reconciliations = await ctx.prisma.reconciliation.findMany({
            where: { bankTransactionId: bankTransaction.id },
            ...reconciliationInclude,
            orderBy: { createdAt: "asc" },
          });

          return {
            bankTransaction,
            reportId,
            reportStartDate: bankTransaction.document!.report.startDate,
            reportEndDate: bankTransaction.document!.report.endDate,
            crmDocumentIdForCreate: crmDocumentIdByReportId[reportId] ?? null,
            reconciliations,
          };
        }),
      );

      return { rows, crmDocumentIdByReportId };
    }),

  createReport: protectedProcedure
    .input(
      z.object({
        bank: z.enum(["Kaspi", "Halyk"]),
        startDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нет организации" });
      }
      const start = new Date(input.startDate);
      const report = await ctx.prisma.report.create({
        data: {
          startDate: start,
          endDate: start,
          cashBalance: 0,
          status: ReportStatus.import_bank,
          organization: { connect: { id: orgId } },
        },
      });
      return report;
    }),

  uploadBankStatement: protectedProcedure
    .input(
      fileInput.extend({
        reportId: z.string(),
        bank: z.enum(["Kaspi", "Halyk"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId;
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "Нет организации" });

      const report = await ctx.prisma.report.findUnique({
        where: { id: input.reportId, organizationId: orgId },
      });
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Отчёт не найден" });

      const { rows } = await parseExcelToRows(input.fileContent);
      const previewRows = rows.slice(0, 20);
      const startRow = await ai.detectTableStartRow(previewRows);
      const headerRow = rows[startRow];
      const columnsMap = await ai.detectTableColumns(headerRow);

      const data = rows.reduce<
        { date: string; amount: number; meta: Record<string, string | number | boolean>; transactionId: string }[]
      >((acc, row, index) => {
        if (index < startRow + 1) return acc;
        if (!row[columnsMap.date]) return acc;

        const hasAmount = Array.isArray(columnsMap.amount)
          ? columnsMap.amount.some((idx) => !!row[idx])
          : !!row[columnsMap.amount];
        if (!hasAmount) return acc;

        const amount = parseAmount(row, columnsMap.amount, columnsMap.isIncome);
        const parsedDate = parseDateTime(row[columnsMap.date], row[columnsMap.time], "Asia/Almaty");
        if (!parsedDate) return acc;

        const byCash = row.join(", ").includes("Наличными");

        acc.push({
          date: parsedDate.toISOString(),
          amount,
          meta: {
            ...row.reduce(
              (meta, item, i) => {
                if (i === columnsMap.date) meta[headerRow[i]] = parsedDate.toISOString();
                else if (i === columnsMap.time) meta[headerRow[i]] = parsedDate.format("HH:mm:ss");
                else if (i === columnsMap.amount) meta[headerRow[i]] = amount;
                else meta[headerRow[i] || "Неопределенное поле"] = item;
                return meta;
              },
              {} as Record<string, string | number>,
            ),
            byCash,
            bank: input.bank,
          },
          transactionId: (row[columnsMap.transactionId] || 0).toString(),
        });

        if (input.bank === "Halyk" && acc[acc.length - 1].meta["Комиссия за транзакции"]) {
          acc.push({
            date: parsedDate.toISOString(),
            amount: Number(acc[acc.length - 1].meta["Комиссия за транзакции"]),
            meta: acc[acc.length - 1].meta,
            transactionId: (row[columnsMap.transactionId] || 0).toString(),
          });
        }

        return acc;
      }, []);

      let processedData = data;
      if (input.bank === "Kaspi") {
        processedData = mergeKnpTransactions(processedData);
      }

      const totalBalance = processedData.reduce((s, t) => s + t.amount, 0);

      const document = await ctx.prisma.document.create({
        data: {
          name: input.fileName,
          balance: totalBalance,
          link: `uploads/${input.reportId}/${input.fileName}`,
          type: "bank",
          bankName: input.bank,
          reportId: input.reportId,
          bankDocumentType: BankDocumentType.bank_statement,
        },
      });

      const transactionsData = processedData.map((t) => ({
        amount: Math.round(t.amount * 100),
        date: new Date(t.date),
        meta: t.meta,
        documentId: document.id,
        transactionId: t.transactionId,
        organizationId: orgId,
      }));

      const batch = await ctx.prisma.transaction.createMany({ data: transactionsData });

      await ctx.prisma.report.update({
        where: { id: input.reportId },
        data: {
          startDate: processedData.length
            ? new Date(processedData.reduce((min, t) => (t.date < min ? t.date : min), processedData[0].date))
            : report.startDate,
          endDate: processedData.length
            ? new Date(processedData.reduce((max, t) => (t.date > max ? t.date : max), processedData[0].date))
            : report.endDate,
        },
      });

      return {
        documentId: document.id,
        transactionsCount: batch.count,
        totalBalance,
      };
    }),

  uploadCrmFiltered: protectedProcedure
    .input(
      fileInput.extend({
        reportId: z.string(),
        bank: z.enum(["Kaspi", "Halyk"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organizationId;
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "Нет организации" });

      const report = await ctx.prisma.report.findUnique({
        where: { id: input.reportId, organizationId: orgId },
      });
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Отчёт не найден" });

      const bankTransactions = await ctx.prisma.transaction.findMany({
        where: {
          organizationId: orgId,
          document: {
            reportId: input.reportId,
            type: DocumentType.bank,
            bankDocumentType: BankDocumentType.bank_statement,
          },
        },
      });

      const allowedDates = extractKnp190Dates(bankTransactions, input.bank);
      if (allowedDates.length === 0 && input.bank === "Halyk") {
        for (const tx of bankTransactions) {
          const meta = tx.meta as Record<string, unknown> | null;
          if (meta?.bank === "Halyk") {
            const d = dayjs(tx.date).startOf("day");
            if (d.isValid()) allowedDates.push(d);
          }
        }
      }

      if (allowedDates.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Не найдены даты из выписки банка для фильтрации CRM-транзакций. Сначала загрузите выписку банка.",
        });
      }

      const { rows } = await parseExcelToRows(input.fileContent);
      const previewRows = rows.slice(0, 20);
      const startRow = await ai.detectTableStartRow(previewRows);
      const headerRow = rows[startRow];
      const columnsMap = await ai.detectTableColumns(headerRow);

      const data = rows.reduce<
        { date: string; amount: number; meta: Record<string, string | number | boolean>; transactionId: string }[]
      >((acc, row, index) => {
        if (index < startRow + 1) return acc;
        if (!row[columnsMap.date]) return acc;

        const hasAmount = Array.isArray(columnsMap.amount)
          ? columnsMap.amount.some((idx) => !!row[idx])
          : !!row[columnsMap.amount];
        if (!hasAmount) return acc;

        const amount = parseAmount(row, columnsMap.amount, columnsMap.isIncome);
        const parsedDate = parseDateTime(row[columnsMap.date], row[columnsMap.time], "Asia/Almaty");
        if (!parsedDate) return acc;

        const txDay = parsedDate.startOf("day");
        const dateOffset = input.bank === "Halyk" ? 1 : 0;

        const matches = allowedDates.some((allowedDate) => {
          const target = allowedDate.add(dateOffset, "day");
          return txDay.isSame(target, "day");
        });

        if (!matches) return acc;

        const byCash = row.join(", ").includes("Наличными");
        acc.push({
          date: parsedDate.toISOString(),
          amount,
          meta: {
            ...row.reduce(
              (meta, item, i) => {
                if (i === columnsMap.date) meta[headerRow[i]] = parsedDate.toISOString();
                else if (i === columnsMap.time) meta[headerRow[i]] = parsedDate.format("HH:mm:ss");
                else if (i === columnsMap.amount) meta[headerRow[i]] = amount;
                else meta[headerRow[i] || "Неопределенное поле"] = item;
                return meta;
              },
              {} as Record<string, string | number>,
            ),
            byCash,
          },
          transactionId: (row[columnsMap.transactionId] || 0).toString(),
        });

        Object.values(acc[acc.length - 1].meta).forEach((el) => {
          switch (el) {
            case "Халык банк":
              acc[acc.length - 1].meta.bank = "Halyk";
              break;
            case "Каспи":
              acc[acc.length - 1].meta.bank = "Kaspi";
              break;
          }
        });

        return acc;
      }, []);

      const totalBalance = data.reduce((s, t) => s + t.amount, 0);

      const document = await ctx.prisma.document.create({
        data: {
          name: input.fileName,
          balance: totalBalance,
          link: `uploads/${input.reportId}/${input.fileName}`,
          type: "crm",
          bankName: "CRM",
          reportId: input.reportId,
          bankDocumentType: null,
        },
      });

      const transactionsData = data.map((t) => ({
        amount: Math.round(t.amount * 100),
        date: new Date(t.date),
        meta: t.meta,
        documentId: document.id,
        transactionId: t.transactionId,
        organizationId: orgId,
      }));

      const batch = await ctx.prisma.transaction.createMany({ data: transactionsData });

      return {
        documentId: document.id,
        transactionsCount: batch.count,
        totalFiltered: data.length,
        totalBalance,
        allowedDatesCount: allowedDates.length,
      };
    }),
});

export type BankStatementRouter = typeof bankStatementRouter;
