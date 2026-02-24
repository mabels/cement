import { Option } from "../option.js";
import { exception2Result, Result } from "../result.js";

export interface ParallelPriorityTeeRunArgs<TBackend> {
  readonly backend: TBackend;
  readonly branch: ReadableStream<Uint8Array>;
  readonly index: number;
  readonly signal: AbortSignal;
}

export interface ParallelPriorityTeePickWinnerArgs<TBackend, TOutcome> {
  readonly backend: TBackend;
  readonly outcome: TOutcome;
  readonly index: number;
}

export interface ParallelPriorityTeeOnErrorArgs<TBackend> {
  readonly backend: TBackend;
  readonly error: Error;
  readonly index: number;
}

export interface ParallelPriorityTeeOnDeclineArgs<TBackend, TOutcome> {
  readonly backend: TBackend;
  readonly outcome: TOutcome;
  readonly index: number;
}

export interface ParallelPriorityTeeArgs<TBackend, TOutcome, TWinner> {
  readonly backends: readonly TBackend[];
  readonly stream: ReadableStream<Uint8Array>;
  readonly signal?: AbortSignal;
  readonly loserAbortReason: (winnerIndex: number) => unknown;
  readonly run: (args: ParallelPriorityTeeRunArgs<TBackend>) => Promise<Result<TOutcome, Error>>;
  readonly pickWinner: (args: ParallelPriorityTeePickWinnerArgs<TBackend, TOutcome>) => Option<TWinner>;
  readonly onError: (args: ParallelPriorityTeeOnErrorArgs<TBackend>) => void;
  readonly onDecline: (args: ParallelPriorityTeeOnDeclineArgs<TBackend, TOutcome>) => void;
}

export interface ParallelPriorityTeeWinner<TWinner> {
  readonly type: "winner";
  readonly winner: TWinner;
}

export interface ParallelPriorityTeeNoWinner {
  readonly type: "no-winner";
}

export type ParallelPriorityTeeResult<TWinner> = ParallelPriorityTeeWinner<TWinner> | ParallelPriorityTeeNoWinner;

function splitReadableStream(stream: ReadableStream<Uint8Array>, copies: number): ReadableStream<Uint8Array>[] {
  const branches: ReadableStream<Uint8Array>[] = [];
  let tail = stream;
  for (let index = 1; index < copies; index++) {
    const pair = tail.tee();
    branches.push(pair[0]);
    tail = pair[1];
  }
  branches.push(tail);
  return branches;
}

function asError(reason: unknown): Error {
  switch (true) {
    case typeof reason === "object" && reason !== null && "message" in reason && typeof reason.message === "string":
      return new Error(reason.message);
    case typeof reason === "string":
      return new Error(reason);
    default:
      return new Error(String(reason));
  }
}

function abortableBranch(branch: ReadableStream<Uint8Array>, signal: AbortSignal): ReadableStream<Uint8Array> {
  const reader = branch.getReader();
  let done = false;
  let removeAbortListener: () => void = () => undefined;

  return new ReadableStream<Uint8Array>({
    start(controller): void {
      function closeStream(): void {
        if (done) {
          return;
        }
        done = true;
        controller.close();
      }

      function errorStream(error: unknown): void {
        if (done) {
          return;
        }
        done = true;
        controller.error(error);
      }

      function onAbort(): void {
        // Reader may already be closed/cancelled by concurrent completion.
        void exception2Result(() => reader.cancel(signal.reason));
        errorStream(signal.reason);
      }

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
      removeAbortListener = (): void => {
        signal.removeEventListener("abort", onAbort);
      };

      async function pump(): Promise<void> {
        while (true) {
          const { done: readDone, value } = await reader.read();
          if (readDone) {
            closeStream();
            return;
          }
          controller.enqueue(value);
        }
      }

      void pump()
        .catch((error) => {
          if (signal.aborted) {
            errorStream(signal.reason);
            return;
          }
          errorStream(error);
        })
        .finally(() => {
          removeAbortListener();
        });
    },
    cancel(reason): Promise<void> {
      removeAbortListener();
      return reader.cancel(reason).then(() => undefined);
    },
  });
}

function settleLosers<TBackend, TOutcome, TWinner>(
  args: ParallelPriorityTeeArgs<TBackend, TOutcome, TWinner>,
  pending: Promise<Result<TOutcome, Error>>[],
  winnerIndex: number,
): void {
  const losers = pending.slice(winnerIndex + 1);
  void Promise.all(
    losers.map(async (pendingResult, loserOffset) => {
      const loserIndex = winnerIndex + 1 + loserOffset;
      const result = await pendingResult;
      if (result.isErr()) {
        args.onError({
          backend: args.backends[loserIndex],
          error: result.Err(),
          index: loserIndex,
        });
        return;
      }
      args.onDecline({
        backend: args.backends[loserIndex],
        outcome: result.Ok(),
        index: loserIndex,
      });
    }),
  );
}

/**
 * Splits a ReadableStream into N tee branches, runs N async consumers in parallel,
 * and selects a winner in deterministic index order (not first-to-finish).
 *
 * Each tee branch is wrapped in an abort-aware stream, so aborting losers also
 * unblocks branch reads for callers that simply drain the stream.
 *
 * After a winner is found, remaining branches are aborted and their settlements
 * are awaited in a fire-and-forget manner (does not block winner return).
 *
 * An optional caller AbortSignal is propagated to all branch controllers.
 *
 * @template TBackend - The backend type provided for each branch
 * @template TOutcome - The result type returned by each branch's run function
 * @template TWinner - The winner type returned by pickWinner
 * @param args - Configuration object with backends, stream, callbacks, and optional signal
 * @returns Promise resolving to either a winner result or no-winner result
 */
export async function parallelPriorityTee<TBackend, TOutcome, TWinner>(
  args: ParallelPriorityTeeArgs<TBackend, TOutcome, TWinner>,
): Promise<ParallelPriorityTeeResult<TWinner>> {
  if (args.backends.length === 0) {
    // Stream may already be closed/locked by caller-controlled lifecycle.
    await exception2Result(() => args.stream.cancel("parallelPriorityTee:no-backends"));
    return { type: "no-winner" };
  }

  const branches = splitReadableStream(args.stream, args.backends.length);
  const controllers = args.backends.map(() => new AbortController());
  const removeEventListeners: (() => void)[] = [];

  if (args.signal) {
    const callerSignal = args.signal;
    function onCallerAbort(): void {
      controllers.forEach((controller) => controller.abort(callerSignal.reason));
    }
    if (callerSignal.aborted) {
      onCallerAbort();
    } else {
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
      removeEventListeners.push(() => {
        callerSignal.removeEventListener("abort", onCallerAbort);
      });
    }
  }

  try {
    const pending = args.backends.map((backend, index) =>
      args
        .run({
          backend,
          branch: abortableBranch(branches[index], controllers[index].signal),
          index,
          signal: controllers[index].signal,
        })
        .catch((error) => Result.Err<TOutcome>(asError(error))),
    );

    for (let index = 0; index < pending.length; index++) {
      const backend = args.backends[index];
      const result = await pending[index];

      if (result.isErr()) {
        args.onError({
          backend,
          error: result.Err(),
          index,
        });
        continue;
      }

      const outcome = result.Ok();
      const maybeWinner = args.pickWinner({
        backend,
        outcome,
        index,
      });
      if (maybeWinner.is_some()) {
        for (let loserIndex = index + 1; loserIndex < controllers.length; loserIndex++) {
          controllers[loserIndex].abort(args.loserAbortReason(index));
        }
        settleLosers(args, pending, index);
        return {
          type: "winner",
          winner: maybeWinner.unwrap(),
        };
      }

      args.onDecline({
        backend,
        outcome,
        index,
      });
    }

    return { type: "no-winner" };
  } finally {
    removeEventListeners.forEach((removeListener) => removeListener());
  }
}
