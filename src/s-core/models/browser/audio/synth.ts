import { MidiNoteNumber } from "../../core/units";
import Envelope from "./envelope";
import Preset from "../../files/soundfont2/preset";
import "../../../extensions/int16array/to-float32array.extensions";
export class Synth {
  // filter;
  gain;
  // panner;
  buffer;
  bufferSource: AudioBufferSourceNode | null = null;
  audioContext;
  sample;
  pitch;
  // private filterEnvelope;
  private gainEnvelope;
  constructor({
    audioContext,
    preset,
    pitch,
  }: {
    preset: Preset;
    audioContext: AudioContext;
    pitch: MidiNoteNumber;
  }) {
    this.audioContext = audioContext;
    this.gain = audioContext.createGain();
    // this.panner = audioContext.createStereoPanner();
    // this.filter = audioContext.createBiquadFilter();
    this.pitch = pitch;
    const sample = preset.instruments
      .flatMap((instrument) => instrument.samples)
      .find(
        (sample) =>
          sample.generators.keyRange.lo <= pitch.value &&
          sample.generators.keyRange.hi >= pitch.value
      )!;
    // this.filter.type = "lowpass";
    // this.filter.Q.setValueAtTime(
    //   sample.generators.initialFilterQ.toDecibel().value,
    //   0
    // );
    // this.panner.pan.setValueAtTime(sample.generators.pan.toNumber(), 0);
    this.gainEnvelope = new Synth.Envelope(this.gain.gain, {
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
    });
    // this.filterEnvelope = new Synth.Envelope(this.filter.frequency, {
    //   init: {
    //     value: sample.generators.initialFilterFc.toHertz().value,
    //     time: 0,
    //   },
    //   delay: {
    //     value: sample.generators.initialFilterFc.toHertz().value,
    //     time: sample.generators.delayModEnv.toSeconds().value,
    //   },
    //   attack: {
    //     value:
    //       sample.generators.initialFilterFc.toHertz().value +
    //       sample.generators.modEnvToFilterFc.value,
    //     time:
    //       sample.generators.delayModEnv.toSeconds().value +
    //       sample.generators.attackModEnv.toSeconds().value,
    //   },
    //   hold: {
    //     value:
    //       sample.generators.initialFilterFc.toHertz().value +
    //       sample.generators.modEnvToFilterFc.value,
    //     time:
    //       sample.generators.delayModEnv.toSeconds().value +
    //       sample.generators.attackModEnv.toSeconds().value +
    //       sample.generators.holdModEnv.toSeconds().value,
    //   },
    //   decay:
    //     sample.generators.delayModEnv.toSeconds().value +
    //     sample.generators.attackModEnv.toSeconds().value +
    //     sample.generators.holdModEnv.toSeconds().value +
    //     sample.generators.decayModEnv.toSeconds().value,
    //   sustain: -sample.generators.sustainModEnv.toNumber(),
    //   release: {
    //     value: sample.generators.initialFilterFc.toHertz().value,
    //     time: sample.generators.releaseModEnv.toSeconds().value,
    //   },
    // });
    const float32 = sample.data.toFloat32Array();
    const buffer = audioContext.createBuffer(
      1,
      float32.length,
      sample.header.sampleRate.value
    );
    buffer.getChannelData(0).set(float32);
    this.sample = sample;
    this.buffer = buffer;
    // this.filter.connect(this.panner).connect(this.gain);
    // this.panner.connect(this.gain);
  }
  noteOn(when?: number) {
    const bufferSource = this.audioContext.createBufferSource();
    bufferSource.buffer = this.buffer;
    if (this.sample.generators.sampleModes.value !== 0) {
      bufferSource.loop = true;
      bufferSource.loopStart =
        (this.sample.startLoop - this.sample.start) /
        this.sample.header.sampleRate.value;
      bufferSource.loopEnd =
        (this.sample.endLoop - this.sample.end) /
        this.sample.header.sampleRate.value;
    }
    bufferSource.playbackRate.value = this.sample.playBackRate(
      this.pitch.value
    );
    const time = when ?? this.audioContext.currentTime;
    bufferSource.connect(this.gain);
    bufferSource.addEventListener("ended", () =>
      bufferSource.disconnect(this.gain)
    );
    bufferSource.start(time);

    this.gainEnvelope.noteOn(time);
    // this.filterEnvelope.noteOn(time);
    this.bufferSource = bufferSource;
  }
  noteOff(when?: number) {
    const time = when ?? this.audioContext.currentTime;
    this.bufferSource?.stop(
      // Math.max(
      //   this.filterEnvelope.release.time,
      //   this.gainEnvelope.release.time
      // ) +
      time
    );
    this.gainEnvelope.noteOff(time);
    // this.filterEnvelope.noteOff(time);
  }

  static Envelope = Envelope;
}
