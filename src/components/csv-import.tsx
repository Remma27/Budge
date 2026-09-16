"use client";
import { useState } from "react";
import { importTransactions } from "@/app/actions/transactions";
import { btnPrimaryCls, Card, FormError } from "@/components/ui";

export function CsvImport({ workspaceId }: { workspaceId: string | null }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  function read(file: File) { const reader = new FileReader(); reader.onload = () => { const lines = String(reader.result).split(/\r?\n/).filter(Boolean); const headers = lines.shift()?.split(",").map(x => x.trim().toLowerCase()) || []; const parsed = lines.map(line => { const values = line.split(","); return Object.fromEntries(headers.map((h, i) => [h, values[i]?.replace(/^"|"$/g, "") || ""])); }); setRows(parsed); setError(parsed.some(r => !r.date || !r.type || !r.amount || !r.currency) ? "Cada fila necesita date, type, amount y currency." : ""); }; reader.readAsText(file); }
  async function submit() { const result = await importTransactions(rows, workspaceId); if (!result.ok) setError(result.error); else { setMessage(`${rows.length} movimientos importados.`); setRows([]); } }
  return <Card><h2 className="mb-3 font-bold">Importar movimientos CSV</h2><input type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && read(e.target.files[0])} className="w-full text-sm" />{rows.length > 0 && <><p className="mt-3 text-sm">Previsualización: {rows.length} filas</p><div className="mt-2 max-h-40 overflow-auto rounded border p-2 text-xs">{rows.slice(0, 5).map((r, i) => <div key={i}>{r.date} · {r.type} · {r.amount} {r.currency} · {r.note}</div>)}</div><button className={`${btnPrimaryCls} mt-3`} onClick={submit} disabled={!!error}>Importar</button></>}{error && <FormError message={error} />}{message && <p className="mt-2 text-sm text-green-600">{message}</p>}<p className="mt-3 text-xs text-zinc-500">Columnas: date,type,amount,currency,categoryId,note. Máximo 1,000 filas.</p></Card>;
}
