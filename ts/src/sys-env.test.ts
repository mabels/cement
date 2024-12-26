import { BrowserEnvActions, Env, EnvActions, EnvFactoryOpts, EnvImpl, envFactory, registerEnvAction } from "@adviser/cement";

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
    const env = new EnvImpl(new BrowserEnvActions({}), {
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
    expect(fn.mock.calls.map((i) => i[0]).sort()).toEqual(envImpl.keys().sort());
    expect(fn.mock.calls.map((i) => i[1]).sort()).toEqual(
      envImpl
        .keys()
        .map((i) => envImpl.get(i))
        .sort(),
    );
  });
  it("onSet filter", () => {
    const env = new EnvImpl(new BrowserEnvActions({}), {
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
});
