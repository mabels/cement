/* eslint-disable no-console */
import process from "node:process";
import { approaches, seededChunkStream, type Measurement } from "./stream2uint8array-approaches.js";

function checksum(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function main(): Promise<void> {
  const [impl, junkArg, totalArg, salt] = process.argv.slice(2);
  const approach = approaches[impl];
  if (!approach) {
    throw new Error(`unknown approach: ${impl}`);
  }
  const junkSize = Number(junkArg);
  const totalSize = Number(totalArg);

  const gc = (globalThis as { gc?: () => void }).gc;
  gc?.();
  await approach(seededChunkStream(64 * 1024, Math.min(junkSize, 8 * 1024), `${salt}:warmup`).stream);
  gc?.();

  const beforePeakRss = process.resourceUsage().maxRSS * 1024;
  const before = process.memoryUsage();
  const { stream, stats } = seededChunkStream(totalSize, junkSize, salt);
  const start = performance.now();
  const output = await approach(stream);
  const runtimeMs = performance.now() - start;
  const after = process.memoryUsage();
  const peakRssBytes = process.resourceUsage().maxRSS * 1024;

  const measurement: Measurement = {
    impl,
    junkSize,
    runtimeMs,
    peakAboveBaselineBytes: Math.max(0, peakRssBytes - beforePeakRss),
    retainedArrayBuffers: after.arrayBuffers - before.arrayBuffers,
    retainedHeap: after.heapUsed - before.heapUsed,
    outputLength: output.length,
    checksum: checksum(output),
    chunks: stats,
  };
  console.log(JSON.stringify(measurement));
}

await main();
