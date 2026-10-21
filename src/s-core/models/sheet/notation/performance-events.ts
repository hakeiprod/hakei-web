/** Retain every displayed note; combine only schema-validated explicit shared events. */
export function performanceNotes<
  T extends {
    rest?: boolean;
    trackId: number;
    performanceEventId?: string;
    tablature?: unknown;
  },
>(notes: readonly T[]) {
  // A validated pair has one standard note and one TAB note. Always use
  // the standard identity so tie keys remain stable across adjacent events.
  const representatives = new Map<string, T>();
  for (const note of notes) {
    if (note.rest || !note.performanceEventId) continue;
    const key = `${note.trackId}:${note.performanceEventId}`;
    const current = representatives.get(key);
    if (!current || (current.tablature && !note.tablature))
      representatives.set(key, note);
  }
  return notes.filter((n) => {
    if (n.rest) return false;
    if (!n.performanceEventId) return true;
    const key = `${n.trackId}:${n.performanceEventId}`;
    return representatives.get(key) === n;
  });
}
