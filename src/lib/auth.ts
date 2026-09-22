import { createHash } from "node:crypto";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { allowAttempt, clientIp } from "@/lib/rate-limit";

// Hash válido para comparar cuando el usuario no existe: evita que el tiempo
// de respuesta revele qué correos están registrados (timing oracle).
const DUMMY_HASH =
  "$2b$10$mnTDTOcd1VGyP.SIshpub.HohyhH4oEcAarVCxo1Oaz1wOvoPTpUe";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Correo y contraseña",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const ip = await clientIp(req);
        if (!(await allowAttempt(`login:${ip}:${parsed.data.email}`))) {
          console.warn("login rate limit bloqueado");
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.passwordHash) {
          await compare(parsed.data.password, DUMMY_HASH);
          return null;
        }
        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      if (typeof token.id === "string") {
        const u = await prisma.user.findUnique({
          where: { id: token.id },
          select: { passwordChangedAt: true },
        });
        if (!u) {
          token.id = undefined;
          return token;
        }
        const changed = u.passwordChangedAt?.getTime() ?? 0;
        if (typeof token.pwd === "undefined") {
          // Sesión anterior a este cambio: se acepta una vez y se marca.
          token.pwd = changed;
        } else if (token.pwd !== changed) {
          // La contraseña cambió después de emitir este JWT: revocar sesión.
          token.id = undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
};

// HaveIBeenPwned (k-anonimato: solo viajan los 5 primeros chars del SHA-1).
// Fail-open y sin red en tests para mantenerlos herméticos.
export async function isPasswordBreached(password: string): Promise<boolean> {
  if (process.env.VITEST) return false;
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const res = await fetch(
      `https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return false;
    const suffix = sha1.slice(5);
    return (await res.text())
      .split("\n")
      .some((line) => line.split(":")[0]?.trim() === suffix);
  } catch {
    return false;
  }
}
