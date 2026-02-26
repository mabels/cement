import { exception2Result, Result } from "../result.js";

export interface PeerStream {
  write: (chunk: Uint8Array) => Promise<void>;
  cancel: () => void;
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
  return exception2Result(async () => {
    let activeStreams = (await Promise.allSettled(peers.map((p) => p.begin()))).flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );

    const reader = inStream.getReader();
    while (activeStreams.length > 0) {
      const { done, value } = await reader.read();
      if (done) break;

      const writeResults = await Promise.allSettled(activeStreams.map((stream) => stream.write(value)));
      for (const [i, r] of writeResults.entries()) {
        if (r.status === "rejected") activeStreams[i].cancel();
      }
      activeStreams = activeStreams.filter((_, i) => writeResults[i].status === "fulfilled");
    }

    if (activeStreams.length === 0) throw new Error("all peers failed");
    const [winner, ...losers] = activeStreams;
    for (const stream of losers) {
      stream.cancel();
    }
    return { peer: winner, commit: (name?: string) => winner.commit(name) };
  });
}
