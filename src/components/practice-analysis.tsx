"use client";
export interface AnalysisSummary {
  expectedCount: number;
  correctCount: number;
  wrongCount: number;
  missedCount: number;
  extraCount: number;
  pitchAccuracy: number | null;
  meanAbsTimingUs: number | null;
}
export interface AnalysisNote {
  noteId: string;
  barNumber: number;
  pitch: number;
  status: string;
  deltaUs?: number;
  actualPitch?: number;
}
export interface AnalysisData {
  summary: AnalysisSummary;
  perNote: AnalysisNote[];
  perBar: ({ barNumber: number } & AnalysisSummary)[];
}
export function PracticeAnalysis(properties: {
  analysis: AnalysisData;
  provisional?: boolean;
}) {
  const { summary, perBar, perNote } = properties.analysis;
  const labels: Record<string, string> = {
    CORRECT: "音高が正しい",
    WRONG: "音高が違う",
    MISSED: "弾き逃し",
    UNASSESSED: "中断のため未評価",
  };
  return (
    <section aria-label="演奏分析">
      <h2>{properties.provisional ? "暫定の演奏分析" : "演奏分析"}</h2>
      <p>
        音高正確率:{" "}
        {summary.pitchAccuracy === null
          ? "評価不可"
          : `${(summary.pitchAccuracy * 100).toFixed(1)}%`}
      </p>
      <p>
        平均の時刻ずれ:{" "}
        {summary.meanAbsTimingUs === null
          ? "評価不可"
          : `${(summary.meanAbsTimingUs / 1000).toFixed(1)} ms`}
      </p>
      <p>
        正しい音 {summary.correctCount}・誤音 {summary.wrongCount}・弾き逃し{" "}
        {summary.missedCount}・余分な音 {summary.extraCount}
      </p>
      <table>
        <caption>小節別の分析</caption>
        <thead>
          <tr>
            <th>小節</th>
            <th>音高正確率</th>
            <th>平均時刻ずれ</th>
            <th>誤音・弾き逃し・余分な音</th>
          </tr>
        </thead>
        <tbody>
          {perBar.map((bar) => (
            <tr key={bar.barNumber}>
              <th>{bar.barNumber}</th>
              <td>
                {bar.pitchAccuracy === null
                  ? "未評価"
                  : `${(bar.pitchAccuracy * 100).toFixed(1)}%`}
              </td>
              <td>
                {bar.meanAbsTimingUs === null
                  ? "未評価"
                  : `${(bar.meanAbsTimingUs / 1000).toFixed(1)} ms`}
              </td>
              <td>
                {bar.wrongCount}・{bar.missedCount}・{bar.extraCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>音ごとの結果</summary>
        <ul>
          {perNote.map((note) => (
            <li key={note.noteId}>
              小節{note.barNumber}・音高{note.pitch}:{" "}
              {labels[note.status] ?? note.status}
              {note.deltaUs === undefined
                ? ""
                : `（${note.deltaUs < 0 ? "早い" : "遅い"} ${Math.abs(note.deltaUs / 1000).toFixed(1)} ms）`}
              {note.actualPitch !== undefined && note.actualPitch !== note.pitch
                ? ` 実際の音高${note.actualPitch}`
                : ""}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
