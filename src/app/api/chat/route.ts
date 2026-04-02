import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/shared/lib/prisma";
import { subDays, startOfDay, format } from "date-fns";

// ─── helpers ────────────────────────────────────────────────────────────────

// Transaction.amount хранится в копейках (Int)
function formatAmount(kopecks: number) {
  return (Number(kopecks) / 100).toLocaleString("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  });
}

// CrmTransaction.amount хранится в тенге как строка
function formatCrmAmount(amount: string | number) {
  return Number(amount).toLocaleString("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  });
}

async function getOrganizationId(userId: string): Promise<string | null> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const meta = user.publicMetadata as {
    currentOrganizationId?: string | null;
    organizationIds?: string[];
    organizationId?: string | null;
  };
  return (
    meta.currentOrganizationId ??
    meta.organizationIds?.[0] ??
    meta.organizationId ??
    null
  );
}

// ─── system prompt с живыми данными из БД ───────────────────────────────────

async function buildSystemPrompt(organizationId: string): Promise<string> {
  const today = startOfDay(new Date());
  const fourteenDaysAgo = subDays(today, 14);

  const [
    organization,
    transactionTypes,
    recentReports,
    crmToday,
    crmLast14Days,
    recentCrmTransactions,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    }),

    prisma.transactionType.findMany({
      where: { organizationId },
      select: { name: true, category: true },
      orderBy: { category: "asc" },
    }),

    // Последние 5 сверок
    prisma.report.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        startDate: true,
        endDate: true,
        status: true,
        cashBalance: true,
        _count: { select: { documents: true, reconciliations: true } },
      },
    }),

    // CRM-транзакции за сегодня — именно они отображаются в «Приём оплат»
    prisma.crmTransaction.findMany({
      where: {
        organizationId,
        transactionId: { not: "0" },
        date: { gte: today },
      },
      select: { amount: true },
    }),

    // CRM-транзакции за 14 дней для динамики
    prisma.crmTransaction.findMany({
      where: {
        organizationId,
        transactionId: { not: "0" },
        date: { gte: fourteenDaysAgo },
      },
      select: { amount: true, date: true },
      orderBy: { date: "desc" },
    }),

    // Последние 10 CRM-транзакций
    prisma.crmTransaction.findMany({
      where: {
        organizationId,
        transactionId: { not: "0" },
      },
      orderBy: { date: "desc" },
      take: 10,
      select: { amount: true, date: true, meta: true },
    }),
  ]);

  // Итоги за сегодня
  const todaySum = crmToday.reduce((acc, t) => acc + Number(t.amount), 0);
  const todayCount = crmToday.length;

  // Динамика по дням
  const byDay = new Map<string, number>();
  for (const t of crmLast14Days) {
    const day = format(new Date(t.date), "dd.MM.yyyy");
    byDay.set(day, (byDay.get(day) ?? 0) + Number(t.amount));
  }
  const totalLast14Days = crmLast14Days.reduce(
    (acc, t) => acc + Number(t.amount),
    0,
  );

  const dailyStatsBlock = Array.from(byDay.entries())
    .slice(0, 7)
    .map(([day, sum]) => `  • ${day}: ${formatCrmAmount(sum)}`)
    .join("\n");

  const recentTxBlock = recentCrmTransactions
    .map((t) => {
      const meta = t.meta as Record<string, any> | null;
      const paymentType =
        meta?.data?.account?.title ?? meta?.paymentType ?? "—";
      const description = meta?.data?.expense?.title ?? "";
      return `  • ${format(new Date(t.date), "dd.MM.yyyy HH:mm")} | ${formatCrmAmount(t.amount)} | ${paymentType}${description ? " | " + description : ""}`;
    })
    .join("\n");

  const statusMap: Record<string, string> = {
    import_info: "Ввод параметров",
    import_bank: "Загрузка документов",
    import_crm: "Загрузка CRM",
    sales: "Сверка",
    expenses: "Расходы",
    done: "Завершён",
  };

  const reportsBlock = recentReports
    .map(
      (r) =>
        `  • ${format(new Date(r.startDate), "dd.MM.yyyy")}–${format(new Date(r.endDate), "dd.MM.yyyy")} | статус: ${statusMap[r.status] ?? r.status} | документов: ${r._count.documents} | сверок: ${r._count.reconciliations}`,
    )
    .join("\n");

  const incomeTypes = transactionTypes
    .filter((t) => t.category === "income")
    .map((t) => t.name)
    .join(", ");
  const expenseTypes = transactionTypes
    .filter((t) => t.category === "expense")
    .map((t) => t.name)
    .join(", ");

  return `Ты — AI-ассистент платформы Reco.kz. Работаешь с компанией «${organization?.name ?? "Организация"}».

## Твои три роли

### 1. Помощник по платформе Reco.kz
Помогаешь пользователям с точными названиями разделов и кнопок из интерфейса.

**Навигация** (верхнее меню):
Профиль | Дашборд | Сверка | Приём оплат | Интеграции | Справочники | Команда | Выйти
Справа в шапке — переключатель компании.

**Раздел «Сверка»** (/cabinet):
- Список сверок: Дата, Сумма, Статус (В работе / Завершен)
- Вкладки: Все / В работе / Завершённые
- Кнопки строки: корзина (удалить), карандаш (открыть)
- Внизу: «Считать текст с картинки» (загрузить фото → Отправить)

**Шаги сверки** (карандаш → аккордеон из 4 шагов):
1. «Информация о сверке» — период + остаток наличных → «Следующий шаг»
2. «Загрузка документов» — выбрать тип (Kaspi/Halyk/CRM) → тип документа (Отчет по продажам / Выписка из банка) → перетащить Excel → «Обработать файлы» → для банка указать «Баланс на начало периода» → «Сверить» (зелёная кнопка)
3. «Сверка» — фильтры: Kaspi/Halyk/CRM/Наличные + Все/Сверенные/Не сверенные; КНП=190 группируются в аккордеон; ручное сопоставление; «Создать наличную транзакцию»; кнопка «Далее»
4. «Итог» — финальные результаты

**Раздел «Приём оплат»** (/cabinet/transactions):
- Сверху: «Сумма транзакций за сегодня»
- Таблица: Дата, Сумма, Описание, Оплатить, Действия
- Кнопки: фильтр по датам, «Экспорт», «AI-ассистент», «+ Создать»
- «+ Создать»: сумма + способ оплаты (Наличные/Kaspi/Halyk) + описание
- У строки: корзина (удалить), стрелка (отправить в Rekassa)

**Раздел «Интеграции»** (/cabinet/connection):
- Rekassa: ввести ЗНМ + Пароль кассы для интеграции → «Подключить»
- МойСклад и Altegio: обратиться к администратору 8-771-540-22-40

**Раздел «Справочники»** (/cabinet/dictionary):
- Список типов транзакций (доходы/расходы), кнопка добавления (правый угол), кнопка удаления у каждого

**Раздел «Команда»** (/cabinet/team):
- Поле Email + кнопка «Добавить в компанию» (пользователь должен быть зарегистрирован)

**Раздел «Дашборд»** (/cabinet/dashboard):
- Карточка «Транзакции за сегодня» (кол-во и сумма)
- График «Сумма по дням» за 14 дней

### 2. Бухгалтерский консультант (Казахстан)
- Банковские выписки Kaspi и Halyk, сверка с кассой
- КНП (Коды Назначения Платежа), особенности КНП=190
- НДС, КПН, кассовая дисциплина, Rekassa/ЗНМ
- Документооборот: акты, счета-фактуры, накладные

### 3. Аналитик данных организации
Анализируешь реальные данные компании (см. контекст ниже).

---

## Данные организации «${organization?.name}» на ${format(new Date(), "dd.MM.yyyy HH:mm")}

**«Приём оплат» — сегодня (${format(today, "dd.MM.yyyy")}):**
${todayCount > 0 ? `  Транзакций: ${todayCount} шт., сумма: ${formatCrmAmount(todaySum)}` : "  Транзакций сегодня нет"}

**Динамика за 7 дней:**
${dailyStatsBlock || "  Нет данных"}

**Итого за 14 дней:** ${formatCrmAmount(totalLast14Days)}

**Последние 10 транзакций:**
${recentTxBlock || "  Нет транзакций"}

**Последние сверки:**
${reportsBlock || "  Сверок нет"}

**Справочник типов:**
  Доходы: ${incomeTypes || "не настроены"}
  Расходы: ${expenseTypes || "не настроены"}

---

## Правила
- Отвечай только на русском
- Ссылайся на реальные цифры из контекста
- Суммы в тенге (₸)
- Используй точные названия кнопок и разделов из интерфейса`;
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const organizationId = await getOrganizationId(userId);
  if (!organizationId)
    return new Response("Organization not found", { status: 403 });

  const { messages } = await req.json();
  const systemPrompt = await buildSystemPrompt(organizationId);

  const result = await streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    maxSteps: 5,
    tools: {
      // Статистика «Приём оплат» за произвольный период
      get_crm_stats: tool({
        description:
          "Статистика CRM-транзакций (раздел «Приём оплат») за указанный период",
        parameters: z.object({
          days: z.number().min(1).max(365).describe("Дней назад от сегодня"),
        }),
        execute: async ({ days }) => {
          const from = subDays(startOfDay(new Date()), days);
          const transactions = await prisma.crmTransaction.findMany({
            where: {
              organizationId,
              transactionId: { not: "0" },
              date: { gte: from },
            },
            select: { amount: true, date: true, meta: true },
          });

          const total = transactions.reduce(
            (acc, t) => acc + Number(t.amount),
            0,
          );
          const byDay = new Map<string, number>();
          for (const t of transactions) {
            const day = format(new Date(t.date), "dd.MM.yyyy");
            byDay.set(day, (byDay.get(day) ?? 0) + Number(t.amount));
          }

          return {
            period: `${days} дней`,
            totalAmount: formatCrmAmount(total),
            count: transactions.length,
            average:
              transactions.length > 0
                ? formatCrmAmount(total / transactions.length)
                : "0 ₸",
            byDay: Array.from(byDay.entries()).map(([date, sum]) => ({
              date,
              sum: formatCrmAmount(sum),
            })),
          };
        },
      }),

      // Топ транзакций
      get_top_crm_transactions: tool({
        description: "Самые крупные CRM-транзакции за последние 30 дней",
        parameters: z.object({
          limit: z.number().min(1).max(20).default(10),
        }),
        execute: async ({ limit }) => {
          const transactions = await prisma.crmTransaction.findMany({
            where: {
              organizationId,
              transactionId: { not: "0" },
              date: { gte: subDays(new Date(), 30) },
            },
            orderBy: { amount: "desc" },
            take: limit,
            select: { amount: true, date: true, meta: true },
          });

          return transactions.map((t) => {
            const meta = t.meta as Record<string, any> | null;
            return {
              amount: formatCrmAmount(t.amount),
              date: format(new Date(t.date), "dd.MM.yyyy HH:mm"),
              paymentType:
                meta?.data?.account?.title ?? meta?.paymentType ?? "—",
              description: meta?.data?.expense?.title ?? "",
            };
          });
        },
      }),

      // Детали последней сверки
      get_last_reconciliation: tool({
        description: "Детали последней сверки со статистикой",
        parameters: z.object({}),
        execute: async () => {
          const report = await prisma.report.findFirst({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            include: {
              documents: {
                select: {
                  type: true,
                  name: true,
                  bankName: true,
                  balance: true,
                },
              },
              reconciliations: {
                select: {
                  bankTransactionId: true,
                  crmTransactionId: true,
                  typeId: true,
                },
              },
            },
          });

          if (!report) return { error: "Сверок пока нет" };

          const matched = report.reconciliations.filter(
            (r) => r.bankTransactionId && r.crmTransactionId,
          ).length;
          const unmatchedBank = report.reconciliations.filter(
            (r) => r.bankTransactionId && !r.crmTransactionId,
          ).length;
          const unmatchedCrm = report.reconciliations.filter(
            (r) => !r.bankTransactionId && r.crmTransactionId,
          ).length;

          const statusMap: Record<string, string> = {
            import_info: "Ввод параметров",
            import_bank: "Загрузка документов",
            sales: "Сверка",
            done: "Завершён",
          };

          return {
            period: `${format(new Date(report.startDate), "dd.MM.yyyy")} – ${format(new Date(report.endDate), "dd.MM.yyyy")}`,
            status: statusMap[report.status] ?? report.status,
            cashBalance: formatAmount(report.cashBalance),
            documents: report.documents.map((d) => ({
              name: d.name,
              type: d.type,
              bank: d.bankName,
              balance: formatAmount(d.balance * 100),
            })),
            reconciliation: {
              total: report.reconciliations.length,
              matched,
              unmatchedBank,
              unmatchedCrm,
              matchRate:
                report.reconciliations.length > 0
                  ? `${Math.round((matched / report.reconciliations.length) * 100)}%`
                  : "0%",
            },
          };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
