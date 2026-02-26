/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from "vitest";
import { teeWriter, Peer, PeerStream } from "./tee-writer.js";

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

describe("teeWriter resilience", () => {
  it("every active peer receives every chunk", async () => {
    const chunks = [new Uint8Array([10]), new Uint8Array([20]), new Uint8Array([30])];
    const received: Map<string, Uint8Array[]> = new Map();

    function trackingPeerStream(name: string): PeerStream {
      received.set(name, []);
      return makePeerStream({
        write: vi.fn<(chunk: Uint8Array) => Promise<void>>().mockImplementation(async (chunk) => {
          received.get(name)!.push(chunk);
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
      write: vi.fn<(chunk: Uint8Array) => Promise<void>>().mockImplementation(async (chunk) => {
        survivorChunks.push(chunk);
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
