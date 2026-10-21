import { cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
const session = vi.hoisted(() => ({
  status: "authenticated",
  data: { user: { id: "alice" } },
}));
vi.mock("next-auth/react", () => ({ useSession: () => session }));
import { AuthenticatedContent } from "./authenticated-content";
afterEach(cleanup);
test("logout or switching identity unmounts private content and its resources", () => {
  const dispose = vi.fn();
  function Private() {
    useEffect(() => dispose, []);
    return <p>Private score</p>;
  }
  const view = render(
    <AuthenticatedContent actorId="alice">
      <Private />
    </AuthenticatedContent>,
  );
  expect(screen.getByText("Private score")).toBeDefined();
  session.data.user.id = "bob";
  view.rerender(
    <AuthenticatedContent actorId="alice">
      <Private />
    </AuthenticatedContent>,
  );
  expect(screen.queryByText("Private score")).toBeNull();
  expect(dispose).toHaveBeenCalledTimes(1);
  session.status = "unauthenticated";
  view.rerender(
    <AuthenticatedContent actorId="alice">
      <Private />
    </AuthenticatedContent>,
  );
  expect(screen.queryByText("Private score")).toBeNull();
});
