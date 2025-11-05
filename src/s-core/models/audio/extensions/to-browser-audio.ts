import * as Audio from "..";
import Soundfont2 from "../../files/soundfont2";
import * as BrowserAudio from "../../browser/audio";
import "../../../extensions/int16array/to-float32array.extensions";

declare module ".." {
  interface Score {
    toBrowserAudio(
      audioContext: AudioContext,
      soundfont2: Soundfont2
    ): BrowserAudio.Score;
  }
}

Audio.Score.prototype.toBrowserAudio = function (
  this: Audio.Score,
  audioContext,
  soundfont2
) {
  const score = BrowserAudio.Score.create({
    gain: audioContext.createGain(),
    ...this.params,
    tracks: this.tracks.map((track) => {
      const preset = soundfont2.getPreset(track.preset.value);
      return {
        gain: audioContext.createGain(),
        ...track.params,
        notes: track.notes
          .filter((note) => note.pitch.value !== -1)
          .map((note) => ({
            ...note.params,
            synth: {
              pitch: note.soundingPitch,
              preset,
              audioContext,
            },
          })),
      };
    }),
  });

  score.gain.connect(audioContext.destination);
  for (const track of score.tracks) {
    track.gain.connect(score.gain);
    for (const note of track.notes) note.synth.gain.connect(track.gain);
  }
  console.log({ browserAudio: score });
  return score;
};
