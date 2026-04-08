"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { InputField } from "@/shared/ui/_fields/input-field";
import { api } from "@/shared/lib/trpc/client";
import { toast } from "sonner";

const schema = z.object({
  addedBy: z.string().min(1, "Обязательное поле"),
  purpose: z.string().min(1, "Обязательное поле"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAmountKopecks: number;
  crmDocumentId: string | null;
  reconciliationId: string;
  bankTransactionId: string;
  onSuccess: () => void;
};

export function CreateCrmDialog({
  open,
  onOpenChange,
  bankAmountKopecks,
  crmDocumentId,
  reconciliationId,
  bankTransactionId,
  onSuccess,
}: Props) {
  const utils = api.useUtils();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { addedBy: "", purpose: "" },
  });

  const { mutateAsync: createTransaction, isPending: isCreating } =
    api.transaction.create.useMutation();
  const { mutateAsync: updateBankReconcile, isPending: isLinking } =
    api.reconciliation.updateBankReconcile.useMutation({
      onSuccess: () => {
        void utils.bankStatement.getRows.invalidate();
        toast.success("CRM-транзакция создана и связана со сверкой");
        onSuccess();
        onOpenChange(false);
        form.reset();
      },
      onError: (e) => toast.error(e.message),
    });

  const pending = isCreating || isLinking;

  async function onSubmit(values: FormValues) {
    if (!crmDocumentId) {
      toast.error("В отчёте нет CRM-документа — добавьте его в отчёте");
      return;
    }
    const tx = await createTransaction({
      amount: bankAmountKopecks,
      documentId: crmDocumentId,
      meta: {
        Purpose: values.purpose,
        "Added by": values.addedBy,
      },
    });
    await updateBankReconcile({
      reconciliationId,
      bankTransactionId,
      crmTransactionId: tx.id,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать CRM-транзакцию</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <InputField name="addedBy" label="Кто добавил" placeholder="ФИО" />
            <InputField
              name="purpose"
              label="Назначение платежа"
              placeholder="Текст назначения"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={pending || !crmDocumentId}>
                {pending ? "Сохранение…" : "Создать и связать"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
