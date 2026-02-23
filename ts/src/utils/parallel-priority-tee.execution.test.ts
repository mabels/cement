import { describe, expect, it, vi } from "vitest";
import { Option, Result, array2stream, exception2Result, parallelPriorityTee, stream2array } from "@adviser/cement";

function makeStream(data: number[]): ReadableStream<Uint8Array> {
  return array2stream(data.map((n) => new Uint8Array([n])));
}

async function drainBranch(branch: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  return stream2array(branch);
}

describe("parallelPriorityTee execution", () => {
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

    expect(abortReasons).toEqual(["defeated by 0", "defeated by 0"]);
  });

  it("propagates caller abort signal to all branches", async () => {
    const callerController = new AbortController();
    const signalAborteds: boolean[] = [];
    const onError = vi.fn();
    const onDecline = vi.fn();

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
      pickWinner: () => Option.None(),
      onError,
      onDecline,
    });

    expect(branchData).toHaveLength(3);
    for (const data of branchData) {
      expect(data).toEqual([10, 20, 30]);
    }
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
    expect(loserResolved).toBe(false);
  });

  it("unblocks loser drains on abort for never-ending streams", async () => {
    let loserSettled = false;
    let resolveLoserSettled: (() => void) | undefined;
    const loserSettledPromise = new Promise<void>((resolve) => {
      resolveLoserSettled = resolve;
    });
    let sourceCancelled = false;
    let releasePullWait: (() => void) | undefined;

    const endless = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(new Uint8Array([1]));
      },
      async pull(controller): Promise<void> {
        await new Promise<void>((resolve) => {
          releasePullWait = resolve;
        });
        if (sourceCancelled) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array([2]));
      },
      cancel(): void {
        sourceCancelled = true;
        releasePullWait?.();
      },
    });

    const result = await parallelPriorityTee({
      backends: ["winner", "loser"],
      stream: endless,
      loserAbortReason: () => "stop-loser",
      run: async ({ backend, branch }) => {
        if (backend === "winner") {
          const reader = branch.getReader();
          await reader.read();
          void reader.cancel("winner done");
          return Result.Ok("winner");
        }
        return drainBranch(branch)
          .then(() => Result.Ok("loser-drained"))
          .finally(() => {
            loserSettled = true;
            resolveLoserSettled?.();
          });
      },
      pickWinner: ({ index, outcome }) => (index === 0 ? Option.Some(outcome) : Option.None()),
      onError: vi.fn(),
      onDecline: vi.fn(),
    });

    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("winner");
    }
    await loserSettledPromise;
    expect(loserSettled).toBe(true);
    expect(sourceCancelled).toBe(true);
  });

  it("starts all runners before selecting the winner", async () => {
    const backendCount = 3;
    const started: number[] = [];
    const abortReasons: unknown[] = [];
    let winnerObservedAllStarted = false;
    let resolveAllStarted: (() => void) | undefined;
    const allStarted = new Promise<void>((resolve) => {
      resolveAllStarted = resolve;
    });

    const result = await parallelPriorityTee({
      backends: ["winner", "loser1", "loser2"],
      stream: makeStream([1]),
      loserAbortReason: (i) => `defeated by ${i}`,
      run: async ({ index, signal }) => {
        started.push(index);
        if (started.length === backendCount) {
          resolveAllStarted?.();
        }

        if (index === 0) {
          await allStarted;
          winnerObservedAllStarted = started.length === backendCount;
          return Result.Ok("winner");
        }

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
      },
      pickWinner: ({ index, outcome }) => (index === 0 ? Option.Some(outcome) : Option.None()),
      onError: vi.fn(),
      onDecline: vi.fn(),
    });

    expect(result.type).toBe("winner");
    if (result.type === "winner") {
      expect(result.winner).toBe("winner");
    }
    expect(winnerObservedAllStarted).toBe(true);
    expect(started.slice().sort()).toEqual([0, 1, 2]);
    expect(abortReasons).toEqual(["defeated by 0", "defeated by 0"]);
  });

  it("aborted loser streams error instead of ending cleanly", async () => {
    let onErrorCount = 0;
    let resolveLoserErrorsObserved: (() => void) | undefined;
    const loserErrorsObserved = new Promise<void>((resolve) => {
      resolveLoserErrorsObserved = resolve;
    });
    const onError = vi.fn<(args: { readonly backend: string; readonly error: Error; readonly index: number }) => void>(
      function handleOnError(_args) {
        onErrorCount++;
        if (onErrorCount === 2) {
          resolveLoserErrorsObserved?.();
        }
      },
    );
    const onDecline = vi.fn();

    await parallelPriorityTee({
      backends: ["winner-0", "loser-1", "loser-2"],
      stream: makeStream([1, 2, 3]),
      loserAbortReason: () => "loser-abort-reason",
      run: async ({ backend, branch }) => {
        if (backend === "winner-0") {
          const reader = branch.getReader();
          await reader.read();
          return Result.Ok("winner");
        }

        const rDrain = await exception2Result(() => drainBranch(branch));
        if (rDrain.isErr()) {
          return Result.Err(new Error(`loser saw stream error: ${rDrain.Err().message}`));
        }
        return Result.Ok("clean-eof");
      },
      pickWinner: ({ index, outcome }) => (index === 0 ? Option.Some(outcome) : Option.None()),
      onError,
      onDecline,
    });

    await loserErrorsObserved;

    expect(onError).toHaveBeenCalledTimes(2);
    const errorMessages: string[] = onError.mock.calls.map((call) => call[0].error.message);
    expect(errorMessages[0]).toContain("loser-abort-reason");
    expect(errorMessages[1]).toContain("loser-abort-reason");
    expect(onDecline).not.toHaveBeenCalled();
  });
});
