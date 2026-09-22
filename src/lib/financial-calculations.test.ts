import { describe, expect, it } from "vitest";
import { advanceRecurring } from "./recurring-schedule";
import { effectiveBudgetAmount, budgetsForMonth } from "./budget-amounts";

describe("financial calculations", () => {
  it("advances fortnightly across month and year boundaries by 15 calendar days", () => {
    expect(advanceRecurring(new Date(2026, 11, 25, 12), "BIWEEKLY")).toEqual(new Date(2027, 0, 9, 12));
    expect(advanceRecurring(new Date(2028, 1, 20, 12), "BIWEEKLY")).toEqual(new Date(2028, 2, 6, 12));
    expect(advanceRecurring(new Date(2026, 1, 28, 12), "MONTHLY", 31)).toEqual(new Date(2026, 2, 31, 12));
  });
  it("distributes income and handles no income, fixed budgets, and cents", () => {
    const budget = { budgetMode: "PERCENTAGE", amount: "0", percentage: "30" };
    expect(effectiveBudgetAmount(budget, 500000)).toBe(150000);
    expect(effectiveBudgetAmount(budget, 0)).toBe(0);
    expect(effectiveBudgetAmount({ ...budget, percentage: "12.5" }, 100.04)).toBe(12.51);
    expect(effectiveBudgetAmount({ ...budget, budgetMode: "FIXED", amount: "5000.50" }, 0)).toBe(5000.5);
  });
  it("uses monthly overrides without double-counting standing budgets", () => {
    const standing = { id: "standing", month: null, currency: "CRC", categoryId: "a" };
    const current = { ...standing, id: "current", month: "2026-09" };
    const future = { ...standing, id: "future", month: "2026-10" };
    const otherCurrency = { ...standing, id: "usd", currency: "USD" };
    expect(budgetsForMonth([standing, current, future, otherCurrency], "2026-09").map(b => b.id)).toEqual(["current", "usd"]);
  });
});
