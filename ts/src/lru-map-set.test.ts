import { LRUMap } from "@adviser/cement";

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
  expect(entries.next().value).toEqual(["a", 1]);
  expect(entries.next().value).toEqual(["b", 2]);
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
