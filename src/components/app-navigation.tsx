"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

const tabs = [["/", "Resumen"], ["/ingresos", "Salario e ingresos"], ["/presupuestos", "Presupuestos"], ["/recurrentes", "Recurrentes"], ["/ahorros", "Ahorros"], ["/categorias", "Categorías"], ["/calendario", "Calendario"], ["/medios-pago", "Medios de pago"], ["/moneda", "Moneda"]];

export function AppNavigation() {
  const pathname = usePathname();
  const workspaceId = useSearchParams().get("workspaceId");
  const suffix = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  const current = tabs.find(([href]) => href === pathname)?.[1] ?? "Budge";
  const links = tabs.map(([href, title]) => <Link key={href} href={`${href}${suffix}`} aria-current={pathname === href ? "page" : undefined}
    className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm ${pathname === href ? "bg-indigo-50 font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-200" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>{title}</Link>);
  return <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
    <div className="mx-auto max-w-5xl px-4 py-3">
      <div className="flex items-center justify-between gap-3"><Link href={`/${suffix}`} className="py-2 font-bold">Budge</Link><span className="min-w-0 truncate text-sm font-semibold text-indigo-800 lg:hidden">{current}</span><SignOutButton /></div>
      <nav aria-label="Navegación principal" className="hidden flex-wrap gap-1 pt-2 lg:flex">{links}</nav>
      <details key={pathname} className="mt-2 lg:hidden"><summary className="min-h-11 cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm">Secciones · {current}</summary><nav aria-label="Navegación móvil" className="mt-2 grid gap-1 sm:grid-cols-2">{links}</nav></details>
    </div>
  </header>;
}
