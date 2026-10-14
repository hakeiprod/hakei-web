import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  session: { status: "unauthenticated" },
}));
vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
  signOut: mocks.signOut,
  useSession: () => mocks.session,
}));
vi.mock("./input-serch", () => ({ InputSearch: () => null }));
vi.mock("@heroui/react", () => ({
  Navbar: ({ children }: { children: React.ReactNode }) => (
    <nav>{children}</nav>
  ),
  NavbarBrand: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  NavbarContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Button: ({
    children,
    onPress,
    isDisabled,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    isDisabled: boolean;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
import { Header } from "./header";
test("uses built-in sign in and full redirect logout so user caches are discarded", () => {
  mocks.session.status = "unauthenticated";
  const view = render(<Header />);
  fireEvent.click(screen.getByRole("button", { name: "ログイン" }));
  expect(mocks.signIn).toHaveBeenCalledWith();
  mocks.session.status = "authenticated";
  view.rerender(<Header />);
  fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
  expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/" });
});
