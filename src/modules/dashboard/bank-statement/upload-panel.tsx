"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Trash2, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { api } from "@/shared/lib/trpc/client";
import { toast } from "sonner";

type Props = {
  bank: "Kaspi" | "Halyk";
};

type Step = "idle" | "bank_uploading" | "bank_done" | "crm_uploading" | "crm_done";

export function UploadPanel({ bank }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [bankFiles, setBankFiles] = useState<File[]>([]);
  const [crmFiles, setCrmFiles] = useState<File[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [bankResult, setBankResult] = useState<{
    transactionsCount: number;
    totalBalance: number;
  } | null>(null);
  const [crmResult, setCrmResult] = useState<{
    transactionsCount: number;
    totalFiltered: number;
    allowedDatesCount: number;
  } | null>(null);

  const utils = api.useUtils();

  const { mutateAsync: createReport, isPending: isCreatingReport } =
    api.bankStatement.createReport.useMutation();
  const { mutateAsync: uploadBank, isPending: isUploadingBank } =
    api.bankStatement.uploadBankStatement.useMutation();
  const { mutateAsync: uploadCrm, isPending: isUploadingCrm } =
    api.bankStatement.uploadCrmFiltered.useMutation();
  const { mutateAsync: reconcile, isPending: isReconciling } =
    api.reconciliation.reconcile.useMutation();

  const pending = isCreatingReport || isUploadingBank || isUploadingCrm || isReconciling;

  const bankDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => setBankFiles((p) => [...p, ...files]), []),
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: true,
    disabled: pending || step !== "idle",
  });

  const crmDropzone = useDropzone({
    onDrop: useCallback((files: File[]) => setCrmFiles((p) => [...p, ...files]), []),
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: true,
    disabled: pending || step !== "bank_done",
  });

  async function fileToBase64(file: File) {
    const buf = await file.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  }

  const handleUploadBank = async () => {
    if (bankFiles.length === 0) return;
    setStep("bank_uploading");
    try {
      const report = await createReport({
        bank,
        startDate: new Date().toISOString(),
      });
      setReportId(report.id);

      let totalCount = 0;
      let totalBal = 0;
      for (const file of bankFiles) {
        const base64 = await fileToBase64(file);
        const res = await uploadBank({
          reportId: report.id,
          bank,
          fileContent: base64,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
        totalCount += res.transactionsCount;
        totalBal += res.totalBalance;
      }
      setBankResult({ transactionsCount: totalCount, totalBalance: totalBal });
      toast.success(`Загружено ${totalCount} транзакций из выписки`);
      setStep("bank_done");
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка загрузки");
      setStep("idle");
    }
  };

  const handleUploadCrm = async () => {
    if (crmFiles.length === 0 || !reportId) return;
    setStep("crm_uploading");
    try {
      let totalFiltered = 0;
      let totalCount = 0;
      let datesCount = 0;
      for (const file of crmFiles) {
        const base64 = await fileToBase64(file);
        const res = await uploadCrm({
          reportId,
          bank,
          fileContent: base64,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
        totalCount += res.transactionsCount;
        totalFiltered += res.totalFiltered;
        datesCount = res.allowedDatesCount;
      }
      setCrmResult({
        transactionsCount: totalCount,
        totalFiltered,
        allowedDatesCount: datesCount,
      });

      await reconcile({ reportId });

      void utils.bankStatement.getRows.invalidate();
      toast.success(
        `CRM: ${totalFiltered} транзакций совпали по датам (${datesCount} дат из выписки). Сверка запущена.`,
      );
      setStep("crm_done");
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка загрузки CRM");
      setStep("bank_done");
    }
  };

  const handleReset = () => {
    setStep("idle");
    setBankFiles([]);
    setCrmFiles([]);
    setReportId(null);
    setBankResult(null);
    setCrmResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Загрузка документов
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Bank statement */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">
            1. Выписка из банка ({bank})
          </h3>

          {step === "idle" && (
            <>
              <div
                {...bankDropzone.getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  bankDropzone.isDragActive
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                    : "border-muted-foreground/30 hover:border-muted-foreground/60"
                }`}
              >
                <input {...bankDropzone.getInputProps()} />
                <p className="text-sm text-muted-foreground">
                  Перетащите Excel-файл выписки или нажмите для выбора
                </p>
              </div>
              {bankFiles.length > 0 && (
                <div className="space-y-2">
                  {bankFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{f.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <button onClick={() => setBankFiles((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                  <Button
                    onClick={handleUploadBank}
                    disabled={pending}
                    size="sm"
                  >
                    {isCreatingReport || isUploadingBank ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Обработка…
                      </>
                    ) : (
                      "Загрузить выписку"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          {step === "bank_uploading" && (
            <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20 px-4 py-3 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium">Загружаем выписку банка…</p>
                <p className="text-xs text-muted-foreground">
                  Парсинг файла и определение транзакций. Это может занять некоторое время.
                </p>
              </div>
            </div>
          )}

          {(step === "bank_done" || step === "crm_uploading" || step === "crm_done") &&
            bankResult && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20 px-3 py-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  Выписка загружена: {bankResult.transactionsCount} транзакций
                </span>
              </div>
            )}
        </section>

        {/* Step 2: CRM */}
        {(step === "bank_done" || step === "crm_uploading" || step === "crm_done") && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">
              2. CRM-транзакции (отфильтруются по датам{" "}
              {bank === "Halyk" ? "выписки +1 день" : "КНП-190"})
            </h3>

            {step === "bank_done" && (
              <>
                <div
                  {...crmDropzone.getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    crmDropzone.isDragActive
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                      : "border-muted-foreground/30 hover:border-muted-foreground/60"
                  }`}
                >
                  <input {...crmDropzone.getInputProps()} />
                  <p className="text-sm text-muted-foreground">
                    Перетащите Excel-файл CRM или нажмите для выбора
                  </p>
                </div>
                {crmFiles.length > 0 && (
                  <div className="space-y-2">
                    {crmFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{f.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <button onClick={() => setCrmFiles((p) => p.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    ))}
                    <Button
                      onClick={handleUploadCrm}
                      disabled={pending}
                      size="sm"
                    >
                      {isUploadingCrm || isReconciling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Обработка и сверка…
                        </>
                      ) : (
                        "Загрузить CRM и запустить сверку"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}

            {step === "crm_uploading" && (
              <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20 px-4 py-3 text-sm">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="font-medium">
                    {isReconciling
                      ? "Запускаем сверку…"
                      : "Загружаем CRM-транзакции…"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isReconciling
                      ? "Сопоставляем банковские и CRM-транзакции."
                      : "Парсинг и фильтрация по датам выписки."}
                  </p>
                </div>
              </div>
            )}

            {step === "crm_done" && crmResult && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20 px-3 py-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  CRM загружено: {crmResult.transactionsCount} транзакций ({crmResult.allowedDatesCount} дат совпало). Сверка выполнена.
                </span>
              </div>
            )}
          </section>
        )}

        {step === "crm_done" && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            Загрузить ещё
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
