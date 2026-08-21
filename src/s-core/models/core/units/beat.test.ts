import { describe, expect, it } from "vitest";
import { Beat } from "./beat";

describe("Beat - Boundary Test", () => {
  describe("Valid values", () => {
    it("should allow positive integer", () => {
      expect(() => new Beat(1)).not.toThrow();
    });

    it("should allow positive float", () => {
      expect(() => new Beat(1.5)).not.toThrow();
    });
  });

  describe("Invalid values", () => {
    it("should allow on zero", () => {
      expect(() => new Beat(0)).toThrow();
    });

    it("should throw error on negative number", () => {
      expect(() => new Beat(-1)).toThrow();
    });
  });
});
