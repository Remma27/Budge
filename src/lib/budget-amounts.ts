export function effectiveBudgetAmount(budget: { budgetMode: string; amount: unknown; percentage: unknown }, income: number) {
  return budget.budgetMode === "PERCENTAGE" ? Math.round(income * Number(budget.percentage)) / 100 : Number(budget.amount);
}

export function budgetsForMonth<T extends { categoryId: string; currency: string; month: string | null }>(budgets: T[], month: string): T[] {
  return budgets.filter(b => b.month === month || (b.month === null && !budgets.some(other => other.month === month && other.categoryId === b.categoryId && other.currency === b.currency)));
}
