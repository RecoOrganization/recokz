import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PropsWithChildren } from "react";

export default async function RootLayout({ children }: PropsWithChildren) {
  const { sessionClaims } = await auth();

  if (sessionClaims?.metadata?.organizationId) {
    redirect("/cabinet");
  }

  return <>{children}</>;
}
