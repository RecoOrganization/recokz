import { createTRPCRouter } from "@/shared/lib/trpc/server";
import { protectedProcedure } from "@/shared/lib/trpc/server";
import { z } from "zod";

export const crmTransactionRouter = createTRPCRouter({
    getAll: protectedProcedure
        .query(async ({ ctx }) => {
            const transactions = await ctx.prisma.crmTransaction.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    transactionId: {
                        not: '0'
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
            return transactions;
        }),
    getPaginated: protectedProcedure
        .input(z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(100).default(20),
        }))
        .query(async ({ ctx, input }) => {
            const where = {
                organizationId: ctx.organizationId,
                transactionId: { not: '0' },
            };
            const [items, total] = await Promise.all([
                ctx.prisma.crmTransaction.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    skip: (input.page - 1) * input.limit,
                    take: input.limit,
                }),
                ctx.prisma.crmTransaction.count({ where }),
            ]);
            return { items, total };
        }),
    getForExport: protectedProcedure
        .input(z.object({
            startDate: z.string().optional(),
            endDate: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const baseWhere = {
                organizationId: ctx.organizationId,
                transactionId: { not: '0' as const },
            };
            const dateFilter =
                input.startDate || input.endDate
                    ? {
                          createdAt: {
                              ...(input.startDate && { gte: new Date(input.startDate) }),
                              ...(input.endDate && {
                                  lte: (() => {
                                      const end = new Date(input.endDate!);
                                      end.setHours(23, 59, 59, 999);
                                      return end;
                                  })(),
                              }),
                          },
                      }
                    : {};
            return ctx.prisma.crmTransaction.findMany({
                where: { ...baseWhere, ...dateFilter },
                orderBy: { createdAt: "desc" },
            });
        }),
    update: protectedProcedure
        .input(z.object({
            transactionId: z.string(),
            bankTransactionId: z.string().optional(),
            sentToRekassa: z.boolean().optional()
        }))
        .mutation(async ({ctx, input}) => {
            const dataToUpdate: {
                bankTransactionId?: string;
                sentToRekassa?: boolean;
            } = {};

            if (input.bankTransactionId !== undefined) {
                dataToUpdate.bankTransactionId = input.bankTransactionId;
            }

            if (input.sentToRekassa !== undefined) {
                dataToUpdate.sentToRekassa = input.sentToRekassa;
            }

            await ctx.prisma.crmTransaction.update({
                where: { id: input.transactionId },
                data: dataToUpdate
            })
        }),
    retrive: protectedProcedure
        .input(z.object({
            id: z.string()
        }))
        .query(async ({ctx, input}) => {
            const transaction = await ctx.prisma.crmTransaction.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    id: input.id
                }
            })
            return transaction;
        }),
    create: protectedProcedure
        .input(z.object({
            amount: z.string().min(1),
            paymentType: z.enum(["cash", "kaspi", "halyk"]),
            description: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const transaction = await ctx.prisma.crmTransaction.create({
                data: {
                    amount: input.amount,
                    date: new Date(),
                    transactionId: `manual-${crypto.randomUUID()}`,
                    organizationId: ctx.organizationId,
                    meta: {
                        crm: "Ручная транзакция",
                        manual: true,
                        paymentType: input.paymentType,
                        data: {
                            account: {
                                title: input.paymentType === "cash" ? "Наличные"
                                    : input.paymentType === "kaspi" ? "Kaspi"
                                    : "Halyk",
                            },
                            expense: {
                                title: input.description || "",
                            },
                        },
                    },
                },
            });
            return transaction;
        }),
    delete: protectedProcedure
        .input(z.object({
            id: z.string()
        }))
        .mutation(async ({ctx, input}) => {
            await ctx.prisma.crmTransaction.delete({
                where: { id: input.id }
            })
        })
})

export type CrmTransactionRouter = typeof crmTransactionRouter;
