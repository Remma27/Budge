import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({ prisma: {
  user: { findUnique: vi.fn(), update: vi.fn() },
  passwordResetToken: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed-password") }));

import { requestPasswordReset, resetPassword } from "./reset-actions";

const form = (values: Record<string, string>) => {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.NEXTAUTH_URL;
});

describe("password reset actions", () => {
  it("returns a generic response for unknown or invalid emails", async () => {
    expect((await requestPasswordReset({ ok: true }, form({ email: "bad" }))).ok).toBe(false);
    prisma.user.findUnique.mockResolvedValue(null);
    expect(await requestPasswordReset({ ok: true }, form({ email: "nobody@example.com" }))).toEqual(expect.objectContaining({ ok: true }));
  });

  it("does not reveal missing mail configuration for existing users", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    const result = await requestPasswordReset({ ok: true }, form({ email: "user@example.com" }));
    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("creates and emails a token when mail is configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Budge <test@example.com>";
    process.env.NEXTAUTH_URL = "https://budge.example.com";
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect((await requestPasswordReset({ ok: true }, form({ email: "user@example.com" }))).ok).toBe(true);
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.anything());
  });

  it("removes the token when email delivery fails", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Budge <test@example.com>";
    process.env.NEXTAUTH_URL = "https://budge.example.com";
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    expect((await requestPasswordReset({ ok: true }, form({ email: "user@example.com" }))).ok).toBe(false);
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid, expired, and used tokens", async () => {
    expect((await resetPassword({ ok: true }, form({ token: "short", password: "password" }))).ok).toBe(false);
    prisma.passwordResetToken.findUnique.mockResolvedValue({ usedAt: null, expiresAt: new Date("2020-01-01"), userId: "user-1" });
    expect((await resetPassword({ ok: true }, form({ token: "a".repeat(32), password: "password" }))).ok).toBe(false);
    prisma.passwordResetToken.findUnique.mockResolvedValue({ usedAt: new Date(), expiresAt: new Date(Date.now() + 10000), userId: "user-1" });
    expect((await resetPassword({ ok: true }, form({ token: "a".repeat(32), password: "password" }))).ok).toBe(false);
  });

  it("updates the password and consumes a valid token", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: "token-1", usedAt: null, expiresAt: new Date(Date.now() + 10000), userId: "user-1" });
    expect(await resetPassword({ ok: true }, form({ token: "a".repeat(32), password: "password" }))).toEqual(expect.objectContaining({ ok: true }));
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
