import { z } from "zod";
const values = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7] as const;
export const keyAccidentalSchema = z.union(
  values.map((value) => z.literal(value)),
);
