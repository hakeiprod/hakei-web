import "server-only";
import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;
const positiveInteger = z.coerce.number().int().positive();
const secret = z.string().min(32);
const mailbox = z.email().refine((value) => !/[\r\n]/u.test(value));

/** Resolve lazily so missing mail settings cannot disable OAuth at startup. */
export function authenticationConfig(environment: Environment = process.env) {
  const enabled =
    z
      .enum(["true", "false"])
      .parse(environment.EMAIL_PASSWORD_ENABLED ?? "false") === "true";
  if (!enabled) return { enabled: false as const };
  const origin = z.url().parse(environment.AUTH_PUBLIC_ORIGIN);
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "AUTH_PUBLIC_ORIGIN must be an HTTPS origin or localhost HTTP origin",
    );
  const host = z
    .string()
    .min(1)
    .refine((value) => !/[\s\r\n]/u.test(value))
    .parse(environment.SMTP_HOST);
  const port = positiveInteger
    .max(65_535)
    .parse(environment.SMTP_PORT ?? "587");
  const user = environment.SMTP_USER;
  const password = environment.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(password))
    throw new Error("SMTP credentials must be configured together");
  return {
    enabled: true as const,
    publicOrigin: url.origin,
    rateSecret: secret.parse(environment.AUTH_RATE_SECRET),
    trustedProxy:
      z
        .enum(["true", "false"])
        .parse(environment.AUTH_TRUSTED_PROXY ?? "false") === "true",
    smtp: {
      host,
      port,
      user,
      password,
      from: mailbox.parse(environment.SMTP_FROM),
      secure: port === 465,
      requireTLS: true,
    },
    limits: {
      loginMailbox: positiveInteger.parse(
        environment.AUTH_LOGIN_MAILBOX_LIMIT ?? "5",
      ),
      loginSource: positiveInteger.parse(
        environment.AUTH_LOGIN_SOURCE_LIMIT ?? "20",
      ),
      sendMailbox: positiveInteger.parse(
        environment.AUTH_SEND_MAILBOX_LIMIT ?? "3",
      ),
      sendSource: positiveInteger.parse(
        environment.AUTH_SEND_SOURCE_LIMIT ?? "10",
      ),
    },
  };
}
