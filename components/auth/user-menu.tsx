"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, RefreshCw, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/db/schema/users";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: UserRole;
};

const ADMIN_ROLES: UserRole[] = ["admin", "owner"];

export function UserMenu({ user }: { user: SessionUser }) {
  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  const isAdmin = !!user.role && ADMIN_ROLES.includes(user.role);
  const [retraining, setRetraining] = useState(false);

  async function retrainWorkingCapital(e: Event, source: "static" | "tables") {
    // Prevent the dropdown from closing while the request is in-flight, so
    // the spinning state stays visible.
    e.preventDefault();
    if (retraining) return;
    setRetraining(true);
    const label = source === "tables" ? "live tables" : "static knowledge file";
    const t = toast.loading(`Retraining Working Capital KB from ${label}…`);
    try {
      const res = await fetch(
        `/api/v1/admin/working-capital/retrain?source=${source}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Retrain failed (${res.status})`);
      }
      const json = (await res.json()) as {
        inserted: number;
        deleted: number;
        unchanged: number;
        embedded: number;
        source: string;
      };
      toast.success(
        `Retrained from ${json.source}: ${json.inserted} new, ${json.deleted} removed, ${json.unchanged} unchanged, ${json.embedded} embedded.`,
        { id: t },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retrain failed", { id: t });
    } finally {
      setRetraining(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name ?? "User"} />
            ) : null}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user.name ?? "Account"}</span>
            {user.email ? (
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings">
            <UserIcon className="mr-2 h-4 w-4" /> Settings
          </a>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => retrainWorkingCapital(e, "static")}
              disabled={retraining}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${retraining ? "animate-spin" : ""}`}
              />
              {retraining ? "Retraining…" : "Retrain WC KB · static"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => retrainWorkingCapital(e, "tables")}
              disabled={retraining}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${retraining ? "animate-spin" : ""}`}
              />
              {retraining ? "Retraining…" : "Retrain WC KB · live tables"}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
