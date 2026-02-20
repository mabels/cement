import { describe, expect, it, vi } from "vitest";
import { Option, Result, array2stream, parallelPriorityTee, stream2array } from "@adviser/cement";

function makeStream(data: number[]): ReadableStream<Uint8Array> {
  return array2stream(data.map((n) => new Uint8Array([n])));
}

async function drainBranch(branch: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  return stream2array(branch);
}

describe("parallelPriorityTee", () => {
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
          // fast-loser resolves immediately
          return Result.Ok(`fast:${chunks.length}`);
        }
        // slow-winner takes a tick longer but runs in parallel
        await new Promise((r) => setTimeout(r, 10));
        return Result.Ok(`slow:${chunks.length}`);
      },
      pickWinner: ({ outcome, index }) => (index === 0 ? Option.Some(`winner-${outcome}`) : Option.None()),
      onError,
      onDecline,
    });

    // Index 0 (slow-winner) is checked first despite finishing later
    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("winner-slow:1");
    }
    expect(onDecline).not.toHaveBeenCalled();
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

  it("aborts loser branches after winner", async () => {
    const abortReasons: unknown[] = [];
    const onError = vi.fn();
    const onDecline = vi.fn();

    await parallelPriorityTee({
      backends: ["winner", "loser1", "loser2"],
      stream: makeStream([1]),
      loserAbortReason: (i) => `defeated by ${i}`,
      run: async ({ branch, signal }) => {
        signal.addEventListener("abort", () => {
          abortReasons.push(signal.reason);
        });
        await drainBranch(branch);
        return Result.Ok("done");
      },
      pickWinner: ({ index }) => (index === 0 ? Option.Some("first") : Option.None()),
      onError,
      onDecline,
    });

    // loser1 (index 1) and loser2 (index 2) should be aborted
    expect(abortReasons).toEqual(["defeated by 0", "defeated by 0"]);
  });

  it("propagates caller abort signal to all branches", async () => {
    const callerController = new AbortController();
    const signalAborteds: boolean[] = [];
    const onError = vi.fn();
    const onDecline = vi.fn();

    // Abort before running
    callerController.abort("caller cancelled");

    await parallelPriorityTee({
      backends: ["a", "b"],
      stream: makeStream([1]),
      signal: callerController.signal,
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ branch, signal }) => {
        signalAborteds.push(signal.aborted);
        await drainBranch(branch);
        return Result.Ok("ok");
      },
      pickWinner: () => Option.None(),
      onError,
      onDecline,
    });

    // Both branches should see aborted signal
    expect(signalAborteds).toEqual([true, true]);
  });

  it("propagates late caller abort to all branches", async () => {
    const callerController = new AbortController();
    const branchSignals: AbortSignal[] = [];
    const onError = vi.fn();
    const onDecline = vi.fn();

    const racePromise = parallelPriorityTee({
      backends: ["a"],
      stream: makeStream([1]),
      signal: callerController.signal,
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ branch, signal }) => {
        branchSignals.push(signal);
        await drainBranch(branch);
        // Abort happens during execution
        callerController.abort("late cancel");
        return Result.Ok("ok");
      },
      pickWinner: () => Option.Some("w"),
      onError,
      onDecline,
    });

    await racePromise;

    expect(branchSignals).toHaveLength(1);
    expect(branchSignals[0].aborted).toBe(true);
    expect(branchSignals[0].reason).toBe("late cancel");
  });

  it("each branch receives its own teed copy of the stream", async () => {
    const branchData: number[][] = [];
    const onError = vi.fn();
    const onDecline = vi.fn();

    await parallelPriorityTee({
      backends: ["a", "b", "c"],
      stream: makeStream([10, 20, 30]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ branch }) => {
        const chunks = await drainBranch(branch);
        branchData.push(chunks.map((c) => c[0]));
        return Result.Ok("done");
      },
      pickWinner: () => Option.None(), // all decline so all run
      onError,
      onDecline,
    });

    // Each branch should get the full stream data
    expect(branchData).toHaveLength(3);
    for (const data of branchData) {
      expect(data).toEqual([10, 20, 30]);
    }
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

  it("winner result does not block on loser settlement", async () => {
    let loserResolved = false;
    const onError = vi.fn();
    const onDecline = vi.fn();

    const result = await parallelPriorityTee({
      backends: ["winner", "slow-loser"],
      stream: makeStream([1]),
      loserAbortReason: (i) => `loser of ${i}`,
      run: async ({ backend, branch }) => {
        if (backend === "slow-loser") {
          // This loser takes a long time, but should not block winner return
          await new Promise((r) => setTimeout(r, 200));
          loserResolved = true;
          await drainBranch(branch);
          return Result.Ok("late");
        }
        await drainBranch(branch);
        return Result.Ok("fast");
      },
      pickWinner: ({ index }) => (index === 0 ? Option.Some("quick-win") : Option.None()),
      onError,
      onDecline,
    });

    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("quick-win");
    }
    // Loser has NOT resolved yet when winner returns
    expect(loserResolved).toBe(false);
  });
});
