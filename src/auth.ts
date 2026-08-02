import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getAdminAllowlist, isAdminAuthConfigured } from "@/lib/env";

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
    signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      return Boolean(configured && email && getAdminAllowlist().has(email));
    },
  },
});
