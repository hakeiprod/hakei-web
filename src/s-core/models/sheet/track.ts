import { firstBy, prop } from "remeda";
import * as Sheet from ".";
import { StaffDetails } from "../../const/musicxml/4.0/musicxml";
import * as Core from "../core";

export class Track extends Core.Track {
  staffDetails;
  declare score: Sheet.Score;
  get notes() {
    return super.notes as Sheet.Note[];
  }
  get bars() {
    return this.score.bars.filter((bar) => bar.trackId === this.id);
  }
  get height() {
    return firstBy(this.bars, [prop("height"), "desc"])!.height;
  }
  get y(): number {
    return this.prev ? this.prev.y + this.height + 6.5 : 0;
  }
  get prev() {
    return this.score.tracks[this.id - 1];
  }
  constructor({
    staffDetails,
    ...track
  }: { staffDetails: StaffDetails } & ConstructorParameters<
    typeof Core.Track
  >[0]) {
    super(track);
    this.staffDetails = staffDetails;
  }
  getMasterbarBars(masterbarId: number) {
    return this.score.bars.filter(
      (bar) => bar.trackId === this.id && bar.id === masterbarId
    );
  }
  serialize() {
    return {
      ...super.serialize(),
      staffDetails: this.staffDetails,
    };
  }
  export() {
    return this.serialize();
  }
  static import(data: ReturnType<Track["export"]>) {
    return new Track({ ...data, ...super.import(data) });
  }
}
