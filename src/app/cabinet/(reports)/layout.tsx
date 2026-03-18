import { CreateReport } from "@/modules/reports/create-report";
import { CabinetLayoutClient } from "./cabinet-layout-client";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CabinetLayoutClient>
      {children}
      <CreateReport />
    </CabinetLayoutClient>
  );
}
