import { exception2Result, Result } from "../result.js";

export interface PeerStream {
  write(chunk: Uint8Array): Promise<void>;
  cancel(): void;
  commit(name?: string): Promise<{ url: string }>;
}

export interface Peer {
  begin(): Promise<PeerStream>;
}

export interface TeeWriterOk {
  readonly peer: PeerStream;
  readonly commit: (name?: string) => Promise<{ url: string }>;
}

export async function teeWriter(peers: Peer[], inStream: ReadableStream<Uint8Array>): Promise<Result<TeeWriterOk>> {
  const beginResults = await Promise.allSettled(peers.map((peer) => peer.begin()));
  let activeStreams = beginResults
    .filter((r): r is PromiseFulfilledResult<PeerStream> => r.status === "fulfilled")
    .map((r) => r.value);

  if (activeStreams.length === 0) {
    return Result.Err("all peers failed to begin");
  }

  const reader = inStream.getReader();
  try {
    while (true) {
      const rRead = await exception2Result(() => reader.read());
      if (rRead.isErr()) {
        return Result.Err(rRead.Err());
      }
      const { done, value } = rRead.Ok();
      if (done) {
        break;
      }

      const writeResults = await Promise.allSettled(activeStreams.map((stream) => stream.write(value)));
      const failedIndices = writeResults.map((r, i) => (r.status === "rejected" ? i : -1)).filter((i) => i >= 0);

      for (const i of failedIndices) {
        exception2Result(() => activeStreams[i].cancel());
      }

      activeStreams = activeStreams.filter((_, i) => writeResults[i].status === "fulfilled");

      if (activeStreams.length === 0) {
        return Result.Err("all peers failed during stream");
      }
    }
  } finally {
    await exception2Result(() => reader.cancel("teeWriter:done"));
  }

  const [winner, ...losers] = activeStreams;
  for (const stream of losers) {
    exception2Result(() => stream.cancel());
  }

  return Result.Ok({
    peer: winner,
    commit: (name?: string) => winner.commit(name),
  });
}
