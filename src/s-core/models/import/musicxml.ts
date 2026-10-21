/* Normalize parser/model data through the actual JSON transport boundary. */
/* eslint-disable unicorn/prefer-structured-clone */
import {
  staffSettingsSchema,
  type StaffSettings,
} from "../sheet/notation/staff-settings";
import { tablatureSchema, percussionSchema } from "../sheet/notation/schema";
import {
  copyNotation,
  visualTiesSchema,
  notatedPitchSchema,
  explicitAccidentalSchema,
  notationSchema,
  type NotationFields,
} from "../sheet/notation/schema";
import { parseStringPromise, processors } from "xml2js";
import { isMusicXmlVersion } from "./musicxml-support";
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
function reserveVoices(
  node: Xml,
  ids: Map<string, number>,
  reserved: Set<number>,
) {
  if (node["#name"] === "voice") {
    const label = text(node) ?? "1";
    if (/^(0|[1-9]\d*)$/.test(label) && Number.isSafeInteger(Number(label))) {
      reserved.add(Number(label));
      ids.set(label, Number(label));
    }
  }
  for (const child of node.$$ ?? []) reserveVoices(child, ids, reserved);
}
function voiceId(
  label: string,
  ids: Map<string, number>,
  reserved: Set<number>,
) {
  const existing = ids.get(label);
  if (existing !== undefined) return existing;
  let id = 0;
  while (reserved.has(id)) id++;
  reserved.add(id);
  ids.set(label, id);
  return id;
}
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
  let declaredRoot: string | undefined;
  let declaredVersion: string | undefined;
  source = source.replace(
    /<!DOCTYPE\s+(score-partwise|score-timewise|opus)\s+(?:PUBLIC\s+(["'])([^"']*)\2\s+(["'])([^"']*)\4|SYSTEM\s+(["'])([^"']*)\6)\s*>/i,
    (
      _declaration,
      root: string,
      _publicQuote: string,
      publicId: string | undefined,
    ) => {
      declaredRoot = root;
      if (publicId !== undefined) {
        const match =
          /^-\/\/Recordare\/\/DTD MusicXML (\d+\.\d+) (Partwise|Timewise|Opus)\/\/EN$/.exec(
            publicId,
          );
        if (
          !match ||
          (`score-${match[2].toLowerCase()}` !== root &&
            !(root === "opus" && match[2] === "Opus"))
        )
          throw new Error("INVALID_XML_DOCTYPE");
        declaredVersion = match[1];
      }
      return "";
    },
  );
  if (/<!DOCTYPE/i.test(source)) throw new Error("INVALID_XML_DOCTYPE");
  const document = (await parseStringPromise(source, {
    valueProcessors: [
      (value: string, name: string) =>
        name === "voice" ? value : processors.parseNumbers(value),
    ],
    explicitArray: true,
    explicitChildren: true,
    preserveChildrenOrder: true,
    explicitCharkey: true,
    strict: true,
  })) as Record<string, Xml>;
  const root = document["score-partwise"];
  if (!root) throw new Error("UNSUPPORTED_MUSICXML_STRUCTURE");
  const versionFromDoctype =
    root.$?.version === undefined &&
    declaredRoot === "score-partwise" &&
    declaredVersion !== undefined;
  const formatVersion =
    root.$?.version ?? (versionFromDoctype ? declaredVersion : undefined);
  if (!isMusicXmlVersion(formatVersion))
    throw new Error("UNSUPPORTED_MUSICXML_VERSION");
  if (
    (declaredRoot !== undefined && declaredRoot !== "score-partwise") ||
    (declaredVersion !== undefined && declaredVersion !== formatVersion)
  )
    throw new Error("INVALID_XML_DOCTYPE");
  const parts = children(root, "part");
  if (parts.length === 0) throw new Error("EMPTY_SCORE");
  const issues: ConversionIssue[] = [];
  const notes: (NotationFields & {
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
  })[] = [];
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
    staffSettings?: StaffSettings;
  }[] = [];
  const sourceStaves: {
    trackId: number;
    barId: number;
    staveId: number;
    attributes: Xml;
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
    severity: "INFO" | "WARNING" | "BLOCKING",
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
  function scan(node: Xml, track: number, bar?: number) {
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
        bar,
      );
    if (["transpose", "scordatura"].includes(name ?? ""))
      issue(
        "UNSUPPORTED_TRANSPOSE",
        "BLOCKING",
        "移調・変則調弦の演奏音高を確定できません。",
        track,
        bar,
      );
    if (
      ["lyric", "ornaments", "print", "articulations", "harmony"].includes(
        name ?? "",
      )
    )
      issue(
        "DISPLAY_INFORMATION_OMITTED",
        "WARNING",
        "歌詞・装飾・印刷・和声記号の一部は表示できません。",
        track,
        bar,
      );
    let measureIndex = 0;
    for (const child of node.$$ ?? [])
      scan(child, track, child["#name"] === "measure" ? measureIndex++ : bar);
  }
  if (versionFromDoctype)
    issue(
      "MUSICXML_VERSION_FROM_DOCTYPE",
      "INFO",
      `version属性がないため、標準DOCTYPEの宣言${formatVersion}を元バージョンとして使用しました。`,
    );
  const partNames = new Map(
    children(first(root, "part-list") ?? {}, "score-part").map((part) => [
      part.$?.id,
      text(first(part, "part-name")) ?? "",
    ]),
  );
  for (const [trackId, part] of parts.entries()) {
    scan(part, trackId);
    let nextNoteId = 0;
    let divisions: number | undefined;
    let nominal = 4;
    let measureStart = 0;
    let staveCount = 1;
    const clefs = new Map<number, Xml>();
    const settings = new Map<number, StaffSettings>();
    const unsupportedStaves = new Set<number>();
    const instruments = new Map(
      children(first(root, "part-list") ?? {}, "score-part")
        .filter((p) => p.$?.id === part.$?.id)
        .flatMap((p) => children(p, "midi-instrument"))
        .map((index) => [
          index.$?.id,
          {
            source: index,
            midiNote: number(first(index, "midi-unpitched")),
            midiChannel: number(first(index, "midi-channel")),
          },
        ]),
    );
    const voiceIds = new Map<string, number>();
    const reservedVoices = new Set<number>([1]);
    reserveVoices(part, voiceIds, reservedVoices);
    voiceIds.set("1", 1);
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
          for (const clef of children(child, "clef"))
            clefs.set(Number(clef.$?.number ?? 1) - 1, clef);
          for (let id = 0; id < staveCount; id++) {
            const clef = clefs.get(id);
            const sign = text(first(clef ?? {}, "sign"));
            const details = children(child, "staff-details").find(
              (d) => Number(d.$?.number ?? 1) === id + 1,
            );
            const previous = settings.get(id);
            const kind =
              sign === undefined
                ? (previous?.kind ?? "standard")
                : sign === "TAB"
                  ? "tablature"
                  : sign === "percussion"
                    ? "percussion"
                    : "standard";
            if (kind !== "standard" || details || previous) {
              const lineCount =
                number(first(details ?? {}, "staff-lines")) ??
                (previous?.kind === kind ? previous.lineCount : undefined) ??
                (kind === "tablature" ? 6 : 5);
              const tuning = children(details ?? {}, "staff-tuning").map(
                (t) => ({
                  string: lineCount + 1 - Number(t.$?.line),
                  step: text(first(t, "tuning-step")),
                  octave: number(first(t, "tuning-octave")),
                  alter: number(first(t, "tuning-alter")) ?? 0,
                }),
              );
              const result = staffSettingsSchema.safeParse({
                kind,
                lineCount,
                ...(tuning.length > 0
                  ? { tuning }
                  : previous?.kind === kind && previous.tuning
                    ? { tuning: previous.tuning }
                    : {}),
              });
              if (
                result.success &&
                (!previous ||
                  previous.kind !== result.data.kind ||
                  previous.lineCount === result.data.lineCount)
              )
                settings.set(id, result.data);
              else {
                unsupportedStaves.add(id);
                sourceStaves.push({
                  trackId,
                  barId,
                  staveId: id,
                  attributes: child,
                });
                issue(
                  "UNSUPPORTED_STAFF",
                  "WARNING",
                  "譜表の線数・調弦には未対応または矛盾があります。元情報を保持します。",
                  trackId,
                  barId,
                );
              }
            }
          }
          for (const time of children(child, "time")) {
            const beats = text(first(time, "beats"));
            const denominator = number(first(time, "beat-type"));
            const numerator = beats
              ?.split("+")
              .reduce((sum, value) => sum + Number(value), 0);
            if (
              (beats !== undefined &&
                (!/^\d+(?:\+\d+)*$/.test(beats) || !numerator)) ||
              (denominator !== undefined &&
                (!Number.isFinite(denominator) ||
                  !Number.isInteger(denominator) ||
                  denominator <= 0))
            )
              throw new Error("INVALID_XML_METER");
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
              accidental !== undefined &&
              (!Number.isInteger(accidental) || Math.abs(accidental) > 7)
            )
              throw new Error("INVALID_XML_KEY");
            const mode = text(first(key, "mode"));
            if (mode !== undefined && !["major", "minor"].includes(mode))
              issue(
                "UNSUPPORTED_KEY_MODE",
                "BLOCKING",
                "調の種類を確定できません。",
                trackId,
                barId,
              );
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
                  perMinute !== undefined &&
                  (!Number.isFinite(perMinute) || perMinute <= 0)
                )
                  throw new Error("INVALID_XML_TEMPO");
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
          const notation: NotationFields = {};
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
            const spelling = notatedPitchSchema.safeParse({
              step,
              octave,
              alter,
            });
            if (spelling.success) notation.notatedPitch = spelling.data;
            else if (pitch !== null)
              issue(
                "DISPLAY_INFORMATION_OMITTED",
                "WARNING",
                "原譜の音名・変化量の表記には未対応の指定があります。演奏音高は維持します。",
                trackId,
                barId,
              );
            const accidental = first(child, "accidental");
            if (accidental) {
              const rawKind = text(accidental);
              const kind =
                rawKind === "flat-flat"
                  ? "double-flat"
                  : rawKind === "sharp-sharp"
                    ? "double-sharp"
                    : rawKind;
              const explicit = explicitAccidentalSchema.safeParse({
                kind,
                ...(accidental.$?.cautionary === undefined
                  ? {}
                  : { cautionary: accidental.$.cautionary === "yes" }),
                ...(accidental.$?.parentheses === undefined
                  ? {}
                  : { parentheses: accidental.$.parentheses === "yes" }),
              });
              if (explicit.success) notation.explicitAccidental = explicit.data;
              else
                issue(
                  "DISPLAY_INFORMATION_OMITTED",
                  "WARNING",
                  "臨時記号の表示指定に未対応の種類があります。",
                  trackId,
                  barId,
                );
              if (
                Object.keys(accidental.$ ?? {}).some(
                  (key) => !["cautionary", "parentheses"].includes(key),
                )
              )
                issue(
                  "DISPLAY_INFORMATION_OMITTED",
                  "WARNING",
                  "臨時記号の装飾属性の一部を表示できません。",
                  trackId,
                  barId,
                );
            }
            if (!notationSchema.safeParse({ ...notation, pitch }).success) {
              delete notation.explicitAccidental;
              issue(
                "NOTATION_PITCH_MISMATCH",
                "WARNING",
                "臨時記号の指定と演奏音高が一致しません。音高を維持して表記を推定します。原譜を確認してください。",
                trackId,
                barId,
              );
            }
            if (
              pitch === null &&
              !first(child, "unpitched") &&
              children(
                first(first(child, "notations") ?? {}, "technical") ?? {},
                "string",
              ).length === 0
            )
              issue(
                "MISSING_PITCH",
                "BLOCKING",
                "無音高・微分音または不明な音高を確認してください。",
                trackId,
                barId,
              );
          }
          const voice = voiceId(
            text(first(child, "voice")) ?? "1",
            voiceIds,
            reservedVoices,
          );
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
          const rawVisual = children(child, "notations").flatMap((notations) =>
            children(notations, "tied"),
          );
          const display = rawVisual.map((tie) => ({
            type: tie.$?.type,
            ...(tie.$?.number === undefined
              ? {}
              : { number: Number(tie.$.number) }),
            ...(tie.$?.placement === undefined
              ? {}
              : { placement: tie.$.placement }),
            ...(tie.$?.orientation === undefined
              ? {}
              : { orientation: tie.$.orientation }),
          }));
          const visual = visualTiesSchema.safeParse(display);
          const unsupportedShape = rawVisual.some(
            (tie) =>
              Object.keys(tie.$ ?? {}).some(
                (key) =>
                  ![
                    "type",
                    "number",
                    "placement",
                    "orientation",
                    "id",
                  ].includes(key),
              ) ||
              (tie.$?.placement === "above" &&
                tie.$?.orientation === "under") ||
              (tie.$?.placement === "below" && tie.$?.orientation === "over"),
          );
          if ((rawVisual.length > 0 && !visual.success) || unsupportedShape)
            issue(
              "DISPLAY_INFORMATION_OMITTED",
              "WARNING",
              "タイの形状指定の一部を表示できません。通常のタイと演奏指定を確認してください。",
              trackId,
              barId,
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
          const setting = settings.get(staveId);
          let displayIncomplete = unsupportedStaves.has(staveId);
          if (rest && setting?.kind === "percussion") pitch = null;
          if (!rest && setting?.kind === "tablature") {
            const technical = first(
              first(child, "notations") ?? {},
              "technical",
            );
            const tab = tablatureSchema.safeParse({
              string: number(first(technical ?? {}, "string")),
              fret: number(first(technical ?? {}, "fret")),
            });
            if (tab.success && tab.data.string <= setting.lineCount)
              notation.tablature = tab.data;
            else displayIncomplete = true;
            if (
              technical &&
              (technical.$$ ?? []).some(
                (n) => !["string", "fret"].includes(n["#name"] ?? ""),
              )
            ) {
              notation.sourceNotation = JSON.parse(JSON.stringify(child));
              issue(
                "UNSUPPORTED_TECHNIQUE",
                "WARNING",
                "TABの奏法を省略しています。元情報を保持し演奏を無効にします。",
                trackId,
                barId,
              );
            }
          }
          if (
            !rest &&
            (setting?.kind === "percussion" || first(child, "unpitched"))
          ) {
            const unpitched = first(child, "unpitched") ?? {};
            const instrumentId = first(child, "instrument")?.$?.id;
            const midi = instruments.get(instrumentId);
            const head = text(first(child, "notehead")) ?? "normal";
            const parsed = percussionSchema.safeParse({
              displayStep: text(first(unpitched, "display-step")),
              displayOctave: number(first(unpitched, "display-octave")),
              notehead: head,
              instrumentId,
              ...(midi?.midiNote === undefined
                ? {}
                : { midiNote: midi.midiNote - 1 }),
              ...(midi?.midiChannel === undefined
                ? {}
                : { midiChannel: midi.midiChannel - 1 }),
            });
            delete notation.notatedPitch;
            delete notation.explicitAccidental;
            pitch = null;
            if (parsed.success) notation.percussion = parsed.data;
            else displayIncomplete = true;
            if (instrumentId && !midi)
              issue(
                "UNKNOWN_PERCUSSION_INSTRUMENT",
                "WARNING",
                "打楽器の演奏対応が不明です。表示位置は保持します。",
                trackId,
                barId,
              );
            // Ties are rendered; retain all other note-level notation as omitted source.
            const omittedNotations = children(child, "notations").some(
              (notations) =>
                (notations.$$ ?? []).some((item) => item["#name"] !== "tied"),
            );
            const omittedPerformance = Boolean(
              first(child, "grace") || first(child, "play"),
            );
            const headAttributes = first(child, "notehead")?.$;
            const omittedHeadAppearance =
              headAttributes?.parentheses === "yes" ||
              headAttributes?.filled !== undefined;
            if (
              omittedNotations ||
              omittedPerformance ||
              omittedHeadAppearance
            ) {
              notation.sourceNotation = JSON.parse(JSON.stringify(child));
              issue(
                "UNSUPPORTED_TECHNIQUE",
                "WARNING",
                "打楽器の特殊奏法・符頭装飾は表示を省略します。元情報を保持します。",
                trackId,
                barId,
              );
            }
          }
          if (displayIncomplete) {
            notation.sourceNotation = JSON.parse(
              JSON.stringify(
                first(child, "instrument") &&
                  instruments.get(first(child, "instrument")?.$?.id)
                  ? {
                      ...child,
                      sourceInstrument: instruments.get(
                        first(child, "instrument")?.$?.id,
                      )?.source,
                    }
                  : child,
              ),
            );
            issue(
              "UNSUPPORTED_NOTATION",
              "WARNING",
              "表示に必要な情報が不足または未対応です。不完全候補に保持します。",
              trackId,
              barId,
            );
          }
          const note = {
            ...copyNotation(notation),
            id: nextNoteId++,
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
            ...(!rest && ties.length > 0 ? { ties } : {}),
            ...(!rest && rawVisual.length > 0 && visual.success
              ? { visualTies: visual.data }
              : {}),
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
        staves.push({
          id,
          trackId,
          barId,
          clefs: [clefs.get(id) ?? clefs.get(0)].filter(
            (clef) => clef !== undefined,
          ),
          ...(settings.has(id)
            ? { staffSettings: structuredClone(settings.get(id)!) }
            : {}),
        });
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
  const semanticallyComplete = sheetScoreSchema.safeParse({
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
  if (
    !semanticallyComplete.success &&
    !notes.some(
      (n) =>
        n.start === null ||
        n.duration === null ||
        (!n.rest && n.pitch === null && !n.tablature && !n.percussion),
    )
  )
    issue(
      "NOTATION_VALUE_CONFLICT",
      "WARNING",
      "表記と音高・調弦・弦指定が一致しません。既知情報を不完全候補に保持します。",
    );
  if (
    !semanticallyComplete.success ||
    issues.some((issue) =>
      [
        "PART_TIMELINE_CONFLICT",
        "UNSUPPORTED_STAFF",
        "UNSUPPORTED_NOTATION",
      ].includes(issue.code),
    ) ||
    notes.some(
      (note) =>
        (!note.rest &&
          note.pitch === null &&
          !note.tablature &&
          !note.percussion) ||
        note.start === null ||
        note.duration === null,
    )
  ) {
    const candidate = partialScoreSchema.parse({
      format: "converted-partial-v1",
      notation: {
        ...(sourceStaves.length > 0
          ? { sourceStaves: JSON.parse(JSON.stringify(sourceStaves)) }
          : {}),
        layoutIncomplete: issues.some((issue) =>
          [
            "PART_TIMELINE_CONFLICT",
            "UNSUPPORTED_STAFF",
            "UNSUPPORTED_NOTATION",
          ].includes(issue.code),
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
        ...copyNotation(note),
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
    return { candidate, issues, formatVersion };
  }
  const completeInput = {
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
  };
  const candidate = sheetScoreSchema.parse(completeInput);
  return { candidate, issues, formatVersion };
}
