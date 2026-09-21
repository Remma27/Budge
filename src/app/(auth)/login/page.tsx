import Link from "next/link";
import { LoginForm } from "./form";
import { Card, linkCls } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-4">
      <Card>
        <h1 className="mb-1 text-2xl font-bold">Budge</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Entra para ver tus gastos
        </p>
        <LoginForm />
        <p className="mt-4 text-center text-sm"><Link href="/recuperar-contrasena" className={linkCls}>¿Olvidaste tu contraseña?</Link></p>
        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          ¿Sin cuenta? <Link href="/register" className={linkCls}>Regístrate</Link>
        </p>
      </Card>
    </main>
  );
}
