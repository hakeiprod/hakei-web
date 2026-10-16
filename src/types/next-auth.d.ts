import type { DefaultSession } from "next-auth";
import "next-auth/jwt";
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
    sid: string;
    authVersion: number;
  }
  interface User {
    authVersion?: number;
    credentialVersion?: number;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    authVersion?: number;
  }
}
