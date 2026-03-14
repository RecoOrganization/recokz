"use client";

import { api } from "@/shared/lib/trpc/client";
// import { xinValidator } from "@/shared/lib/validators";
import { InputField } from "@/shared/ui/_fields/input-field";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { Typography } from "@/shared/ui/typography";
import { useUser } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { toast } from "sonner";
import z from "zod";

const formSchema = z.object({
  fullName: z
    .string({ message: "Обязательное поле" })
    .min(2, "ФИО должно содержать не менее 2 символов"),
  position: z.string().optional(),
  companyName: z
    .string({ message: "Обязательное поле" })
    .min(2, "Название компании должно содержать не менее 2 символов"),
  bin: z.string().optional(),
  email: z
    .string({ message: "Обязательное поле" })
    .email("Некорректный email адрес"),
  phone: z
    .string({ message: "Обязательное поле" })
    .min(10, "Номер телефона должен содержать не менее 10 символов"),
});

export function OnboardingForm({
  onBack,
}: {
  onBack?: () => void;
} = {}) {
  const router = useRouter();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      position: "",
      companyName: "",
      bin: "",
      email: "",
      phone: "",
    },
  });

  // Обновляем email и phone из Clerk user когда он загрузится
  useEffect(() => {
    if (user) {
      const email = user.emailAddresses[0]?.emailAddress || "";
      const phone = user.phoneNumbers[0]?.phoneNumber || "";
      form.setValue("email", email);
      form.setValue("phone", phone);
    }
  }, [user, form]);

  const { mutateAsync: createOrganization } =
    api.organization.create.useMutation({
      onSuccess: async () => {
        await user?.reload();
        router.push("/cabinet");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    await createOrganization({
      fullName: values.fullName,
      position: values.position || undefined,
      companyName: values.companyName,
      bin: values.bin || undefined,
      email: values.email,
      phone: values.phone,
    });
  };

  return (
    <div className="flex flex-col gap-9 mt-50 items-center">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-9 mb-20"
        >
          <div className="flex flex-col gap-9 max-w-[540px]">
            <div className="flex flex-col gap-6 items-center">
              <Typography size="h3-med" className="text-center">
                Данные компании
              </Typography>
              <Typography size="body-16" className="text-center text-gray-200">
                Управляйте платежами онлайн. Добавляйте документы к сравнению,
                формируйте и экспортируйте отчёты за 5 минут
              </Typography>
            </div>

            <div className="flex flex-col gap-6">
              <InputField
                inputSize="lg"
                name="fullName"
                placeholder="ФИО"
                label="ФИО"
              />
              <InputField
                inputSize="lg"
                name="position"
                placeholder="Должность (не обязательно)"
                label="Должность"
              />
              <InputField
                inputSize="lg"
                name="companyName"
                placeholder="Наименование компании"
                label="Наименование компании"
              />
              <InputField
                inputSize="lg"
                name="bin"
                placeholder="БИН (не обязательно)"
                label="БИН"
              />
              <InputField
                inputSize="lg"
                name="email"
                placeholder="Email"
                label="Email"
                type="email"
              />
              <InputField
                inputSize="lg"
                name="phone"
                placeholder="Номер телефона"
                label="Номер телефона"
                type="tel"
              />
            </div>

            <div className="flex justify-between items-center gap-12">
              <div className="flex gap-2">
                {onBack && (
                  <Button type="button" variant="outline" onClick={onBack}>
                    Назад
                  </Button>
                )}
                <Typography size="body-14" className="text-gray-200">
                  Нажимая кнопку “Продолжить”, вы
                  <br /> соглашаетесь с Политикой конфиденциальности
                </Typography>
              </div>
              <Button type="submit">Продолжить</Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
