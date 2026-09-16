"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { register } from "../actions";
import { btnPrimaryCls, FormError, inputCls, labelCls } from "@/components/ui";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await register(fd);
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    const login = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    if (login?.error) {
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormError message={error} />
      <div>
        <label className={labelCls} htmlFor="name">
          Nombre (opcional)
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={100}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className={inputCls}
          required
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="password">
          Contraseña (mínimo 8 caracteres)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className={inputCls}
          required
        />
      </div>
      <button type="submit" className={btnPrimaryCls} disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
