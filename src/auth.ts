import NextAuth from "next-auth";
import { prisma } from "@/prisma";
import { authenticationOptions } from "@/server/authentication/authjs";

export const { handlers, auth, signIn, signOut } = NextAuth(
  authenticationOptions(prisma),
);
