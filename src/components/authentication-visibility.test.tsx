import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
const { session } = vi.hoisted(() => ({
  session: {
    status: "authenticated",
    data: { user: { id: "alice" }, sid: "test-sid", authVersion: 0 },
    update: vi.fn(),
  },
}));
vi.mock("next-auth/react", () => ({
  useSession: () => session,
  getSession: () => session.update(),
}));
import { AuthenticationVisibility } from "./authentication-visibility";
import { AuthenticatedContent } from "./authenticated-content";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("unmounts private resources offline and waits for a new verification after resuming", async () => {
  let online = true;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  session.update.mockResolvedValue({
    user: { id: "alice" },
    sid: "test-sid",
    authVersion: 0,
  });
  const dispose = vi.fn();
  function Private() {
    useEffect(() => dispose, []);
    return <p>Private score</p>;
  }
  render(
    <AuthenticationVisibility>
      <AuthenticatedContent actorId="alice">
        <Private />
      </AuthenticatedContent>
    </AuthenticationVisibility>,
  );
  await screen.findByText("Private score");
  online = false;
  fireEvent(globalThis.window, new Event("offline"));
  expect(screen.queryByText("Private score")).toBeNull();
  expect(dispose).toHaveBeenCalledTimes(1);
  let complete!: (value: unknown) => void;
  session.update.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  online = true;
  fireEvent(globalThis.window, new Event("online"));
  expect(screen.queryByText("Private score")).toBeNull();
  complete({ user: { id: "alice" }, sid: "test-sid", authVersion: 0 });
  await screen.findByText("Private score");
  session.update.mockResolvedValue(null);
  fireEvent(globalThis.window, new Event("pageshow"));
  await waitFor(() => expect(screen.queryByText("Private score")).toBeNull());
});

it("keeps practice resources mounted during routine polling and hides them on verification failure", async () => {
  vi.useFakeTimers();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  session.update.mockResolvedValue({
    user: { id: "alice" },
    sid: "test-sid",
    authVersion: 0,
  });
  const dispose = vi.fn();
  function Private() {
    useEffect(() => dispose, []);
    return <p>Active practice</p>;
  }
  render(
    <AuthenticationVisibility>
      <AuthenticatedContent actorId="alice">
        <Private />
      </AuthenticatedContent>
    </AuthenticationVisibility>,
  );
  await act(async () => {});
  expect(screen.getByText("Active practice")).toBeDefined();
  let complete!: (value: unknown) => void;
  session.update.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000);
  });
  expect(screen.getByText("Active practice")).toBeDefined();
  expect(dispose).not.toHaveBeenCalled();
  await act(async () => {
    complete(null);
  });
  expect(screen.queryByText("Active practice")).toBeNull();
  expect(dispose).toHaveBeenCalledTimes(1);
});
