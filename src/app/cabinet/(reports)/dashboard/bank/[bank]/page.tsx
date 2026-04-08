import { notFound } from "next/navigation";
import { BankStatementBrowser } from "@/modules/dashboard/bank-statement";

function toBankEnum(param: string): "Kaspi" | "Halyk" | null {
  if (param === "kaspi") return "Kaspi";
  if (param === "halyk") return "Halyk";
  return null;
}

export default async function BankStatementPage({
  params,
}: {
  params: Promise<{ bank: string }>;
}) {
  const { bank: raw } = await params;
  const bank = toBankEnum(raw.toLowerCase());
  if (!bank) notFound();

  return <BankStatementBrowser bank={bank} />;
}
