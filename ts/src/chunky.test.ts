import { it, expect, describe } from "vitest";
import { chunkySync, chunkyAsync } from "./chunky.js";
import { sleep } from "./promise-sleep.js";

interface TestCase {
  name: string;
  inputFactory: () => Iterable<number>;
  splitSize: number;
  expectedCommits: number;
  expectedSizes: number[];
}

describe.each([
  {
    name: "empty array",
    inputFactory: (): number[] => [],
    splitSize: 8,
    expectedCommits: 0,
    expectedSizes: [],
  },
  {
    name: "clean cut with array (100 items, 10 chunks)",
    inputFactory: (): number[] =>
      Array(100)
        .fill(0)
        .map((_, i) => i),
    splitSize: 10,
    expectedCommits: 10,
    expectedSizes: Array(10).fill(10) as number[],
  },
  {
    name: "uneven split with array (100 items, 8+4 chunks)",
    inputFactory: (): number[] =>
      Array(100)
        .fill(0)
        .map((_, i) => i),
    splitSize: 8,
    expectedCommits: 13,
    expectedSizes: [...(Array(12).fill(8) as number[]), 4],
  },
  {
    name: "clean cut with generator (100 items, 10 chunks)",
    inputFactory: (): Generator<number> =>
      (function* (): Generator<number> {
        for (let i = 0; i < 100; i++) yield i;
      })(),
    splitSize: 10,
    expectedCommits: 10,
    expectedSizes: Array(10).fill(10) as number[],
  },
  {
    name: "uneven split with generator (100 items, 8+4 chunks)",
    inputFactory: (): Generator<number> =>
      (function* (): Generator<number> {
        for (let i = 0; i < 100; i++) yield i;
      })(),
    splitSize: 8,
    expectedCommits: 13,
    expectedSizes: [...(Array(12).fill(8) as number[]), 4],
  },
  {
    name: "single item",
    inputFactory: (): number[] => [1],
    splitSize: 8,
    expectedCommits: 1,
    expectedSizes: [1],
  },
])("$name", ({ inputFactory, splitSize, expectedCommits, expectedSizes }: TestCase) => {
  it("sync commits", () => {
    const commits: number[] = [];
    const results: { idx: number; ok: boolean }[] = [];

    chunkySync({
      input: inputFactory(),
      splitCondition: (chunked) => chunked.length >= splitSize,
      commit: (chunked) => {
        commits.push(chunked.length);
      },
      onCommit(result, idx) {
        results.push({ idx, ok: result.isOk() });
      },
    });

    expect(commits.length).toBe(expectedCommits);
    expect(commits).toEqual(expectedSizes);
    expect(results.length).toBe(expectedCommits);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("async commits", async () => {
    const commits: number[] = [];
    const results: { idx: number; ok: boolean }[] = [];

    await chunkyAsync({
      input: inputFactory(),
      splitCondition: (chunked) => chunked.length >= splitSize,
      commit: async (chunked) => {
        commits.push(chunked.length);
        await sleep(10);
      },
      onCommit(result, idx) {
        results.push({ idx, ok: result.isOk() });
      },
    });

    expect(commits.length).toBe(expectedCommits);
    expect(commits).toEqual(expectedSizes);
    expect(results.length).toBe(expectedCommits);
    expect(results.every((r) => r.ok)).toBe(true);
  });
});

describe("commit ordering", () => {
  it("executes sync commits in order", () => {
    const order: number[] = [];

    chunkySync({
      input: Array(30)
        .fill(0)
        .map((_, i) => i),
      splitCondition: (chunked) => chunked.length >= 10,
      commit(chunked) {
        order.push(chunked[0]);
      },
    });

    expect(order).toEqual([0, 10, 20]);
  });

  it("executes async commits sequentially in order", async () => {
    const order: number[] = [];
    const delays = [50, 10, 30]; // Different delays to test sequential execution

    await chunkyAsync({
      input: Array(30)
        .fill(0)
        .map((_, i) => i),
      splitCondition: (chunked) => chunked.length >= 10,
      async commit(chunked) {
        const chunkIndex = Math.floor(chunked[0] / 10);
        const delay = delays[chunkIndex];
        await sleep(delay);
        order.push(chunked[0]);
      },
    });

    // Despite different delays, order should be maintained
    expect(order).toEqual([0, 10, 20]);
  });

  it("maintains order even with onCommit callback", async () => {
    const callbackOrder: number[] = [];
    const commitOrder: number[] = [];

    await chunkyAsync({
      input: Array(25)
        .fill(0)
        .map((_, i) => i),
      splitCondition: (chunked) => chunked.length >= 10,
      async commit() {
        await sleep(Math.random() * 20);
        commitOrder.push(commitOrder.length);
      },
      onCommit(result, idx) {
        expect(result.isOk()).toBe(true);
        callbackOrder.push(idx);
      },
    });
    expect(callbackOrder).toEqual([0, 1, 2]);
    expect(commitOrder).toEqual([0, 1, 2]);
  });
});
