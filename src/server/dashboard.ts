import { createTRPCRouter } from "@/shared/lib/trpc/server";
import { protectedProcedure } from "@/shared/lib/trpc/server";
import { addDays, startOfDay, subDays } from "date-fns";

export const dashboardRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.organizationId;
    if (!organizationId) {
      return {
        transactionsTodayCount: 0,
        transactionsTodaySum: 0,
        sumByDays: [] as { date: string; sum: number }[],
      };
    }

    const todayStart = startOfDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);

    const [todayStats, sumByDaysRaw] = await Promise.all([
      ctx.prisma.transaction.aggregate({
        where: {
          organizationId,
          date: { gte: todayStart, lt: tomorrowStart },
        },
        _count: true,
        _sum: { amount: true },
      }),
      ctx.prisma.transaction.groupBy({
        by: ["date"],
        where: {
          organizationId,
          date: { gte: subDays(todayStart, 13) },
        },
        _sum: { amount: true },
      }),
    ]);

    const sumByDays = sumByDaysRaw
      .map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        sum: r._sum.amount ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      transactionsTodayCount: todayStats._count,
      transactionsTodaySum: todayStats._sum.amount ?? 0,
      sumByDays,
    };
  }),
});

export type DashboardRouter = typeof dashboardRouter;
