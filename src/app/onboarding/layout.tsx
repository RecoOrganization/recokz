import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PropsWithChildren } from "react";

export default async function RootLayout({ children }: PropsWithChildren) {
  const { sessionClaims } = await auth();

  const meta = sessionClaims?.metadata as
    | { organizationIds?: string[]; organizationId?: string }
    | undefined;
  const hasOrg =
    (Array.isArray(meta?.organizationIds) && meta.organizationIds.length > 0) ||
    meta?.organizationId;
  if (hasOrg) redirect("/cabinet");

  return <>{children}</>;
}
