import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getAdminAllowlist, isAdminAuthConfigured } from "@/lib/env";
import { ensureAdminUser, isAdminEmailEligible } from "@/lib/event-repository";

const configured = isAdminAuthConfigured();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(process.env.AUTH_SECRET ? { secret: process.env.AUTH_SECRET } : {}),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: configured
    ? [
        GitHub({
          clientId: process.env.AUTH_GITHUB_ID!,
          clientSecret: process.env.AUTH_GITHUB_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      if (!configured || !email) return false;
      const isBootstrapSuperAdmin = getAdminAllowlist().has(email);
      try {
        if (!isBootstrapSuperAdmin && !(await isAdminEmailEligible(email))) return false;
        await ensureAdminUser(email, user.name, isBootstrapSuperAdmin);
        return true;
      } catch {
        return false;
      }
    },
  },
});
