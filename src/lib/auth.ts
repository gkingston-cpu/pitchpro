import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Google login restricted to an allow-list of the two salespeople's emails
// (spec §7). No user-management system needed for a 2-person tool.

export function authEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  providers: authEnabled()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : [],
  callbacks: {
    signIn({ user }) {
      const email = user.email?.toLowerCase();
      return Boolean(email && allowedEmails().includes(email));
    },
  },
};
