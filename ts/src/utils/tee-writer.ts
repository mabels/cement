import { exception2Result, Result } from "../result.js";

export interface PeerStream {
  write: (chunk: Uint8Array) => Promise<void>;
  cancel: () => Promise<void>;
  commit: (name?: string) => Promise<{ url: string }>;
}

export interface Peer {
  begin: () => Promise<PeerStream>;
}

export interface TeeWriterOk {
  readonly peer: PeerStream;
  readonly commit: (name?: string) => Promise<{ url: string }>;
}

export async function teeWriter(peers: Peer[], inStream: ReadableStream<Uint8Array>): Promise<Result<TeeWriterOk>> {
  let activeStreams = await Promise.allSettled(peers.map((p) => p.begin())).then((r) =>
    r.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
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
    const writeResults = await Promise.allSettled(activeStreams.map((stream) => stream.write(value)));
    await Promise.allSettled(
      writeResults.flatMap((r, i) => {
        if (r.status === "rejected") return [activeStreams[i].cancel()];
        return [];
      }),
    );
    activeStreams = activeStreams.filter((_, i) => writeResults[i].status === "fulfilled");
  }

  if (activeStreams.length === 0) {
    // abort the input stream to stop any further processing
    await reader.cancel();
    return Result.Err(new Error("all peers failed"));
  }
  const [winner, ...losers] = activeStreams;
  await Promise.allSettled(losers.map((stream) => stream.cancel()));
  return Result.Ok({ peer: winner, commit: (name?: string) => winner.commit(name) });
}
