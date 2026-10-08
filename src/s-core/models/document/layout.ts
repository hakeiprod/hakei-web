/** Coordinates use staff spaces, with positive y pointing downwards. */
export interface Point {
  x: number;
  y: number;
}

export interface Bounds extends Point {
  width: number;
  height: number;
}
