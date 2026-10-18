import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AuthFeedback } from "./auth-feedback";
afterEach(cleanup);
it("keeps a polite live region mounted and updates the result without a dismiss action", () => {
  const view = render(<AuthFeedback message="" />);
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("");
  expect(status.getAttribute("aria-live")).toBe("polite");
  view.rerender(<AuthFeedback message="受信メールを確認してください。" />);
  expect(screen.getByRole("status")).toBe(status);
  expect(status.textContent).toContain("受信メールを確認してください。");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
