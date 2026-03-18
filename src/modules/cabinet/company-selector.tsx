"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "@/shared/lib/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

type ClerkOrgMeta = {
  organizationIds?: string[];
  currentOrganizationId?: string | null;
  organizationId?: string | null;
};

export function CompanySelector() {
  const { user } = useUser();
  const router = useRouter();
  const { data: currentUser } = api.user.getCurrent.useQuery();
  const { mutateAsync: setCurrentOrganization, isPending } =
    api.organization.setCurrentOrganization.useMutation({
      onSuccess: async () => {
        await user?.reload();
        router.refresh();
      },
      onError: (e) => toast.error(e.message),
    });

  const meta = (user?.publicMetadata ?? {}) as ClerkOrgMeta;
  const organizationIds = Array.isArray(meta?.organizationIds)
    ? meta.organizationIds
    : meta?.organizationId
      ? [meta.organizationId]
      : [];
  const currentId =
    meta?.currentOrganizationId ?? meta?.organizationId ?? organizationIds[0];

  const orgs =
    currentUser?.organizations?.filter((uo) =>
      organizationIds.includes(uo.organization.id),
    ) ?? [];
  const currentOrg = orgs.find((o) => o.organization.id === currentId);

  if (organizationIds.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="truncate max-w-[180px]">
          {currentOrg?.organization.name ?? "Компания"}
        </span>
      </div>
    );
  }

  return (
    <Select
      value={currentId ?? ""}
      onValueChange={async (value) => {
        if (value && value !== currentId) {
          await setCurrentOrganization({ organizationId: value });
        }
      }}
      disabled={isPending}
    >
      <SelectTrigger className="w-[200px] gap-2" size="sm">
        <Building2 className="h-4 w-4 shrink-0" />
        <SelectValue placeholder="Компания">
          {currentOrg?.organization.name ?? currentId ?? "Выберите компанию"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {orgs.map((uo) => (
          <SelectItem key={uo.id} value={uo.organization.id}>
            {uo.organization.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
