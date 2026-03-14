"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Typography } from "@/shared/ui/typography";
import { Button } from "@/shared/ui/button";
import { Building2Icon, UserPlusIcon } from "lucide-react";
import { OnboardingForm } from "./onboarding-form";
import { cn } from "@/shared/lib/cn";

type Step = "choice" | "create" | "wait";

export function OnboardingChoice() {
  const { user } = useUser();
  const [step, setStep] = useState<Step>("choice");

  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  if (step === "create") {
    return (
      <OnboardingForm onBack={() => setStep("choice")} />
    );
  }

  if (step === "wait") {
    return (
      <div className="flex max-w-[540px] flex-col gap-8 text-center">
        <Typography size="h3-med">
          Ожидайте приглашения в компанию
        </Typography>
        <Typography size="body-16" className="text-muted-foreground">
          Администратор компании может добавить вас по email. После добавления
          войдите в аккаунт снова — вы попадёте в кабинет компании.
        </Typography>
        <div className="rounded-xl border bg-muted/30 p-4">
          <Typography size="body-14" className="text-muted-foreground">
            Ваш email для приглашения:
          </Typography>
          <Typography size="body-16" className="mt-1 font-medium">
            {email}
          </Typography>
        </div>
        <Button variant="outline" onClick={() => setStep("choice")}>
          Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-8">
      <div className="text-center">
        <Typography size="h3-med" className="text-center">
          Добро пожаловать
        </Typography>
        <Typography size="body-16" className="mt-2 text-center text-muted-foreground">
          Выберите, как продолжить
        </Typography>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setStep("create")}
          className={cn(
            "flex flex-col items-center gap-4 rounded-xl border-2 border-border p-6 text-left",
            "transition-colors hover:border-primary hover:bg-muted/30",
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2Icon className="h-6 w-6" />
          </span>
          <div>
            <Typography size="body-16" className="font-medium">
              Создать свою компанию
            </Typography>
            <Typography size="body-14" className="mt-1 text-muted-foreground">
              Заполните данные компании и начните работу
            </Typography>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStep("wait")}
          className={cn(
            "flex flex-col items-center gap-4 rounded-xl border-2 border-border p-6 text-left",
            "transition-colors hover:border-primary hover:bg-muted/30",
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlusIcon className="h-6 w-6" />
          </span>
          <div>
            <Typography size="body-16" className="font-medium">
              Меня добавят в компанию
            </Typography>
            <Typography size="body-14" className="mt-1 text-muted-foreground">
              Администратор добавит вас по email после регистрации
            </Typography>
          </div>
        </button>
      </div>

    </div>
  );
}
