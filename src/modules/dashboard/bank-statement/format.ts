export function formatAmountKopecks(kopecks: number) {
  return (kopecks / 100).toLocaleString("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 2,
  });
}

export function formatTxDate(date: Date | string) {
  return new Date(date).toLocaleString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
