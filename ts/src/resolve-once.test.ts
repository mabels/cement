import { Result, KeyedResolvOnce, ResolveOnce, ResolveSeq, Lazy, Future } from "@adviser/cement";

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
    const fn = (): Promise<number> => once.once(async () => reallyOnce());
    expect(reallyOnce).toHaveBeenCalledTimes(0);
    expect(await fn()).toBe(42);
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    expect(await fn()).toBe(42);
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    expect(await fn()).toBe(42);
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(90);
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
    const fn = (): Promise<number> => once.once(async () => reallyOnce());
    const start = Date.now();
    expect(
      await Promise.all(
        Array(100)
          .fill(fn)
          .map((fn: () => Promise<number>) => fn()),
      ),
    ).toEqual(Array(100).fill(42));
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(99);
    expect(diff).toBeLessThan(150);
  });

  it("async works with void", async () => {
    const cnt = 1;
    const once = new ResolveOnce<void>();
    const reallyOnce = vi.fn(async () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
    });
    const fn = (): Promise<void> =>
      once.once(() => {
        return reallyOnce();
      });
    const start = Date.now();
    expect(
      await Promise.all(
        Array(cnt)
          .fill(fn)
          .map((fn: () => Promise<number>) => fn()),
      ),
    ).toEqual(Array(cnt).fill(undefined));
    expect(reallyOnce).toHaveBeenCalledTimes(1);
    const diff = Date.now() - start;
    expect(diff).toBeGreaterThanOrEqual(95);
    expect(diff).toBeLessThan(150);
  });

  it("sync works with void", () => {
    const once = new ResolveOnce<void>();
    const reallyOnce = vi.fn(() => 19);
    const val = once.once((): void => {
      reallyOnce();
    });
    expect(Array(100).fill(val)).toEqual(Array(100).fill(undefined));
    expect(reallyOnce).toHaveBeenCalledTimes(1);
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
    const fn = (): Promise<number> => once.once(async () => reallyOnce());
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
    expect(diff).toBeLessThan(250);
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
    const fn = async (): Promise<string> => {
      const o = order++;
      const ret = await once.once(async () => reallyOnce());
      return `${o}:${ret}`;
    };
    const start = Date.now();
    expect(
      await Promise.all(
        Array(100)
          .fill(fn)
          .map((fn: () => Promise<number>) => fn()),
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
    expect(orderFn.mock.calls.map(([i]) => i as number)).toEqual(
      Array(100)
        .fill(0)
        .map((_, i) => i),
    );
  });

  it("reset", async () => {
    const once = new ResolveOnce<number>();
    const orderFn = vi.fn(() => Promise.resolve(42));
    await once.once(orderFn);
    await once.once(orderFn);
    await once.once(orderFn);
    void once.reset();
    await once.once(orderFn);
    await once.once(orderFn);
    void once.reset();
    await once.once(orderFn);
    await once.once(orderFn);
    void once.reset();
    expect(orderFn).toHaveBeenCalledTimes(3);
  });

  it("keyed", async () => {
    const keyed = new KeyedResolvOnce<number>();
    const a_orderFn = vi.fn(() => Promise.resolve(42));
    const b_orderFn = vi.fn(() => Promise.resolve(42));
    for (let i = 0; i < 5; i++) {
      await keyed.get("a").once(a_orderFn);
      await keyed.get(() => "a").once(a_orderFn);
      await keyed.get("b").once(b_orderFn);
      await keyed.get(() => "b").once(b_orderFn);
      expect(a_orderFn).toHaveBeenCalledTimes(i + 1);
      expect(b_orderFn).toHaveBeenCalledTimes(i + 1);
      keyed.reset();
    }
  });

  it("keyed with pass ctx", async () => {
    const keyed = new KeyedResolvOnce<number>();
    const a_orderFn = vi.fn((key) => Promise.resolve(key));
    const b_orderFn = vi.fn((key) => Promise.resolve(key));
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
    const a_orderFn = vi.fn((key) => Promise.resolve(key));
    const b_orderFn = vi.fn((key) => Promise.resolve(key));
    await Promise.all([
      keyed
        .asyncGet(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return "a";
        })
        .then((resolveOnce) => resolveOnce.once(a_orderFn)),
      keyed
        .asyncGet(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return "b";
        })
        .then((resolveOnce) => resolveOnce.once(b_orderFn)),
    ]);
    expect(a_orderFn).toHaveBeenCalledTimes(1);
    expect(a_orderFn).toHaveBeenCalledWith("a");
    expect(b_orderFn).toHaveBeenCalledTimes(1);
    expect(b_orderFn).toHaveBeenCalledWith("b");
  });

  function shuffle<T>(array: T[]): T[] {
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
    const fn = async (): Promise<number> => {
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
    const fn = (): number => val++;
    expect(once.once(fn)).toBe(42);
    expect(once.once(fn)).toBe(42);
  });

  it("without promise but exception", () => {
    const once = new ResolveOnce<number>();
    let val = 42;
    const fn = (): Promise<number> => {
      throw new Error(`nope ${val++}`);
    };
    expect(() => once.once(fn)).toThrowError("nope 42");
    expect(() => once.once(fn)).toThrowError("nope 42");
  });

  it.each([(): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10)), (): Promise<void> => Promise.resolve()])(
    "async with unget",
    async (sleeper) => {
      const once = new KeyedResolvOnce();
      let triggerUnget = true;
      const fn = vitest.fn();
      async function onceFn(): Promise<string> {
        await sleeper();
        if (triggerUnget) {
          fn("first");
          once.unget("a");
          return await sleeper().then(() => "first");
        }
        fn("second");
        return await sleeper().then(() => "second");
      }
      expect(await once.get("a").once(onceFn)).toBe("first");
      expect(fn).toHaveBeenCalledTimes(1);
      expect(await once.get("a").once(onceFn)).toBe("first");
      expect(fn).toHaveBeenCalledTimes(2);
      triggerUnget = false;
      expect(await once.get("a").once(onceFn)).toBe("second");
      expect(fn).toHaveBeenCalledTimes(3);
      expect(await once.get("a").once(onceFn)).toBe("second");
      expect(fn).toHaveBeenCalledTimes(3);
      once.unget("a");
      expect(await once.get("a").once(onceFn)).toBe("second");
      expect(fn).toHaveBeenCalledTimes(4);
    },
  );

  it("sync with unget", () => {
    const once = new KeyedResolvOnce();
    let triggerUnget = true;
    const fn = vitest.fn();
    function onceFn(): string {
      if (triggerUnget) {
        fn("first");
        once.unget("a");
        return "first";
      }
      fn("second");
      return "second";
    }
    expect(once.get("a").once(onceFn)).toBe("first");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(once.get("a").once(onceFn)).toBe("first");
    expect(fn).toHaveBeenCalledTimes(2);
    triggerUnget = false;
    expect(once.get("a").once(onceFn)).toBe("second");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(once.get("a").once(onceFn)).toBe("second");
    expect(fn).toHaveBeenCalledTimes(3);
    once.unget("a");
    expect(once.get("a").once(onceFn)).toBe("second");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("flush on seq", async () => {
    const seq = new ResolveSeq<number>();
    let call = 42;
    const fn = vitest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return call++;
    });
    const results = Array(10)
      .fill(0)
      .map((_, i) => {
        return seq.add(fn, i);
      });
    expect(seq._seqFutures.length).toBe(10);
    const flushes = [seq.flush(), seq.flush(), seq.flush(), seq.flush(), seq.flush()];
    await Promise.all(flushes);
    expect(seq._seqFutures.length).toBe(0);
    expect(await Promise.all(results)).toEqual(
      Array(10)
        .fill(0)
        .map((_, i) => 42 + i),
    );
    expect(fn).toHaveBeenCalledTimes(10);
  });

  it("KeyedResolvOnce values", () => {
    const keyed = new KeyedResolvOnce<number>();
    expect(keyed.values()).toEqual([]);
    const a = keyed.get("a");
    expect(keyed.values()).toEqual([]);
    a.once(() => 42);
    expect(keyed.values()).toEqual([{ key: "a", value: Result.Ok(42) }]);
    keyed.get("b").once(() => 43);
    expect(keyed.values()).toEqual([
      { key: "a", value: Result.Ok(42) },
      { key: "b", value: Result.Ok(43) },
    ]);
    try {
      keyed.get("c").once(() => {
        throw new Error("nope");
      });
    } catch (e) {
      expect(e).toEqual(new Error("nope"));
    }
    expect(keyed.values()).toEqual([
      { key: "a", value: Result.Ok(42) },
      { key: "b", value: Result.Ok(43) },
      { key: "c", value: Result.Err(new Error("nope")) },
    ]);
    keyed.unget("a");
    keyed.unget("c");
    expect(keyed.values()).toEqual([{ key: "b", value: Result.Ok(43) }]);
  });

  it("KeyedResolvOnce entries", () => {
    const keyed = new KeyedResolvOnce<number>();
    expect(Array.from(keyed.entries())).toEqual([]);
    const a = keyed.get("a");
    expect(Array.from(keyed.entries())).toEqual([]);
    a.once(() => 42);
    expect(Array.from(keyed.entries())).toEqual([{ key: "a", value: Result.Ok(42) }]);
    keyed.get("b").once(() => 43);
    expect(Array.from(keyed.entries())).toEqual([
      { key: "a", value: Result.Ok(42) },
      { key: "b", value: Result.Ok(43) },
    ]);
    try {
      keyed.get("c").once(() => {
        throw new Error("nope");
      });
    } catch (e) {
      expect(e).toEqual(new Error("nope"));
    }
    expect(Array.from(keyed.entries())).toEqual([
      { key: "a", value: Result.Ok(42) },
      { key: "b", value: Result.Ok(43) },
      { key: "c", value: Result.Err(new Error("nope")) },
    ]);
    keyed.unget("a");
    keyed.unget("c");
    expect(Array.from(keyed.entries())).toEqual([{ key: "b", value: Result.Ok(43) }]);
  });

  it("uses lru cache", () => {
    const keyed = new KeyedResolvOnce<number>({ lru: { maxEntries: 2 } });
    for (let i = 0; i < 10; i++) {
      keyed.get(i.toString()).once(() => i);
    }
    expect(keyed.values()).toEqual([
      { key: "8", value: Result.Ok(8) },
      { key: "9", value: Result.Ok(9) },
    ]);
  });

  it("resolve once serves ready and value", () => {
    const once = new ResolveOnce<number>();
    expect(once.ready).toBe(false);
    expect(once.value).toBe(undefined);
    once.once(() => 42);
    expect(once.ready).toBe(true);
    expect(once.value).toBe(42);
    void once.reset();
    expect(once.ready).toBe(false);
    expect(once.value).toBe(undefined);
  });

  it("async resolve once serves ready and value", async () => {
    const once = new ResolveOnce<number>();
    expect(once.ready).toBe(false);
    expect(once.value).toBe(undefined);
    await once.once(() => Promise.resolve(42));
    expect(once.ready).toBe(true);
    expect(once.value).toBe(42);
    void once.reset();
    expect(once.ready).toBe(false);
    expect(once.value).toBe(undefined);
  });

  it("keyed expose onAdd on onDelete", () => {
    const k = new KeyedResolvOnce<number>();
    const fn = vi.fn();
    k.onSet(fn)();
    k.onDelete(fn)();
  });

  it("once return undefined", () => {
    const once = new ResolveOnce<void>();
    once.once(() => {
      return undefined;
    });
  });

  it("keyed has a has method", () => {
    const keyed = new KeyedResolvOnce<number>();
    expect(keyed.has("a")).toBe(false);
    keyed.get("a").once(() => 42);
    expect(keyed.has("a")).toBe(true);
  });
});

class MyLazy {
  initVal = 42;
  readonly lazyMember = Lazy(() => ++this.initVal);
  readonly lazyAsyncMember = Lazy(() => Promise.resolve(++this.initVal));

  async action(): Promise<{ sync: number; async: number }> {
    return {
      sync: this.lazyMember(),
      async: await this.lazyAsyncMember(),
    };
  }
}

describe("Reset does not remove pending futures", () => {
  it("reset are queued", async () => {
    const once = new ResolveOnce<number>();
    const actions: {
      futures: Future<void>[];
      results: Promise<number>[];
      reset: Promise<number>;
    }[] = [];

    const actionCnt = 3;
    const onceCallCnt = 3;

    for (let i = 0; i < actionCnt; i++) {
      const loop = i;
      // console.log(`loop ${loop}`);
      const futures: Future<void>[] = Array(onceCallCnt)
        .fill(0)
        .map(() => {
          const f = new Future<void>();
          // console.log(`future ${loop} created ${f.id}`);
          return f;
        });
      actions.push({
        futures,
        results: Array(onceCallCnt)
          .fill(0)
          .map((_, fidx) =>
            once.once(() =>
              futures[fidx].asPromise().then(() => {
                const ret = loop ? fidx + loop + 42 : fidx + loop + 63;
                // console.log(`future ${loop} ${fidx} resolved ${ret}`);
                return ret;
              }),
            ),
          ),
        reset: once.reset(() => {
          const ret = loop + 97;
          // console.log(`reset ${loop} resolved ${ret}`);
          return Promise.resolve(ret);
        }),
      });
    }

    expect(once.queueLength).toBe(actionCnt * onceCallCnt + actionCnt + actionCnt + 1);

    [...actions].reverse().forEach((a) => {
      // console.log(`resolve action for ${i}`);
      [...a.futures].reverse().forEach((f) => {
        // console.log(`resolve future ${f.id}`);
        f.resolve();
      });
    });

    await Promise.all(actions.map((a) => a.reset));

    expect(once.queueLength).toBe(actionCnt + 1);

    for (let i = 0; i < actionCnt; i++) {
      const a = actions[i];
      expect(await Promise.all(a.results)).toEqual(
        Array(onceCallCnt)
          .fill(0)
          .map(() => (i ? i + 96 : i + 63)),
      );
    }
  });
  it("Reset does not remove pending futures", async () => {
    const cnt = 10;
    const once = new ResolveOnce<number>();

    const releaseOnce = new Future<void>();

    const waiting = Promise.all(
      Array(cnt)
        .fill(0)
        .map(() => {
          return once.once(() => releaseOnce.asPromise().then(() => 24));
        }),
    );

    const newValue = new Future<void>();
    let newWaiting: Promise<number[]>;
    const never = vi.fn();
    const resetResult = once.reset(async () => {
      newWaiting = Promise.all(
        Array(cnt)
          .fill(0)
          .map(() =>
            once.once(() => {
              never();
              return 46;
            }),
          ),
      );
      await newValue.asPromise();
      return 42;
    });
    releaseOnce.resolve();
    newValue.resolve();
    expect(await resetResult).toBe(42);

    const resWaiting = await waiting;
    expect(resWaiting).toEqual(Array(cnt).fill(24));

    const newWaitingResult = await newWaiting;
    expect(newWaitingResult).toEqual(Array(cnt).fill(24));

    expect(never).not.toHaveBeenCalled();

    const resolvedReset = await resetResult;
    expect(resolvedReset).toBe(42);

    expect(
      await Promise.all(
        Array(cnt)
          .fill(0)
          .map(() =>
            once.once(() => {
              never();
              return 49;
            }),
          ),
      ),
    ).toEqual(Array(cnt).fill(42));
  });
});

describe("Lazy Initialization", () => {
  it("ResolveOnce could be used for LazyInitialization", async () => {
    const my = new MyLazy();
    expect(await my.action()).toEqual({ sync: 43, async: 44 });
    expect(await my.action()).toEqual({ sync: 43, async: 44 });
    expect(await my.action()).toEqual({ sync: 43, async: 44 });
  });
});
