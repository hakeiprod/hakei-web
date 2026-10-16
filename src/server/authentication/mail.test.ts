import { expect, it, vi } from "vitest";
import { authenticationConfig } from "./config";
import { authenticationEnvironment } from "../testing/authentication";
const { sendMail, createTransport } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock("smtp-mailer", () => ({ default: { createTransport } }));
import { authenticationMailer } from "./mail";
it("uses TLS, bounded timeouts and a fixed fragment link without logging secrets", async () => {
  createTransport.mockReturnValue({ sendMail });
  sendMail.mockResolvedValue({
    accepted: ["recipient@example.invalid"],
    rejected: [],
  });
  const config = authenticationConfig(authenticationEnvironment());
  if (!config.enabled) throw new Error("expected enabled config");
  const mail = authenticationMailer(config);
  expect(
    await mail.sendChallenge(
      "recipient@example.invalid",
      "x".repeat(43),
      "VERIFY",
    ),
  ).toEqual({ accepted: true });
  expect(createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      requireTLS: true,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
      tls: { rejectUnauthorized: true },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    }),
  );
  const sent = sendMail.mock.calls[0][0];
  expect(sent.from).toEqual({ address: "sender@example.invalid" });
  expect(sent.to).toEqual({ address: "recipient@example.invalid" });
  const url = new URL(sent.text.split("\n").at(-1));
  expect(url.origin).toBe("http://localhost:3000");
  expect(url.search).toBe("");
  expect(url.hash).toContain("token=");
});
it("does not expose SMTP errors and rejects header injection before transport", async () => {
  createTransport.mockReturnValue({ sendMail });
  sendMail.mockRejectedValue(new Error("private SMTP credentials"));
  const config = authenticationConfig(authenticationEnvironment());
  if (!config.enabled) throw new Error("expected enabled config");
  const mail = authenticationMailer(config);
  expect(
    await mail.sendChallenge(
      "recipient@example.invalid",
      "x".repeat(43),
      "RESET",
    ),
  ).toEqual({ accepted: false });
  const calls = sendMail.mock.calls.length;
  await expect(
    mail.sendChallenge(
      "a@example.invalid\r\nBcc: b@example.invalid",
      "x".repeat(43),
      "RESET",
    ),
  ).rejects.toThrow();
  expect(sendMail.mock.calls.length).toBe(calls);
});
