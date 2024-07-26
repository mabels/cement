import { KeyedResolvOnce, ResolveOnce, ResolveSeq } from "./resolve-once";

describe("resolve-once", () => {
  it("sequence", async () => {
    const once = new ResolveOnce<number>();

    const reallyOnce = vi.fn(async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(42);
        }, 100);
      });
    });
    const start = Date.now();
    const fn = () => once.once(async () => reallyOnce());
    expect(reallyOnce).toHaveBeenCalledTimes(0);
    expect(await fn()).toBe(42);
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    expect(await fn()).toBe(42);
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    expect(await fn()).toBe(42);
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(99);
    expect(diff).toBeLessThan(150);
  });
  it("parallel", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = vi.fn(async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(42);
        }, 100);
      });
    });
    const fn = () => once.once(async () => reallyOnce());
    const start = Date.now();
    expect(
      await Promise.all(
        Array(100)
          .fill(fn)
          .map((fn) => fn()),
      ),
    ).toEqual(Array(100).fill(42));
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(99);
    expect(diff).toBeLessThan(150);
  });

  it("works with void", async () => {
    const once = new ResolveOnce<void>();
    const reallyOnce = vi.fn(async () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
    });
    const fn = () => once.once(async () => reallyOnce());
    const start = Date.now();
    expect(
      await Promise.all(
        Array(100)
          .fill(fn)
          .map((fn) => fn()),
      ),
    ).toEqual(Array(100).fill(undefined));
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(99);
    expect(diff).toBeLessThan(150);
  });

  it("throws", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = vi.fn(async () => {
      return new Promise<number>((rs, rj) => {
        setTimeout(() => {
          rj(new Error("nope"));
        }, 100);
      });
    });
    const fn = () => once.once(async () => reallyOnce());
    const start = Date.now();
    await new Promise((rs) => {
      for (let i = 0; i < 100; i++) {
        fn()
          .then(() => {
            assert.fail("should not happen");
          })
          .catch((e) => {
            expect(e).toEqual(new Error("nope"));
            expect(reallyOnce).toHaveBeenCalledTimes(1);
            if (i === 99) {
              rs(undefined);
            }
          });
      }
    });
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(99);
    expect(diff).toBeLessThan(150);
  });

  it("preserves order", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = vi.fn(async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(42);
        }, 100);
      });
    });
    let order = 0;
    const fn = async () => {
      const o = order++;
      const ret = await once.once(async () => reallyOnce());
      return `${o}:${ret}`;
    };
    const start = Date.now();
    expect(
      await Promise.all(
        Array(100)
          .fill(fn)
          .map((fn) => fn()),
      ),
    ).toEqual(
      Array(100)
        .fill(undefined)
        .map((_, i) => `${i}:42`),
    );
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(99);
    expect(diff).toBeLessThan(150);
  });

  it("preserves call order to resolv order", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = vi.fn(async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(42);
        }, 100);
      });
    });
    const start = Date.now();
    const orderFn = vi.fn();
    const fns = Array(100)
      .fill(0)
      .map((_, i) => {
        return once
          .once(() => reallyOnce())
          .then((once) => {
            orderFn(i, once);
            // expect(i).toBe(order++);
            return `${i}:${once}`;
          });
      });
    expect(await Promise.all(fns)).toEqual(
      Array(100)
        .fill(undefined)
        .map((_, i) => `${i}:42`),
    );
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(99);
    expect(diff).toBeLessThan(150);
    expect(orderFn).toHaveBeenCalledTimes(100);
    expect(orderFn.mock.calls.map(([i]) => i)).toEqual(
      Array(100)
        .fill(0)
        .map((_, i) => i),
    );
  });

  it("reset", async () => {
    const once = new ResolveOnce<number>();
    const orderFn = vi.fn(async () => 42);
    once.once(orderFn);
    once.once(orderFn);
    once.once(orderFn);
    once.reset();
    once.once(orderFn);
    once.once(orderFn);
    once.reset();
    once.once(orderFn);
    once.once(orderFn);
    once.reset();
    expect(orderFn).toHaveBeenCalledTimes(3);
  });

  it("keyed", async () => {
    const keyed = new KeyedResolvOnce<number>();
    const a_orderFn = vi.fn(async () => 42);
    const b_orderFn = vi.fn(async () => 42);
    for (let i = 0; i < 5; i++) {
      keyed.get("a").once(a_orderFn);
      keyed.get(() => "a").once(a_orderFn);
      keyed.get("b").once(b_orderFn);
      keyed.get(() => "b").once(b_orderFn);
      expect(a_orderFn).toHaveBeenCalledTimes(i + 1);
      expect(b_orderFn).toHaveBeenCalledTimes(i + 1);
      keyed.reset();
    }
  });

  it("keyed with pass ctx", async () => {
    const keyed = new KeyedResolvOnce<number>();
    const a_orderFn = vi.fn(async (key) => key);
    const b_orderFn = vi.fn(async (key) => key);
    await Promise.all([
      keyed.get("a").once(a_orderFn),
      keyed.get(() => "a").once(a_orderFn),
      keyed.get("b").once(b_orderFn),
      keyed.get(() => "b").once(b_orderFn),
    ]);
    expect(a_orderFn).toHaveBeenCalledTimes(1);
    expect(a_orderFn).toHaveBeenCalledWith("a");
    expect(b_orderFn).toHaveBeenCalledTimes(1);
    expect(b_orderFn).toHaveBeenCalledWith("b");
  });

  it("keyed asyncGet", async () => {
    const keyed = new KeyedResolvOnce<number>();
    const a_orderFn = vi.fn(async (key) => key);
    const b_orderFn = vi.fn(async (key) => key);
    await Promise.all([
      keyed
        .asyncGet(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return "a";
        })
        .then((resolveOnce) => {
          resolveOnce.once(a_orderFn);
        }),
      keyed
        .asyncGet(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return "b";
        })
        .then((resolveOnce) => {
          resolveOnce.once(b_orderFn);
        }),
    ]);
    expect(a_orderFn).toHaveBeenCalledTimes(1);
    expect(a_orderFn).toHaveBeenCalledWith("a");
    expect(b_orderFn).toHaveBeenCalledTimes(1);
    expect(b_orderFn).toHaveBeenCalledWith("b");
  });

  function shuffle<T>(array: T[]) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
  }

  it("ResolveSeq", async () => {
    const seq = new ResolveSeq<number>();
    let enter = 0;
    let leave = 0;
    const actions = Array(10)
      .fill(0)
      .map((_, i) => {
        return seq.add(async () => {
          expect(enter++).toBe(i);
          await new Promise((resolve) => setTimeout(resolve, i * 3));
          await new Promise((resolve) => setTimeout(resolve, i * 2));
          expect(leave++).toBe(i);
          expect(leave).toBe(enter);
          return i;
        }, i);
      });
    const ret = await Promise.all(shuffle(actions));
    expect(ret.length).toBe(10);
    expect(enter).toBe(10);
    expect(leave).toBe(10);
  });

  it("with promise", async () => {
    const once = new ResolveOnce<number>();
    let val = 42;
    const fn = async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(val++);
        }, 10);
      });
    };
    expect(await once.once(fn)).toBe(42);
    expect(await once.once(fn)).toBe(42);
  });

  it("without promise", () => {
    const once = new ResolveOnce<number>();
    let val = 42;
    const fn = () => val++;
    expect(once.once(fn)).toBe(42);
    expect(once.once(fn)).toBe(42);
  });

  it("without promise but exception", () => {
    const once = new ResolveOnce<number>();
    let val = 42;
    const fn = () => {
      throw new Error(`nope ${val++}`);
    };
    expect(() => once.once(fn)).toThrowError("nope 42");
    expect(() => once.once(fn)).toThrowError("nope 42");
  });
});
