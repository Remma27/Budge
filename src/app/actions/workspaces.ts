"use server";
import { revalidatePath } from "next/cache";
import { WorkspaceRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/get-user";
import { createInvitationToken, hashInvitationToken, normalizeEmail, requireWorkspaceRole } from "@/lib/workspace";

export async function createWorkspace(name: string) {
  const userId = await requireUserId();
  if (!name.trim()) throw new Error("El nombre es obligatorio");
  return prisma.workspace.create({ data: { name: name.trim(), ownerId: userId, members: { create: { userId, role: WorkspaceRole.OWNER } } } });
}
export async function deleteWorkspace(workspaceId: string) {
  const userId = await requireUserId();
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
  if (!workspace || workspace.ownerId !== userId) throw new Error("No tienes permiso para eliminar este workspace");
  await prisma.workspace.delete({ where: { id: workspaceId } });
  revalidatePath("/");
  revalidatePath("/workspace");
}
export async function updateWorkspaceMember(workspaceId: string, memberId: string, role: WorkspaceRole) {
  const userId = await requireUserId();
  await requireWorkspaceRole(userId, workspaceId, WorkspaceRole.OWNER);
  if (role === WorkspaceRole.OWNER) throw new Error("No puedes asignar otro propietario desde aquí");
  await prisma.workspaceMember.updateMany({ where: { workspaceId, userId: memberId, role: { not: WorkspaceRole.OWNER } }, data: { role } });
  revalidatePath("/workspace");
}
export async function removeWorkspaceMember(workspaceId: string, memberId: string) {
  const userId = await requireUserId();
  await requireWorkspaceRole(userId, workspaceId, WorkspaceRole.OWNER);
  await prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: memberId, role: { not: WorkspaceRole.OWNER } } });
  revalidatePath("/workspace");
}
export async function leaveWorkspace(workspaceId: string) {
  const userId = await requireUserId();
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true } });
  if (!member || member.role === WorkspaceRole.OWNER) throw new Error("El propietario no puede abandonar el workspace");
  await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } });
  revalidatePath("/");
  revalidatePath("/workspace");
}
export async function createInvitation(workspaceId: string, email: string, role: WorkspaceRole = WorkspaceRole.VIEWER) {
  const senderId = await requireUserId(); await requireWorkspaceRole(senderId, workspaceId, WorkspaceRole.OWNER);
  const normalized = normalizeEmail(email); if (!normalized || role === WorkspaceRole.OWNER) throw new Error("Invitación inválida");
  const token = createInvitationToken();
  await prisma.workspaceInvitation.updateMany({ where: { workspaceId, email: normalized, acceptedAt: null }, data: { expiresAt: new Date() } });
  await prisma.workspaceInvitation.create({ data: { workspaceId, email: normalized, role, tokenHash: hashInvitationToken(token), expiresAt: new Date(Date.now() + 7 * 86400000), senderId } });
  return { url: `${process.env.NEXTAUTH_URL ?? ""}/invitaciones/aceptar?token=${token}` };
}
export async function revokeInvitation(id: string) {
  const userId = await requireUserId(); const invitation = await prisma.workspaceInvitation.findUnique({ where: { id }, select: { workspaceId: true } });
  if (!invitation) return; await requireWorkspaceRole(userId, invitation.workspaceId, WorkspaceRole.OWNER); await prisma.workspaceInvitation.update({ where: { id }, data: { expiresAt: new Date() } });
}
export async function acceptInvitation(token: string) {
  const userId = await requireUserId(); const invitation = await prisma.workspaceInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) throw new Error("Invitación inválida o expirada");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  if (normalizeEmail(user.email) !== invitation.email) throw new Error("La invitación no corresponde a tu correo");
  await prisma.$transaction([prisma.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } }, update: { role: invitation.role }, create: { workspaceId: invitation.workspaceId, userId, role: invitation.role } }), prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })]);
  revalidatePath("/");
}
export async function migratePersonalData(workspaceId: string) {
  const userId = await requireUserId(); await requireWorkspaceRole(userId, workspaceId, WorkspaceRole.OWNER);
  await prisma.$transaction(async tx => {
    const categories = await tx.category.findMany({ where: { userId, workspaceId: null } }); const map = new Map<string, string>();
    for (const c of categories) { const target = await tx.category.upsert({ where: { userId_name: { userId, name: c.name } }, update: { workspaceId }, create: { userId, workspaceId, name: c.name, color: c.color } }); map.set(c.id, target.id); }
    await tx.transaction.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }); await tx.budget.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } }); await tx.recurringRule.updateMany({ where: { userId, workspaceId: null }, data: { workspaceId } });
    for (const [oldId, newId] of map) { await tx.transaction.updateMany({ where: { userId, workspaceId, categoryId: oldId }, data: { categoryId: newId } }); await tx.budget.updateMany({ where: { userId, workspaceId, categoryId: oldId }, data: { categoryId: newId } }); await tx.recurringRule.updateMany({ where: { userId, workspaceId, categoryId: oldId }, data: { categoryId: newId } }); }
    await tx.category.deleteMany({ where: { userId, workspaceId: null } });
  }); revalidatePath("/");
}
