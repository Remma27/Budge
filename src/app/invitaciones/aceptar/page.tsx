import { acceptInvitation } from "@/app/actions/workspaces";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p>Falta el enlace de invitación.</p>;
  return <form action={acceptInvitation.bind(null, token)} className="grid gap-4"><h1 className="text-xl font-bold">Aceptar invitación</h1><p>Confirma para añadir este workspace a tu cuenta.</p><button className="rounded-lg bg-zinc-900 px-4 py-2 text-white">Aceptar</button></form>;
}
