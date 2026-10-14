// The package exports its declarations as a subpath but omits the root import types condition.
// Re-export those shipped public types without changing runtime module resolution.
declare module "binary-parser" {
  export { Parser } from "binary-parser/dist/binary_parser";
}
