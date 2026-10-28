const pending = new Set<symbol>();
const listeners = new Set<(pending: boolean) => void>();

function publish() {
  for (const listener of listeners) listener(pending.size > 0);
}

/** Each pending Link owns one lease; settling an old Link cannot resume a new one. */
export function beginScoreNavigation() {
  const token = Symbol("score-navigation");
  pending.add(token);
  if (pending.size === 1) publish();
  return () => {
    if (pending.delete(token) && pending.size === 0) publish();
  };
}

export function subscribeScoreNavigation(listener: (pending: boolean) => void) {
  listeners.add(listener);
  listener(pending.size > 0);
  return () => {
    listeners.delete(listener);
  };
}
