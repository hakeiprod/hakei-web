import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AuthPanel } from "./auth-panel";
import { AuthHomeLink } from "./auth-home-link";
afterEach(cleanup);
it("renders a semantic heading and the supplied content without an extra action", () => {
  render(
    <AuthPanel title="認証">
      <p>手続きを選択してください。</p>
    </AuthPanel>,
  );
  expect(screen.getByRole("heading", { name: "認証", level: 1 })).toBeDefined();
  expect(screen.getByText("手続きを選択してください。")).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});

it("keeps the home destination in the client-side HeroUI link", () => {
  render(<AuthHomeLink />);
  expect(
    screen.getByRole("link", { name: "ホームへ戻る" }).getAttribute("href"),
  ).toBe("/");
});
