"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  BookOpenIcon,
  FileTextIcon,
  ArrowLeftRightIcon,
  ChevronsLeftRightEllipsisIcon,
  UserIcon,
  UsersIcon,
  LayoutDashboardIcon,
  LogOutIcon,
} from "lucide-react";
import LogoWhite from "@/shared/icons/logo-white.svg";
import { api } from "@/shared/lib/trpc/client";
import { CompanySelector } from "@/modules/cabinet/company-selector";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

const navLinks = [
  { href: "/cabinet/profile", icon: UserIcon, label: "Профиль" },
  { href: "/cabinet/dashboard", icon: LayoutDashboardIcon, label: "Дашборд" },
  { href: "/cabinet", icon: FileTextIcon, label: "Сверка" },
  {
    href: "/cabinet/transactions",
    icon: ArrowLeftRightIcon,
    label: "Приём оплат",
  },
  {
    href: "/cabinet/connection",
    icon: ChevronsLeftRightEllipsisIcon,
    label: "Интеграции",
  },
  { href: "/cabinet/dictionary", icon: BookOpenIcon, label: "Справочники" },
  { href: "/cabinet/team", icon: UsersIcon, label: "Команда" },
];

export function CabinetTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  const { mutateAsync: clearOrganization } =
    api.organization.clearOrganization.useMutation({
      onSuccess: async () => {
        await user?.reload();
        router.push("/sign-in");
      },
      onError: (err) => toast.error(err.message),
    });

  const handleLogout = async () => {
    await clearOrganization();
    await signOut();
    router.push("/sign-in");
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4">
      <Link href="/cabinet" className="flex items-center gap-2 shrink-0">
        <LogoWhite className="h-8 w-22" />
      </Link>
      <nav className="flex items-center gap-1">
        {navLinks.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 text-muted-foreground hover:text-foreground",
                pathname === href && "bg-muted text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <CompanySelector />
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOutIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      </div>
    </header>
  );
}
