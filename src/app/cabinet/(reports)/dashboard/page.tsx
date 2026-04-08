"use client";

import { api } from "@/shared/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Typography } from "@/shared/ui/typography";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";
import { Button } from "@/shared/ui/button";

export default function DashboardPage() {
  const { data: stats, isLoading } = api.dashboard.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-24 w-full max-w-sm" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const chartColor = "hsl(var(--chart-1))";

  return (
    <div className="p-6 space-y-6">
      <div>
        <Typography size="h3-med">Дашборд</Typography>
        <Typography size="body-16" color="gray-200" className="mt-2">
          Статистика транзакций
        </Typography>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/cabinet/dashboard/bank/kaspi">Выписка — Kaspi</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/cabinet/dashboard/bank/halyk">Выписка — Halyk</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Транзакции за сегодня</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">
                {stats?.transactionsTodayCount ?? 0}
              </span>
              <Typography size="body-14" color="gray-200">
                шт.
              </Typography>
            </div>
            <Typography size="body-14" color="gray-200" className="mt-2">
              Сумма:{" "}
              <span className="font-medium text-foreground">
                {(stats?.transactionsTodaySum ?? 0).toLocaleString("ru-KZ")} ₸
              </span>
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сумма по дням</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.sumByDays && stats.sumByDays.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.sumByDays.map((d) => ({
                      ...d,
                      label: format(new Date(d.date), "d MMM", { locale: ru }),
                    }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={(v) =>
                        v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${v}`
                      }
                    />
                    <Tooltip
                      formatter={(value: unknown) => [
                        `${Number(value ?? 0).toLocaleString("ru-KZ")} ₸`,
                        "Сумма",
                      ]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.date
                          ? format(
                              new Date(payload[0].payload.date),
                              "d MMMM yyyy",
                              { locale: ru },
                            )
                          : ""
                      }
                    />
                    <Bar dataKey="sum" radius={[4, 4, 0, 0]} name="Сумма">
                      {stats.sumByDays.map((_, i) => (
                        <Cell key={i} fill={chartColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Typography size="body-14" color="gray-200">
                Нет данных за последние 14 дней
              </Typography>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
