import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc/server";
import { decryptString, encryptString } from "@/server/lib/encryption";

const REKASSA_API = process.env.NEXT_PUBLIC_API_REKASSA;
const REKASSA_API_KEY = process.env.NEXT_PUBLIC_API_KEY_REKASSA;

export const rekassaRouter = createTRPCRouter({
  saveCredentials: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        token: z.string().min(1),
        number: z.string().optional(),
        password: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const data: Record<string, string> = {
        rekassaIdEncrypted: encryptString(input.id),
        rekassaTokenEncrypted: encryptString(input.token),
      };
      if (input.number) {
        data.rekassaNumberEncrypted = encryptString(input.number);
      }
      if (input.password) {
        data.rekassaPasswordEncrypted = encryptString(input.password);
      }

      await ctx.prisma.conf.upsert({
        where: { organizationId: ctx.organizationId },
        create: {
          organizationId: ctx.organizationId,
          ...data,
        },
        update: data,
      });
    }),

  refreshCredentials: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!REKASSA_API || !REKASSA_API_KEY) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Rekassa API not configured",
      });
    }

    const conf = await ctx.prisma.conf.findUnique({
      where: { organizationId: ctx.organizationId },
    });
    const numEnc = (conf as { rekassaNumberEncrypted?: string | null })
      ?.rekassaNumberEncrypted;
    const passEnc = (conf as { rekassaPasswordEncrypted?: string | null })
      ?.rekassaPasswordEncrypted;

    if (!numEnc || !passEnc) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Нет сохранённых данных для повторной авторизации. Перейдите на страницу подключения Rekassa.",
      });
    }

    const number = decryptString(numEnc);
    const password = decryptString(passEnc);

    const res = await fetch(
      `${REKASSA_API}/api/auth/login?apiKey=${REKASSA_API_KEY}&format=json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, password }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Ошибка Rekassa: ${res.status} ${text}`,
      });
    }

    const data = (await res.json()) as { id?: string; token?: string };
    if (!data.id || !data.token) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Неверный ответ Rekassa",
      });
    }

    await ctx.prisma.conf.update({
      where: { organizationId: ctx.organizationId },
      data: {
        rekassaIdEncrypted: encryptString(data.id.toString()),
        rekassaTokenEncrypted: encryptString(data.token),
      },
    });

    return { id: data.id.toString(), token: data.token };
  }),
  getCredentials: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const conf = await ctx.prisma.conf.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    if (!conf?.rekassaIdEncrypted || !conf?.rekassaTokenEncrypted) {
      return null;
    }

    return {
      id: decryptString(conf.rekassaIdEncrypted),
      token: decryptString(conf.rekassaTokenEncrypted),
    };
  }),
});
