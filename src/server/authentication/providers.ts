import "server-only";

type Environment = Readonly<Record<string, string | undefined>>;

export function githubSettings(environment: Environment = process.env) {
  const clientId = environment.AUTH_GITHUB_ID;
  const clientSecret = environment.AUTH_GITHUB_SECRET;
  if (!clientId?.trim() || !clientSecret?.trim()) return null;
  return { clientId, clientSecret };
}

/** The only provider configuration safe to send to a browser. */
export function providerAvailability(environment: Environment = process.env) {
  return { github: githubSettings(environment) !== null };
}
