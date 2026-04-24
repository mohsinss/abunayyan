import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import {
  db,
  users,
  accounts,
  sessions as sessionsTable,
  verificationTokens,
  subscriptions,
} from "@/db";
import type { UserRole } from "@/db/schema/users";

declare module "next-auth" {
  // eslint-disable-next-line no-unused-vars
  interface Session {
    user: {
      id: string;
      role: UserRole;
      disabled: boolean;
      hasAccess?: boolean;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        try {
          const [row] = await db
            .select({
              role: users.role,
              disabled: users.disabled,
              hasAccess: subscriptions.hasAccess,
            })
            .from(users)
            .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
            .where(eq(users.id, user.id))
            .limit(1);
          session.user.role = (row?.role ?? "member") as UserRole;
          session.user.disabled = row?.disabled ?? false;
          session.user.hasAccess = row?.hasAccess ?? false;
        } catch {
          session.user.role = "member";
          session.user.disabled = false;
          session.user.hasAccess = false;
        }
      }
      return session;
    },
  },
});
