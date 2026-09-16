import { createHash, randomBytes } from "node:crypto";
import { WorkspaceRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const createInvitationToken = () => randomBytes(32).toString("base64url");
export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");
const rank = { VIEWER: 1, EDITOR: 2, OWNER: 3 } as const;

export async function requireWorkspaceRole(userId: string, workspaceId: string, minimum: WorkspaceRole) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
  if (!workspace) throw new Error("Workspace no encontrado");
  if (workspace.ownerId === userId) return WorkspaceRole.OWNER;
  const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!member || rank[member.role] < rank[minimum]) throw new Error("No tienes permisos para esta acción");
  return member.role;
}

export async function getWorkspaceContext(userId: string, requested?: string | null) {
  if (!requested) return { workspaceId: null as string | null, role: null as WorkspaceRole | null };
  const role = await requireWorkspaceRole(userId, requested, WorkspaceRole.VIEWER);
  return { workspaceId: requested, role };
}

export async function getActionWorkspace(userId: string, requested?: string | null) {
  const workspaceId = requested || null;
  if (workspaceId) await requireWorkspaceRole(userId, workspaceId, WorkspaceRole.EDITOR);
  return workspaceId;
}

export function scopeWorkspace(userId: string, workspaceId: string | null) {
  return workspaceId ? { userId, workspaceId } : { userId, workspaceId: null };
}
