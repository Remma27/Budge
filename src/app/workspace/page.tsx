import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { Card } from "@/components/ui";
import { DeleteButton } from "@/components/delete-button";
import {
  createWorkspace,
  createInvitation,
  revokeInvitation,
  deleteWorkspace,
  updateWorkspaceMember,
  removeWorkspaceMember,
  leaveWorkspace,
} from "@/app/actions/workspaces";
import { WorkspaceRole } from "@/generated/prisma/client";

export default async function WorkspacePage() {
  const userId = await requireUserId();
  const workspaces = await prisma.workspace.findMany({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: { members: { include: { user: { select: { id: true, email: true } } } }, invitations: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } } },
  });

  return <div className="grid gap-6">
    <h1 className="text-xl font-bold">Workspaces</h1>
    <Card>
      <h2 className="mb-3 font-bold">Crear workspace</h2>
      <form action={async (f) => { "use server"; await createWorkspace(String(f.get("name"))); }} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="Nombre" className="min-w-0 flex-1 rounded border px-3 py-2" />
        <button className="rounded bg-zinc-900 px-3 py-2 text-white">Crear</button>
      </form>
    </Card>
    {workspaces.map((w) => {
      const isOwner = w.ownerId === userId;
      return <Card key={w.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-bold">{w.name}</h2><p className="mt-2 text-sm">Miembros: {w.members.map((m) => m.user.email).join(", ")}</p></div>
          {isOwner ? <form action={deleteWorkspace.bind(null, w.id)}><DeleteButton message={`¿Eliminar el workspace «${w.name}»? Se borrarán sus movimientos, presupuestos y miembros.`} /></form> : <form action={leaveWorkspace.bind(null, w.id)}><DeleteButton message={`¿Abandonar «${w.name}»? Perderás acceso a sus datos.`} /></form>}
        </div>
        <ul className="mt-4 grid gap-2 text-sm">
          {w.members.map((m) => <li key={m.user.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
            <span>{m.user.email} {m.role === WorkspaceRole.OWNER && "(propietario)"}</span>
            {isOwner && m.role !== WorkspaceRole.OWNER && <span className="flex flex-wrap gap-2">
              <form action={updateWorkspaceMember.bind(null, w.id, m.user.id, m.role === WorkspaceRole.EDITOR ? WorkspaceRole.VIEWER : WorkspaceRole.EDITOR)}><button className="underline">Cambiar a {m.role === WorkspaceRole.EDITOR ? "viewer" : "editor"}</button></form>
              <form action={removeWorkspaceMember.bind(null, w.id, m.user.id)}><button className="text-red-600 underline">Expulsar</button></form>
            </span>}
          </li>)}
        </ul>
        {isOwner && <>
          <form action={async (f) => { "use server"; await createInvitation(w.id, String(f.get("email")), String(f.get("role")) as WorkspaceRole); }} className="mt-4 flex flex-wrap gap-2">
            <input name="email" type="email" required placeholder="correo@ejemplo.com" className="min-w-0 flex-1 rounded border px-3 py-2" />
            <select name="role" className="rounded border px-2"><option value="VIEWER">VIEWER</option><option value="EDITOR">EDITOR</option></select>
            <button className="rounded bg-zinc-900 px-3 py-2 text-white">Invitar</button>
          </form>
          <ul className="mt-3 grid gap-2 text-sm">{w.invitations.map((i) => <li key={i.id} className="flex flex-wrap justify-between gap-2">{i.email} ({i.role}) <form action={revokeInvitation.bind(null, i.id)}><button className="underline">Revocar</button></form></li>)}</ul>
        </>}
      </Card>;
    })}
  </div>;
}
