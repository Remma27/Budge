import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";
import { authOptions } from "@/lib/auth";
import { AppNavigation } from "@/components/app-navigation";
import { PwaRegister } from "@/components/pwa-register";
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
  icons: {
    icon: [{ url: "/icon-192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-192.svg", type: "image/svg+xml" }],
  },
  appleWebApp: { capable: true, title: "Budge", statusBarStyle: "default" },
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
        <PwaRegister />
        {session?.user && <Suspense fallback={<div className="border-b p-4 font-bold">Budge</div>}><AppNavigation /></Suspense>}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
