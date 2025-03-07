import { WebBasicSysAbstraction } from "@adviser/cement/web";
import { CFBasicSysAbstraction } from "@adviser/cement/cf";
import { runtimeFn } from "./runtime.js";
import { IDMode, TimeMode, RandomMode } from "./sys-abstraction.js";
import { NodeBasicSysAbstraction } from "./node/node-basic-sys-abstraction.js";
import { DenoBasicSysAbstraction } from "./deno/deno-basic-sys-abstraction.js";

const abstractions = [];

if (runtimeFn().isCFWorker) {
  abstractions.push({ name: "CFSysAbstraction", fn: CFBasicSysAbstraction });
}

if (runtimeFn().isNodeIsh) {
  abstractions.push({ name: "NodeSysAbstraction", fn: NodeBasicSysAbstraction });
}

if (runtimeFn().isDeno) {
  abstractions.push({ name: "DenoSysAbstraction", fn: DenoBasicSysAbstraction });
}

if (runtimeFn().isBrowser) {
  abstractions.push({ name: "WebSysAbstraction", fn: WebBasicSysAbstraction });
}

for (const abstraction of abstractions) {
  describe(abstraction.name, () => {
    it("IdService UUID", () => {
      const sys = abstraction.fn();
      const id1 = sys.NextId();
      const id2 = sys.NextId();
      expect(id1).not.toEqual(id2);
    });

    it("IdService explict UUID", () => {
      const sys = abstraction.fn({ IdMode: IDMode.UUID });
      const id1 = sys.NextId();
      const id2 = sys.NextId();
      expect(id1).not.toEqual(id2);
    });

    it("IdService const", () => {
      const sys = abstraction.fn({ IdMode: IDMode.CONST });
      const id1 = sys.NextId();
      const id2 = sys.NextId();
      expect(id1).toEqual(id2);
    });

    it("IdService set", () => {
      for (let i = 0; i < 10; i++) {
        const sys = abstraction.fn({ IdMode: IDMode.STEP });
        const id1 = sys.NextId();
        const id2 = sys.NextId();
        expect(id1).toEqual("STEPId-0");
        expect(id2).toEqual("STEPId-1");
      }
    });

    it("time sleep", async () => {
      const sys = abstraction.fn();
      const start = sys.Time().Now();
      await sys.Time().Sleep(100);
      expect(sys.Time().TimeSince(start)).toBeGreaterThan(90);
    });

    it("time sleep const", async () => {
      const sys = abstraction.fn({ TimeMode: TimeMode.REAL });
      const start = new Date();
      await sys.Time().Sleep(100);
      const end = new Date();
      expect(end.getTime() - start.getTime()).toBeGreaterThan(90);
    });

    it("time sleep step", async () => {
      const sys = abstraction.fn({ TimeMode: TimeMode.STEP });
      const start = sys.Time().Now();
      await sys.Time().Sleep(86400500);
      expect(sys.Time().Now().getTime() - start.getTime()).toEqual(86401500);
    });

    it("const random", () => {
      const sys = abstraction.fn({ RandomMode: RandomMode.CONST });
      expect(sys.Random0ToValue(10)).toEqual(5);
      expect(sys.Random0ToValue(10)).toEqual(5);
    });

    it("step random", () => {
      const sys = abstraction.fn({ RandomMode: RandomMode.STEP });
      expect(sys.Random0ToValue(10000)).toEqual(1);
      expect(sys.Random0ToValue(10000)).toEqual(2);
    });

    it("random", () => {
      const sys = abstraction.fn({});
      for (let i = 0; i < 100; i++) {
        const val = sys.Random0ToValue(10);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(10);
      }
    });
  });
}
