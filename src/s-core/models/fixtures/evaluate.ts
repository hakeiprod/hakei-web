import * as Drawing from "../document";
import type { Assertion, Result, Selector } from "./manifest";
export interface DrawingRecord {
  direction?: "up" | "down";
  tabValue?: string;
  string?: number;
  fret?: number;
  anchorRole?: string;
  kind?: string;
  role?: string;
  glyphName?: string;
  source?: Drawing.Source;
  x?: number;
  y?: number;
  pageIndex?: number;
  bounds?: Drawing.Bounds;
  pageBounds?: Drawing.Bounds;
  start?: Drawing.Point;
  end?: Drawing.Point;
  relationId?: string;
  part?: string;
  startNote?: { trackId: number; noteId: number };
  endNote?: { trackId: number; noteId: number };
}
export function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function valueAt(value: unknown, path: string): unknown {
  let current = value;
  for (const key of path.split(".")) {
    if (
      ["__proto__", "prototype", "constructor"].includes(key) ||
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key)
    )
      return null;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? null;
}
export function matches(record: DrawingRecord, selector: Selector): boolean {
  return Object.entries(selector)
    .filter(([key]) => key !== "path")
    .every(([key, value]) => {
      const actual = record[key as keyof DrawingRecord];
      return value && typeof value === "object"
        ? Object.entries(value).every(
            ([k, v]) =>
              actual != null &&
              typeof actual === "object" &&
              (actual as Record<string, unknown>)[k] === v,
          )
        : actual === value;
    });
}
export function documentRecords(document: Drawing.Document): DrawingRecord[] {
  const result: DrawingRecord[] = [];
  for (const [pageIndex, page] of document.pages.entries()) {
    const visit = (elements: readonly Drawing.Element[], x = 0, y = 0) => {
      for (const element of elements) {
        const record: DrawingRecord = {
          ...element,
          pageIndex,
          pageBounds: { x: 0, y: 0, width: page.width, height: page.height },
        };
        if (element instanceof Drawing.Group) {
          if (element.role === "tab-fret") {
            record.tabValue = element.children
              .filter(
                (element): element is Drawing.Glyph =>
                  element instanceof Drawing.Glyph,
              )
              .map((g) =>
                g.glyphName?.startsWith("timeSig") &&
                g.codepoint === 0xe0_80 + Number(g.glyphName.slice(7))
                  ? g.glyphName.slice(7)
                  : "?",
              )
              .join("");
          }
          record.x = x + element.position.x;
          record.y = y + element.position.y;
          const firstDigit = element.children.find(
            (element): element is Drawing.Glyph =>
              element instanceof Drawing.Glyph && element.role === "tab-digit",
          );
          const digitCenter = firstDigit
            ? y + firstDigit.bounds.y + firstDigit.bounds.height / 2
            : undefined;
          visit(element.children, record.x, record.y);
          if (digitCenter !== undefined) {
            record.y = digitCenter;
            const gs = element.children.filter(
              (element): element is Drawing.Glyph =>
                element instanceof Drawing.Glyph &&
                element.role === "tab-digit",
            );
            const left = Math.min(...gs.map((g) => x + g.bounds.x)),
              top = Math.min(...gs.map((g) => y + g.bounds.y)),
              right = Math.max(
                ...gs.map((g) => x + g.bounds.x + g.bounds.width),
              ),
              bottom = Math.max(
                ...gs.map((g) => y + g.bounds.y + g.bounds.height),
              );
            record.bounds = {
              x: left,
              y: top,
              width: right - left,
              height: bottom - top,
            };
          }
        } else if (element instanceof Drawing.Glyph) {
          record.x = x + element.position.x;
          record.y = y + element.position.y;
          record.bounds = {
            ...element.bounds,
            x: x + element.bounds.x,
            y: y + element.bounds.y,
          };
        } else if ("start" in element && "end" in element) {
          const line = element as Drawing.Line;
          record.start = { x: x + line.start.x, y: y + line.start.y };
          record.end = { x: x + line.end.x, y: y + line.end.y };
          if (element.role === "stem")
            record.direction = record.end.y < record.start.y ? "up" : "down";
          record.x = record.start.x;
          record.y = record.start.y;
          if ("bounds" in element) {
            const bounds = element.bounds as Drawing.Bounds;
            record.bounds = { ...bounds, x: x + bounds.x, y: y + bounds.y };
          }
        }
        result.push(record);
      }
    };
    visit(page.elements);
  }
  return result;
}
export function evaluateAssertion(
  fixtureId: string,
  assertion: Assertion,
  records: readonly DrawingRecord[],
  data?: unknown,
): Result {
  const selected = records.filter((record) =>
    matches(record, assertion.selector),
  );
  let actual: unknown = null;
  let pass = false;
  try {
    switch (assertion.kind) {
      case "count": {
        actual = selected.length;
        pass = actual === assertion.expected;
        break;
      }
      case "absent": {
        actual = selected.length;
        pass = actual === 0;
        break;
      }
      case "value": {
        actual = valueAt(data, assertion.selector.path ?? "");
        pass = canonical(actual) === canonical(assertion.expected);
        break;
      }
      case "relativePosition": {
        const expected = assertion.expected as {
          axis: "x" | "y";
          value?: number;
          tolerance?: number;
          relativeTo?: Selector;
          relation?: "above" | "below" | "left" | "right";
          minGap?: number;
          offset?: number;
        };
        if (!["x", "y"].includes(expected.axis))
          throw new Error("Position assertion needs axis");
        actual = selected.map((record) => record[expected.axis]);
        const other = expected.relativeTo
          ? records.find((record) => matches(record, expected.relativeTo!))
          : undefined;
        pass =
          selected.length > 0 &&
          selected.every((record) => {
            const value = record[expected.axis];
            if (value === undefined || !Number.isFinite(value)) return false;
            if (other) {
              const reference = other[expected.axis];
              if (reference === undefined) return false;
              if (expected.offset !== undefined)
                return (
                  Math.abs(value - reference - expected.offset) <=
                  (expected.tolerance ?? 1e-6)
                );
              return ["above", "left"].includes(expected.relation ?? "")
                ? value <= reference - (expected.minGap ?? 0)
                : value >= reference + (expected.minGap ?? 0);
            }
            return (
              expected.value !== undefined &&
              Math.abs(value - expected.value) <= (expected.tolerance ?? 1e-6)
            );
          });
        break;
      }
      case "tieEndpoints": {
        const expected = assertion.expected as {
          startNote: DrawingRecord["startNote"];
          endNote: DrawingRecord["endNote"];
          part?: string;
          count?: number;
        };
        actual = selected.map(({ startNote, endNote, part }) => ({
          startNote,
          endNote,
          part,
        }));
        pass =
          selected.length === (expected.count ?? 1) &&
          selected.every(
            (r) =>
              canonical(r.startNote) === canonical(expected.startNote) &&
              canonical(r.endNote) === canonical(expected.endNote) &&
              (!expected.part || r.part === expected.part) &&
              r.start &&
              r.end &&
              r.end.x > r.start.x,
          );
        break;
      }
      case "staffGap": {
        const gap =
          typeof assertion.expected === "number" ? assertion.expected : 0;
        actual = selected.map((n) => {
          const b = n.bounds;
          if (!b) return false;
          return !records.some(
            (line) =>
              line.role === "staff-line" &&
              line.pageIndex === n.pageIndex &&
              line.source?.trackId === n.source?.trackId &&
              line.source?.staveId === n.source?.staveId &&
              line.source?.barId === n.source?.barId &&
              line.start &&
              line.end &&
              Math.abs(line.start.y - n.y!) < 1e-6 &&
              line.end.x > b.x - gap + 1e-6 &&
              line.start.x < b.x + b.width + gap - 1e-6,
          );
        });
        pass = selected.length > 0 && (actual as boolean[]).every(Boolean);
        break;
      }
      case "bounds": {
        actual = selected.map((record) => record.bounds ?? null);
        pass =
          selected.length > 0 &&
          selected.every(
            ({ bounds, pageBounds }) =>
              bounds &&
              pageBounds &&
              Object.values(bounds).every(Number.isFinite) &&
              bounds.width > 0 &&
              bounds.height > 0 &&
              bounds.x >= -1e-6 &&
              bounds.y >= -1e-6 &&
              bounds.x + bounds.width <= pageBounds.width + 1e-6 &&
              bounds.y + bounds.height <= pageBounds.height + 1e-6,
          );
        break;
      }
    }
    return {
      fixtureId,
      assertionId: assertion.id,
      stage: assertion.stage,
      expected: assertion.expected,
      actual: JSON.parse(canonical(actual)),
      status: pass ? "pass" : "fail",
      message: pass
        ? "Expected condition satisfied"
        : `Expected ${canonical(assertion.expected)}; received ${canonical(actual)}`,
    };
  } catch (error) {
    return {
      fixtureId,
      assertionId: assertion.id,
      stage: assertion.stage,
      expected: assertion.expected,
      actual: null,
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
