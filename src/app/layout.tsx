import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
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
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session?.user && (
          <header className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-3">
              <Link href="/" className="font-bold">
                Budge
              </Link>
              <Link
                href="/categorias"
                className="text-sm text-zinc-600 hover:underline dark:text-zinc-300"
              >
                Categorías
              </Link>
              <Link href="/presupuestos" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Presupuestos</Link>
              <Link href="/recurrentes" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Recurrentes</Link>
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
