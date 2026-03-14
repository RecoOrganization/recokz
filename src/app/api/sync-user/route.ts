import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/shared/lib/prisma";

/**
 * Синхронизирует текущего пользователя Clerk в БД после верификации почты.
 * Вызывается после ввода кода с почты при регистрации.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );
    const email =
      primaryEmail?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "";
    if (!email) {
      return NextResponse.json(
        { error: "У пользователя нет email" },
        { status: 400 },
      );
    }
    const firstName = clerkUser.firstName ?? "";
    const lastName = clerkUser.lastName ?? "";
    const fullName =
      [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";

    await prisma.user.upsert({
      where: { clerkUserId: userId },
      create: {
        clerkUserId: userId,
        email,
        fullName,
        companyName: "—",
        phone: "—",
      },
      update: {
        email,
        fullName,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync user error:", error);
    return NextResponse.json(
      { error: "Не удалось сохранить пользователя" },
      { status: 500 },
    );
  }
}
