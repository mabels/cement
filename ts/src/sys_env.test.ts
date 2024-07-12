import { EnvImpl, envImpl } from "./sys_env";

describe("sys_env", () => {
  let key: string;
  beforeEach(() => {
    key = `key-${Math.random()}`;
  });
  it("actions", () => {
    expect(envImpl.get(key)).toBeUndefined();
    envImpl.set(key, "value");
    expect(envImpl.get(key)).toBe("value");
    envImpl.set(key);
    expect(envImpl.get(key)).toBe("value");
    envImpl.del(key);
    expect(envImpl.get(key)).toBeUndefined();
  });
  it("preset", () => {
    const env = new EnvImpl({
      presetEnv: new Map([[key, "value"]]),
    });
    expect(env.get(key)).toBe("value");
    env.del(key);
    expect(env.get(key)).toBeUndefined();
  });
  it("onSet wild card", () => {
    const fn = vi.fn();
    envImpl.onSet(fn);
    expect(fn).toBeCalledTimes(envImpl.keys().length);
    expect(fn.mock.calls.map((i) => i[0])).toEqual(envImpl.keys());
    expect(fn.mock.calls.map((i) => i[1])).toEqual(envImpl.keys().map((i) => envImpl.get(i)));
  });
  it("onSet filter", () => {
    const env = new EnvImpl({
      presetEnv: new Map([[key, "value"]]),
    });
    const fn = vi.fn();
    env.onSet(fn, key);
    expect(fn).toBeCalledTimes(1);
    expect(fn.mock.calls[0]).toEqual([key, "value"]);
    env.set(key, "value2");
    expect(fn).toBeCalledTimes(2);
    expect(fn.mock.calls[1]).toEqual([key, "value2"]);
    env.del(key);
    expect(fn).toBeCalledTimes(3);
    expect(fn.mock.calls[2]).toEqual([key, undefined]);
  });
});
