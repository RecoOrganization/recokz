"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { toast } from "sonner";
import { Building2, Loader2, ChevronsUpDown } from "lucide-react";

type ClerkOrgMeta = {
  organizationIds?: string[];
  currentOrganizationId?: string | null;
  organizationId?: string | null;
};

export function CompanySelector() {
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentUser } = api.user.getCurrent.useQuery();
  const { mutateAsync: setCurrentOrganization, isPending } =
    api.organization.setCurrentOrganization.useMutation({
      onSuccess: async () => {
        await user?.reload();
        await queryClient.invalidateQueries();
        router.refresh();
      },
      onError: (e) => toast.error(e.message),
    });

  const meta = (user?.publicMetadata ?? {}) as ClerkOrgMeta;
  const currentId =
    meta?.currentOrganizationId ?? meta?.organizationId ?? undefined;

  const orgs = currentUser?.organizations ?? [];
  const currentOrg = orgs.find((o) => o.organization.id === currentId);

  if (orgs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="truncate max-w-[180px]">Нет компании</span>
      </div>
    );
  }

  if (orgs.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="truncate max-w-[180px]">
          {orgs[0].organization.name}
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
          toast.success(
            `Компания изменена на «${orgs.find((o) => o.organization.id === value)?.organization.name ?? "выбранную"}»`,
          );
        }
      }}
      disabled={isPending}
    >
      <SelectTrigger className="w-[220px] gap-2" size="sm">
        {isPending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Building2 className="h-4 w-4 shrink-0" />
        )}
        <SelectValue placeholder="Выберите компанию">
          {isPending
            ? "Переключение…"
            : (currentOrg?.organization.name ?? "Выберите компанию")}
        </SelectValue>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
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
