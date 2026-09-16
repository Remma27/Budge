import Link from "next/link";
import { RegisterForm } from "./form";
import { Card, linkCls } from "@/components/ui";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-4">
      <Card>
        <h1 className="mb-1 text-2xl font-bold">Crea tu cuenta</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Gratis y open-source, tus datos son tuyos
        </p>
        <RegisterForm />
        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          ¿Ya tienes cuenta? <Link href="/login" className={linkCls}>Entra</Link>
        </p>
      </Card>
    </main>
  );
}
