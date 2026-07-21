import { LayoutType } from "@/s-core/models/sheet";
import { atomWithStorage } from "jotai/utils";

export const layoutTypeAtom = atomWithStorage(
  "layoutType",
  LayoutType.Horizontal,
  undefined,
  { getOnInit: true },
);
