"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function WorkspaceSelector({ workspaces }: { workspaces: { id: string; name: string }[] }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  return <select aria-label="Workspace" value={params.get("workspaceId") ?? ""} onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set("workspaceId", e.target.value); else next.delete("workspaceId"); router.push(`${pathname}?${next}`); }} className="rounded border px-1 py-1 text-sm"><option value="">Personal</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>;
}
