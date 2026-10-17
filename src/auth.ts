import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { findUserForLogin, upsertOAuthUser, workspaceIdForUser } from "@/lib/data/users";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    workspaceId: string;
    user: { id: string } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        // 8 attempts / 10 min per address blunts password guessing.
        if (rateLimit(`login:${email}`, 8, 10 * 60_000).limited) return null;
        const user = await findUserForLogin(email);
        if (!user?.passwordHash) {
          await verifyPassword(null, parsed.data.password); // equalise timing
          return null;
        }
        if (!(await verifyPassword(user.passwordHash, parsed.data.password))) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const u = await upsertOAuthUser({ email: user.email, name: user.name ?? null, image: user.image ?? null });
        user.id = u.id;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        token.wid = await workspaceIdForUser(user.id);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      session.workspaceId = String(token.wid ?? "");
      return session;
    },
  },
});
