import type { Point } from "./layout";

/** Identifies score data without retaining the score object itself. */
export interface Source {
  rowId?: number;
  barId?: number;
  trackId?: number;
  staveId?: number;
  chordId?: number;
  noteId?: number;
}

export interface ElementOptions {
  role?: string;
  source?: Source;
  classList?: readonly string[];
}

export abstract class Element {
  abstract readonly kind: "group" | "glyph" | "line" | "rectangle";
  readonly role?: string;
  readonly source?: Readonly<Source>;
  readonly classList: readonly string[];

  constructor(options: ElementOptions = {}) {
    this.role = options.role;
    this.source = options.source ? { ...options.source } : undefined;
    this.classList = [...(options.classList ?? [])];
  }
}

export class Group extends Element {
  readonly kind = "group";
  readonly position: Readonly<Point>;
  readonly children: readonly Element[];

  constructor(
    children: readonly Element[] = [],
    options: ElementOptions & { position?: Point } = {},
  ) {
    super(options);
    this.position = { x: 0, y: 0, ...options.position };
    this.children = [...children];
  }
}
