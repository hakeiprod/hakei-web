import { map, pipe, times } from "remeda";
import "../../../extensions/int16array/to-float32array.extensions";
import * as Audio from "../../audio";
import { MidiNoteNumber } from "../../core/units";
import Preset from "../../files/soundfont2/preset";
import Envelope from "./envelope";
export class Synth {
  filter;
  gain;
  // panner;
  audioContext;
  track;
  resources;
  private endListeners = new Map<AudioBufferSourceNode, () => void>();
  private startTimers = new Set<ReturnType<typeof setTimeout>>();
  bufferSources: {
    bufferSource: AudioBufferSourceNode;
    pitch: MidiNoteNumber;
  }[] = [];
  constructor({
    audioContext,
    preset,
    track,
  }: {
    preset: Preset;
    audioContext: AudioContext;
    track: Audio.Track;
  }) {
    this.audioContext = audioContext;
    this.track = track;
    this.gain = audioContext.createGain();
    this.filter = audioContext.createBiquadFilter();
    // this.panner = audioContext.createStereoPanner();
    this.resources = pipe(
      times(
        track.keyRange[1].value - track.keyRange[0].value + 1,
        (index) => new MidiNoteNumber(index + track.keyRange[0].value),
      ),
      map((pitch) => {
        const sample = preset.instruments
          .flatMap((instrument) => instrument.samples)
          .find(
            (sample) =>
              sample.generators.keyRange.lo <= pitch.value &&
              sample.generators.keyRange.hi >= pitch.value,
          )!;
        const float32 = sample.data.toFloat32Array();
        const buffer = audioContext.createBuffer(
          1,
          float32.length,
          sample.header.sampleRate.value,
        );
        buffer.getChannelData(0).set(float32);
        return {
          pitch,
          sample,
          buffer,
          gainEnvelope: new Synth.Envelope(this.gain.gain, {
            init: { value: 0, time: 0 },
            delay: {
              value: 0,
              time: sample.generators.delayVolEnv.toSeconds().value,
            },
            attack: {
              value: 1,
              time:
                sample.generators.delayVolEnv.toSeconds().value +
                sample.generators.attackVolEnv.toSeconds().value,
            },
            hold: {
              value: 1,
              time:
                sample.generators.delayVolEnv.toSeconds().value +
                sample.generators.attackVolEnv.toSeconds().value +
                sample.generators.holdVolEnv.toSeconds().value,
            },
            decay:
              sample.generators.delayVolEnv.toSeconds().value +
              sample.generators.attackVolEnv.toSeconds().value +
              sample.generators.holdVolEnv.toSeconds().value +
              sample.generators.decayVolEnv.toSeconds().value,
            sustain: sample.generators.sustainVolEnv.value,
            release: {
              value: 0,
              time: sample.generators.releaseVolEnv.toSeconds().value,
            },
          }),
          filterEnvelope: new Synth.Envelope(this.filter.frequency, {
            init: {
              value: sample.generators.initialFilterFc.toHertz().value,
              time: 0,
            },
            delay: {
              value: sample.generators.initialFilterFc.toHertz().value,
              time: sample.generators.delayModEnv.toSeconds().value,
            },
            attack: {
              value:
                sample.generators.initialFilterFc.toHertz().value +
                sample.generators.modEnvToFilterFc.value,
              time:
                sample.generators.delayModEnv.toSeconds().value +
                sample.generators.attackModEnv.toSeconds().value,
            },
            hold: {
              value:
                sample.generators.initialFilterFc.toHertz().value +
                sample.generators.modEnvToFilterFc.value,
              time:
                sample.generators.delayModEnv.toSeconds().value +
                sample.generators.attackModEnv.toSeconds().value +
                sample.generators.holdModEnv.toSeconds().value,
            },
            decay:
              sample.generators.delayModEnv.toSeconds().value +
              sample.generators.attackModEnv.toSeconds().value +
              sample.generators.holdModEnv.toSeconds().value +
              sample.generators.decayModEnv.toSeconds().value,
            sustain:
              sample.generators.initialFilterFc.value +
              sample.generators.modEnvToFilterFc.value *
                (1 - sample.generators.sustainModEnv.value),
            release: {
              value: sample.generators.initialFilterFc.toHertz().value,
              time: sample.generators.releaseModEnv.toSeconds().value,
            },
          }),
        };
      }),
    );
    this.filter.type = "lowpass";
    this.filter.connect(this.gain);
    // this.panner.pan.setValueAtTime(sample.generators.pan.toNumber(), 0);
    // this.filter.connect(this.panner).connect(this.gain);
    // this.panner.connect(this.gain);
  }
  noteOn(
    pitch: MidiNoteNumber,
    when?: number,
    onStart?: () => void,
    onEnd?: () => void,
  ) {
    const bufferSource = this.audioContext.createBufferSource();
    const time = Math.max(
      when ?? this.audioContext.currentTime,
      this.audioContext.currentTime + 0.001,
    );
    const { buffer, sample, gainEnvelope, filterEnvelope } =
      this.resources.find((resource) => resource.pitch.equal(pitch))!;
    this.bufferSources.push({ bufferSource, pitch });
    this.filter.Q.setValueAtTime(
      sample.generators.initialFilterQ.toDecibel().value,
      0,
    );
    bufferSource.buffer = buffer;
    if (sample.generators.sampleModes.value !== 0) {
      bufferSource.loop = true;
      bufferSource.loopStart =
        (sample.startLoop - sample.start) / sample.header.sampleRate.value;
      bufferSource.loopEnd =
        (sample.endLoop - sample.end) / sample.header.sampleRate.value;
    }
    bufferSource.playbackRate.value = sample.playBackRate(pitch.value);
    bufferSource.connect(this.filter);
    const handleEnd = () => {
      this.endListeners.delete(bufferSource);
      onEnd?.();
      bufferSource.disconnect(this.filter);
      const index = this.bufferSources.findIndex(
        (item) => item.bufferSource === bufferSource,
      );
      if (index !== -1) this.bufferSources.splice(index, 1);
    };
    bufferSource.addEventListener("ended", handleEnd);
    this.endListeners.set(bufferSource, handleEnd);
    bufferSource.start(time);
    gainEnvelope.noteOn(time);
    filterEnvelope.noteOn(time);
    const timer = setTimeout(
      () => {
        this.startTimers.delete(timer);
        onStart?.();
      },
      Math.max(0, time - this.audioContext.currentTime) * 1000,
    );
    this.startTimers.add(timer);
  }
  noteOff(pitch: MidiNoteNumber, when?: number) {
    const time = when ?? this.audioContext.currentTime;
    const bufferSource = this.bufferSources.findLast((bufferSource) =>
      bufferSource.pitch.equal(pitch),
    )!.bufferSource;
    const { filterEnvelope, gainEnvelope } = this.resources.findLast(
      (resource) => resource.pitch.equal(pitch),
    )!;
    bufferSource.stop(
      // Math.max(
      //   this.filterEnvelope.release.time,
      //   this.gainEnvelope.release.time
      // ) +
      time,
    );
    gainEnvelope.noteOff(time);
    filterEnvelope.noteOff(time);
  }

  clearAllScheduled() {
    const now = this.audioContext.currentTime;
    for (const timer of this.startTimers) clearTimeout(timer);
    this.startTimers.clear();
    for (const { bufferSource } of this.bufferSources.splice(0)) {
      const handleEnd = this.endListeners.get(bufferSource);
      if (handleEnd) bufferSource.removeEventListener("ended", handleEnd);
      this.endListeners.delete(bufferSource);
      bufferSource.stop();
      bufferSource.disconnect();
    }
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0, now);
    this.filter.frequency.cancelScheduledValues(now);
  }
  dispose() {
    this.clearAllScheduled();
    this.filter.disconnect();
    this.gain.disconnect();
  }
  static Envelope = Envelope;
}
