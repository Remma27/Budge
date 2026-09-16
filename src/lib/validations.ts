import { z } from "zod";

// ponytail: regex propia en vez de z.email() para no depender de la API de cada versión de zod.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().max(254).refine((v) => EMAIL_RE.test(v)),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().max(254).refine((v) => EMAIL_RE.test(v)),
  password: z.string().min(1).max(128),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
});

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/)
    .refine((v) => {
      const n = Number(v);
      return n > 0 && n <= 9999999999.99;
    }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .default("MXN"),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => !Number.isNaN(Date.parse(v))),
  note: z.string().trim().max(280).optional(),
  categoryId: z.string().trim().min(1).optional(),
});

export const budgetSchema = z.object({
  categoryId: z.string().trim().min(1),
  amount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/).refine((v) => Number(v) > 0),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("MXN"),
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export const recurringSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]), amount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/).refine((v) => Number(v) > 0),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("MXN"), frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  nextRun: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().trim().max(280).optional(), categoryId: z.string().trim().min(1).optional(),
});

// Mensajes en español por campo (evita depender de los mensajes internos de zod).
const FIELD_MESSAGES: Record<string, string> = {
  name: "Nombre inválido (máx. 60 caracteres)",
  color: "Color inválido",
  email: "Correo inválido",
  password: "Contraseña inválida (mínimo 8 caracteres)",
  type: "Tipo inválido",
  amount: "Monto inválido (ej. 150.50)",
  currency: "Moneda de 3 letras (ej. MXN)",
  date: "Fecha inválida",
  note: "Nota muy larga (máx. 280 caracteres)",
  categoryId: "Categoría inválida",
};

export function firstError(
  error: z.ZodError,
  fallback = "Revisa los datos e intenta de nuevo",
): string {
  const field = String(error.issues[0]?.path[0] ?? "");
  return FIELD_MESSAGES[field] ?? fallback;
}

export function emptyToUndefined(
  v: FormDataEntryValue | null,
): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
