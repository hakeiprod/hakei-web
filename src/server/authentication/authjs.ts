import "server-only";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import GitHub from "next-auth/providers/github";
import type { PrismaClient } from "../../generated/prisma/client";
import { maintenanceAdapter } from "../maintenance-adapter";
import { githubSettings } from "./providers";

export function authenticationOptions(
  database: PrismaClient,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): NextAuthConfig {
  const github = githubSettings(environment);
  const server = environment.EMAIL_SERVER?.trim();
  const from = environment.EMAIL_FROM?.trim();
  if (server && from) {
    let connection: URL;
    try {
      connection = new URL(server);
    } catch {
      throw new Error("Invalid SMTP configuration");
    }
    const smtp = connection.protocol === "smtp:";
    const smtps = connection.protocol === "smtps:";
    if (!smtp && !smtps) throw new Error("Invalid SMTP configuration");
    if (environment.NODE_ENV === "production") {
      // Keep production URL options narrow: do not permit TLS downgrade flags.
      const safeOptions = [...connection.searchParams].every(
        ([key, value]) => key === "requireTLS" && value === "true",
      );
      if (
        !connection.username ||
        !connection.password ||
        !safeOptions ||
        (smtp && connection.searchParams.get("requireTLS") !== "true") ||
        ["mailpit", "localhost", "127.0.0.1", "[::1]"].includes(
          connection.hostname,
        )
      ) {
        throw new Error("Invalid SMTP configuration");
      }
    }
  }
  return {
    // Git/DB checkpoints must freeze adapter writes as well as score writes.
    adapter: maintenanceAdapter(PrismaAdapter(database)),
    session: { strategy: "database" },
    providers: [
      ...(server && from ? [Nodemailer({ server, from })] : []),
      ...(github ? [GitHub(github)] : []),
    ],
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  };
}
