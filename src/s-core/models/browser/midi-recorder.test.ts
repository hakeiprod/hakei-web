/* eslint-disable unicorn/consistent-function-scoping -- Port methods depend on the test instance. */
import { expect, it, vi } from "vitest";
import { MidiRecorder } from "./midi-recorder";
class Port extends EventTarget {
  id = "input-a";
  name = "Piano";
  state = "connected";
  connection = "closed";
  open = vi.fn(async () => {
    this.connection = "open";
    return this;
  });
  close = vi.fn(async () => {
    this.connection = "closed";
    return this;
  });
  send(data: number[], timeStamp: number) {
    const event = new Event("midimessage");
    Object.defineProperties(event, {
      data: { value: new Uint8Array(data) },
      timeStamp: { value: timeStamp },
    });
    this.dispatchEvent(event);
  }
}
class Access extends EventTarget {
  inputs = new Map<string, Port>();
}
it("records only the chosen port, channels, velocities and FIFO releases", async () => {
  const a = new Port(),
    b = new Port();
  b.id = "input-b";
  const access = new Access();
  access.inputs.set(a.id, a);
  access.inputs.set(b.id, b);
  const recorder = new MidiRecorder({ request: async () => access });
  await recorder.connect();
  await recorder.select(a.id);
  recorder.start(1000);
  b.send([144, 70, 90], 1001);
  a.send([145, 60, 90], 1001);
  a.send([145, 60, 80], 1002);
  a.send([145, 60, 0], 1003);
  a.send([129, 60, 10], 1004);
  const result = recorder.stop();
  expect(
    result.events.map((event) => [
      event.sequence,
      event.type,
      event.channel,
      event.pitch,
      event.velocity,
      event.relativeUs,
    ]),
  ).toEqual([
    [0, "NOTE_ON", 1, 60, 90, 1000],
    [1, "NOTE_ON", 1, 60, 80, 2000],
    [2, "NOTE_OFF", 1, 60, 0, 3000],
    [3, "NOTE_OFF", 1, 60, 10, 4000],
  ]);
  expect(result.openNotes).toEqual([]);
  a.send([145, 60, 90], 1005);
  expect(recorder.events).toHaveLength(4);
  expect(a.close).toHaveBeenCalled();
  recorder.dispose();
});
it("does not subscribe after delayed permission resolves beyond disposal", async () => {
  let resolve!: (access: Access) => void;
  const access = new Access();
  const port = new Port();
  access.inputs.set(port.id, port);
  const recorder = new MidiRecorder({
    request: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const pending = recorder.connect();
  recorder.dispose();
  resolve(access);
  await pending;
  expect(port.open).not.toHaveBeenCalled();
  expect(recorder.devices).toEqual([]);
});
it("interrupts and stops capturing when the selected input disconnects", async () => {
  const port = new Port(),
    access = new Access();
  access.inputs.set(port.id, port);
  const interrupted = vi.fn();
  const recorder = new MidiRecorder({
    request: async () => access,
    onInterrupt: interrupted,
  });
  await recorder.connect();
  await recorder.select(port.id);
  recorder.start(1000);
  port.send([144, 60, 90], 1001);
  port.state = "disconnected";
  const event = new Event("statechange");
  Object.defineProperty(event, "port", { value: port });
  access.dispatchEvent(event);
  expect(interrupted).toHaveBeenCalledWith("DISCONNECTED");
  port.send([128, 60, 0], 1002);
  expect(recorder.events).toHaveLength(1);
  expect(recorder.stop().openNotes).toEqual([0]);
  recorder.dispose();
});
it("reports permission denial without leaving an active recorder", async () => {
  const recorder = new MidiRecorder({
    request: async () => {
      throw new Error("denied");
    },
  });
  await recorder.connect();
  expect(recorder.status).toBe("PERMISSION_REQUIRED");
  expect(() => recorder.start(0)).toThrow();
  recorder.dispose();
});
