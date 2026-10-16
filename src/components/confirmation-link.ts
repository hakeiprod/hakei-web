/** Browser-owned, transient link state. Never persisted or logged. */
export class ConfirmationLink {
  private value: {
    token: string | null;
    purpose: "VERIFY" | "RESET" | "ADD_PASSWORD" | null;
  } | null = null;
  private read = false;
  private readonly listeners = new Set<() => void>();
  snapshot = () => this.value;
  serverSnapshot = () => null;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.read) {
      this.read = true;
      const fragment = new URLSearchParams(globalThis.location.hash.slice(1));
      globalThis.history.replaceState(
        globalThis.history.state,
        "",
        globalThis.location.pathname,
      );
      const token = fragment.get("token");
      const purpose = fragment.get("purpose");
      this.value = {
        purpose:
          purpose === "VERIFY" ||
          purpose === "RESET" ||
          purpose === "ADD_PASSWORD"
            ? purpose
            : null,
        token:
          token &&
          /^[\w-]{43}$/u.test(token) &&
          (purpose === "VERIFY" ||
            purpose === "RESET" ||
            purpose === "ADD_PASSWORD")
            ? token
            : null,
      };
    }
    listener();
    return () => {
      this.listeners.delete(listener);
      queueMicrotask(() => {
        if (this.listeners.size === 0) {
          this.value = null;
          this.read = false;
        }
      });
    };
  };
  clear() {
    this.value = { token: null, purpose: null };
    for (const listener of this.listeners) listener();
  }
}
