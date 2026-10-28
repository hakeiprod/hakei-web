/** Reference-only acceleration of frozen original getters. Never use for performance. */
type Graph = Record<string, unknown>;
type Getter = (this: object) => unknown;

function rejectMutation() {
  throw new Error("REFERENCE_INPUT_MUTATION");
}

export function referenceMemoization(score: Graph) {
  const checks: (() => void)[] = [];
  let verified = 0;
  let guardedObjects = 0;
  function memo(object: object, names: string[]) {
    for (const name of names) {
      let prototype: object | null = object;
      let getter: Getter | undefined;
      while (prototype && !getter) {
        getter = Object.getOwnPropertyDescriptor(prototype, name)?.get;
        prototype = Object.getPrototypeOf(prototype);
      }
      if (!getter) throw new Error("REFERENCE_GETTER_MISSING");
      const original = getter;
      let present = false;
      let value: unknown;
      Object.defineProperty(object, name, {
        configurable: true,
        get() {
          if (!present) {
            value = original.call(this);
            if (Array.isArray(value)) Object.freeze(value);
            present = true;
          }
          return value;
        },
      });
      checks.push(() => {
        if (!present) return;
        const fresh = original.call(object);
        const equal =
          Array.isArray(value) && Array.isArray(fresh)
            ? value.length === fresh.length &&
              value.every((item, index) => item === fresh[index])
            : Object.is(value, fresh);
        if (!equal) throw new Error("REFERENCE_GETTER_CHANGED");
        verified++;
      });
    }
  }
  const objects = (key: string) => score[key] as object[];
  // Original predicates, comparators, ordering and arithmetic are not replaced.
  for (const note of objects("notes"))
    memo(note, ["track", "stave", "keysignature"]);
  for (const chord of objects("chords"))
    memo(chord, [
      "notes",
      "start",
      "end",
      "slot",
      "stave",
      "track",
      "beamGroup",
    ]);
  for (const slot of objects("slots")) memo(slot, ["chords"]);
  for (const bar of objects("masterbars"))
    memo(bar, ["bars", "notes", "chords", "slots", "events"]);
  for (const bar of objects("bars"))
    memo(bar, [
      "track",
      "masterbar",
      "notes",
      "chords",
      "events",
      "staves",
      "timesignature",
      "keysignature",
    ]);
  for (const stave of objects("staves"))
    memo(stave, ["bar", "notes", "slots", "chords", "beamGroups", "events"]);
  for (const beam of objects("beamGroups"))
    memo(beam, ["firstChord", "lastChord", "stave"]);
  // During Document generation only tie extents may change. Guard all other
  // original graph inputs so a hidden mutation cannot invalidate memoization.
  function guardDocumentInputs() {
    const rows = new Set(objects("rows"));
    const seen = new Set<object>();
    function visit(value: unknown) {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (value instanceof Map || value instanceof Set) {
        for (const entry of value.values()) visit(entry);
        for (const method of value instanceof Map
          ? ["set", "delete", "clear"]
          : ["add", "delete", "clear"])
          Object.defineProperty(value, method, { value: rejectMutation });
      }
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!("value" in descriptor)) continue;
        visit(descriptor.value);
        if (
          rows.has(value) &&
          (key === "notationTop" || key === "notationBottom")
        )
          continue;
        Object.defineProperty(value, key, {
          ...descriptor,
          writable: false,
          configurable: false,
        });
      }
      Object.preventExtensions(value);
      guardedObjects++;
    }
    visit(score);
  }
  let started = false;
  return {
    beginDocument() {
      if (started) throw new Error("REFERENCE_PASS_REUSED");
      started = true;
      for (const slot of objects("slots"))
        memo(slot, ["minWidth", "width", "x"]);
      for (const stave of objects("staves"))
        memo(stave, ["headerWidth", "endPadding", "minWidth", "width"]);
      for (const bar of objects("bars")) memo(bar, ["minWidth", "width"]);
      for (const bar of objects("masterbars"))
        memo(bar, ["minWidth", "width", "x"]);
      for (const row of objects("rows"))
        memo(row, ["masterbars", "minWidth", "width"]);
      guardDocumentInputs();
    },
    verify() {
      for (const check of checks) check();
      return {
        verifiedGetters: verified,
        guardedObjects,
        mode: "original-getters-memoized-reference-only",
      };
    },
  };
}
