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
  tabValue?: string;
  string?: number;
  fret?: number;
  anchorRole?: string;
  anchorBounds?: { x: number; y: number; width: number; height: number };
}

export abstract class Element {
  abstract readonly kind: "group" | "glyph" | "line" | "rectangle" | "curve";
  readonly role?: string;
  readonly source?: Readonly<Source>;
  readonly classList: readonly string[];

  readonly tabValue?: string;
  readonly string?: number;
  readonly fret?: number;
  readonly anchorRole?: string;
  readonly anchorBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  constructor(options: ElementOptions = {}) {
    this.tabValue = options.tabValue;
    this.string = options.string;
    this.fret = options.fret;
    this.anchorRole = options.anchorRole;
    this.anchorBounds = options.anchorBounds
      ? { ...options.anchorBounds }
      : undefined;
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
