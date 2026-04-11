import { atomWithStorage } from "jotai/utils";

export const masterVolumeAtom = atomWithStorage(
  "masterVolume",
  100,
  undefined,
  { getOnInit: true },
);
