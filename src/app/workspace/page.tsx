import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { Card } from "@/components/ui";
import { createWorkspace, createInvitation, revokeInvitation } from "@/app/actions/workspaces";
import { WorkspaceRole } from "@/generated/prisma/client";

export default async function WorkspacePage() {
  const userId = await requireUserId();
  const workspaces = await prisma.workspace.findMany({ where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }, include: { members: { include: { user: { select: { email: true } } } }, invitations: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } } } });
  return <div className="grid gap-6"><h1 className="text-xl font-bold">Workspaces</h1><Card><h2 className="mb-3 font-bold">Crear workspace</h2><form action={async (f) => { "use server"; await createWorkspace(String(f.get("name"))); }} className="flex gap-2"><input name="name" required placeholder="Nombre" className="rounded border px-3 py-2" /><button className="rounded bg-zinc-900 px-3 py-2 text-white">Crear</button></form></Card>{workspaces.map(w => <Card key={w.id}><h2 className="font-bold">{w.name}</h2><p className="mt-2 text-sm">Miembros: {w.members.map(m => m.user.email).join(", ")}</p>{w.ownerId === userId && <><form action={async (f) => { "use server"; await createInvitation(w.id, String(f.get("email")), String(f.get("role")) as WorkspaceRole); }} className="mt-4 flex flex-wrap gap-2"><input name="email" type="email" required placeholder="correo@ejemplo.com" className="rounded border px-3 py-2" /><select name="role" className="rounded border px-2"><option value="VIEWER">VIEWER</option><option value="EDITOR">EDITOR</option></select><button className="rounded bg-zinc-900 px-3 py-2 text-white">Invitar</button></form><ul className="mt-3 text-sm">{w.invitations.map(i => <li key={i.id} className="flex justify-between">{i.email} ({i.role}) <form action={revokeInvitation.bind(null, i.id)}><button className="underline">Revocar</button></form></li>)}</ul></>}</Card>)}</div>;
}
