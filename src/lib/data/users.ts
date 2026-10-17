import { prisma } from "../prisma";
import { getStorage } from "../storage";

export async function findUserForLogin(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function emailExists(email: string) {
  return (await prisma.user.count({ where: { email: email.toLowerCase() } })) > 0;
}

export async function createUserWithWorkspace(input: { email: string; name: string | null; passwordHash: string | null; image?: string | null }) {
  const email = input.email.toLowerCase();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name: input.name, passwordHash: input.passwordHash, image: input.image ?? null } });
    const ws = await tx.workspace.create({
      data: { name: input.name ? `${input.name}'s workspace` : "My workspace", memberships: { create: { userId: user.id, role: "OWNER" } } },
    });
    return { user, workspaceId: ws.id };
  });
}

export async function upsertOAuthUser(input: { email: string; name: string | null; image: string | null }) {
  const existing = await findUserForLogin(input.email);
  if (existing) return existing;
  return (await createUserWithWorkspace({ ...input, passwordHash: null })).user;
}

export async function workspaceIdForUser(userId: string): Promise<string> {
  const m = await prisma.membership.findFirst({ where: { userId }, orderBy: { id: "asc" } });
  return m?.workspaceId ?? "";
}

export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, image: true, createdAt: true } });
}

export async function updateProfile(userId: string, data: { name: string }) {
  return prisma.user.update({ where: { id: userId }, data: { name: data.name }, select: { id: true, name: true } });
}

export async function setPasswordHash(userId: string, hash: string) {
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
}

/**
 * "Delete all my data": removes the user's workspace (projects, documents, findings, files) and the
 * user record itself. Files are deleted from storage first so nothing is orphaned.
 */
export async function deleteAllUserData(userId: string, workspaceId: string) {
  const members = await prisma.membership.count({ where: { workspaceId } });
  if (members <= 1) {
    await getStorage().deletePrefix(workspaceId);
    await prisma.workspace.delete({ where: { id: workspaceId } });
  } else {
    await prisma.membership.deleteMany({ where: { userId, workspaceId } });
  }
  await prisma.user.delete({ where: { id: userId } });
}
