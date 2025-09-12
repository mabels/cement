/// <reference types="deno" />
import { Env, EnvActions, EnvFactoryOpts, EnvImpl, envFactory, registerEnvAction, runtimeFn, param } from "@adviser/cement";
import { CFEnvActions } from "./cf/cf-env-actions.js";
import { BrowserEnvActions } from "./web/web-env-actions.js";

describe("sys_env", () => {
  let key: string;
  const envImpl = envFactory();
  beforeEach(() => {
    key = `key-${Math.random()}`;
  });
  it("actions", () => {
    expect(envImpl.get(key)).toBeUndefined();
    envImpl.set(key, "value");
    expect(envImpl.get(key)).toBe("value");
    envImpl.set(key);
    expect(envImpl.get(key)).toBe("value");
    envImpl.delete(key);
    expect(envImpl.get(key)).toBeUndefined();
  });
  it("preset", () => {
    const env = new EnvImpl(BrowserEnvActions.new({}), {
      presetEnv: new Map([[key, "value"]]),
    });
    expect(env.get(key)).toBe("value");
    env.delete(key);
    expect(env.get(key)).toBeUndefined();
  });
  it("onSet wild card", () => {
    const fn = vi.fn();
    envImpl.onSet(fn);
    expect(fn).toBeCalledTimes(envImpl.keys().length);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(fn.mock.calls.map((i) => i[0]).sort()).toEqual(envImpl.keys().sort());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(fn.mock.calls.map((i) => i[1]).sort()).toEqual(
      envImpl
        .keys()
        .map((i) => envImpl.get(i))
        .sort(),
    );
  });
  it("onSet filter", () => {
    const env = new EnvImpl(BrowserEnvActions.new({}), {
      presetEnv: new Map([[key, "value"]]),
    });
    const fn = vi.fn();
    env.onSet(fn, key);
    expect(fn).toBeCalledTimes(1);
    expect(fn.mock.calls[0]).toEqual([key, "value"]);
    env.set(key, "value2");
    expect(fn).toBeCalledTimes(2);
    expect(fn.mock.calls[1]).toEqual([key, "value2"]);
    env.delete(key);
    expect(fn).toBeCalledTimes(3);
    expect(fn.mock.calls[2]).toEqual([key, undefined]);
  });
  it("test register", () => {
    class TestEnvActions implements EnvActions {
      readonly #map: Map<string, string>;

      constructor(opts: Partial<EnvFactoryOpts>) {
        this.#map = opts.presetEnv || new Map<string, string>();
      }

      register(env: Env): Env {
        return env;
      }

      active(): boolean {
        return true;
      }
      keys(): string[] {
        return Array.from(this.#map.keys());
      }
      get(key: string): string | undefined {
        return this.#map.get(key);
      }
      set(key: string, value?: string): void {
        if (value) {
          this.#map.set(key, value);
        }
      }
      delete(key: string): void {
        this.#map.delete(key);
      }
    }
    let tea: TestEnvActions = {} as TestEnvActions;
    const unreg = registerEnvAction((opts) => {
      tea = new TestEnvActions(opts);
      return tea;
    });
    const env = envFactory({
      presetEnv: new Map([[key, "value"]]),
    });
    expect(env.get(key)).toBe("value");
    expect(tea.get(key)).toBe("value");
    unreg();
  });
  if (runtimeFn().isCFWorker) {
    it("CFWorker env", () => {
      const env = envFactory();
      const onSet = vi.fn();
      env.onSet(onSet);

      CFEnvActions.inject({ "cf-key": "cf-value" });

      env.set("cf-key-1", "cf-value-2");

      expect(onSet).toBeCalledWith("cf-key", "cf-value");
      expect(env.get("cf-key")).toBe("cf-value");
    });
  }
  it("gets ok", () => {
    const res0 = envImpl.gets({ key: param.REQUIRED });
    expect(res0.isErr()).toBeTruthy();
    envImpl.set("key", "value");
    const res = envImpl.gets({ key: param.REQUIRED });
    expect(res.isOk()).toBeTruthy();
    expect(res.unwrap()).toEqual({ key: "value" });
  });

  it("gets error", () => {
    envImpl.set("key", "value");
    const res = envImpl.gets({
      unk1: param.REQUIRED,
      unk2: param.REQUIRED,
      key: param.REQUIRED,
    });
    expect(res.isErr()).toBeTruthy();
    expect(res.Err().message).toEqual("missing parameters: unk1,unk2");
  });

  it("sets array flat tuple", () => {
    envImpl.sets(["key1", "value1"], ["key2", "value2"]);
    expect(envImpl.get("key1")).toBe("value1");
    expect(envImpl.get("key2")).toBe("value2");
  });
  it("sets array array tuple", () => {
    envImpl.sets([
      ["key1", "value1"],
      ["key2", "value2"],
    ]);
    expect(envImpl.get("key1")).toBe("value1");
    expect(envImpl.get("key2")).toBe("value2");
  });

  it("sets object", () => {
    envImpl.sets({
      key1: "value1",
      key2: "value2",
    });
    expect(envImpl.get("key1")).toBe("value1");
    expect(envImpl.get("key2")).toBe("value2");
  });

  it("sets iterator", () => {
    envImpl.sets(
      new Map(
        Object.entries({
          key1: "value1",
          key2: "value2",
        }),
      ).entries(),
    );
    expect(envImpl.get("key1")).toBe("value1");
    expect(envImpl.get("key2")).toBe("value2");
  });

  it("sets combination", () => {
    envImpl.sets(
      new Map(
        Object.entries({
          key1: "value1",
          key2: "value2",
        }),
      ).entries(),
      {
        key3: "value3",
        key4: "value4",
      },
      ["key5", "value5"],
      ["key6", "value6"],
      [
        ["key7", "value7"],
        ["key8", "value8"],
      ],
    );
    expect(envImpl.get("key1")).toBe("value1");
    expect(envImpl.get("key2")).toBe("value2");
    expect(envImpl.get("key3")).toBe("value3");
    expect(envImpl.get("key4")).toBe("value4");
    expect(envImpl.get("key5")).toBe("value5");
    expect(envImpl.get("key6")).toBe("value6");
    expect(envImpl.get("key7")).toBe("value7");
    expect(envImpl.get("key8")).toBe("value8");
  });

  it("test import.meta.env wrapper", () => {
    const env = envFactory({
      testPatchImportMetaEnv: { HELLO: "world" },
    });
    expect(env.get("HELLO")).toBe("world");
  });

  it("set into provider", () => {
    const key = `ENV-${Math.random()}`;
    envImpl.set(key, "value");
    expect(envImpl.get(key)).toBe("value");
    if (runtimeFn().isNodeIsh) {
      expect(process.env[key]).toBe("value");
    }
    envImpl.delete(key);
    expect(envImpl.get(key)).toBeUndefined();
    if (runtimeFn().isNodeIsh) {
      expect(process.env[key]).toBeUndefined();
    }
    if (runtimeFn().isDeno) {
      // deno does not have process.env
      expect(Deno.env.get(key)).toBeUndefined();
    }
  });
});

// if (runtimeFn().isNodeIsh) {
//   describe("node-env-interaction with import.meta.env", () => {
//     it("import meta", () => {
//       NodeEnvActions.addCleanPrefix("VITE");
//       NodeEnvActions.addCleanPrefix("GURKE_");
//       (globalThis as ImportMetaEnv).import = {
//         meta: {
//           env: {
//             HELLO: "world",
//             VITE_HELLO: "vite-world",
//             GURKE_HELLO: "gurke-world",
//             VITE_SOME: "vite-some",
//             GURKE_SOME: "gurke-some",
//             VITE_VITE: "vite-vite",
//             GURKE_GURKE: "gurke-gurke",
//           },
//         },
//       };
//       NodeEnvActions.once.reset();
//       const env = envFactory({
//         symbol: "this-is-a-test",
//         id: "this-is-a-test-id",
//       });
//       const ret = env.gets(
//         "HELLO",
//         "VITE_HELLO",
//         "GURKE_HELLO",
//         "VITE_SOME",
//         "GURKE_SOME",
//         "SOME",
//         "VITE",
//         "GURKE",
//         "VITE_VITE",
//         "GURKE_GURKE",
//       );
//       // console.log("ret", ret);
//       expect(ret.isOk()).toBeTruthy();
//       expect(ret.unwrap()).toEqual({
//         HELLO: "world",
//         VITE_HELLO: "vite-world",
//         GURKE_HELLO: "gurke-world",
//         VITE_SOME: "vite-some",
//         GURKE_SOME: "gurke-some",
//         SOME: "vite-some",
//         VITE: "vite-vite",
//         VITE_VITE: "vite-vite",
//         GURKE: "gurke-gurke",
//         GURKE_GURKE: "gurke-gurke",
//       });
//     });
//   });
// }
