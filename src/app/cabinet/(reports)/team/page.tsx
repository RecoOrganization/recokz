"use client";

import { useState } from "react";
import { api } from "@/shared/lib/trpc/client";
import { Button } from "@/shared/ui/button";
import { Typography } from "@/shared/ui/typography";
import { Input } from "@/shared/ui/input";
import { UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

export default function TeamPage() {
  const [email, setEmail] = useState("");

  const { mutateAsync: addUserByEmail, isPending } =
    api.organization.addUserByEmail.useMutation({
      onSuccess: (data) => {
        toast.success(`Пользователь ${data.userName} добавлен в компанию`);
        setEmail("");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) {
      toast.error("Введите email");
      return;
    }
    await addUserByEmail({ email: value });
  };

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <Typography size="h3-med">Команда</Typography>
        <Typography size="body-16" className="mt-1 text-muted-foreground">
          Добавьте пользователя в компанию по email. Он должен быть уже
          зарегистрирован и подтвердил почту.
        </Typography>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex max-w-md flex-col gap-4 rounded-xl border bg-card p-6"
      >
        <label className="space-y-2">
          <Typography size="body-14" className="font-medium">
            Email пользователя
          </Typography>
          <Input
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="max-w-sm"
          />
        </label>
        <Button type="submit" disabled={isPending} className="w-fit gap-2">
          <UserPlusIcon className="h-4 w-4" />
          {isPending ? "Добавление…" : "Добавить в компанию"}
        </Button>
      </form>
    </div>
  );
}
