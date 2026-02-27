import { describe, expect, it, vi } from "vitest";
import { teeWriter, Peer, PeerStream } from "./tee-writer.js";

function makeStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller): void {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function makePeerStream(overrides: Partial<PeerStream> = {}): PeerStream {
  return {
    write: vi.fn<(chunk: Uint8Array) => Promise<void>>().mockResolvedValue(undefined),
    cancel: vi.fn(),
    commit: vi.fn<(name?: string) => Promise<{ url: string }>>().mockResolvedValue({ url: "https://example.com/blob" }),
    ...overrides,
  };
}

function makePeer(peerStream: PeerStream): Peer {
  return { begin: vi.fn<() => Promise<PeerStream>>().mockResolvedValue(peerStream) };
}

describe("teeWriter", () => {
  const chunk1 = new Uint8Array([1, 2, 3]);
  const chunk2 = new Uint8Array([4, 5, 6]);

  it("writes all chunks to a single peer and commits", async () => {
    const ps = makePeerStream();
    const peer = makePeer(ps);

    const result = await teeWriter([peer], makeStream([chunk1, chunk2]));

    expect(result.isOk()).toBe(true);
    const { peer: winnerPeer, commit } = result.Ok();
    expect(winnerPeer).toBe(ps);
    expect(ps.write).toHaveBeenCalledTimes(2);
    expect(ps.write).toHaveBeenNthCalledWith(1, chunk1);
    expect(ps.write).toHaveBeenNthCalledWith(2, chunk2);

    const commitResult = await commit("my-key");
    expect(commitResult).toEqual({ url: "https://example.com/blob" });
    expect(ps.commit).toHaveBeenCalledWith("my-key");
  });

  it("returns the first peer and cancels the rest when all succeed", async () => {
    const ps1 = makePeerStream();
    const ps2 = makePeerStream();
    const ps3 = makePeerStream();

    const result = await teeWriter([makePeer(ps1), makePeer(ps2), makePeer(ps3)], makeStream([chunk1]));

    expect(result.isOk()).toBe(true);
    const { peer: winnerPeer } = result.Ok();
    expect(winnerPeer).toBe(ps1);

    expect(ps1.cancel).not.toHaveBeenCalled();
    expect(ps2.cancel).toHaveBeenCalled();
    expect(ps3.cancel).toHaveBeenCalled();

    // all peers received the chunk
    expect(ps1.write).toHaveBeenCalledWith(chunk1);
    expect(ps2.write).toHaveBeenCalledWith(chunk1);
    expect(ps3.write).toHaveBeenCalledWith(chunk1);
  });

  it("removes a peer that fails mid-stream and continues with the rest", async () => {
    const ps1 = makePeerStream({
      write: vi
        .fn<(chunk: Uint8Array) => Promise<void>>()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("write failed")),
    });
    const ps2 = makePeerStream();

    const result = await teeWriter([makePeer(ps1), makePeer(ps2)], makeStream([chunk1, chunk2]));

    expect(result.isOk()).toBe(true);
    const { peer: winnerPeer } = result.Ok();
    // ps1 failed on chunk2, so ps2 becomes the winner
    expect(winnerPeer).toBe(ps2);
    expect(ps1.cancel).toHaveBeenCalled();
    expect(ps2.write).toHaveBeenCalledTimes(2);
  });

  it("returns Err when all peers fail during the stream", async () => {
    const ps1 = makePeerStream({
      write: vi.fn<(chunk: Uint8Array) => Promise<void>>().mockRejectedValue(new Error("fail")),
    });
    const ps2 = makePeerStream({
      write: vi.fn<(chunk: Uint8Array) => Promise<void>>().mockRejectedValue(new Error("fail")),
    });

    const result = await teeWriter([makePeer(ps1), makePeer(ps2)], makeStream([chunk1]));

    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toMatch(/all peers failed/);
  });

  it("returns the first peer on an empty stream", async () => {
    const ps1 = makePeerStream();
    const ps2 = makePeerStream();

    const result = await teeWriter([makePeer(ps1), makePeer(ps2)], makeStream([]));

    expect(result.isOk()).toBe(true);
    const { peer: winnerPeer } = result.Ok();
    expect(winnerPeer).toBe(ps1);
    expect(ps1.write).not.toHaveBeenCalled();
    expect(ps2.write).not.toHaveBeenCalled();
    expect(ps2.cancel).toHaveBeenCalled();
  });

  it("returns Err when all peers fail on begin", async () => {
    const failPeer: Peer = { begin: vi.fn<() => Promise<PeerStream>>().mockRejectedValue(new Error("begin failed")) };

    const result = await teeWriter([failPeer, failPeer], makeStream([chunk1]));

    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toMatch(/all peers failed/);
  });

  it("survives when some peers fail on begin", async () => {
    const ps = makePeerStream();
    const goodPeer = makePeer(ps);
    const badPeer: Peer = { begin: vi.fn<() => Promise<PeerStream>>().mockRejectedValue(new Error("begin failed")) };

    const result = await teeWriter([badPeer, goodPeer], makeStream([chunk1]));

    expect(result.isOk()).toBe(true);
    const { peer: winnerPeer } = result.Ok();
    expect(winnerPeer).toBe(ps);
    expect(ps.write).toHaveBeenCalledWith(chunk1);
  });

  it("commit delegates name argument to the winning peer", async () => {
    const ps = makePeerStream();

    const result = await teeWriter([makePeer(ps)], makeStream([]));

    expect(result.isOk()).toBe(true);
    await result.Ok().commit("my-name");
    expect(ps.commit).toHaveBeenCalledWith("my-name");

    await result.Ok().commit();
    expect(ps.commit).toHaveBeenCalledWith(undefined);
  });
});

describe("teeWriter resilience", () => {
  it("every active peer receives every chunk", async () => {
    const chunks = [new Uint8Array([10]), new Uint8Array([20]), new Uint8Array([30])];
    const received = new Map<string, Uint8Array[]>();

    function trackingPeerStream(name: string): PeerStream {
      received.set(name, []);
      return makePeerStream({
        write: vi.fn<(chunk: Uint8Array) => Promise<void>>().mockImplementation((chunk) => {
          received.get(name)?.push(chunk);
          return Promise.resolve();
        }),
      });
    }

    const ps1 = trackingPeerStream("a");
    const ps2 = trackingPeerStream("b");
    const ps3 = trackingPeerStream("c");

    const stream = new ReadableStream<Uint8Array>({
      start(controller): void {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    await teeWriter([makePeer(ps1), makePeer(ps2), makePeer(ps3)], stream);

    for (const [, data] of received) {
      expect(data).toEqual(chunks);
    }
  });

  it("returns Err when input stream errors", async () => {
    const ps = makePeerStream();
    const stream = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(new Uint8Array([1]));
        controller.error(new Error("source died"));
      },
    });

    const result = await teeWriter([makePeer(ps)], stream);

    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toMatch(/source died/);
  });

  it("peers drop out at staggered points and survivor gets all chunks", async () => {
    const chunks = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3]), new Uint8Array([4])];
    const survivorChunks: Uint8Array[] = [];

    // ps1 fails on chunk 2, ps2 fails on chunk 3, ps3 survives all
    const ps1 = makePeerStream({
      write: vi
        .fn<(chunk: Uint8Array) => Promise<void>>()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("ps1 fail")),
    });
    const ps2 = makePeerStream({
      write: vi
        .fn<(chunk: Uint8Array) => Promise<void>>()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("ps2 fail")),
    });
    const ps3 = makePeerStream({
      write: vi.fn<(chunk: Uint8Array) => Promise<void>>().mockImplementation((chunk) => {
        survivorChunks.push(chunk);
        return Promise.resolve();
      }),
    });

    const stream = new ReadableStream<Uint8Array>({
      start(controller): void {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const result = await teeWriter([makePeer(ps1), makePeer(ps2), makePeer(ps3)], stream);

    expect(result.isOk()).toBe(true);
    expect(result.Ok().peer).toBe(ps3);
    expect(survivorChunks).toEqual(chunks);
    expect(ps1.cancel).toHaveBeenCalled();
    expect(ps2.cancel).toHaveBeenCalled();
  });
});
