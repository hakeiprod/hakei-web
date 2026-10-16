/** Injected settings only: never read real SMTP/OAuth credentials in tests. */
export function authenticationEnvironment() {
  return {
    EMAIL_PASSWORD_ENABLED: "true",
    AUTH_PUBLIC_ORIGIN: "http://localhost:3000",
    AUTH_RATE_SECRET: "test-only-rate-secret-not-for-deployment",
    SMTP_HOST: "localhost",
    SMTP_PORT: "2525",
    SMTP_FROM: "sender@example.invalid",
  };
}
export function githubEnvironment(enabled: boolean) {
  return enabled
    ? {
        AUTH_GITHUB_ID: "test-only-client",
        AUTH_GITHUB_SECRET: "test-only-secret",
      }
    : {};
}

/** SMTP stays in memory even when real environment credentials are present. */
export async function capturedAuthenticationMailer() {
  const { default: mailer } = await import("smtp-mailer");
  return mailer.createTransport({ streamTransport: true, buffer: true });
}
