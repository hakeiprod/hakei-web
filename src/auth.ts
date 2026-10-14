import { maintenanceAdapter } from "@/server/maintenance-adapter";
import { prisma } from "@/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: maintenanceAdapter(PrismaAdapter(prisma)),
  providers: [GitHub],
  logger: { error: () => console.error({ event: "authentication-failed" }) },
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
