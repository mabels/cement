import { ResolveOnce } from "./resolve-once";
import { vi as jest } from "vitest";

describe("resolve-once", () => {
  it("sequence", async () => {
    const once = new ResolveOnce<number>();

    const reallyOnce = jest.fn(async () => {
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
    expect(diff).toBeGreaterThanOrEqual(100);
    expect(diff).toBeLessThan(150);
  });
  it("parallel", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = jest.fn(async () => {
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
    expect(diff).toBeGreaterThanOrEqual(100);
    expect(diff).toBeLessThan(150);
  });

  it("works with void", async () => {
    const once = new ResolveOnce<void>();
    const reallyOnce = jest.fn(async () => {
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
    expect(diff).toBeGreaterThanOrEqual(100);
    expect(diff).toBeLessThan(150);
  });

  it("throws", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = jest.fn(async () => {
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
    expect(diff).toBeGreaterThanOrEqual(100);
    expect(diff).toBeLessThan(150);
  });

  it("preserves order", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = jest.fn(async () => {
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
    expect(diff).toBeGreaterThanOrEqual(100);
    expect(diff).toBeLessThan(150);
  });

  it("preserves call order to resolv order", async () => {
    const once = new ResolveOnce<number>();
    const reallyOnce = jest.fn(async () => {
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(42);
        }, 100);
      });
    });
    const start = Date.now();
    const orderFn = jest.fn();
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
    expect(diff).toBeGreaterThanOrEqual(100);
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

    const orderFn = jest.fn(async () => 42);
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
});
