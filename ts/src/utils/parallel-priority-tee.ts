import { Option } from "../option.js";
import { Result } from "../result.js";

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
  if (copies === 1) {
    return [stream];
  }

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

/**
 * Splits a ReadableStream into N tee branches, runs N async consumers in parallel,
 * and selects a winner in deterministic index order (not first-to-finish).
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
      args.run({
        backend,
        branch: branches[index],
        index,
        signal: controllers[index].signal,
      }),
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
        void Promise.allSettled(pending.slice(index + 1));
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
