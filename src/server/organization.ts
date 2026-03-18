import { TRPCError } from "@trpc/server";
import { createTRPCRouter } from "@/shared/lib/trpc/server";
import { protectedProcedure } from "@/shared/lib/trpc/server";
import { z } from "zod";

const DEFAULT_INCOME_TYPES = [
  "Поступления от продажи товаров/услуг",
  "Предоплата за товары/услуги",
  "Взносы учредителей",
  "Получение кредита",
  "Возврат подотчётных средств",
];

const DEFAULT_EXPENSE_TYPES = [
  "Налоги выплаченные",
  "Заработная плата",
  "Аренда помещений",
  "Банковская комиссия",
  "Консультационные и профессиональные услуги",
  "Маркетинговые расходы",
  "Представительские расходы",
  "Командировочные расходы",
  "Транспортные расходы",
  "Коммунальные расходы",
  "Програмное обеспечение",
  "Канцелярские товары и хоз нужды",
  "Обучение сотрудников",
  "Страхование",
  "Выдача в подотчет",
];

export const organizationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        fullName: z.string(),
        position: z.string().optional(),
        companyName: z.string(),
        bin: z.string().optional(),
        email: z.string().email(),
        phone: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Создаем или обновляем пользователя
      const user = await ctx.prisma.user.upsert({
        where: {
          clerkUserId: ctx.userId,
        },
        create: {
          fullName: input.fullName,
          position: input.position,
          companyName: input.companyName,
          bin: input.bin,
          email: input.email,
          phone: input.phone,
          clerkUserId: ctx.userId,
        },
        update: {
          fullName: input.fullName,
          position: input.position,
          companyName: input.companyName,
          bin: input.bin,
          email: input.email,
          phone: input.phone,
        },
      });

      // Создаем организацию
      const organization = await ctx.prisma.organization.create({
        data: {
          name: input.companyName,
        },
      });

      // Связываем пользователя с организацией
      await ctx.prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
        },
      });

      // Создаем дефолтные типы транзакций
      const defaultTransactionTypes = [
        ...DEFAULT_INCOME_TYPES.map((name) => ({
          name,
          category: "income" as const,
          organizationId: organization.id,
        })),
        ...DEFAULT_EXPENSE_TYPES.map((name) => ({
          name,
          category: "expense" as const,
          organizationId: organization.id,
        })),
      ];

      await ctx.prisma.transactionType.createMany({
        data: defaultTransactionTypes,
      });

      // Обновляем metadata в Clerk: массив компаний + текущая
      await ctx.clerk.users.updateUserMetadata(ctx.userId, {
        publicMetadata: {
          organizationIds: [organization.id],
          currentOrganizationId: organization.id,
        },
      });

      return organization;
    }),

  addUserByEmail: protectedProcedure
    .input(z.object({ email: z.string().email("Некорректный email") }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.organizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Сначала выберите организацию",
        });
      }

      const user = await ctx.prisma.user.findFirst({
        where: { email: input.email.toLowerCase().trim() },
      });
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Пользователь с таким email не зарегистрирован. Попросите его зарегистрироваться и подтвердить почту.",
        });
      }

      const existing = await ctx.prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId },
        },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Пользователь уже добавлен в эту компанию",
        });
      }

      await ctx.prisma.userOrganization.create({
        data: { userId: user.id, organizationId },
      });

      const existingMeta = (await ctx.clerk.users.getUser(user.clerkUserId))
        .publicMetadata as { organizationIds?: string[] } | undefined;
      const existingIds = Array.isArray(existingMeta?.organizationIds)
        ? existingMeta.organizationIds
        : [];
      const newIds = existingIds.includes(organizationId)
        ? existingIds
        : [...existingIds, organizationId];

      await ctx.clerk.users.updateUserMetadata(user.clerkUserId, {
        publicMetadata: {
          organizationIds: newIds,
          currentOrganizationId: organizationId,
        },
      });

      return { success: true, userName: user.fullName };
    }),

  clearOrganization: protectedProcedure.mutation(async ({ ctx }) => {
    const existingMeta = (await ctx.clerk.users.getUser(ctx.userId))
      .publicMetadata as {
      organizationIds?: string[];
      currentOrganizationId?: string | null;
    };
    const organizationIds = Array.isArray(existingMeta?.organizationIds)
      ? existingMeta.organizationIds
      : [];
    await ctx.clerk.users.updateUserMetadata(ctx.userId, {
      publicMetadata: {
        organizationIds,
        currentOrganizationId: null,
      },
    });
    return { success: true };
  }),

  setCurrentOrganization: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ids = ctx.organizationIds ?? [];
      if (!ids.includes(input.organizationId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Нет доступа к этой организации",
        });
      }
      const existingMeta = (await ctx.clerk.users.getUser(ctx.userId))
        .publicMetadata as { organizationIds?: string[] };
      await ctx.clerk.users.updateUserMetadata(ctx.userId, {
        publicMetadata: {
          organizationIds: existingMeta?.organizationIds ?? ids,
          currentOrganizationId: input.organizationId,
        },
      });
      return { success: true };
    }),
});

export type OrganizationRouter = typeof organizationRouter;
