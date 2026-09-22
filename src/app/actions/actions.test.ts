import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({ prisma: {
  transaction: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  category: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  paymentMethod: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  recurringRule: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  recurringRun: { createMany: vi.fn() },
  budget: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  exchangeRate: { upsert: vi.fn(), deleteMany: vi.fn() },
  user: { update: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  workspace: { update: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  workspaceMember: { updateMany: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
  workspaceInvitation: { updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  savingsGoal: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  savingsContribution: { create: vi.fn() },
  $transaction: vi.fn(),
} }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/get-user", () => ({ requireUserId: vi.fn(async () => "user-1") }));
vi.mock("@/lib/workspace", () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  createInvitationToken: () => "test-token",
  hashInvitationToken: (token: string) => `hash:${token}`,
  getActionWorkspace: vi.fn(async (_userId: string, workspaceId?: string) => workspaceId || null),
  scopeWorkspace: vi.fn((userId: string, workspaceId: string | null) => ({ userId, workspaceId })),
  requireWorkspaceRole: vi.fn(),
}));

import { createCategory, renameCategory, deleteCategory } from "./categories";
import { createTransaction, importTransactions } from "./transactions";
import { updateTransaction, deleteTransaction } from "./transactions";
import { generateDueRecurring } from "@/lib/recurring";
import { createBudget } from "./budgets";
import { updatePrimaryCurrency, upsertExchangeRate, deleteExchangeRate } from "./currency";
import { createPaymentMethod, updatePaymentMethod } from "./payment-methods";
import { createSavings, addContribution, deleteSavings } from "./savings";
import { deleteBudget } from "./budgets";
import { createWorkspace, deleteWorkspace, updateWorkspaceMember, removeWorkspaceMember, leaveWorkspace, createInvitation, revokeInvitation, acceptInvitation, migratePersonalData } from "./workspaces";
import { WorkspaceRole } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { deletePaymentMethod } from "./payment-methods";
import { createRecurring, updateRecurring, toggleRecurring, deleteRecurring, generateDueRecurring as generateRecurringAction } from "./recurring";

const form = (values: Record<string, string>) => {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.category.findFirst.mockResolvedValue({ id: "cat-1" });
  prisma.paymentMethod.findFirst.mockResolvedValue({ id: "pay-1" });
  prisma.paymentMethod.updateMany.mockResolvedValue({ count: 1 });
  prisma.budget.findFirst.mockResolvedValue({ id: "budget-1" });
  prisma.savingsGoal.findFirst.mockResolvedValue({ id: "goal-1" });
  prisma.transaction.findFirst.mockResolvedValue({ id: "tx-1", userId: "user-1", workspaceId: null });
  prisma.recurringRule.findFirst.mockResolvedValue({ id: "rule-1", isActive: true });
  prisma.recurringRule.updateMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockResolvedValue([]);
});

describe("transaction actions", () => {
  it("creates a valid transaction in the requested workspace", async () => {
    const result = await createTransaction({ ok: true }, form({ type: "EXPENSE", amount: "12.50", currency: "USD", date: "2026-09-21", categoryId: "cat-1", paymentMethodId: "pay-1", workspaceId: "ws-1" }));
    expect(result).toEqual({ ok: true });
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", workspaceId: "ws-1", amount: "12.50" }) }));
  });

  it("rejects invalid transaction input before writing", async () => {
    const result = await createTransaction({ ok: true }, form({ type: "EXPENSE", amount: "-1", date: "nope" }));
    expect(result.ok).toBe(false);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("rejects a category outside the current scope", async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    const result = await createTransaction({ ok: true }, form({ type: "EXPENSE", amount: "1", date: "2026-09-21", categoryId: "other" }));
    expect(result).toEqual({ ok: false, error: "Categoría inválida" });
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("imports valid rows and rejects an invalid row without inserting it", async () => {
    const result = await importTransactions([{ type: "INCOME", amount: "50", currency: "CRC", date: "2026-09-21" }]);
    expect(result).toEqual({ ok: true });
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    prisma.paymentMethod.findFirst.mockResolvedValue(null);
    expect(await createTransaction({ ok: true }, form({ type: "EXPENSE", amount: "1", date: "2026-09-21", paymentMethodId: "bad" }))).toEqual({ ok: false, error: "Medio de pago inválido" });
    expect((await importTransactions([])).ok).toBe(false);
    prisma.category.findFirst.mockResolvedValue(null);
    expect(await importTransactions([{ type: "INCOME", amount: "50", currency: "CRC", date: "2026-09-21", categoryId: "bad" }])).toEqual({ ok: false, error: "Categoría inválida" });
    const invalid = await importTransactions([{ type: "INCOME", amount: "0", currency: "CRC", date: "2026-09-21" }]);
    expect(invalid.ok).toBe(false);
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
  });
});

describe("category actions", () => {
  it("creates a category with the default color", async () => {
    const result = await createCategory({ ok: true }, form({ name: "Comida", workspaceId: "" }));
    expect(result).toEqual({ ok: true });
    expect(prisma.category.create).toHaveBeenCalledWith({ data: { userId: "user-1", workspaceId: null, name: "Comida", color: "#6366f1" } });
  });

  it("does not rename a category outside the current scope", async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    const result = await renameCategory("missing", { ok: true }, form({ name: "Nuevo" }));
    expect(result).toEqual({ ok: false, error: "Categoría no encontrada" });
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("renames and deletes an owned category", async () => {
    expect(await renameCategory("cat-1", { ok: true }, form({ name: "Hogar" }))).toEqual({ ok: true });
    await deleteCategory("cat-1");
    expect(prisma.category.update).toHaveBeenCalled();
    expect(prisma.category.delete).toHaveBeenCalled();
  });

  it("returns friendly duplicate and persistence errors for categories", async () => {
    prisma.category.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
    expect(await createCategory({ ok: true }, form({ name: "Comida" }))).toEqual({ ok: false, error: "Ya tienes una categoría con ese nombre" });
    prisma.category.update.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
    expect(await renameCategory("cat-1", { ok: true }, form({ name: "Comida" }))).toEqual({ ok: false, error: "Ya tienes una categoría con ese nombre" });
    prisma.category.create.mockRejectedValueOnce(new Error("database"));
    expect(await createCategory({ ok: true }, form({ name: "Otra" }))).toEqual({ ok: false, error: "No se pudo crear la categoría" });
    prisma.category.update.mockRejectedValueOnce(new Error("database"));
    expect(await renameCategory("cat-1", { ok: true }, form({ name: "Otra" }))).toEqual({ ok: false, error: "No se pudo guardar la categoría" });
    expect((await createCategory({ ok: true }, form({ name: "" }))).ok).toBe(false);
    expect((await renameCategory("cat-1", { ok: true }, form({ name: "" }))).ok).toBe(false);
    prisma.category.findFirst.mockResolvedValue(null);
    await deleteCategory("missing");
  });
});

describe("recurring generation", () => {
  it("creates every overdue occurrence and advances the rule beyond now", async () => {
    const now = new Date("2026-09-21T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const rule = { id: "rule-1", userId: "user-1", workspaceId: null, type: "EXPENSE", amount: "10", currency: "CRC", frequency: "MONTHLY", nextRun: new Date("2026-07-21T12:00:00.000Z"), note: "Internet", categoryId: "cat-1", paymentMethodId: "pay-1" };
    prisma.recurringRule.findMany.mockResolvedValue([rule]);
    prisma.recurringRun.createMany.mockResolvedValue({ count: 1 });
    const result = await generateDueRecurring("user-1");
    expect(result).toBe(3);
    expect(prisma.transaction.create).toHaveBeenCalledTimes(3);
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentMethodId: "pay-1" }) }));
    expect(prisma.recurringRule.update).toHaveBeenCalledWith(expect.objectContaining({ data: { nextRun: new Date("2026-10-21T12:00:00.000Z") } }));
    vi.useRealTimers();
  });

  it("does not duplicate an occurrence when the run already exists", async () => {
    const now = new Date("2026-09-21T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const rule = { id: "rule-2", userId: "user-1", workspaceId: null, type: "EXPENSE", amount: "10", currency: "CRC", frequency: "MONTHLY", nextRun: new Date("2026-09-21T12:00:00.000Z"), note: null, categoryId: null, paymentMethodId: null };
    prisma.recurringRule.findMany.mockResolvedValue([rule]);
    prisma.recurringRun.createMany.mockResolvedValue({ count: 0 });
    expect(await generateDueRecurring("user-1")).toBe(0);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("advances yearly rules after generating their overdue occurrence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T12:00:00.000Z"));
    prisma.recurringRule.findMany.mockResolvedValue([{ id: "rule-year", userId: "user-1", workspaceId: null, type: "EXPENSE", amount: "10", currency: "CRC", frequency: "YEARLY", nextRun: new Date("2025-09-21T12:00:00.000Z"), note: null, categoryId: null, paymentMethodId: null }]);
    prisma.recurringRun.createMany.mockResolvedValue({ count: 1 });
    await generateDueRecurring("user-1");
    expect(prisma.recurringRule.update).toHaveBeenCalledWith(expect.objectContaining({ data: { nextRun: new Date("2027-09-21T12:00:00.000Z") } }));
    vi.useRealTimers();
    prisma.recurringRule.findMany.mockResolvedValue([{ id: "rule-week", userId: "user-1", workspaceId: null, type: "EXPENSE", amount: "10", currency: "CRC", frequency: "WEEKLY", nextRun: new Date("2026-09-20T12:00:00.000Z"), note: null, categoryId: null, paymentMethodId: null }]);
    prisma.recurringRun.createMany.mockResolvedValue({ count: 1 });
    await generateDueRecurring("user-1");
  });
});

describe("remaining financial actions", () => {
  it("assigns a category to a recurring rule and refuses missing records", async () => {
    const values = { type: "EXPENSE", amount: "25000", currency: "CRC", frequency: "BIWEEKLY", nextRun: "2026-10-01", categoryId: "cat-1" };
    expect(await updateRecurring("rule-1", { ok: true }, form(values))).toEqual({ ok: true });
    expect(prisma.recurringRule.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "rule-1", userId: "user-1", workspaceId: null }, data: expect.objectContaining({ categoryId: "cat-1", frequency: "BIWEEKLY" }) }));
    prisma.recurringRule.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await updateRecurring("missing", { ok: true }, form(values))).ok).toBe(false);
  });

  it("creates savings without a target or date and validates optional fields", async () => {
    expect(await createSavings({ ok: true }, form({ name: "Reserva", target: "", targetDate: "", frequency: "MONTHLY" }))).toEqual({ ok: true });
    expect(prisma.savingsGoal.create).toHaveBeenCalledWith({ data: { userId: "user-1", workspaceId: null, name: "Reserva", target: null, targetDate: null, frequency: "MONTHLY", currency: "CRC", balance: "0" } });
    prisma.savingsGoal.create.mockClear();
    const invalidInputs: Record<string, string>[] = [{ frequency: "OTHER" }, { targetDate: "2026-02-30" }, { initialAmount: "-1" }];
    for (const invalid of invalidInputs) {
      expect((await createSavings({ ok: true }, form({ name: "Reserva", ...invalid }))).ok).toBe(false);
    }
    expect(prisma.savingsGoal.create).not.toHaveBeenCalled();
  });
  it("creates a budget only for an existing category", async () => {
    const result = await createBudget({ ok: true }, form({ categoryId: "cat-1", amount: "100", currency: "CRC", month: "2026-09" }));
    expect(result).toEqual({ ok: true });
    expect(prisma.budget.create).toHaveBeenCalled();
    expect((await createBudget({ ok: true }, form({ categoryId: "", amount: "0", month: "bad" }))).ok).toBe(false);
    prisma.category.findFirst.mockResolvedValue(null);
    expect(await createBudget({ ok: true }, form({ categoryId: "bad", amount: "100", month: "2026-09" }))).toEqual({ ok: false, error: "Categoría inválida" });
    prisma.category.findFirst.mockResolvedValue({ id: "cat-1" });
    prisma.budget.create.mockRejectedValueOnce(new Error("duplicate"));
    expect(await createBudget({ ok: true }, form({ categoryId: "cat-1", amount: "100", month: "2026-09" }))).toEqual({ ok: false, error: "Ya existe ese presupuesto" });
  });

  it("updates the user currency and upserts exchange rates", async () => {
    expect(await updatePrimaryCurrency({ ok: true }, form({ primaryCurrency: "USD" }))).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { primaryCurrency: "USD" } }));
    expect(await upsertExchangeRate({ ok: true }, form({ from: "USD", to: "CRC", rate: "500" }))).toEqual({ ok: true });
    expect(prisma.exchangeRate.upsert).toHaveBeenCalled();
    expect(await updatePrimaryCurrency({ ok: true }, form({ primaryCurrency: "XXXX" }))).toEqual({ ok: false, error: "Moneda principal inválida" });
    expect((await upsertExchangeRate({ ok: true }, form({ from: "USD", to: "CRC", rate: "0" }))).ok).toBe(false);
    expect(await updatePrimaryCurrency({ ok: true }, form({ primaryCurrency: "USD", workspaceId: "ws-1" }))).toEqual({ ok: true });
  });

  it("creates payment methods and rejects invalid card dates", async () => {
    expect(await createPaymentMethod({ ok: true }, form({ name: "Visa", type: "CREDIT_CARD", creditLimit: "1000", closingDay: "15", paymentDay: "25" }))).toEqual({ ok: true });
    expect(prisma.paymentMethod.create).toHaveBeenCalled();
    expect(await createPaymentMethod({ ok: true }, form({ name: "Visa", type: "CREDIT_CARD", closingDay: "32" }))).toEqual({ ok: false, error: "Datos de tarjeta inválidos" });
    expect(await createPaymentMethod({ ok: true }, form({ name: "", type: "UNKNOWN" }))).toEqual({ ok: false, error: "Medio de pago inválido" });
  });

  it("updates a payment method inside its scope and rejects bad payloads", async () => {
    const payload = { id: "pay-1", name: "Visa", type: "CREDIT_CARD", openingBalance: "-500", creditLimit: "200000", closingDay: "10", paymentDay: "20" };
    expect(await updatePaymentMethod({ ok: true }, form(payload))).toEqual({ ok: true });
    expect(prisma.paymentMethod.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "pay-1", userId: "user-1" }),
      data: expect.objectContaining({ name: "Visa", creditLimit: 200000, openingBalance: -500, closingDay: 10, paymentDay: 20 }),
    }));
    prisma.paymentMethod.updateMany.mockResolvedValue({ count: 0 });
    expect(await updatePaymentMethod({ ok: true }, form({ ...payload, id: "missing" }))).toEqual({ ok: false, error: "Medio de pago inválido" });
    expect(await updatePaymentMethod({ ok: true }, form({ name: "Visa", type: "DEBIT" }))).toEqual({ ok: false, error: "Medio de pago inválido" });
    expect(await updatePaymentMethod({ ok: true }, form({ ...payload, openingBalance: "bad" }))).toEqual({ ok: false, error: "Datos de tarjeta inválidos" });
    expect(await createPaymentMethod({ ok: true }, form({ name: "Efectivo", type: "CASH", openingBalance: "bad" }))).toEqual({ ok: false, error: "Datos de tarjeta inválidos" });
  });

  it("creates savings goals and contributions only for valid goals", async () => {
    expect(await createSavings({ ok: true }, form({ name: "Fondo", target: "1000", currency: "CRC" }))).toEqual({ ok: true });
    expect(await addContribution("goal-1", { ok: true }, form({ amount: "50", note: "Aporte" }))).toEqual({ ok: true });
    expect(prisma.savingsContribution.create).toHaveBeenCalled();
    expect(await addContribution("missing", { ok: true }, form({ amount: "0" }))).toEqual({ ok: false, error: "Aporte inválido" });
    expect((await createSavings({ ok: true }, form({ name: "", target: "0", currency: "bad" }))).ok).toBe(false);
    prisma.savingsGoal.findFirst.mockResolvedValue(null);
    expect(await addContribution("missing", { ok: true }, form({ amount: "50" }))).toEqual({ ok: false, error: "Aporte inválido" });
    expect(await createSavings({ ok: true }, form({ name: "Fondo", target: "1000", currency: "CRC", targetDate: "2026-12-01" }))).toEqual({ ok: true });
    expect(await addContribution("goal-1", { ok: true }, form({ amount: "bad" }))).toEqual({ ok: false, error: "Aporte inválido" });
  });

  it("enforces workspace ownership and normalizes invitation email", async () => {
    prisma.workspace.create.mockResolvedValue({ id: "ws-1" });
    expect(await createWorkspace(" Casa ")).toEqual({ id: "ws-1" });
    await expect(createWorkspace("   ")).rejects.toThrow("El nombre es obligatorio");
    prisma.workspace.findUnique.mockResolvedValue({ ownerId: "user-1" });
    await deleteWorkspace("ws-1");
    await updateWorkspaceMember("ws-1", "user-2", WorkspaceRole.EDITOR);
    prisma.workspaceInvitation.create.mockResolvedValue({ id: "inv-1" });
    const invitation = await createInvitation("ws-1", " PERSON@EXAMPLE.COM ");
    expect(invitation.url).toContain("token=");
    expect(prisma.workspaceInvitation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "person@example.com", role: WorkspaceRole.VIEWER }) }));
    prisma.workspace.findUnique.mockResolvedValue(null);
    await expect(deleteWorkspace("missing")).rejects.toThrow("No tienes permiso");
  });

  it("prevents the owner from leaving a workspace", async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: WorkspaceRole.OWNER });
    await expect(leaveWorkspace("ws-1")).rejects.toThrow("El propietario no puede abandonar");
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    await expect(leaveWorkspace("missing")).rejects.toThrow("El propietario no puede abandonar");
  });

  it("manages members and invitations through their lifecycle", async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: WorkspaceRole.EDITOR });
    await leaveWorkspace("ws-1");
    await removeWorkspaceMember("ws-1", "user-2");
    prisma.workspaceInvitation.findUnique.mockResolvedValue({ id: "inv-1", workspaceId: "ws-1" });
    await revokeInvitation("inv-1");
    prisma.workspaceInvitation.findUnique.mockResolvedValue({ id: "inv-1", workspaceId: "ws-1", email: "user@example.com", role: WorkspaceRole.VIEWER, acceptedAt: null, expiresAt: new Date(Date.now() + 10000) });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ email: "user@example.com" });
    await acceptInvitation("token");
    expect(prisma.workspaceMember.delete).toHaveBeenCalled();
    expect(prisma.workspaceInvitation.update).toHaveBeenCalled();
    await expect(updateWorkspaceMember("ws-1", "user-2", WorkspaceRole.OWNER)).rejects.toThrow("No puedes asignar");
    prisma.workspaceInvitation.findUnique.mockResolvedValue(null);
    await revokeInvitation("missing");
    await expect(createInvitation("ws-1", " ")).rejects.toThrow("Invitación inválida");
    await expect(createInvitation("ws-1", "a@b.com", WorkspaceRole.OWNER)).rejects.toThrow("Invitación inválida");
    prisma.workspaceInvitation.findUnique.mockResolvedValue(null);
    await expect(acceptInvitation("missing")).rejects.toThrow("Invitación inválida");
    prisma.workspaceInvitation.findUnique.mockResolvedValue({ id: "inv-1", workspaceId: "ws-1", email: "other@example.com", role: WorkspaceRole.VIEWER, acceptedAt: null, expiresAt: new Date(Date.now() + 10000) });
    await expect(acceptInvitation("token")).rejects.toThrow("no corresponde");
  });

  it("updates, deletes, and imports transaction records safely", async () => {
    await updateTransaction("tx-1", { ok: true }, form({ type: "EXPENSE", amount: "20", date: "2026-09-21" }));
    await deleteTransaction("tx-1");
    await deleteBudget("budget-1");
    await deleteExchangeRate("rate-1");
    await deletePaymentMethod("pay-1");
    await deleteSavings("goal-1");
    expect(prisma.transaction.update).toHaveBeenCalled();
    expect(prisma.transaction.delete).toHaveBeenCalled();
  });

  it("creates, updates, toggles, and deletes recurring rules", async () => {
    const values = { type: "EXPENSE", amount: "20", currency: "CRC", frequency: "MONTHLY", nextRun: "2026-10-01", note: "Servicio" };
    expect(await createRecurring({ ok: true }, form(values))).toEqual({ ok: true });
    expect(await updateRecurring("rule-1", { ok: true }, form(values))).toEqual({ ok: true });
    await toggleRecurring("rule-1");
    await deleteRecurring("rule-1");
    expect(prisma.recurringRule.create).toHaveBeenCalled();
    expect(prisma.recurringRule.updateMany).toHaveBeenCalled();
    expect(prisma.recurringRule.deleteMany).toHaveBeenCalled();
    expect((await createRecurring({ ok: true }, form({ type: "BAD", amount: "0", frequency: "BAD", nextRun: "nope" }))).ok).toBe(false);
    expect(await createRecurring({ ok: true }, form({ type: "EXPENSE", amount: "20", frequency: "MONTHLY", nextRun: "2026-10-01", chargeDay: "32" }))).toEqual({ ok: false, error: "Día de cobro inválido" });
    prisma.category.findFirst.mockResolvedValue(null);
    expect(await updateRecurring("rule-1", { ok: true }, form({ type: "EXPENSE", amount: "20", frequency: "MONTHLY", nextRun: "2026-10-01", categoryId: "bad" }))).toEqual({ ok: false, error: "Categoría inválida" });
  });

  it("rejects missing transaction and recurring records during updates", async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);
    expect((await updateTransaction("missing", { ok: true }, form({ type: "EXPENSE", amount: "20", date: "2026-10-01" }))).ok).toBe(false);
    prisma.recurringRule.findFirst.mockResolvedValue(null);
    await toggleRecurring("missing");
    prisma.transaction.findFirst.mockResolvedValue({ id: "tx-1", userId: "user-1", workspaceId: null });
    prisma.category.findFirst.mockResolvedValue(null);
    expect(await updateTransaction("tx-1", { ok: true }, form({ type: "EXPENSE", amount: "20", date: "2026-10-01", categoryId: "bad" }))).toEqual({ ok: false, error: "Categoría inválida" });
    prisma.transaction.findFirst.mockResolvedValue({ id: "tx-1", userId: "user-1", workspaceId: null });
    prisma.category.findFirst.mockResolvedValue({ id: "cat-1" });
    prisma.paymentMethod.findFirst.mockResolvedValue(null);
    expect(await updateTransaction("tx-1", { ok: true }, form({ type: "EXPENSE", amount: "20", date: "2026-10-01", paymentMethodId: "bad" }))).toEqual({ ok: false, error: "Medio de pago inválido" });
    prisma.paymentMethod.findFirst.mockResolvedValue({ id: "pay-1" });
    prisma.transaction.findFirst.mockResolvedValue({ id: "tx-1", userId: "user-1", workspaceId: "ws-1" });
    await deleteTransaction("tx-1");
    prisma.paymentMethod.findFirst.mockResolvedValue(null);
    expect(await importTransactions([{ type: "INCOME", amount: "50", currency: "CRC", date: "2026-09-21", paymentMethodId: "bad" }])).toEqual({ ok: false, error: "Medio de pago inválido" });
  });

  it("migrates personal categories and linked records into a workspace", async () => {
    const tx = {
      category: { findMany: vi.fn().mockResolvedValue([{ id: "old-cat", name: "Comida", color: "#fff" }]), upsert: vi.fn().mockResolvedValue({ id: "new-cat" }), deleteMany: vi.fn() },
      transaction: { updateMany: vi.fn() }, budget: { updateMany: vi.fn() }, recurringRule: { updateMany: vi.fn() },
    };
    prisma.$transaction.mockImplementationOnce(async (callback: (value: typeof tx) => unknown) => callback(tx));
    await migratePersonalData("ws-1");
    expect(tx.category.upsert).toHaveBeenCalled();
    expect(tx.transaction.updateMany).toHaveBeenCalled();
    expect(tx.category.deleteMany).toHaveBeenCalled();
  });

  it("runs the authenticated recurring action wrapper", async () => {
    prisma.recurringRule.findMany.mockResolvedValue([]);
    await generateRecurringAction(form({ workspaceId: "" }));
  });
});
