/** Supported source declarations, shared by the converter and its UI. */
export const musicXmlVersions = ["2.0", "3.0", "3.1", "4.0"] as const;
export type MusicXmlVersion = (typeof musicXmlVersions)[number];
export function isMusicXmlVersion(value: unknown): value is MusicXmlVersion {
  return (
    typeof value === "string" &&
    (musicXmlVersions as readonly string[]).includes(value)
  );
}
