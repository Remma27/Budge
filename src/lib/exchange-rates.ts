const API = "https://api.frankfurter.dev/v2/rate";

export async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  try {
    const response = await fetch(`${API}/${encodeURIComponent(from)}/${encodeURIComponent(to)}`, {
      next: { revalidate: 86400 },
    });
    if (!response.ok) return null;
    const data = await response.json() as { rate?: number };
    return typeof data.rate === "number" && Number.isFinite(data.rate) && data.rate > 0 ? data.rate : null;
  } catch {
    return null;
  }
}
