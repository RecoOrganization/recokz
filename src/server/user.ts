import { createTRPCRouter } from "@/shared/lib/trpc/server";
import { protectedProcedure } from "@/shared/lib/trpc/server";
import { z } from "zod";

const updateCurrentInput = z.object({
  fullName: z.string().min(1).optional(),
  position: z.string().nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const userRouter = createTRPCRouter({
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: {
        clerkUserId: ctx.userId,
      },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    });

    return user;
  }),

  updateCurrent: protectedProcedure
    .input(updateCurrentInput)
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.user.update({
        where: { clerkUserId: ctx.userId },
        data: {
          ...(input.fullName !== undefined && { fullName: input.fullName }),
          ...(input.position !== undefined && { position: input.position }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.phone !== undefined && { phone: input.phone }),
        },
        include: {
          organizations: { include: { organization: true } },
        },
      });
      return updated;
    }),
});

export type UserRouter = typeof userRouter;

