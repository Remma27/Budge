"use server";

import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isPasswordBreached } from "@/lib/auth";
import {
  emptyToUndefined,
  firstError,
  registerSchema,
  type ActionResult,
} from "@/lib/validations";
import { allowAttempt, clientIp } from "@/lib/rate-limit";

const DEFAULT_CATEGORIES = [
  { name: "Comida", color: "#f59e0b" },
  { name: "Transporte", color: "#3b82f6" },
  { name: "Vivienda", color: "#8b5cf6" },
  { name: "Salud", color: "#ef4444" },
  { name: "Ocio", color: "#ec4899" },
  { name: "Otros", color: "#6b7280" },
];

export async function register(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: emptyToUndefined(formData.get("name")),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!(await allowAttempt(`register:${await clientIp()}:${parsed.data.email}`, 5, 60 * 60_000))) {
    return { ok: false, error: "Demasiados intentos, espera una hora" };
  }
  if (await isPasswordBreached(parsed.data.password)) {
    return { ok: false, error: "Esa contraseña apareció en filtraciones, usa otra diferente" };
  }

  const passwordHash = await hash(parsed.data.password, 12);
  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        passwordHash,
        categories: { create: DEFAULT_CATEGORIES },
      },
    });
    return { ok: true };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Ese correo ya está registrado, inicia sesión" };
    }
    return { ok: false, error: "No se pudo crear la cuenta, intenta de nuevo" };
  }
}
