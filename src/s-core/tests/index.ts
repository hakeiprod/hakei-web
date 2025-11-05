import path from "node:path";
import * as Core from "../models/core";

export const importCore = async (fileName: string) =>
  Core.Score.create(
    await import(path.join("..", "fixtures", "core", `${fileName}.json`))
  );
