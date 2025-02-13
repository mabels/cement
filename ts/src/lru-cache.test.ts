import { LRUCache } from "@adviser/cement";

it("get-put without createFN", () => {
  const cache = new LRUCache<string, number>({
    maxEntries: 1,
  });
  expect(cache.size).toBe(0);
  cache.put("a", 1);
  expect(cache.size).toBe(1);
  cache.put("a", 1);
  expect(cache.size).toBe(1);
  cache.put("b", 2);
  expect(cache.size).toBe(1);
  cache.put("b", 2);
  expect(cache.size).toBe(1);
});

it("get-put evict in order", () => {
  const cache = new LRUCache<string, number>({
    maxEntries: 2,
  });
  expect(cache.size).toBe(0);
  cache.put("a", 1);
  cache.put("b", 2);
  expect(cache.size).toBe(2);
  cache.put("c", 3);
  expect(cache.size).toBe(2);
  expect(cache.get("a")).toBe(undefined);
  expect(cache.get("b")).toBe(2);
  expect(cache.get("c")).toBe(3);

  expect(cache.get("b")).toBe(2);
  cache.put("d", 4);
  expect(cache.get("a")).toBe(undefined);
  expect(cache.get("b")).toBe(2);
  expect(cache.get("c")).toBe(undefined);
  expect(cache.get("d")).toBe(4);
});

it("get-put with createFN", async () => {
  const cache = new LRUCache<string, number>({
    maxEntries: 2,
  });
  expect(cache.size).toBe(0);
  expect(await cache.getPut("a", () => Promise.resolve(1))).toBe(1);
  expect(await cache.getPut("b", () => Promise.resolve(2))).toBe(2);
  expect(await cache.getPut("c", () => Promise.resolve(3))).toBe(3);
  expect(await cache.getPut("d", () => Promise.resolve(4))).toBe(4);
  expect(cache.size).toBe(2);
  expect(await cache.getPut("c", () => Promise.resolve(5))).toBe(3);
  expect(cache.size).toBe(2);
  expect(await cache.getPut("e", () => Promise.resolve(5))).toBe(5);
  expect(await cache.getPut("f", () => Promise.resolve(6))).toBe(6);
  expect(cache.size).toBe(2);
  expect(await cache.getPut("c", () => Promise.resolve(7))).toBe(7);
  expect(cache.size).toBe(2);
});
