"use client";

import { signOut } from "next-auth/react";
import { btnGhostCls } from "@/components/ui";

export function SignOutButton() {
  return (
    <button
      type="button"
      className={btnGhostCls}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Salir
    </button>
  );
}
