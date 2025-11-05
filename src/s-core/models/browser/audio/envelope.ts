interface ValueAtTime {
  value: number;
  time: number;
}
export interface IEnvelope<T, K> {
  init: T;
  delay: T;
  attack: T;
  hold: T;
  decay: K;
  sustain: K;
  release: T;
}
export default class Envelope {
  audioParam;
  init;
  delay;
  attack;
  hold;
  decay;
  sustain;
  release;
  constructor(
    audioParameter: AudioParam,
    {
      init,
      delay,
      attack,
      hold,
      decay,
      sustain,
      release,
    }: IEnvelope<ValueAtTime, number>
  ) {
    this.audioParam = audioParameter;
    this.init = init;
    this.delay = delay;
    this.attack = attack;
    this.hold = hold;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;
  }
  noteOn(time: number) {
    this.audioParam.setValueAtTime(this.init.value, time + this.init.time);
    this.audioParam.setValueAtTime(this.delay.value, time + this.delay.time);
    this.audioParam.linearRampToValueAtTime(
      this.attack.value,
      time + this.attack.time
    );
    this.audioParam.setValueAtTime(this.hold.value, time + this.hold.time);
    this.audioParam.linearRampToValueAtTime(this.sustain, time + this.decay);
  }
  noteOff(time: number) {
    this.audioParam.linearRampToValueAtTime(
      this.release.value,
      time + this.release.time
    );
  }
}
