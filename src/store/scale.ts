import { atomWithStorage } from "jotai/utils";

export const scaleAtom = atomWithStorage("scale", 12, undefined, {
  getOnInit: true,
});
