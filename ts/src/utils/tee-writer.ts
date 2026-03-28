import { exception2Result, Result } from "../result.js";

export interface PeerStream<C = Uint8Array> {
  write: (chunk: C) => Promise<void>;
  cancel: () => Promise<void>;
  close: () => Promise<void>;
  // commit: () => Promise<void>;
}
export interface Peer<C = Uint8Array> {
  begin: () => Promise<Result<PeerStream<C>>>;
}

export interface TeeWriterOk {
  readonly peer: PeerStream;
  // readonly commit: () => Promise<void>;
}

export interface TeeWriterOptions {
  readonly peerTimeout?: number; // ms — if a peer op exceeds this, treat as failure
}

function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (ms == null) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout((): void => reject(new Error(`peer timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

export async function teeWriter(
  peers: Peer[],
  inStream: ReadableStream<Uint8Array>,
  options?: TeeWriterOptions,
): Promise<Result<TeeWriterOk>> {
  const timeout = options?.peerTimeout;

  let activeStreams = await Promise.allSettled(peers.map((p) => exception2Result(() => withTimeout(p.begin(), timeout)))).then(
    (r) => r.flatMap((r) => (r.status === "fulfilled" && r.value.isOk() ? [r.value.Ok()] : [])),
  );
  const reader = inStream.getReader();
  while (activeStreams.length > 0) {
    const rRead = await exception2Result(() => reader.read());
    if (rRead.isErr()) {
      await Promise.allSettled(activeStreams.map((stream) => exception2Result(() => withTimeout(stream.cancel(), timeout))));
      return Result.Err(rRead.Err());
    }
    const { value, done } = rRead.Ok();
    if (done) break;
    const writeResults = await Promise.allSettled(
      activeStreams.map((stream) => exception2Result(() => withTimeout(stream.write(value), timeout))),
    );
    await Promise.allSettled(
      writeResults.flatMap((r, i) => {
        if (r.status === "rejected" || r.value.isErr())
          return exception2Result(() => withTimeout(activeStreams[i].cancel(), timeout));
        return [];
      }),
    );
    activeStreams = activeStreams.filter((_, i) => writeResults[i].status === "fulfilled" && writeResults[i].value.isOk());
  }

  if (activeStreams.length === 0) {
    // abort the input stream to stop any further processing
    await exception2Result(() => reader.cancel());
    return Result.Err(new Error("all peers failed"));
  }

  while (activeStreams.length >= 1) {
    const [winner, ...losers] = activeStreams;
    const rClose = await exception2Result(() => withTimeout(winner.close(), timeout));
    if (rClose.isOk()) {
      await Promise.allSettled(losers.map((stream) => exception2Result(() => withTimeout(stream.cancel(), timeout))));
      return Result.Ok({ peer: winner });
    }
    // close failed — cancel this peer before moving on
    await exception2Result(() => withTimeout(winner.cancel(), timeout));
    activeStreams = losers;
  }
  return Result.Err(new Error("all peers failed to close successfully"));
}
