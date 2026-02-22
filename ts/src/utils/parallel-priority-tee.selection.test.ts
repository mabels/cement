import { describe, expect, it, vi } from "vitest";
import { Option, Result, array2stream, parallelPriorityTee, stream2array } from "@adviser/cement";

function makeStream(data: number[]): ReadableStream<Uint8Array> {
  return array2stream(data.map((n) => new Uint8Array([n])));
}

async function drainBranch(branch: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  return stream2array(branch);
}

describe("parallelPriorityTee selection", () => {
  it("single backend wins immediately", async () => {
    const onError = vi.fn();
    const onDecline = vi.fn();

    const result = await parallelPriorityTee({
      backends: ["only"],
      stream: makeStream([1, 2, 3]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ branch }) => {
        const chunks = await drainBranch(branch);
        return Result.Ok(chunks.length);
      },
      pickWinner: ({ outcome }) => (outcome === 3 ? Option.Some("got-3") : Option.None()),
      onError,
      onDecline,
    });

    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("got-3");
    }
    expect(onError).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });

  it("picks winner in index order, not first-to-finish", async () => {
    const onError = vi.fn();
    const onDecline = vi.fn();

    const result = await parallelPriorityTee({
      backends: ["slow-winner", "fast-loser"],
      stream: makeStream([10]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ backend, branch }) => {
        const chunks = await drainBranch(branch);
        if (backend === "fast-loser") {
          return Result.Ok(`fast:${chunks.length}`);
        }
        await new Promise((r) => setTimeout(r, 10));
        return Result.Ok(`slow:${chunks.length}`);
      },
      pickWinner: ({ outcome, index }) => (index === 0 ? Option.Some(`winner-${outcome}`) : Option.None()),
      onError,
      onDecline,
    });

    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("winner-slow:1");
    }
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledWith(expect.objectContaining({ backend: "fast-loser", outcome: "fast:1", index: 1 }));
  });

  it("declines lower tiers and aborts higher tiers when a mid-tier winner is selected", async () => {
    const onError = vi.fn();
    const onDecline = vi.fn();
    const abortReasons: unknown[] = [];

    const result = await parallelPriorityTee({
      backends: ["low-0", "low-1", "winner-2", "high-3"],
      stream: makeStream([7]),
      loserAbortReason: (i) => `defeated by ${i}`,
      run: async ({ index, signal }) => {
        switch (index) {
          case 0:
            return Result.Ok("decline-0");
          case 1:
            return Result.Ok("decline-1");
          case 2:
            return Result.Ok("winner");
          default:
            await new Promise<void>((resolve) => {
              signal.addEventListener(
                "abort",
                () => {
                  abortReasons.push(signal.reason);
                  resolve();
                },
                { once: true },
              );
            });
            return Result.Err("aborted");
        }
      },
      pickWinner: ({ outcome }) => (outcome === "winner" ? Option.Some(outcome) : Option.None()),
      onError,
      onDecline,
    });

    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("winner");
    }
    expect(onDecline).toHaveBeenCalledTimes(2);
    expect(onDecline).toHaveBeenNthCalledWith(1, expect.objectContaining({ index: 0, outcome: "decline-0" }));
    expect(onDecline).toHaveBeenNthCalledWith(2, expect.objectContaining({ index: 1, outcome: "decline-1" }));
    expect(onError).not.toHaveBeenCalled();
    expect(abortReasons).toEqual(["defeated by 2"]);
  });

  it("skips errored backends and finds later winner", async () => {
    const onError = vi.fn();
    const onDecline = vi.fn();

    const result = await parallelPriorityTee({
      backends: ["fail", "succeed"],
      stream: makeStream([42]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ backend, branch }) => {
        await drainBranch(branch);
        if (backend === "fail") {
          return Result.Err<string>("backend failed");
        }
        return Result.Ok("ok");
      },
      pickWinner: ({ outcome }) => Option.Some(`won:${outcome}`),
      onError,
      onDecline,
    });

    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("won:ok");
    }
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        backend: "fail",
        index: 0,
      }),
    );
    expect(onDecline).not.toHaveBeenCalled();
  });

  it("returns no-winner when all backends error", async () => {
    const onError = vi.fn();
    const onDecline = vi.fn();

    const result = await parallelPriorityTee({
      backends: ["a", "b"],
      stream: makeStream([1]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ branch }) => {
        await drainBranch(branch);
        return Result.Err<string>("nope");
      },
      pickWinner: ({ outcome }) => Option.Some(outcome),
      onError,
      onDecline,
    });

    expect(result.type).toBe("no-winner");
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onDecline).not.toHaveBeenCalled();
  });

  it("returns no-winner when all backends decline", async () => {
    const onError = vi.fn();
    const onDecline = vi.fn();

    const result = await parallelPriorityTee({
      backends: ["a", "b"],
      stream: makeStream([1]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ branch }) => {
        await drainBranch(branch);
        return Result.Ok("meh");
      },
      pickWinner: () => Option.None(),
      onError,
      onDecline,
    });

    expect(result.type).toBe("no-winner");
    expect(onError).not.toHaveBeenCalled();
    expect(onDecline).toHaveBeenCalledTimes(2);
    expect(onDecline).toHaveBeenCalledWith(expect.objectContaining({ backend: "a", outcome: "meh", index: 0 }));
    expect(onDecline).toHaveBeenCalledWith(expect.objectContaining({ backend: "b", outcome: "meh", index: 1 }));
  });

  it("handles empty backends array", async () => {
    const onError = vi.fn();
    const onDecline = vi.fn();
    const result = await parallelPriorityTee({
      backends: [],
      stream: makeStream([1]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: () => Promise.resolve(Result.Ok("unreachable")),
      pickWinner: () => Option.Some("unreachable"),
      onError,
      onDecline,
    });

    expect(result.type).toBe("no-winner");
  });
});
