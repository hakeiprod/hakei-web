import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/components/score-fixture-gallery", () => ({
  ScoreFixtureGallery: () => null,
}));
import Page from "./page";
test("does not expose fixture reports in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  try {
    await expect(Page()).rejects.toThrow("NOT_FOUND");
  } finally {
    vi.unstubAllEnvs();
  }
});
