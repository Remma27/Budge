export const frequencyLabels: Record<string, string> = {
  WEEKLY: "Semanal", BIWEEKLY: "Quincenal (cada 15 días)", MONTHLY: "Mensual", YEARLY: "Anual",
};

export function advanceRecurring(date: Date, frequency: string, chargeDay?: number | null) {
  const next = new Date(date);
  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    next.setDate(next.getDate() + (frequency === "WEEKLY" ? 7 : 15));
  } else {
    const day = chargeDay ?? next.getDate();
    next.setDate(1);
    if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1);
    next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  }
  return next;
}
