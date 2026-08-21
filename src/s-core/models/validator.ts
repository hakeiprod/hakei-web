import { z } from "zod";
export const PositiveNumberSchema = z.number().positive();
export const NonNegativeNumberSchema = z.number().nonnegative();
export const PositiveIntSchema = PositiveNumberSchema.int();
export const NonNegativeIntSchema = NonNegativeNumberSchema.int();
