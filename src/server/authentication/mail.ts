import "server-only";
import { z } from "zod";
import type { authenticationConfig } from "./config";
import { emailSchema } from "./input";

type MailConfiguration = Extract<
  ReturnType<typeof authenticationConfig>,
  { enabled: true }
>;
const tokenSchema = z.string().regex(/^[\w-]{43}$/u);
const purposeSchema = z.enum(["VERIFY", "RESET", "ADD_PASSWORD"]);

export function authenticationMailer(config: MailConfiguration) {
  let transport:
    | Promise<ReturnType<typeof import("smtp-mailer").default.createTransport>>
    | undefined;
  function getTransport() {
    transport ??= import("smtp-mailer")
      .then(({ default: mailer }) =>
        mailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          requireTLS: true,
          tls: { rejectUnauthorized: true },
          auth: config.smtp.user
            ? { user: config.smtp.user, pass: config.smtp.password }
            : undefined,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 10_000,
          logger: false,
          debug: false,
          disableFileAccess: true,
          disableUrlAccess: true,
        }),
      )
      .catch(() => {
        transport = undefined;
        throw new Error("TEMPORARY_FAILURE");
      });
    return transport;
  }
  async function send(recipient: string, subject: string, text: string) {
    const address = emailSchema.parse(recipient);
    try {
      const mailer = await getTransport();
      const result = await mailer.sendMail({
        from: { address: config.smtp.from },
        to: { address },
        subject,
        text,
      });
      return {
        accepted:
          result.accepted?.includes(address) === true &&
          (result.rejected?.length ?? 0) === 0,
      };
    } catch {
      return { accepted: false };
    }
  }
  return {
    async sendChallenge(
      recipient: string,
      token: string,
      purpose: "VERIFY" | "RESET" | "ADD_PASSWORD",
    ) {
      emailSchema.parse(recipient);
      const url = new URL("/auth/confirm", config.publicOrigin);
      url.hash = new URLSearchParams({
        token: tokenSchema.parse(token),
        purpose: purposeSchema.parse(purpose),
      }).toString();
      return send(
        recipient,
        "hakei 本人確認のご案内",
        `本人確認を完了してください。\n${url.href}`,
      );
    },
    async sendChangeNotice(recipient: string) {
      return send(
        recipient,
        "hakei パスワード変更のお知らせ",
        "アカウントのパスワードが変更されました。心当たりがない場合は、サービスのパスワード再設定をご利用ください。",
      );
    },
  };
}
