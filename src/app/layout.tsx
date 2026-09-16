import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { PwaRegister } from "@/components/pwa-register";
import { prisma } from "@/lib/prisma";
import { WorkspaceSelector } from "@/components/workspace-selector";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Budge — controla tus gastos",
  description:
    "App web open-source y gratuita para trackear gastos personales.",
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const workspaces = session?.user ? await prisma.workspace.findMany({ where: { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {session?.user && (
          <header className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-3">
              <Link href="/" className="font-bold">
                Budge
              </Link>
              {workspaces.length > 0 && <WorkspaceSelector workspaces={workspaces} />}
              <Link
                href="/categorias"
                className="text-sm text-zinc-600 hover:underline dark:text-zinc-300"
              >
                Categorías
              </Link>
              <Link href="/presupuestos" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Presupuestos</Link>
               <Link href="/recurrentes" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Recurrentes</Link>
               <Link href="/moneda" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Moneda</Link>
               <Link href="/importar" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Importar</Link>
               <Link href="/workspace" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Workspace</Link>
              <span className="flex-1" />
              <span className="hidden text-sm text-zinc-500 sm:inline">
                {session.user.email}
              </span>
              <SignOutButton />
            </nav>
          </header>
        )}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
