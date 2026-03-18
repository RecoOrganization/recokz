"use client";

import { CabinetChatPanel } from "@/modules/cabinet/cabinet-chat-panel";
import { CabinetTopNav } from "./cabinet-top-nav";

export function CabinetLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <CabinetChatPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <CabinetTopNav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
