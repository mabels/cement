import { ResolveOnce } from "./resolve-once";

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
});
