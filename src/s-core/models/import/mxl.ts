import JSZip from "jszip";
import { parseStringPromise } from "xml2js";
// JSZip exposes this public API; its bundled typings currently omit ZipObject.internalStream.
interface ZipStream {
  on(event: "data", callback: (chunk: Uint8Array) => void): ZipStream;
  on(event: "end" | "error", callback: () => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
}
function safePath(name: string) {
  if (
    !name ||
    name.startsWith("/") ||
    /[\\\u0000:]/.test(name) ||
    name.split("/").some((part) => part === ".." || part === ".") ||
    /%(?:2e|2f|5c)/i.test(name)
  )
    throw new Error("INVALID_MXL_PATH");
}
/** Expand in memory, counting actual output bytes before retaining them. Never extracts to disk. */
const defaultLimits = { maxExpandedBytes: 20 * 1024 * 1024, maxEntries: 100 };
export async function extractMxl(bytes: Uint8Array, limits = defaultLimits) {
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("INPUT_LIMIT");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let footer = -1;
  for (
    let offset = bytes.length - 22;
    offset >= Math.max(0, bytes.length - 65_557);
    offset--
  ) {
    if (
      view.getUint32(offset, true) === 0x06_05_4b_50 &&
      offset + 22 + view.getUint16(offset + 20, true) === bytes.length
    ) {
      footer = offset;
      break;
    }
  }
  if (
    footer === -1 ||
    view.getUint16(footer + 4, true) !== 0 ||
    view.getUint16(footer + 6, true) !== 0
  )
    throw new Error("INVALID_MXL_DIRECTORY");
  const declaredEntries = view.getUint16(footer + 10, true);
  if (declaredEntries > limits.maxEntries) throw new Error("ENTRY_LIMIT");
  if (view.getUint16(footer + 8, true) !== declaredEntries)
    throw new Error("INVALID_MXL_DIRECTORY");
  const zip = await JSZip.loadAsync(bytes, {
    checkCRC32: false,
    createFolders: false,
  });
  const entries = Object.values(zip.files);
  if (entries.length > limits.maxEntries) throw new Error("ENTRY_LIMIT");
  if (entries.length !== declaredEntries)
    throw new Error("INVALID_MXL_DIRECTORY");
  for (const entry of entries) {
    safePath(entry.name);
    if (entry.unsafeOriginalName) safePath(entry.unsafeOriginalName);
  }
  let expanded = 0;
  async function consume(entry: JSZip.JSZipObject, retain: boolean) {
    const stream = (
      entry as JSZip.JSZipObject & {
        internalStream(type: "uint8array"): ZipStream;
      }
    ).internalStream("uint8array");
    const chunks: Uint8Array[] = [];
    let retained = 0;
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      let settled = false;
      stream.on("data", (raw: Uint8Array) => {
        if (settled) return;
        expanded += raw.byteLength;
        if (expanded > limits.maxExpandedBytes) {
          settled = true;
          stream.pause();
          reject(new Error("EXPANSION_LIMIT"));
          return;
        }
        if (retain) {
          chunks.push(new Uint8Array(raw));
          retained += raw.byteLength;
        }
      });
      stream.on("error", () => {
        if (!settled) {
          settled = true;
          reject(new Error("INVALID_MXL_COMPRESSION"));
        }
      });
      stream.on("end", () => {
        if (!settled) {
          settled = true;
          if (!retain) {
            resolve(null);
            return;
          }
          const output = new Uint8Array(retained);
          let offset = 0;
          for (const chunk of chunks) {
            output.set(chunk, offset);
            offset += chunk.byteLength;
          }
          resolve(output);
        }
      });
      stream.resume();
    });
  }
  const container = zip.files["META-INF/container.xml"];
  if (!container || container.dir) throw new Error("INVALID_MXL_CONTAINER");
  const containerBytes = (await consume(container, true))!;
  const source = new TextDecoder("utf-8", { fatal: true }).decode(
    containerBytes,
  );
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error("XML_ENTITY_FORBIDDEN");
  const parsed = (await parseStringPromise(source, {
    explicitArray: true,
    strict: true,
  })) as {
    container?: {
      rootfiles?: { rootfile?: { $?: Record<string, string> }[] }[];
    };
  };
  const roots = parsed.container?.rootfiles?.[0]?.rootfile;
  if (!roots?.length) throw new Error("INVALID_MXL_ROOT");
  for (const root of roots) {
    const path = root.$?.["full-path"];
    if (!path) throw new Error("INVALID_MXL_ROOT");
    safePath(path);
  }
  const candidates = roots.filter(
    (root) =>
      root.$?.["media-type"] === "application/vnd.recordare.musicxml+xml" ||
      (!root.$?.["media-type"] &&
        /\.(xml|musicxml)$/i.test(root.$?.["full-path"] ?? "")),
  );
  if (candidates.length === 0) throw new Error("INVALID_MXL_ROOT");
  const paths = new Set(candidates.map((root) => root.$!["full-path"]));
  const retained = new Map<string, Uint8Array>();
  // Include alternate files in the same expanded-byte budget before selecting a root.
  for (const entry of entries) {
    if (entry.dir || entry === container) continue;
    const data = await consume(entry, paths.has(entry.name));
    if (data) retained.set(entry.name, data);
  }
  for (const root of candidates) {
    const path = root.$!["full-path"],
      data = retained.get(path);
    if (!data || path === "META-INF/container.xml")
      throw new Error("INVALID_MXL_ROOT");
    if (root.$?.["media-type"] === "application/vnd.recordare.musicxml+xml")
      return data;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text))
      throw new Error("XML_ENTITY_FORBIDDEN");
    let parsed: Record<string, unknown>;
    try {
      parsed = await parseStringPromise(text, { strict: true });
    } catch {
      throw new Error("INVALID_MXL_ROOT");
    }
    if (
      ["score-partwise", "score-timewise", "opus"].some(
        (name) => name in parsed,
      )
    )
      return data;
  }
  throw new Error("INVALID_MXL_ROOT");
}
