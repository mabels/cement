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

export async function teeWriter(peers: Peer[], inStream: ReadableStream<Uint8Array>): Promise<Result<TeeWriterOk>> {
  let activeStreams = await Promise.allSettled(peers.map((p) => exception2Result(() => p.begin()))).then((r) =>
    r.flatMap((r) => (r.status === "fulfilled" && r.value.isOk() ? [r.value.Ok()] : [])),
  );
  const reader = inStream.getReader();
  while (activeStreams.length > 0) {
    const rRead = await exception2Result(() => reader.read());
    if (rRead.isErr()) {
      await Promise.allSettled(activeStreams.map((stream) => stream.cancel()));
      return Result.Err(rRead.Err());
    }
    const { value, done } = rRead.Ok();
    if (done) break;
    const writeResults = await Promise.allSettled(activeStreams.map((stream) => exception2Result(() => stream.write(value))));
    await Promise.allSettled(
      writeResults.flatMap((r, i) => {
        if (r.status === "rejected" || r.value.isErr()) return exception2Result(() => activeStreams[i].cancel());
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
    const rClose = await exception2Result(() => winner.close());
    if (rClose.isOk()) {
      await Promise.allSettled(losers.map((stream) => exception2Result(() => stream.cancel())));
      return Result.Ok({ peer: winner });
    }
    activeStreams = losers;
  }
  return Result.Err("all peers failed to close successfully");
}
