"use client";

import { useState, ChangeEvent } from "react";
import {
  TrashIcon,
  ArrowRightFromLineIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import dayjs from "dayjs";
import { api } from "@/shared/lib/trpc/client";
import { LoaderIcon } from "@/shared/ui/loader";
import { Transaction } from "@/modules/transactions/model/Transaction";
import { api as axiosApi } from "@/shared/client";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";
import { CustomCheckbox } from "@/shared/ui/checkbox";
import { formatDateToCustomObject } from "../utils";
import { Axios, AxiosError } from "axios";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

export function TransactionsTable() {
  const { user } = useUser();
  const utils = api.useUtils();
  const [isLoading, setLoading] = useState(false);
  const [checkedTransactions, setCheckedTransactions] = useState<string[]>([]);
  const [amountOfTransactions, setAmountOfTransaction] = useState(0);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxPaymentType, setNewTxPaymentType] = useState<
    "cash" | "kaspi" | "halyk"
  >("cash");
  const [newTxDescription, setNewTxDescription] = useState("");

  const { data: paginatedData, isLoading: isTransactionsLoading } =
    api.crmTransaction.getPaginated.useQuery({
      page,
      limit,
    });
  const transactions = (paginatedData?.items ?? []) as unknown as Transaction[];
  const totalTransactions = paginatedData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / limit));

  const { data: rekassaCredentials } = api.rekassa.getCredentials.useQuery();

  const { mutateAsync: refreshRekassaCredentials } =
    api.rekassa.refreshCredentials.useMutation();

  const { mutateAsync: createCrmTransaction, isPending: isCreating } =
    api.crmTransaction.create.useMutation({
      onSuccess: () => {
        toast.success("Транзакция создана");
        utils.crmTransaction.getPaginated.invalidate();
        utils.crmTransaction.getAll.invalidate();
        setIsCreateModalOpen(false);
        setNewTxAmount("");
        setNewTxPaymentType("cash");
        setNewTxDescription("");
      },
      onError: () => {
        toast.error("Не удалось создать транзакцию");
      },
    });

  const { mutateAsync: deleteCrmTransaction } =
    api.crmTransaction.delete.useMutation({
      onSuccess: () => {
        toast("CRM транзакция удалена");
        utils.crmTransaction.getAll.invalidate();
        utils.crmTransaction.getPaginated.invalidate();
      },
      onError: () => {
        toast("Не получилось удалить транзакцию");
      },
    });

  const { mutateAsync: updateCrmTransaction } =
    api.crmTransaction.update.useMutation({
      onSuccess: (_data, variables) => {
        if (variables.sentToRekassa) {
          toast.success("Транзакция отправлена в Rekassa");
        } else if (variables.bankTransactionId) {
          toast("CRM транзакция оплачена");
        }
        utils.crmTransaction.getAll.invalidate();
        utils.crmTransaction.getPaginated.invalidate();
      },
      onError: () => {
        toast("Не получилось оплатить транзакцию в ручную");
      },
    });

  if (isTransactionsLoading || isLoading || !user) {
    return (
      <div className="p-6">
        <LoaderIcon className="animate-spin" />
      </div>
    );
  }

  const formatBalance = (balanceInKopecks: number) => {
    return balanceInKopecks.toLocaleString("ru-RU", {
      style: "currency",
      currency: "KZT",
      minimumFractionDigits: 2,
    });
  };

  const deleteHandler = async (transaction: Transaction) => {
    await deleteCrmTransaction({ id: transaction.id });
  };

  const sendPaymentHalyk = async (transaction: Transaction) => {
    setLoading(true);
    try {
      await axiosApi.post("/api/create-payment", {
        amount: transaction.amount,
        organizationId: user.publicMetadata.organizationId,
        transactionIds: [transaction.id],
        type: "halyk",
      });

      toast.success(
        `Транзакция (${transaction.amount}) отправилась на Halyk-терминал`,
      );
    } catch (error) {
      console.log(error);
      toast.error("Произошла ошибка при отправке платежа");
    }

    setLoading(false);
  };

  const sendPaymentKaspi = async (transaction: Transaction) => {
    setLoading(true);
    try {
      await axiosApi.post("/api/create-payment", {
        amount: transaction.amount,
        organizationId: user.publicMetadata.organizationId,
        transactionIds: [transaction.id],
        type: "kaspi",
      });

      toast.success(
        `Транзакция (${transaction.amount}) отправилась на Kaspi-терминал`,
      );
    } catch (error) {
      console.log(error);
      toast.error("Произошла ошибка при отправке платежа");
    }

    setLoading(false);
  };

  const handleOptionChange = (
    event: ChangeEvent<HTMLInputElement>,
    amount: string,
  ) => {
    const { name: id } = event.target;
    if (checkedTransactions.includes(id)) {
      setCheckedTransactions((prev) => prev.filter((tId) => tId !== id));
      setAmountOfTransaction((prev) => prev - Number(amount));
      return;
    }

    setCheckedTransactions((prev) => [...prev, id]);
    setAmountOfTransaction((prev) => prev + Number(amount));
  };

  const handleCommonPayment = async (type: "halyk" | "kaspi") => {
    setLoading(true);
    try {
      await axiosApi.post("/api/create-payment", {
        amount: amountOfTransactions.toString(),
        organizationId: user.publicMetadata.organizationId,
        transactionIds: checkedTransactions,
        type: type,
      });

      toast.success(
        `Транзакции на сумму (${amountOfTransactions}) отправились на ${type}-терминал`,
      );
    } catch (error) {
      console.log(error);
      toast.error("Произошла ошибка при отправке платежа");
    }

    setLoading(false);
  };

  const makeTransactionPayed = async (transaction: Transaction) => {
    setLoading(true);
    try {
      await updateCrmTransaction({
        transactionId: transaction.id,
        bankTransactionId: `by-hand-${crypto.randomUUID()}`,
      });
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
  };

  const sendToRekassa = async (transaction: Transaction) => {
    setLoading(true);

    const sendTicket = async (creds: { id: string; token: string }) => {
      const now = new Date();
      const formattedDate = formatDateToCustomObject(now);
      const price = transaction.amount.toString();

      await axiosApi.post(
        `${process.env.NEXT_PUBLIC_API_REKASSA}/api/crs/${creds.id}/tickets`,
        {
          operation: "OPERATION_SELL",
          ...formattedDate,
          domain: { type: "DOMAIN_SERVICES" },
          items: [
            {
              type: "ITEM_TYPE_COMMODITY",
              commodity: {
                name: "Позиция",
                sectionCode: "1",
                quantity: 1000,
                price: { bills: price, coins: 0 },
                sum: { bills: price, coins: 0 },
                auxiliary: [{ key: "UNIT_TYPE", value: "PIECE" }],
              },
            },
          ],
          payments: [{ type: "PAYMENT_CARD", sum: { bills: price, coins: 0 } }],
          amounts: {
            total: { bills: price, coins: 0 },
            taken: { bills: price, coins: 0 },
            change: { bills: "0", coins: 0 },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${creds.token}`,
            "X-Request-ID": crypto.randomUUID(),
          },
        },
      );
    };

    try {
      if (!rekassaCredentials?.id || !rekassaCredentials?.token) {
        toast.error(
          "Не получилось авторизоваться в Rekassa. Перейдите на страницу авторизации (Rekassa)",
        );
        return;
      }

      let creds = rekassaCredentials;

      try {
        await sendTicket(creds);
      } catch (e) {
        if (e instanceof AxiosError && e.response?.status === 401) {
          const refreshed = await refreshRekassaCredentials();
          utils.rekassa.getCredentials.invalidate();
          creds = refreshed;
          await sendTicket(creds);
        } else {
          throw e;
        }
      }

      await updateCrmTransaction({
        transactionId: transaction.id,
        sentToRekassa: true,
      });
    } catch (e) {
      if (e instanceof AxiosError) {
        if (e.response?.status === 401) {
          toast.error(
            "Не удалось авторизоваться в Rekassa. Перейдите на страницу подключения и заново подключите Rekassa.",
          );
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error(
          e instanceof Error
            ? e.message
            : "Произошла ошибка при отправке в Рекассу",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const exportTransactions = async () => {
    try {
      const filteredTransactions =
        await utils.crmTransaction.getForExport.fetch({
          startDate: exportStartDate || undefined,
          endDate: exportEndDate || undefined,
        });

      const rowsData = filteredTransactions.map((item) => {
        const meta = (item.meta || {}) as Record<string, unknown>;
        const data = (meta.data || {}) as Record<string, unknown>;
        const expense = (data.expense || {}) as Record<string, unknown>;
        const account = (data.account || {}) as Record<string, unknown>;
        const record = (data.record || {}) as Record<string, unknown>;

        const service = String(expense.title || "");
        const costWithoutDiscount =
          typeof data.amount === "number" ? data.amount : null;
        const paymentChannel = String(account.title || meta.crm || "");
        const paymentSum = Number(item.amount);
        const discountSize =
          typeof data.amount === "number" &&
          typeof record.paid_full === "number"
            ? (data.amount as number) - (record.paid_full as number)
            : null;
        const sentToOfd =
          typeof item.sentToRekassa === "boolean"
            ? item.sentToRekassa
              ? "Да"
              : "Нет"
            : "";

        return {
          service,
          costWithoutDiscount,
          paymentChannel,
          paymentSum,
          discountSize,
          sentToOfd,
        };
      });

      const columns = [
        {
          key: "service",
          label: "Услуга",
          exists: rowsData.some((row) => row.service),
        },
        {
          key: "costWithoutDiscount",
          label: "Стоимость без скидки",
          exists: rowsData.some((row) => row.costWithoutDiscount !== null),
        },
        {
          key: "paymentChannel",
          label: "Канал оплаты",
          exists: rowsData.some((row) => row.paymentChannel),
        },
        {
          key: "paymentSum",
          label: "Сумма оплаты",
          exists: rowsData.some((row) => Number.isFinite(row.paymentSum)),
        },
        {
          key: "discountSize",
          label: "Размер скидки",
          exists: rowsData.some((row) => row.discountSize !== null),
        },
        {
          key: "sentToOfd",
          label: "Отправлено в ОФД",
          exists: rowsData.some((row) => row.sentToOfd),
        },
      ].filter((column) => column.exists);

      if (columns.length === 0) {
        toast.error("Нет данных для выгрузки");
        return;
      }

      const rows: (string | number)[][] = [
        columns.map((column) => column.label),
      ];

      rowsData.forEach((row) => {
        rows.push(
          columns.map((column) => {
            const value = row[column.key as keyof typeof row];
            return value === null || value === "" ? "--" : value;
          }),
        );
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Транзакции");

      ws["!cols"] = columns.map(() => ({ wch: 24 }));

      const rangeLabel =
        exportStartDate || exportEndDate
          ? `${exportStartDate || "start"}-${exportEndDate || "end"}`
          : dayjs().format("YYYY-MM-DD");
      const fileName = `transactions_${rangeLabel}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Файл экспортирован");
    } catch (e) {
      toast.error("Ошибка при выгрузке");
    }
  };

  const handleCreateTransaction = async () => {
    const amount = newTxAmount.trim();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }
    await createCrmTransaction({
      amount,
      paymentType: newTxPaymentType,
      description: newTxDescription.trim() || undefined,
    });
  };

  const amountOfTransactionsToday = transactions.reduce((acc, item) => {
    if (dayjs(item.createdAt).isSame(dayjs(), "day")) {
      return acc + Number(item.amount);
    }
    return acc;
  }, 0);

  return (
    <div className="flex flex-col gap-8 mb-12">
      <div className="flex justify-between flex gap-4">
        <div>
          <h1 className="text-3xl">Прием оплат</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={exportStartDate}
            onChange={(event) => setExportStartDate(event.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="date"
            value={exportEndDate}
            onChange={(event) => setExportEndDate(event.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={exportTransactions}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Экспорт
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Создать
          </Button>
        </div>
      </div>

      <div className="flex justify-between">
        <div>
          <p>Сумма транзакций за сегодня: {amountOfTransactionsToday}</p>
        </div>
        {checkedTransactions.length !== 0 && (
          <div className="flex flex-col items-end gap-2">
            <span>Сумма: {amountOfTransactions}</span>
            <div className="flex justify-end gap-2">
              <Button
                className="flex w-full px-1 bg-red-600 text-white"
                variant="default"
                size="icon"
                asChild
                onClick={() => handleCommonPayment("kaspi")}
              >
                <div>Kaspi</div>
              </Button>
              <Button
                className="flex w-full px-1 bg-green-600 text-white"
                variant="default"
                size="icon"
                asChild
                onClick={() => handleCommonPayment("halyk")}
              >
                <div>Halyk</div>
              </Button>
            </div>
          </div>
        )}
      </div>

      {!isTransactionsLoading && transactions.length === 0 && (
        <div>У вас нет активных транзакций</div>
      )}

      {transactions.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead className="w-[80px]">Оплатить</TableHead>
                <TableHead className="w-[120px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((item) => (
                <TableRow
                  key={item.id}
                  className={
                    item.bankTransactionId
                      ? "bg-[#1b6b23a0] text-white hover:bg-[#1b6b23a0]"
                      : ""
                  }
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {!item.bankTransactionId && (
                          <CustomCheckbox
                            id={item.id}
                            name={item.id}
                            label=""
                            checked={checkedTransactions.includes(item.id)}
                            onChange={(e) => handleOptionChange(e, item.amount)}
                          />
                        )}
                        {item.bankTransactionId ? "Оплачено" : ""}
                      </div>
                      <p>{item.sentToRekassa ? "Отправлено в Rekassa" : ""}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {dayjs(item.createdAt).format("DD.MM.YYYY, HH:mm")}
                  </TableCell>
                  <TableCell>{formatBalance(Number(item.amount))}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <p>{`${item.meta.crm || ""} ${item.meta?.data?.expense?.title || ""}`}</p>
                      <p>{`${item.meta?.data?.account?.title || ""}`}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {!checkedTransactions.includes(item.id) && (
                      <div className="flex flex-col gap-2">
                        <Button
                          className="flex w-full px-0.5 bg-red-700 text-white"
                          variant="default"
                          size="sm"
                          asChild
                          onClick={() => sendPaymentKaspi(item)}
                        >
                          <div>Kaspi</div>
                        </Button>
                        <Button
                          className="flex w-full px-0.5 bg-green-600 text-white"
                          variant="default"
                          size="sm"
                          asChild
                          onClick={() => sendPaymentHalyk(item)}
                        >
                          <div>Halyk</div>
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-6">
                      {!item.bankTransactionId && (
                        <div className="flex">
                          <button
                            type="button"
                            className="cursor-pointer"
                            onClick={() => deleteHandler(item)}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                      {/* {item.bankTransactionId && (
                    
                  )} */}
                      <div className="flex">
                        <button
                          type="button"
                          className="cursor-pointer"
                          onClick={() => sendToRekassa(item)}
                        >
                          <ArrowRightFromLineIcon />
                        </button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalTransactions > limit && (
            <div className="flex items-center justify-between border-t px-2 py-4">
              <p className="text-sm text-muted-foreground">
                Показано {(page - 1) * limit + 1}–
                {Math.min(page * limit, totalTransactions)} из{" "}
                {totalTransactions}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Вперёд
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать транзакцию</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium mb-1">Сумма</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={newTxAmount}
                onChange={(e) => setNewTxAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Способ оплаты
              </label>
              <Select
                value={newTxPaymentType}
                onValueChange={(v) =>
                  setNewTxPaymentType(v as "cash" | "kaspi" | "halyk")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="kaspi">Kaspi</SelectItem>
                  <SelectItem value="halyk">Halyk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Описание
              </label>
              <Input
                type="text"
                placeholder="Описание транзакции (необязательно)"
                value={newTxDescription}
                onChange={(e) => setNewTxDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Отмена
            </Button>
            <Button onClick={handleCreateTransaction} disabled={isCreating}>
              {isCreating ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
