"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { resetPassword } from "../reset-actions";
import { Card, FormError, btnPrimaryCls, inputCls, labelCls, linkCls } from "@/components/ui";
export default function ResetPasswordPage() { const token = useSearchParams().get("token") ?? ""; const [state, action, pending] = useActionState(resetPassword, { ok: true }); return <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-4"><Card><h1 className="mb-1 text-2xl font-bold">Nueva contraseña</h1><form action={action} className="grid gap-4"><input type="hidden" name="token" value={token} /><FormError message={state.ok ? null : state.error} />{state.ok && state.message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message} <Link href="/login" className={linkCls}>Iniciar sesión</Link></p> : <><div><label className={labelCls} htmlFor="password">Nueva contraseña</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" className={inputCls} required /></div><button className={btnPrimaryCls} disabled={pending}>{pending ? "Actualizando..." : "Actualizar contraseña"}</button></>}</form></Card></main>; }
