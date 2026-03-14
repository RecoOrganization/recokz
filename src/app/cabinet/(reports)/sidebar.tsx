"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/ui/sidebar";
import {
  BookOpenIcon,
  FileTextIcon,
  ArrowLeftRightIcon,
  ChevronsLeftRightEllipsisIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import LogoWhite from "@/shared/icons/logo-white.svg";
import { api } from "@/shared/lib/trpc/client";
import { useClerk } from "@clerk/nextjs";

export function ReportsSidebar() {
  const { user } = useUser();
  const router = useRouter();
  const { signOut } = useClerk();

  const { mutateAsync: clearOrganization } =
    api.organization.clearOrganization.useMutation({
      onSuccess: async () => {
        await user?.reload();
        router.push("/sign-in");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  const handleResetOrganization = async () => {
    await signOut();
    router.push("/sign-in");
  };

  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <div className="p-4">
          <LogoWhite />
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/cabinet/profile">
                    <UserIcon />
                    <span>Профиль</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/cabinet">
                    <FileTextIcon />
                    <span>Сверка</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/cabinet/transactions">
                    <ArrowLeftRightIcon />
                    <span>Приём оплат</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/cabinet/connection">
                    <ChevronsLeftRightEllipsisIcon />
                    <span>Интеграции</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/cabinet/dictionary">
                    <BookOpenIcon />
                    <span>Справочники</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/cabinet/team">
                    <UsersIcon />
                    <span>Команда</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenuButton onClick={handleResetOrganization}>
          <span>Выйти</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
