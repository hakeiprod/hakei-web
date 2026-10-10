import { atomWithStorage } from "jotai/utils";

export const debugAtom = atomWithStorage("debug", true, undefined, {
  getOnInit: true,
});
