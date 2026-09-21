import { describe, expect, it, vi } from "vitest";
import { fetchExchangeRate } from "./exchange-rates";

describe("automatic exchange rates", () => {
  it("returns one for the same currency without calling the provider", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await fetchExchangeRate("CRC", "CRC")).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("returns a valid provider rate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rate: 512.25 }), { status: 200 })));
    expect(await fetchExchangeRate("USD", "CRC")).toBe(512.25);
  });

  it("returns null for provider errors, malformed rates, and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    expect(await fetchExchangeRate("USD", "CRC")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rate: 0 }), { status: 200 })));
    expect(await fetchExchangeRate("USD", "CRC")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await fetchExchangeRate("USD", "CRC")).toBeNull();
  });
});
