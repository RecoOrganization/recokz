"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Building2, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { formatAmountKopecks, formatTxDate } from "./format";
import { CreateCrmDialog } from "./create-crm-dialog";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server";

type Row = inferRouterOutputs<AppRouter>["bankStatement"]["getRows"]["rows"][number];

function isResolved(
  rec: Row["reconciliations"][number],
): boolean {
  const matched = !!(
    rec.bankTransaction && rec.crmTransaction
  );
  const hasType = !!rec.typeId;
  return matched || hasType;
}

export function BankStatementRow({ row }: { row: Row }) {
  const [expanded, setExpanded] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const { bankTransaction, reportId, reconciliations, crmDocumentIdForCreate } =
    row;

  const meta =
    bankTransaction.meta && typeof bankTransaction.meta === "object"
      ? (bankTransaction.meta as Record<string, unknown>)
      : {};

  const purpose =
    typeof meta["Назначение платежа"] === "string"
      ? meta["Назначение платежа"]
      : "";

  const withCrm = reconciliations.filter((r) => r.crmTransaction);
  const withoutCrm = reconciliations.find(
    (r) => r.bankTransactionId && !r.crmTransactionId,
  );

  const canCreateCrm = Boolean(withoutCrm && crmDocumentIdForCreate);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:gap-6">
        {/* Левая колонка: банковская транзакция выписки */}
        <div className="space-y-2 border-b pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{bankTransaction.document?.name ?? "Выписка банка"}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatTxDate(bankTransaction.date)}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {formatAmountKopecks(bankTransaction.amount)}
          </p>
          {purpose ? (
            <p className="text-sm text-muted-foreground line-clamp-3">{purpose}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/cabinet/${reportId}`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Открыть сверку отчёта
              </Link>
            </Button>
          </div>
        </div>

        {/* Правая колонка: CRM / гармошка */}
        <div className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-left text-sm font-medium hover:bg-muted/60"
            onClick={() => setExpanded(!expanded)}
          >
            <span>
              CRM по этой операции{" "}
              <span className="text-muted-foreground font-normal">
                ({withCrm.length} сверок)
              </span>
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" />
            )}
          </button>

          {expanded && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
              {reconciliations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Нет строк сверки для этой транзакции. Запустите сверку в
                  отчёте.
                </p>
              ) : (
                reconciliations.map((rec) => (
                  <div
                    key={rec.id}
                    className={cn(
                      "rounded-md border p-3 text-sm",
                      isResolved(rec)
                        ? "border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20"
                        : "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {isResolved(rec) ? "Сверено" : "Не сверено"}
                      </span>
                      {rec.type?.name ? (
                        <span className="text-xs">{rec.type.name}</span>
                      ) : null}
                    </div>
                    {rec.crmTransaction ? (
                      <>
                        <p className="mt-1 font-medium tabular-nums">
                          {formatAmountKopecks(rec.crmTransaction.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTxDate(rec.crmTransaction.date)}
                        </p>
                        {rec.crmTransaction.document ? (
                          <p className="text-xs mt-1">
                            {rec.crmTransaction.document.name}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-1 text-muted-foreground">
                        CRM-транзакция не привязана
                      </p>
                    )}
                  </div>
                ))
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {canCreateCrm && withoutCrm ? (
                  <Button
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                    disabled={!crmDocumentIdForCreate}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Создать CRM-транзакцию
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/cabinet/${reportId}`}>
                    Перейти к созданию сверки
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {canCreateCrm && withoutCrm && crmDocumentIdForCreate ? (
        <CreateCrmDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          bankAmountKopecks={bankTransaction.amount}
          crmDocumentId={crmDocumentIdForCreate}
          reconciliationId={withoutCrm.id}
          bankTransactionId={bankTransaction.id}
          onSuccess={() => setExpanded(true)}
        />
      ) : null}
    </div>
  );
}
