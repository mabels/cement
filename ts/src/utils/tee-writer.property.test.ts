import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { teeWriter, Peer, PeerStream } from "./tee-writer.js";
import { Result } from "../result.js";

// ---------------------------------------------------------------------------
// Model: each peer has a "failure schedule" — which op fails and when
// ---------------------------------------------------------------------------

type FailureMode = "ok" | "reject" | "throw" | "hang" | "result-err";

interface PeerSchedule {
  begin: FailureMode;
  // Per-chunk write failure: index → mode. Missing = ok.
  writeFails: Map<number, FailureMode>;
  close: FailureMode;
  cancel: FailureMode;
}

const failureModeArb = fc.constantFrom<FailureMode>("ok", "reject", "throw", "hang", "result-err");

const peerScheduleArb: fc.Arbitrary<PeerSchedule> = fc.record({
  begin: failureModeArb,
  writeFails: fc.array(fc.tuple(fc.nat({ max: 19 }), failureModeArb), { maxLength: 5 }).map((pairs) => new Map(pairs)),
  close: failureModeArb,
  cancel: failureModeArb,
});

// ---------------------------------------------------------------------------
// Build real PeerStream implementations from a schedule (no mocks)
// ---------------------------------------------------------------------------

interface PeerObservation {
  peer: Peer;
  peerStream: PeerStream;
  received: Uint8Array[];
  schedule: PeerSchedule;
  began: boolean;
  beginCount: number;
  cancelCount: number;
  closeCount: number;
  writeCount: number;
  failedWriteIndex: number | null; // first write index that failed
}

function buildPeer(schedule: PeerSchedule, log: string[]): PeerObservation {
  const obs: PeerObservation = {
    peer: undefined as unknown as Peer, // set below
    peerStream: undefined as unknown as PeerStream, // set below
    received: [],
    schedule,
    began: false,
    beginCount: 0,
    cancelCount: 0,
    closeCount: 0,
    writeCount: 0,
    failedWriteIndex: null,
  };
  let writeIndex = 0;
  let cancelled = false;
  let closed = false;

  function applyMode(mode: FailureMode, label: string): Promise<void> {
    if (mode === "throw") throw new Error(`${label} sync throw`);
    if (mode === "reject") return Promise.reject(new Error(`${label} reject`));
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    if (mode === "hang") return new Promise<void>(() => {}); // never resolves
    return Promise.resolve();
  }

  const peerStream: PeerStream = {
    async write(chunk: Uint8Array): Promise<void> {
      const idx = writeIndex++;
      obs.writeCount++;
      const mode = schedule.writeFails.get(idx) ?? "ok";
      log.push(`write[${idx}]:${mode}`);
      await applyMode(mode, `write[${idx}]`);
      if (!cancelled && !closed) obs.received.push(chunk);
    },
    async cancel(): Promise<void> {
      obs.cancelCount++;
      log.push(`cancel:${schedule.cancel}`);
      cancelled = true;
      await applyMode(schedule.cancel, "cancel");
    },
    async close(): Promise<void> {
      obs.closeCount++;
      log.push(`close:${schedule.close}`);
      closed = true;
      await applyMode(schedule.close, "close");
    },
  };

  const peer: Peer = {
    async begin(): Promise<Result<PeerStream>> {
      obs.began = true;
      obs.beginCount++;
      log.push(`begin:${schedule.begin}`);
      if (schedule.begin === "throw") throw new Error("begin sync throw");
      if (schedule.begin === "reject") return Promise.reject(new Error("begin reject"));
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      if (schedule.begin === "hang") return new Promise(() => {});
      if (schedule.begin === "result-err") return Result.Err(new Error("begin result-err"));
      return Result.Ok(peerStream);
    },
  };

  obs.peer = peer;
  obs.peerStream = peerStream;
  return obs;
}

function makeStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller): void {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

const TIMEOUT = 15; // ms — short enough to catch hangs, fast enough for many runs

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("teeWriter property-based", () => {
  // Property 1: teeWriter always terminates (no hang) when peerTimeout is set
  it("always terminates with peerTimeout set", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const built = schedules.map((s) => buildPeer(s, log));
          const peers = built.map((b) => b.peer);

          const result = await teeWriter(peers, makeStream(chunks), { peerTimeout: TIMEOUT });

          // Must be a Result — either Ok or Err, never throw
          expect(result.is_ok() || result.is_err()).toBe(true);
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 2: if result is Ok, exactly one winner; all others eventually cancelled or not started
  it("Ok result returns exactly one peer", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const built = schedules.map((s) => buildPeer(s, log));
          const peers = built.map((b) => b.peer);

          const result = await teeWriter(peers, makeStream(chunks), { peerTimeout: TIMEOUT });

          if (result.isOk()) {
            const winner = result.Ok().peer;
            expect(typeof winner.write).toBe("function");
            expect(typeof winner.cancel).toBe("function");
            expect(typeof winner.close).toBe("function");
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 3: if all peers fail begin, result is Err
  it("all-fail-begin yields Err", async () => {
    const failBeginArb = fc.constantFrom<FailureMode>("reject", "throw", "hang");
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            begin: failBeginArb,
            writeFails: fc.constant(new Map<number, FailureMode>()),
            close: fc.constant<FailureMode>("ok"),
            cancel: fc.constant<FailureMode>("ok"),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 5 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const built = schedules.map((s) => buildPeer(s, log));
          const result = await teeWriter(
            built.map((b) => b.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );
          expect(result.isErr()).toBe(true);
        },
      ),
      { timeout: 10_000, numRuns: 100 },
    );
  });

  // Property 4: a fully healthy peer always produces Ok
  it("at least one healthy peer always yields Ok", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 0, maxLength: 3 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (badSchedules, chunks) => {
          const healthySchedule: PeerSchedule = {
            begin: "ok",
            writeFails: new Map(),
            close: "ok",
            cancel: "ok",
          };
          const log: string[] = [];
          // Put healthy peer last to stress the fallback path
          const allSchedules = [...badSchedules, healthySchedule];
          const built = allSchedules.map((s) => buildPeer(s, log));
          const result = await teeWriter(
            built.map((b) => b.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );
          expect(result.isOk()).toBe(true);
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 5: the winning peer received all chunks (for healthy winner)
  it("winner received all chunks when healthy", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 16 }), { minLength: 1, maxLength: 10 }),
        async (chunks) => {
          const healthySchedule: PeerSchedule = {
            begin: "ok",
            writeFails: new Map(),
            close: "ok",
            cancel: "ok",
          };
          const log: string[] = [];
          const built = buildPeer(healthySchedule, log);
          const result = await teeWriter([built.peer], makeStream(chunks), { peerTimeout: TIMEOUT });

          expect(result.isOk()).toBe(true);
          expect(built.received).toEqual(chunks);
        },
      ),
      { timeout: 10_000, numRuns: 200 },
    );
  });

  // Property 6: hung peer on write doesn't block pipeline when survivor exists
  it("hung peer on write does not block when survivor exists", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 9 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 10 }),
        async (hangAt, chunks) => {
          const hangSchedule: PeerSchedule = {
            begin: "ok",
            writeFails: new Map([[hangAt, "hang"]]),
            close: "ok",
            cancel: "ok",
          };
          const healthySchedule: PeerSchedule = {
            begin: "ok",
            writeFails: new Map(),
            close: "ok",
            cancel: "ok",
          };
          const log: string[] = [];
          const hung = buildPeer(hangSchedule, log);
          const healthy = buildPeer(healthySchedule, log);

          const result = await teeWriter([hung.peer, healthy.peer], makeStream(chunks), { peerTimeout: TIMEOUT });

          expect(result.isOk()).toBe(true);
          expect(healthy.received).toEqual(chunks);
        },
      ),
      { timeout: 15_000, numRuns: 50 },
    );
  }, 30_000);

  // Property 7: hung peer on begin doesn't block pipeline
  it("hung peer on begin does not block when survivor exists", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.uint8Array({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 10 }), async (chunks) => {
        const hangSchedule: PeerSchedule = {
          begin: "hang",
          writeFails: new Map(),
          close: "ok",
          cancel: "ok",
        };
        const healthySchedule: PeerSchedule = {
          begin: "ok",
          writeFails: new Map(),
          close: "ok",
          cancel: "ok",
        };
        const log: string[] = [];
        const hung = buildPeer(hangSchedule, log);
        const healthy = buildPeer(healthySchedule, log);

        const result = await teeWriter([hung.peer, healthy.peer], makeStream(chunks), { peerTimeout: TIMEOUT });

        expect(result.isOk()).toBe(true);
        expect(healthy.received).toEqual(chunks);
      }),
      { timeout: 10_000, numRuns: 50 },
    );
  });

  // Property 8: hung peer on close falls through to next peer
  it("hung peer on close falls through to next peer", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.uint8Array({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 10 }), async (chunks) => {
        const hangCloseSchedule: PeerSchedule = {
          begin: "ok",
          writeFails: new Map(),
          close: "hang",
          cancel: "ok",
        };
        const healthySchedule: PeerSchedule = {
          begin: "ok",
          writeFails: new Map(),
          close: "ok",
          cancel: "ok",
        };
        const log: string[] = [];
        const hangClose = buildPeer(hangCloseSchedule, log);
        const healthy = buildPeer(healthySchedule, log);

        const result = await teeWriter([hangClose.peer, healthy.peer], makeStream(chunks), { peerTimeout: TIMEOUT });

        expect(result.isOk()).toBe(true);
        // The second peer should win since first hangs on close
        expect(result.Ok().peer).toBe(healthy.peerStream);
      }),
      { timeout: 15_000, numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Deeper invariants — probing for structural bugs
// ---------------------------------------------------------------------------

const healthy: PeerSchedule = { begin: "ok", writeFails: new Map(), close: "ok", cancel: "ok" };

describe("teeWriter invariants", () => {
  // Property 9: winner is the lowest-index peer that successfully began, survived all writes, and closed ok
  // This tests the close-loop priority ordering.
  it("winner is the lowest-index surviving peer", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          const result = await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          if (result.isOk()) {
            const winnerStream = result.Ok().peer;
            const winnerIdx = obs.findIndex((o) => o.peerStream === winnerStream);
            expect(winnerIdx).toBeGreaterThanOrEqual(0);

            // Every peer before the winner that successfully began must have
            // either failed a write or failed to close
            for (let i = 0; i < winnerIdx; i++) {
              const o = obs[i];
              if (!o.began || o.schedule.begin !== "ok") continue;
              // This peer began ok but didn't win — it must have failed write or close
              const failedWrite = [...o.schedule.writeFails.entries()].some(([idx, mode]) => idx < chunks.length && mode !== "ok");
              const failedClose = o.schedule.close !== "ok";
              expect(failedWrite || failedClose).toBe(true);
            }
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 10: each peer's received chunks are a prefix of the full chunk list
  // A peer that fails on chunk N should have received chunks 0..N-1 (not more).
  it("each peer's received chunks are a prefix of the input", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 6 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          for (const o of obs) {
            if (!o.began || o.schedule.begin !== "ok") {
              expect(o.received).toHaveLength(0);
              continue;
            }
            // received must be a prefix of chunks
            expect(o.received.length).toBeLessThanOrEqual(chunks.length);
            for (let i = 0; i < o.received.length; i++) {
              expect(o.received[i]).toEqual(chunks[i]);
            }
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 11: no peer receives writes after it has failed
  // Once a peer fails a write, teeWriter should stop calling write on it.
  it("no writes after first failure", async () => {
    // Use non-hang failure modes only so we can count writes precisely
    const noHangFailure = fc.constantFrom<FailureMode>("ok", "reject", "throw");
    const preciseScheduleArb = fc.record({
      begin: fc.constant<FailureMode>("ok"),
      writeFails: fc.array(fc.tuple(fc.nat({ max: 9 }), noHangFailure), { maxLength: 3 }).map((pairs) => new Map(pairs)),
      close: noHangFailure,
      cancel: noHangFailure,
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(preciseScheduleArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 8 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          for (const o of obs) {
            if (o.schedule.begin !== "ok") continue;
            // Find the first write index that should fail
            const failIndices = [...o.schedule.writeFails.entries()]
              .filter(([, mode]) => mode !== "ok")
              .map(([idx]) => idx)
              .sort((a, b) => a - b);
            if (failIndices.length > 0 && failIndices[0] < chunks.length) {
              // Should have been called for at most failIndex+1 writes (including the failing one)
              expect(o.writeCount).toBeLessThanOrEqual(failIndices[0] + 1);
            }
          }
        },
      ),
      { timeout: 10_000, numRuns: 200 },
    );
  }, 30_000);

  // Property 12: on Ok, exactly one peer was closed and zero were both closed+cancelled
  // The winner gets close(), losers get cancel(), nobody gets both.
  it("winner is closed not cancelled, losers are cancelled not closed", async () => {
    // Use only ok cancel so we can observe the calls cleanly
    const cleanCancelSchedule = fc.record({
      begin: failureModeArb,
      writeFails: fc.array(fc.tuple(fc.nat({ max: 9 }), failureModeArb), { maxLength: 3 }).map((pairs) => new Map(pairs)),
      close: failureModeArb,
      cancel: fc.constant<FailureMode>("ok"),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(cleanCancelSchedule, { minLength: 2, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          const result = await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          if (result.isOk()) {
            const winnerStream = result.Ok().peer;
            const winnerObs = obs.find((o) => o.peerStream === winnerStream);
            expect(winnerObs).toBeDefined();
            const winner = winnerObs as PeerObservation;

            // Winner was closed (at least attempted)
            expect(winner.closeCount).toBeGreaterThanOrEqual(1);
            // Winner was NOT cancelled
            expect(winner.cancelCount).toBe(0);

            // Every other peer that began successfully: was cancelled, not closed
            // (or it was closed but failed, then later cancelled when a subsequent peer won)
            for (const o of obs) {
              if (o === winnerObs) continue;
              if (!o.began || o.schedule.begin !== "ok") continue;
              // Should have been cancelled at some point
              expect(o.cancelCount).toBeGreaterThanOrEqual(1);
            }
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 13: empty peers array immediately returns Err
  it("empty peers array returns Err", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }), async (chunks) => {
        const result = await teeWriter([], makeStream(chunks), { peerTimeout: TIMEOUT });
        expect(result.isErr()).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  // Property 14: all peers fail every write → Err, and input reader is cancelled
  // (tests the "all peers failed" path after write loop drains)
  it("all peers failing all writes returns Err", async () => {
    const failWriteArb = fc.constantFrom<FailureMode>("reject", "throw");
    await fc.assert(
      fc.asyncProperty(
        fc.array(failWriteArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 4 }),
        async (failModes, chunks) => {
          const log: string[] = [];
          const obs = failModes.map((mode) =>
            buildPeer({ begin: "ok", writeFails: new Map([[0, mode]]), close: "ok", cancel: "ok" }, log),
          );

          const result = await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );
          expect(result.isErr()).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 15: all peers succeed begin+writes but ALL fail close → Err
  it("all peers failing close returns Err", async () => {
    const failCloseArb = fc.constantFrom<FailureMode>("reject", "throw");
    await fc.assert(
      fc.asyncProperty(
        fc.array(failCloseArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (closeModes, chunks) => {
          const log: string[] = [];
          const obs = closeModes.map((mode) => buildPeer({ begin: "ok", writeFails: new Map(), close: mode, cancel: "ok" }, log));

          const result = await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );
          expect(result.isErr()).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 16: peer that fails write at index N then has cancel called,
  // even if cancel also fails the pipeline continues with other peers
  it("write-fail then cancel-fail does not poison remaining peers", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 5 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 2, maxLength: 6 }),
        async (failAt, chunks) => {
          const poisonSchedule: PeerSchedule = {
            begin: "ok",
            writeFails: new Map([[failAt, "reject"]]),
            close: "ok",
            cancel: "throw", // cancel itself throws
          };
          const log: string[] = [];
          const poison = buildPeer(poisonSchedule, log);
          const survivor = buildPeer(healthy, log);

          const result = await teeWriter([poison.peer, survivor.peer], makeStream(chunks), { peerTimeout: TIMEOUT });

          expect(result.isOk()).toBe(true);
          expect(survivor.received).toEqual(chunks);
        },
      ),
      { numRuns: 50 },
    );
  }, 30_000);

  // Property 17: close is never called during the write loop — only after all chunks are consumed
  // (tests that the write loop and close loop are strictly sequential phases)
  it("close is never called before all chunks are written", async () => {
    // Only use ok/reject/throw (no hang) for writes so timing is deterministic
    const noHangWriteArb = fc.record({
      begin: fc.constant<FailureMode>("ok"),
      writeFails: fc
        .array(fc.tuple(fc.nat({ max: 9 }), fc.constantFrom<FailureMode>("ok", "reject", "throw")), { maxLength: 3 })
        .map((pairs) => new Map(pairs)),
      close: fc.constantFrom<FailureMode>("ok", "reject", "throw"),
      cancel: fc.constantFrom<FailureMode>("ok", "reject", "throw"),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(noHangWriteArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 6 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          // In the log, every "close:*" entry must come after all "write[*]:*" entries
          const lastWriteIdx = log.findLastIndex((e) => e.startsWith("write["));
          const firstCloseIdx = log.findIndex((e) => e.startsWith("close:"));

          if (firstCloseIdx >= 0 && lastWriteIdx >= 0) {
            expect(firstCloseIdx).toBeGreaterThan(lastWriteIdx);
          }
        },
      ),
      { timeout: 10_000, numRuns: 200 },
    );
  }, 30_000);

  // Property 18: the winner's peerStream identity matches one of the built peers
  // (guards against teeWriter returning a wrapper or proxy instead of the original)
  it("winner is referentially identical to one of the input peerStreams", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          const result = await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          if (result.isOk()) {
            const winnerStream = result.Ok().peer;
            const match = obs.some((o) => o.peerStream === winnerStream);
            expect(match).toBe(true);
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 19: on Err result, no peer should have been "successfully closed"
  // (if any peer closed ok, the result should be Ok, not Err)
  it("Err result means no peer closed successfully", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          const result = await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          if (result.isErr()) {
            // No peer that began ok with ok writes and ok close should exist
            for (const o of obs) {
              if (o.schedule.begin !== "ok") continue;
              const allWritesOk = [...o.schedule.writeFails.entries()].every(
                ([idx, mode]) => idx >= chunks.length || mode === "ok",
              );
              if (allWritesOk && o.schedule.close === "ok") {
                // This peer should have been a valid winner — bug if we got Err
                // (unless it got timed out, but with no hangs this shouldn't happen)
                // Only assert for non-hang schedules
                const hasAnyHang = o.schedule.cancel === "hang" || [...o.schedule.writeFails.values()].some((m) => m === "hang");
                if (!hasAnyHang) {
                  // This peer was fully healthy — teeWriter should have returned Ok
                  expect(result.isOk()).toBe(true); // will fail, proving a bug
                }
              }
            }
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Call-count and lifecycle invariants
// ---------------------------------------------------------------------------

describe("teeWriter lifecycle", () => {
  // Property 20: begin is called exactly once per peer, never more
  it("begin is called exactly once per peer", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          for (const o of obs) {
            expect(o.beginCount).toBe(1);
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 21: close is called at most once per peer
  it("close is called at most once per peer", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          for (const o of obs) {
            expect(o.closeCount).toBeLessThanOrEqual(1);
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 22: cancel is called at most once per peer
  it("cancel is called at most once per peer", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          for (const o of obs) {
            expect(o.cancelCount).toBeLessThanOrEqual(1);
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 23: begin returning Result.Err (not throw/reject) is handled —
  // peer is filtered out, never written to, never closed, never cancelled
  it("begin returning Result.Err skips the peer entirely", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 6 }), async (chunks) => {
        const log: string[] = [];
        const errBegin = buildPeer({ begin: "result-err", writeFails: new Map(), close: "ok", cancel: "ok" }, log);
        const survivor = buildPeer(healthy, log);

        const result = await teeWriter([errBegin.peer, survivor.peer], makeStream(chunks), { peerTimeout: TIMEOUT });

        expect(result.isOk()).toBe(true);
        expect(errBegin.writeCount).toBe(0);
        expect(errBegin.closeCount).toBe(0);
        expect(errBegin.cancelCount).toBe(0);
        expect(survivor.received).toEqual(chunks);
      }),
      { numRuns: 50 },
    );
  }, 30_000);

  // Property 24: when the input stream errors, all active peers are cancelled
  it("input stream error cancels all active peers", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 5 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 2, maxLength: 6 }),
        async (errorAfter, chunks) => {
          const idx = Math.min(errorAfter, chunks.length - 1);
          let enqueued = 0;
          const errorStream = new ReadableStream<Uint8Array>({
            pull(controller): void {
              if (enqueued >= chunks.length || enqueued > idx) {
                controller.error(new Error("stream exploded"));
                return;
              }
              controller.enqueue(chunks[enqueued++]);
            },
          });

          const log: string[] = [];
          const p1 = buildPeer(healthy, log);
          const p2 = buildPeer(healthy, log);

          const result = await teeWriter([p1.peer, p2.peer], errorStream, { peerTimeout: TIMEOUT });

          expect(result.isErr()).toBe(true);
          // Both peers should have been cancelled
          expect(p1.cancelCount).toBe(1);
          expect(p2.cancelCount).toBe(1);
        },
      ),
      { numRuns: 50 },
    );
  }, 30_000);

  // Property 25: Err result always contains an Error object, never a bare string
  it("Err result is always an Error instance", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(peerScheduleArb, { minLength: 1, maxLength: 3 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { maxLength: 4 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          const result = await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          if (result.isErr()) {
            expect(result.Err()).toBeInstanceOf(Error);
          }
        },
      ),
      { timeout: 30_000, numRuns: 100 },
    );
  }, 60_000);

  // Property 26: a peer that was written to and then removed (write fail)
  // is never written to again in subsequent rounds
  it("removed peer receives no further writes", async () => {
    // Track per-peer write calls with timestamps relative to rounds
    const noHangArb = fc.constantFrom<FailureMode>("ok", "reject", "throw");
    const trackedScheduleArb = fc.record({
      begin: fc.constant<FailureMode>("ok"),
      writeFails: fc.array(fc.tuple(fc.nat({ max: 9 }), noHangArb), { maxLength: 3 }).map((pairs) => new Map(pairs)),
      close: noHangArb,
      cancel: noHangArb,
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(trackedScheduleArb, { minLength: 2, maxLength: 4 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 2, maxLength: 8 }),
        async (schedules, chunks) => {
          const log: string[] = [];
          const obs = schedules.map((s) => buildPeer(s, log));

          await teeWriter(
            obs.map((o) => o.peer),
            makeStream(chunks),
            { peerTimeout: TIMEOUT },
          );

          // For each peer, find which write round it first failed at
          for (const o of obs) {
            const failIndices = [...o.schedule.writeFails.entries()]
              .filter(([idx, mode]) => idx < chunks.length && mode !== "ok")
              .map(([idx]) => idx)
              .sort((a, b) => a - b);

            if (failIndices.length > 0) {
              const firstFail = failIndices[0];
              // The peer should have received at most firstFail+1 write calls
              // (the failing call counts, but no calls after)
              expect(o.writeCount).toBeLessThanOrEqual(firstFail + 1);
            }
          }
        },
      ),
      { timeout: 10_000, numRuns: 200 },
    );
  }, 30_000);

  // Property 27: a peer with cancel:"hang" that fails write — its hung cancel
  // doesn't prevent other peers from receiving subsequent chunks
  it("hung cancel on failed peer does not block write loop for survivors", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 5 }),
        fc.array(fc.uint8Array({ minLength: 1, maxLength: 4 }), { minLength: 2, maxLength: 6 }),
        async (failAt, chunks) => {
          const hangCancelSchedule: PeerSchedule = {
            begin: "ok",
            writeFails: new Map([[failAt, "reject"]]),
            close: "ok",
            cancel: "hang",
          };
          const log: string[] = [];
          const toxic = buildPeer(hangCancelSchedule, log);
          const survivor = buildPeer(healthy, log);

          const result = await teeWriter([toxic.peer, survivor.peer], makeStream(chunks), { peerTimeout: TIMEOUT });

          expect(result.isOk()).toBe(true);
          expect(survivor.received).toEqual(chunks);
        },
      ),
      { timeout: 15_000, numRuns: 50 },
    );
  }, 30_000);
});
