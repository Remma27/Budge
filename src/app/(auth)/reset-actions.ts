"use server";
import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isPasswordBreached } from "@/lib/auth";
import { allowAttempt, clientIp } from "@/lib/rate-limit";
import { forgotPasswordSchema, resetPasswordSchema, type ActionResult } from "@/lib/validations";

const message = "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function requestPasswordReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: "Introduce un correo válido" };
  if (!(await allowAttempt(`reset:${await clientIp()}:${parsed.data.email}`, 3, 60 * 60_000))) {
    return { ok: false, error: "Demasiados intentos, espera una hora" };
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true } });
  if (!user) return { ok: true, message };
   if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !process.env.NEXTAUTH_URL) {
    console.error("Password reset is not configured");
    return { ok: true, message };
  }
  const raw = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: digest(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
   const resetUrl = new URL("/restablecer-contrasena", process.env.NEXTAUTH_URL);
   resetUrl.searchParams.set("token", raw);
   const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [user.email], subject: "Restablece tu contraseña de Budge", html: `<p>Solicitaste restablecer tu contraseña.</p><p><a href="${resetUrl}">Restablecer contraseña</a></p><p>El enlace expira en 30 minutos.</p>` }) });
   if (!response.ok) await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash: digest(raw) } });
  return response.ok ? { ok: true, message } : { ok: false, error: "No se pudo enviar el correo. Intenta de nuevo." };
}

export async function resetPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({ token: formData.get("token"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres" };
  if (await isPasswordBreached(parsed.data.password)) return { ok: false, error: "Esa contraseña apareció en filtraciones, usa otra diferente" };
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: digest(parsed.data.token) } });
  if (!token || token.usedAt || token.expiresAt < new Date()) return { ok: false, error: "El enlace es inválido o expiró" };
  await prisma.$transaction([prisma.user.update({ where: { id: token.userId }, data: { passwordHash: await hash(parsed.data.password, 12), passwordChangedAt: new Date() } }), prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })]);
  return { ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." };
}
