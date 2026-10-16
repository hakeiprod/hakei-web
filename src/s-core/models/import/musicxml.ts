import { parseStringPromise, processors } from "xml2js";
import { partialScoreSchema, type ConversionIssue } from "./contracts";
import {
  beamSchema,
  stemSchema,
  notatedTypeSchema,
  sheetScoreSchema,
} from "./score-schema";
interface Xml {
  $?: Record<string, string>;
  _?: string | number;
  $$?: Xml[];
  "#name"?: string;
  [key: string]: unknown;
}
function children(node: Xml, name: string): Xml[] {
  const items = node[name];
  return Array.isArray(items) ? (items as Xml[]) : [];
}
function first(node: Xml, name: string) {
  return children(node, name)[0];
}
function text(node: Xml | undefined): string | undefined {
  return node && (typeof node._ === "string" || typeof node._ === "number")
    ? String(node._)
    : undefined;
}
function number(node: Xml | undefined) {
  const value = text(node);
  return value === undefined || value.trim() === "" ? undefined : Number(value);
}
const steps: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
export async function convertMusicXml(bytes: Uint8Array) {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("INVALID_XML_ENCODING");
  }
  // sax/xml2js does not retrieve external resources. Reject declarations that could define entities.
  if (/<!ENTITY/i.test(source) || /<!DOCTYPE[^>]*\[/i.test(source))
    throw new Error("XML_ENTITY_FORBIDDEN");
  source = source.replace(
    /<!DOCTYPE\s+score-partwise\s+(?:PUBLIC\s+"[^"]*"\s+"[^"]*"|SYSTEM\s+"[^"]*")\s*>/i,
    "",
  );
  if (/<!DOCTYPE/i.test(source)) throw new Error("INVALID_XML_DOCTYPE");
  const document = (await parseStringPromise(source, {
    valueProcessors: [processors.parseNumbers],
    explicitArray: true,
    explicitChildren: true,
    preserveChildrenOrder: true,
    explicitCharkey: true,
    strict: true,
  })) as Record<string, Xml>;
  const root = document["score-partwise"];
  if (!root || root.$?.version !== "4.0") throw new Error("UNSUPPORTED_FORMAT");
  const parts = children(root, "part");
  if (parts.length === 0) throw new Error("EMPTY_SCORE");
  const issues: ConversionIssue[] = [];
  const notes: {
    id: number;
    trackId: number;
    staveId: number;
    chordId?: number;
    pitch: number | null;
    start: number | null;
    duration: number | null;
    end: number | null;
    rest: boolean;
    voice: number;
    velocity: number;
    ties?: string[];
    notatedType?: {
      _: import("../../const/musicxml/4.0/musicxml").NormalType["_"];
    };
    notatedDots?: number;
    beam?: unknown;
    stem?: unknown;
  }[] = [];
  const tracks: {
    id: number;
    name: string;
    preset: number;
    staffDetails: object;
    start: number;
    duration: number;
    end: number;
  }[] = [];
  const masterbars: {
    id: number;
    start: number;
    duration: number;
    end: number;
  }[] = [];
  const bars: { id: number; trackId: number }[] = [];
  const staves: {
    id: number;
    trackId: number;
    barId: number;
    clefs: object[];
  }[] = [];
  const chords: { id: number }[] = [];
  const tempos: { start: number; value: number }[] = [];
  const timesignatures: {
    start: number;
    numerator: number;
    denominator: number;
  }[] = [];
  const keysignatures: {
    start: number;
    accidental: number;
    tonality: 0 | 1;
  }[] = [];
  function issue(
    code: string,
    severity: "WARNING" | "BLOCKING",
    message: string,
    track?: number,
    bar?: number,
  ) {
    issues.push({
      id: `xml:${issues.length}`,
      code,
      severity,
      status: "UNRESOLVED",
      message,
      ...(["MISSING_PITCH", "MISSING_DURATION"].includes(code)
        ? {
            fieldPath: `notes.${notes.length}.${code === "MISSING_PITCH" ? "pitch" : "duration"}`,
          }
        : {}),
      ...(track === undefined ? {} : { track }),
      ...(bar === undefined ? {} : { bar }),
    });
  }
  function scan(node: Xml, track: number) {
    const name = node["#name"];
    if (
      ["repeat", "ending", "segno", "coda"].includes(name ?? "") ||
      (name === "sound" &&
        ["dacapo", "dalsegno", "tocoda", "fine"].some(
          (key) => node.$?.[key] !== undefined,
        ))
    )
      issue(
        "UNSUPPORTED_REPEAT",
        "BLOCKING",
        "反復・別エンディングなどの演奏順を展開できません。",
        track,
      );
    if (["lyric", "ornaments", "print", "articulations"].includes(name ?? ""))
      issue(
        "DISPLAY_INFORMATION_OMITTED",
        "WARNING",
        "歌詞・装飾・印刷情報の一部は表示できません。",
        track,
      );
    for (const child of node.$$ ?? []) scan(child, track);
  }
  const partNames = new Map(
    children(first(root, "part-list") ?? {}, "score-part").map((part) => [
      part.$?.id,
      text(first(part, "part-name")) ?? "",
    ]),
  );
  for (const [trackId, part] of parts.entries()) {
    scan(part, trackId);
    let divisions: number | undefined;
    let nominal = 4;
    let measureStart = 0;
    let staveCount = 1;
    let clefs: object[] = [];
    const measures = children(part, "measure");
    for (const [barId, measure] of measures.entries()) {
      let cursor: number | null = 0;
      let maxEnd = 0;
      let previousOnset: number | null = null;
      let previousChord: number | undefined;
      // Event kinds include shared validation and timing state across branches.

      for (const child of measure.$$ ?? []) {
        const name = child["#name"];
        // eslint-disable-next-line unicorn/prefer-switch
        if (name === "attributes") {
          const declared = number(first(child, "divisions"));
          if (declared !== undefined) {
            if (!Number.isFinite(declared) || declared <= 0)
              throw new Error("INVALID_XML_DIVISIONS");
            divisions = declared;
          }
          const stavesValue = number(first(child, "staves"));
          if (stavesValue !== undefined) {
            if (
              !Number.isInteger(stavesValue) ||
              stavesValue < 1 ||
              stavesValue > 16
            )
              throw new Error("INVALID_XML_STAVES");
            staveCount = stavesValue;
          }
          if (children(child, "clef").length > 0)
            clefs = children(child, "clef");
          for (const time of children(child, "time")) {
            const beats = text(first(time, "beats"));
            const denominator = number(first(time, "beat-type"));
            const numerator = beats
              ?.split("+")
              .reduce((sum, value) => sum + Number(value), 0);
            if (
              !numerator ||
              !Number.isInteger(numerator) ||
              !denominator ||
              !Number.isInteger(Math.log2(denominator))
            ) {
              issue(
                "UNSUPPORTED_METER",
                "BLOCKING",
                "拍子を確定できません。",
                trackId,
                barId,
              );
              continue;
            }
            nominal = (numerator * 4) / denominator;
            timesignatures.push({
              start: measureStart + (cursor ?? 0),
              numerator,
              denominator,
            });
          }
          for (const key of children(child, "key")) {
            const accidental = number(first(key, "fifths"));
            if (
              accidental === undefined ||
              !Number.isInteger(accidental) ||
              Math.abs(accidental) > 7
            ) {
              issue(
                "UNSUPPORTED_KEY",
                "BLOCKING",
                "調号を確定できません。",
                trackId,
                barId,
              );
              continue;
            }
            keysignatures.push({
              start: measureStart + (cursor ?? 0),
              accidental,
              tonality: text(first(key, "mode")) === "minor" ? 1 : 0,
            });
          }
        } else if (name === "backup" || name === "forward") {
          const value = number(first(child, "duration"));
          if (value === undefined || value <= 0 || divisions === undefined) {
            cursor = null;
            issue(
              "UNKNOWN_CURSOR_DURATION",
              "BLOCKING",
              "声部の時刻移動を確定できません。",
              trackId,
              barId,
            );
            continue;
          }
          if (cursor !== null) {
            cursor += ((name === "backup" ? -1 : 1) * value) / divisions;
            if (cursor < -1e-9) throw new Error("INVALID_XML_BACKUP");
            cursor = Math.max(0, cursor);
            maxEnd = Math.max(maxEnd, cursor);
          }
          previousOnset = null;
          previousChord = undefined;
        } else if (name === "direction" || name === "sound") {
          const offset = number(first(child, "offset"));
          if (
            cursor === null ||
            (offset !== undefined && divisions === undefined)
          ) {
            issue(
              "MISSING_TEMPO_TIME",
              "BLOCKING",
              "テンポ指示の位置を確定できません。",
              trackId,
              barId,
            );
            continue;
          }
          const position =
            measureStart +
            cursor +
            (offset === undefined ? 0 : offset / divisions!);
          if (!Number.isFinite(position) || position < 0)
            throw new Error("INVALID_XML_TEMPO_OFFSET");
          const sounds = name === "sound" ? [child] : children(child, "sound");
          let hasTempo = false;
          for (const sound of sounds)
            if (sound.$?.tempo !== undefined) {
              const value = Number(sound.$.tempo);
              if (!Number.isFinite(value) || value <= 0)
                throw new Error("INVALID_XML_TEMPO");
              tempos.push({ start: position, value });
              hasTempo = true;
            }
          if (!hasTempo)
            for (const directionType of children(child, "direction-type"))
              for (const metronome of children(directionType, "metronome")) {
                const units: Record<string, number> = {
                  whole: 4,
                  half: 2,
                  quarter: 1,
                  eighth: 0.5,
                  "16th": 0.25,
                  "32nd": 0.125,
                  "64th": 0.0625,
                };
                const unit = units[text(first(metronome, "beat-unit")) ?? ""];
                const perMinute = number(first(metronome, "per-minute"));
                const dots = children(metronome, "beat-unit-dot").length;
                if (
                  unit === undefined ||
                  perMinute === undefined ||
                  !Number.isFinite(perMinute) ||
                  perMinute <= 0 ||
                  dots > 4
                ) {
                  issue(
                    "UNSUPPORTED_METRONOME",
                    "BLOCKING",
                    "メトロノーム指示を確定できません。",
                    trackId,
                    barId,
                  );
                  continue;
                }
                tempos.push({
                  start: position,
                  value: perMinute * unit * (2 - Math.pow(2, -dots)),
                });
              }
        } else if (name === "note") {
          if (notes.length >= 10_000) throw new Error("NOTE_LIMIT");
          const rest = children(child, "rest").length > 0;
          const chord = children(child, "chord").length > 0;
          if (chord && previousOnset === null)
            throw new Error("INVALID_XML_CHORD");
          const start = chord ? previousOnset : cursor;
          const rawDuration = number(first(child, "duration"));
          const duration =
            divisions !== undefined &&
            rawDuration !== undefined &&
            rawDuration > 0
              ? rawDuration / divisions
              : null;
          if (duration === null)
            issue(
              "MISSING_DURATION",
              "BLOCKING",
              "音価またはdivisionsが不明です。",
              trackId,
              barId,
            );
          let pitch: number | null = rest ? 0 : null;
          if (!rest) {
            const data = first(child, "pitch");
            const step = text(first(data ?? {}, "step"));
            const octave = number(first(data ?? {}, "octave"));
            const alter = number(first(data ?? {}, "alter")) ?? 0;
            if (
              step !== undefined &&
              steps[step] !== undefined &&
              octave !== undefined &&
              Number.isInteger(octave) &&
              Number.isInteger(alter)
            ) {
              const value = (octave + 1) * 12 + steps[step] + alter;
              if (value >= 0 && value <= 127) pitch = value;
            }
            if (pitch === null)
              issue(
                "MISSING_PITCH",
                "BLOCKING",
                "無音高・微分音または不明な音高を確認してください。",
                trackId,
                barId,
              );
          }
          const voice = number(first(child, "voice")) ?? 1;
          const staveId = (number(first(child, "staff")) ?? 1) - 1;
          if (
            !Number.isInteger(voice) ||
            voice < 0 ||
            !Number.isInteger(staveId) ||
            staveId < 0 ||
            staveId >= staveCount
          )
            throw new Error("INVALID_XML_VOICE_STAFF");
          if (!chord) {
            previousChord = chords.length;
            chords.push({ id: previousChord });
          }
          const ties = children(child, "tie")
            .map((tie) => tie.$?.type)
            .filter(
              (type): type is string => type === "start" || type === "stop",
            );
          const beams = beamSchema.safeParse(children(child, "beam"));
          const stem = stemSchema.safeParse(first(child, "stem"));
          if (!beams.success || (first(child, "stem") && !stem.success))
            issue(
              "DISPLAY_INFORMATION_OMITTED",
              "WARNING",
              "連桁・符幹の一部を表示できません。",
              trackId,
              barId,
            );
          const declaredType = notatedTypeSchema.safeParse({
            _: text(first(child, "type")),
          });
          const dots = children(child, "dot").length;
          if (dots > 4)
            issue(
              "UNSUPPORTED_DOT_DISPLAY",
              "WARNING",
              "5個以上の付点表示には対応していません。",
              trackId,
              barId,
            );
          const note = {
            id: notes.filter((note) => note.trackId === trackId).length,
            trackId,
            staveId,
            chordId: previousChord,
            pitch,
            start: start === null ? null : measureStart + start,
            duration,
            end:
              start === null || duration === null
                ? null
                : measureStart + start + duration,
            rest,
            voice,
            velocity: 102,
            ...(beams.success && beams.data.length > 0
              ? { beam: beams.data }
              : {}),
            ...(stem.success ? { stem: stem.data } : {}),
            ...(declaredType.success
              ? {
                  notatedType: declaredType.data,
                  notatedDots: Math.min(dots, 4),
                }
              : {}),
            ...(ties.length > 0 ? { ties } : {}),
          };
          notes.push(note);
          if (!chord) {
            previousOnset = cursor;
            cursor =
              cursor === null || duration === null ? null : cursor + duration;
          }
          if (start !== null && duration !== null)
            maxEnd = Math.max(maxEnd, start + duration);
        }
      }
      const duration =
        measure.$?.implicit === "yes" ? maxEnd : Math.max(nominal, maxEnd);
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error("INVALID_XML_MEASURE");
      if (trackId === 0)
        masterbars.push({
          id: barId,
          start: measureStart,
          duration,
          end: measureStart + duration,
        });
      else if (
        !masterbars[barId] ||
        Math.abs(masterbars[barId].start - measureStart) > 1e-9 ||
        Math.abs(masterbars[barId].duration - duration) > 1e-9
      )
        issue(
          "PART_TIMELINE_CONFLICT",
          "BLOCKING",
          "パート間の小節位置が一致しません。",
          trackId,
          barId,
        );
      bars.push({ id: barId, trackId });
      for (let id = 0; id < staveCount; id++)
        staves.push({ id, trackId, barId, clefs });
      measureStart += duration;
      if (measureStart > 40_000) throw new Error("SCORE_SPAN_LIMIT");
    }
    tracks.push({
      id: trackId,
      name: partNames.get(part.$?.id) ?? "",
      preset: 0,
      staffDetails: { "staff-lines": [{ _: 5 }] },
      start: 0,
      duration: measureStart,
      end: measureStart,
    });
  }
  if (notes.length === 0) throw new Error("EMPTY_SCORE");
  const total = Math.max(...tracks.map((track) => track.end));
  function metadata<T extends { start: number }>(
    entries: T[],
    fallback: T,
    code: string,
  ) {
    const byTime = new Map<number, T>();
    for (const entry of entries) {
      const existing = byTime.get(entry.start);
      if (existing && JSON.stringify(existing) !== JSON.stringify(entry))
        issue(code, "BLOCKING", "パート間の演奏設定が一致しません。");
      byTime.set(entry.start, entry);
    }
    if (!byTime.has(0)) {
      byTime.set(0, fallback);
      issue(
        `DEFAULT_${code}`,
        "WARNING",
        `開始位置の演奏設定を補完しました: ${JSON.stringify(fallback)}`,
      );
    }
    const sorted = [...byTime.values()].toSorted((a, b) => a.start - b.start);
    return sorted.map((entry, index) => ({
      ...entry,
      end: sorted[index + 1]?.start ?? total,
      duration: (sorted[index + 1]?.start ?? total) - entry.start,
    }));
  }
  const normalized = {
    tempos: metadata(tempos, { start: 0, value: 120 }, "TEMPO"),
    timesignatures: metadata(
      timesignatures,
      { start: 0, numerator: 4, denominator: 4 },
      "METER",
    ),
    keysignatures: metadata(
      keysignatures,
      { start: 0, accidental: 0, tonality: 0 as const },
      "KEY",
    ),
  };
  if (
    issues.some((issue) => issue.code === "PART_TIMELINE_CONFLICT") ||
    notes.some(
      (note) =>
        note.pitch === null || note.start === null || note.duration === null,
    )
  ) {
    const candidate = partialScoreSchema.parse({
      format: "converted-partial-v1",
      notation: {
        layoutIncomplete: issues.some(
          (issue) => issue.code === "PART_TIMELINE_CONFLICT",
        ),
        tracks,
        masterbars,
        bars,
        staves,
        chords,
        rows: [],
        slots: [],
        ...normalized,
      },
      tracks: tracks.map(({ id, name, preset }) => ({ id, name, preset })),
      notes: notes.map((note) => ({
        id: String(note.id),
        trackId: note.trackId,
        pitch: note.pitch,
        onset: note.start,
        duration: note.duration,
        velocity: note.velocity,
        rest: note.rest,
        voice: note.voice,
        staveId: note.staveId,
        ...(note.chordId === undefined ? {} : { chordId: note.chordId }),
        ...(note.ties ? { ties: note.ties } : {}),
        ...(note.beam ? { beam: note.beam } : {}),
        ...(note.stem ? { stem: note.stem } : {}),
        ...(note.notatedType
          ? { notatedType: note.notatedType, notatedDots: note.notatedDots }
          : {}),
      })),
      ...Object.fromEntries(
        Object.entries(normalized).map(([key, items]) => [
          key,
          items.map((item) =>
            Object.fromEntries(
              Object.entries(item).filter(
                ([field]) => field !== "end" && field !== "duration",
              ),
            ),
          ),
        ]),
      ),
    });
    return { candidate, issues };
  }
  const candidate = sheetScoreSchema.parse({
    name:
      text(first(root, "work") && first(first(root, "work")!, "work-title")) ??
      "",
    notes,
    tracks,
    masterbars,
    bars,
    staves,
    chords,
    rows: [],
    slots: [],
    ...normalized,
  });
  return { candidate, issues };
}
