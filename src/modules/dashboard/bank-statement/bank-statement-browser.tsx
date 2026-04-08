"use client";

import { api } from "@/shared/lib/trpc/client";
import { Typography } from "@/shared/ui/typography";
import { Skeleton } from "@/shared/ui/skeleton";
import { BankStatementRow } from "./bank-statement-row";
import { UploadPanel } from "./upload-panel";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { ArrowLeft } from "lucide-react";

const BANK_LABEL: Record<"Kaspi" | "Halyk", string> = {
  Kaspi: "Kaspi",
  Halyk: "Halyk",
};

export function BankStatementBrowser({ bank }: { bank: "Kaspi" | "Halyk" }) {
  const { data, isLoading, isError } = api.bankStatement.getRows.useQuery({
    bank,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Typography size="body-16" color="gray-200">
          Не удалось загрузить данные
        </Typography>
      </div>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cabinet/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            К дашборду
          </Link>
        </Button>
        <div>
          <Typography size="h3-med">
            Выписка банка — {BANK_LABEL[bank]}
          </Typography>
          <Typography size="body-16" color="gray-200" className="mt-1">
            Слева — операции из документа «Выписка банка», справа — связанные
            CRM-транзакции по сверке
          </Typography>
        </div>
      </div>

      <UploadPanel bank={bank} />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Typography size="body-16" color="gray-200">
            Нет транзакций выписки для {BANK_LABEL[bank]}. Импортируйте выписку
            в отчёте или выберите другой банк.
          </Typography>
          <Button className="mt-4" asChild variant="outline">
            <Link href="/cabinet">Перейти к сверкам</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <BankStatementRow key={row.bankTransaction.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
