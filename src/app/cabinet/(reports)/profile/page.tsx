"use client";

import { api } from "@/shared/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Typography } from "@/shared/ui/typography";
import { Skeleton } from "@/shared/ui/skeleton";
import { User, Mail, Phone, Briefcase, Pencil } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/shared/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/shared/ui/form";
import { InputField } from "@/shared/ui/_fields/input-field";
import { toast } from "sonner";
import { useState } from "react";

const profileFormSchema = z.object({
  fullName: z.string().min(1, "Обязательное поле"),
  position: z.string(),
  email: z.string().email("Некорректный email"),
  phone: z.string().min(1, "Укажите телефон"),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const [editOpen, setEditOpen] = useState(false);
  const utils = api.useUtils();
  const { data: user, isLoading } = api.user.getCurrent.useQuery();
  const { mutateAsync: updateCurrent, isPending: isUpdating } =
    api.user.updateCurrent.useMutation({
      onSuccess: () => {
        void utils.user.getCurrent.invalidate();
        setEditOpen(false);
        toast.success("Данные обновлены");
      },
      onError: (e) => toast.error(e.message),
    });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    values: user
      ? {
          fullName: user.fullName,
          position: user.position ?? "",
          email: user.email,
          phone: user.phone,
        }
      : undefined,
  });

  async function onSubmit(values: ProfileFormValues) {
    await updateCurrent({
      fullName: values.fullName,
      position: values.position || null,
      email: values.email,
      phone: values.phone,
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Typography size="h4-med">Пользователь не найден</Typography>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Typography size="h3-med">Профиль пользователя</Typography>
        <Typography size="body-16" color="gray-200" className="mt-2">
          Информация о вашем аккаунте
        </Typography>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Личная информация</CardTitle>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Редактировать
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Редактировать профиль</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <InputField
                    name="fullName"
                    label="ФИО"
                    placeholder="Иванов Иван Иванович"
                  />
                  <InputField
                    name="position"
                    label="Должность"
                    placeholder="Менеджер"
                  />
                  <InputField
                    name="email"
                    label="Email"
                    type="email"
                    placeholder="email@example.com"
                  />
                  <InputField
                    name="phone"
                    label="Номер телефона"
                    placeholder="+7 700 123 45 67"
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? "Сохранение…" : "Сохранить"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <Typography size="body-14" color="gray-200">
                ФИО
              </Typography>
              <Typography size="body-16" className="mt-1">
                {user.fullName}
              </Typography>
            </div>
          </div>

          {user.position && (
            <div className="flex items-start gap-4">
              <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <Typography size="body-14" color="gray-200">
                  Должность
                </Typography>
                <Typography size="body-16" className="mt-1">
                  {user.position}
                </Typography>
              </div>
            </div>
          )}

          <div className="flex items-start gap-4">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <Typography size="body-14" color="gray-200">
                Email
              </Typography>
              <Typography size="body-16" className="mt-1">
                {user.email}
              </Typography>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <Typography size="body-14" color="gray-200">
                Номер телефона
              </Typography>
              <Typography size="body-16" className="mt-1">
                {user.phone}
              </Typography>
            </div>
          </div>
        </CardContent>
      </Card>

      {user.organizations && user.organizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Организации</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.organizations.map((userOrg) => (
                <div
                  key={userOrg.id}
                  className="p-4 border rounded-lg bg-muted/50"
                >
                  <Typography size="body-16" className="font-medium">
                    {userOrg.organization.name}
                  </Typography>
                  <Typography size="body-14" color="gray-200" className="mt-1">
                    Создана:{" "}
                    {new Date(userOrg.organization.createdAt).toLocaleDateString(
                      "ru-RU",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </Typography>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

