/* eslint-disable no-console */
import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { approachNames, type Measurement } from "./stream2uint8array-approaches.js";

const execFileAsync = promisify(execFile);
const measureScript = fileURLToPath(new URL("./stream2uint8array-measure.ts", import.meta.url));
const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const JUNK_SIZES = [16, 64, 256, 1024].map((kb) => kb * 1024);
const TOTAL_SIZE = Number(process.env.PERF_TOTAL ?? 2 * 1024 * 1024);
const SALT = process.env.PERF_SALT ?? "cement-stream2uint8array";
const configuredIterations = Number(process.env.PERF_ITERATIONS ?? 3);
const ITERATIONS = Number.isFinite(configuredIterations) ? Math.max(1, Math.floor(configuredIterations)) : 3;

interface Aggregate extends Measurement {
  readonly iterations: number;
  readonly runtimeMinMs: number;
  readonly runtimeMaxMs: number;
}

async function runIsolated(impl: string, junkSize: number, totalSize: number, salt: string): Promise<Measurement> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--expose-gc", "--import", "tsx", measureScript, impl, String(junkSize), String(totalSize), salt],
    { cwd: projectRoot, maxBuffer: 16 * 1024 * 1024 },
  );
  const lines = stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0);
  return JSON.parse(lines[lines.length - 1]) as Measurement;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function aggregate(runs: Measurement[]): Aggregate {
  const first = runs[0];
  if (!first) {
    throw new Error("aggregate requires at least one run");
  }
  return {
    ...first,
    iterations: runs.length,
    runtimeMs: median(runs.map((run) => run.runtimeMs)),
    runtimeMinMs: Math.min(...runs.map((run) => run.runtimeMs)),
    runtimeMaxMs: Math.max(...runs.map((run) => run.runtimeMs)),
    peakAboveBaselineBytes: median(runs.map((run) => run.peakAboveBaselineBytes)),
    retainedArrayBuffers: median(runs.map((run) => run.retainedArrayBuffers)),
    retainedHeap: median(runs.map((run) => run.retainedHeap)),
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatJunk(junkSize: number): string {
  return `${junkSize / 1024}KB`;
}

function printTable(results: Aggregate[]): void {
  const header = [
    "junk".padStart(6),
    "impl".padEnd(16),
    "chunks".padStart(7),
    "avg".padStart(8),
    "runtime".padStart(12),
    "min-max".padStart(15),
    "peak+".padStart(9),
    "buffers".padStart(9),
    "heap".padStart(9),
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of results) {
    const avgChunk = r.chunks.count === 0 ? 0 : r.chunks.bytes / r.chunks.count;
    console.log(
      [
        formatJunk(r.junkSize).padStart(6),
        r.impl.padEnd(16),
        String(r.chunks.count).padStart(7),
        formatBytes(avgChunk).padStart(8),
        `${r.runtimeMs.toFixed(2)}ms`.padStart(12),
        `${r.runtimeMinMs.toFixed(2)}-${r.runtimeMaxMs.toFixed(2)}`.padStart(15),
        formatBytes(r.peakAboveBaselineBytes).padStart(9),
        formatBytes(r.retainedArrayBuffers).padStart(9),
        formatBytes(r.retainedHeap).padStart(9),
      ].join("  "),
    );
  }
}

describe("stream2uint8array approaches", () => {
  it("compares all approaches with deterministic random chunk sizes", async () => {
    console.log(
      `total=${formatBytes(TOTAL_SIZE)} salt=${SALT} iterations=${ITERATIONS} junkSizes=${JUNK_SIZES.map(formatJunk).join(", ")}`,
    );

    const runsByKey = new Map<string, Measurement[]>();
    for (const junkSize of JUNK_SIZES) {
      for (let iteration = 0; iteration < ITERATIONS; iteration++) {
        for (const impl of approachNames) {
          const key = `${junkSize}:${impl}`;
          process.stderr.write(`[${iteration + 1}/${ITERATIONS}] ${impl} @ ${formatJunk(junkSize)}...`);
          const measurement = await runIsolated(impl, junkSize, TOTAL_SIZE, SALT);
          const bucket = runsByKey.get(key) ?? [];
          bucket.push(measurement);
          runsByKey.set(key, bucket);
          process.stderr.write(" done\n");
        }
      }
    }

    const rawRuns: Measurement[] = [];
    const results: Aggregate[] = [];
    for (const junkSize of JUNK_SIZES) {
      for (const impl of approachNames) {
        const bucket = runsByKey.get(`${junkSize}:${impl}`);
        if (!bucket) {
          throw new Error(`missing measurements for ${impl} @ ${formatJunk(junkSize)}`);
        }
        rawRuns.push(...bucket);
        results.push(aggregate(bucket));
      }
    }

    for (const junkSize of JUNK_SIZES) {
      const group = rawRuns.filter((run) => run.junkSize === junkSize);
      const reference = group[0];
      if (!reference) {
        throw new Error(`missing measurements for ${formatJunk(junkSize)}`);
      }
      for (const run of group) {
        expect(run.chunks).toEqual(reference.chunks);
        expect(run.outputLength).toBe(reference.outputLength);
        expect(run.checksum).toBe(reference.checksum);
      }
    }

    console.log("");
    printTable(results);
    console.log("");

    for (const junkSize of JUNK_SIZES) {
      const group = results.filter((r) => r.junkSize === junkSize);
      const simple = group.find((r) => r.impl === "simple");
      const chunkAndJoin = group.find((r) => r.impl === "chunk-and-join");
      const growBuffer = group.find((r) => r.impl === "grow-buffer");
      const growResizable = group.find((r) => r.impl === "grow-resizable");
      if (!simple || !chunkAndJoin || !growBuffer || !growResizable) {
        throw new Error(`missing measurement for ${formatJunk(junkSize)}`);
      }

      const fastest = Math.min(...group.filter((r) => r.impl !== "simple").map((r) => r.runtimeMs));
      expect(fastest, `a non-simple approach should beat simple at ${formatJunk(junkSize)}`).toBeLessThan(simple.runtimeMs);

      expect(growResizable.peakAboveBaselineBytes).toBeLessThan(simple.peakAboveBaselineBytes);
      expect(growResizable.retainedArrayBuffers).toBeLessThan(chunkAndJoin.retainedArrayBuffers);
      expect(growResizable.retainedArrayBuffers).toBeLessThan(growBuffer.retainedArrayBuffers);

      console.log(
        `${formatJunk(junkSize)}: ` +
          group
            .filter((r) => r.impl !== "simple")
            .map((r) => `${r.impl} ${(simple.runtimeMs / r.runtimeMs).toFixed(1)}x faster`)
            .join(", "),
      );
    }

    console.log(
      `\nPASS: ${ITERATIONS} iterations per implementation; all produced identical bytes and every non-simple approach beat simple.`,
    );
  }, 180_000);
});
