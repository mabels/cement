import {
  stream2uint8arrayChunkAndJoin,
  stream2uint8arrayGrowBuffer,
  stream2uint8arrayGrowResizable,
  stream2uint8arraySimple,
  type Stream2Uint8ArrayStrategy,
} from "../src/utils/stream2uint8array.js";

export const approaches: Record<string, Stream2Uint8ArrayStrategy> = {
  simple: stream2uint8arraySimple,
  "chunk-and-join": stream2uint8arrayChunkAndJoin,
  "grow-buffer": stream2uint8arrayGrowBuffer,
  "grow-resizable": stream2uint8arrayGrowResizable,
};

export const approachNames = Object.keys(approaches);

export interface ChunkStats {
  count: number;
  bytes: number;
  min: number;
  max: number;
}

export interface Measurement {
  readonly impl: string;
  readonly junkSize: number;
  readonly runtimeMs: number;
  readonly peakAboveBaselineBytes: number;
  readonly retainedArrayBuffers: number;
  readonly retainedHeap: number;
  readonly outputLength: number;
  readonly checksum: string;
  readonly chunks: ChunkStats;
}

export interface SeededStream {
  readonly stream: ReadableStream<Uint8Array>;
  readonly stats: ChunkStats;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededChunkStream(totalSize: number, junkSize: number, salt: string): SeededStream {
  const random = mulberry32(hashString(`${salt}:${junkSize}:${totalSize}`));
  const stats: ChunkStats = { count: 0, bytes: 0, min: Number.POSITIVE_INFINITY, max: 0 };
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller): void {
      if (offset >= totalSize) {
        controller.close();
        return;
      }
      const randomSize = junkSize - random() * junkSize;
      const length = Math.max(1, Math.min(Math.floor(randomSize), totalSize - offset));
      const chunk = new Uint8Array(length);
      chunk.fill(offset & 0xff);
      offset += length;
      stats.count++;
      stats.bytes += length;
      stats.min = Math.min(stats.min, length);
      stats.max = Math.max(stats.max, length);
      controller.enqueue(chunk);
    },
  });
  return { stream, stats };
}
