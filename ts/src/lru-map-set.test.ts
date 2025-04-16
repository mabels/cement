import { LRUCtx, LRUMap, AppContext } from "@adviser/cement";

it("get-put without createFN", () => {
  const cache = new LRUMap<string, number>({
    maxEntries: 1,
  });
  expect(cache.size).toBe(0);
  cache.set("a", 1);
  expect(cache.size).toBe(1);
  cache.set("a", 1);
  expect(cache.size).toBe(1);
  cache.set("b", 2);
  expect(cache.size).toBe(1);
  cache.set("b", 2);
  expect(cache.size).toBe(1);
});

it("get-put evict in order", () => {
  const cache = new LRUMap<string, number>({
    maxEntries: 2,
  });
  expect(cache.size).toBe(0);
  cache.set("a", 1);
  cache.set("b", 2);
  expect(cache.size).toBe(2);
  cache.set("c", 3);
  expect(cache.size).toBe(2);
  expect(cache.get("a")).toBe(undefined);
  expect(cache.get("b")).toBe(2);
  expect(cache.get("c")).toBe(3);

  expect(cache.get("b")).toBe(2);
  cache.set("d", 4);
  expect(cache.get("a")).toBe(undefined);
  expect(cache.get("b")).toBe(2);
  expect(cache.get("c")).toBe(undefined);
  expect(cache.get("d")).toBe(4);
});

it("get-put with createFN", async () => {
  const cache = new LRUMap<string, number>({
    maxEntries: 2,
  });
  expect(cache.size).toBe(0);
  expect(await cache.getSet("a", () => Promise.resolve(1))).toBe(1);
  expect(await cache.getSet("b", () => Promise.resolve(2))).toBe(2);
  expect(await cache.getSet("c", () => Promise.resolve(3))).toBe(3);
  expect(await cache.getSet("d", () => Promise.resolve(4))).toBe(4);
  expect(cache.size).toBe(2);
  expect(await cache.getSet("c", () => Promise.resolve(5))).toBe(3);
  expect(cache.size).toBe(2);
  expect(await cache.getSet("e", () => Promise.resolve(5))).toBe(5);
  expect(await cache.getSet("f", () => Promise.resolve(6))).toBe(6);
  expect(cache.size).toBe(2);
  expect(await cache.getSet("c", () => Promise.resolve(7))).toBe(7);
  expect(cache.size).toBe(2);
});

it("test entries iterator", () => {
  const cache = new LRUMap<string, number>({
    maxEntries: -1,
  });
  cache.set("a", 1);
  cache.set("b", 2);
  const entries = cache.entries();
  expect((entries.next().value as [string, number, LRUCtx<string, number>]).slice(0, -1)).toEqual(["a", 1]);
  expect((entries.next().value as [string, number, LRUCtx<string, number>]).slice(0, -1)).toEqual(["b", 2]);
  expect(entries.next().done).toBe(true);
});

it("test setParam", () => {
  const cache = new LRUMap<string, number>({
    maxEntries: 5,
  });
  for (let i = 0; i < 10; i++) {
    cache.set(i.toString(), i);
  }
  expect(cache.size).toBe(5);
  cache.setParam({ maxEntries: 3 });
  expect(cache.size).toBe(3);
  cache.setParam({ maxEntries: 0 });
  for (let i = 0; i < 10; i++) {
    cache.set(i.toString(), i);
  }
  expect(cache.size).toBe(10);
});

it("onAdd", () => {
  const cache = new LRUMap<string, number>({
    maxEntries: 5,
  });
  const fn1 = vi.fn();
  const fn2 = vi.fn();
  const ufn1 = cache.onSet(fn1);
  const ufn2 = cache.onSet(fn2);
  cache.set("a", 1);
  cache.set("a", 1);
  cache.set("a", 3);
  cache.set("b", 2);
  ufn1();
  cache.set("a", 2);
  cache.set("c", 3);
  ufn2();
  cache.set("d", 1);

  expect(
    fn1.mock.calls.map(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ([a, b, c]) => [a, b, (c as LRUCtx<string, number>).update],
    ),
  ).toEqual([
    ["a", 1, false],
    ["a", 3, true],
    ["b", 2, false],
  ]);

  expect(
    fn2.mock.calls.map(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ([a, b, c]) => [a, b, (c as LRUCtx<string, number>).update],
    ),
  ).toEqual([
    ["a", 1, false],
    ["a", 3, true],
    ["b", 2, false],
    ["a", 2, true],
    ["c", 3, false],
  ]);
});

it("onDelete", () => {
  const cache = new LRUMap<string, number>({
    maxEntries: 5,
  });
  const fn1 = vi.fn();
  const fn2 = vi.fn();
  const ufn1 = cache.onDelete(fn1);
  const ufn2 = cache.onDelete(fn2);
  cache.set("a", 1);
  cache.set("a", 3);
  cache.set("b", 2);
  cache.delete("a");
  ufn1();
  cache.set("c", 3);
  cache.delete("a");
  cache.delete("b");
  cache.delete("kk");
  cache.delete("b");
  ufn2();
  cache.delete("c");
  const fn3 = vi.fn();
  cache.onDelete(fn3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.clear();
  expect(
    fn1.mock.calls.map(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ([a, b, c]) => [a, b, (c as LRUCtx<string, number>).update],
    ),
  ).toEqual([["a", 3, true]]);
  expect(
    fn2.mock.calls.map(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ([a, b, c]) => [a, b, (c as LRUCtx<string, number>).update],
    ),
  ).toEqual([
    ["a", 3, true],
    ["b", 2, true],
  ]);
  expect(
    fn3.mock.calls.map(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ([a, b, c]) => [a, b, (c as LRUCtx<string, number>).update],
    ),
  ).toEqual([
    ["a", 1, true],
    ["b", 2, true],
  ]);
});

it("use ctx", () => {
  const cache = new LRUMap<string, number>({
    maxEntries: 5,
  });
  cache.onSet((k, v, ctx) => {
    ctx.item.ctx = ctx.item.ctx ?? new AppContext();
    ctx.item.ctx.set(k, v);
  });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  cache.get("a");
  cache.get("b");
  cache.get("b");
  cache.get("kk");
  expect(cache.stats).toEqual({
    deletes: 0,
    puts: 2,
    gets: 4,
  });
  expect(cache.getItem("a")?.value).toEqual(1);
  expect(cache.getItem("b")?.value).toEqual(2);
  expect(cache.getItem("a")?.ctx?.asObj()).toEqual({ a: 1 });
  expect(cache.getItem("b")?.ctx?.asObj()).toEqual({ b: 2 });
});
