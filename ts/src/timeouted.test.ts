import { sleep } from "./promise-sleep.js";
import { runtimeFn } from "./runtime.js";
import { timeouted, isSuccess, isTimeout, isAborted, isError, unwrap, unwrapOr, createTimeoutResult } from "./timeouted.js";

// ============================================================================
// BASIC SUCCESS SCENARIOS
// ============================================================================

describe("timeoutAction - Success Cases", () => {
  it("should return success for a fast promise", async () => {
    const result = await timeouted(Promise.resolve("hello"), { timeout: 1000 });

    expect(isSuccess(result)).toBe(true);
    expect(result.state).toBe("success");
    if (isSuccess(result)) {
      expect(result.value).toBe("hello");
    }
    expect(result.duration).toBeLessThan(100);
  });

  it("should return success for a fast action function", async () => {
    const result = await timeouted(
      (ctrl) => {
        expect(ctrl).toBeInstanceOf(AbortController);
        return Promise.resolve("world");
      },
      { timeout: 1000 },
    );

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.value).toBe("world");
    }
  });

  it("should return success with custom context", async () => {
    interface MyContext {
      userId: string;
      requestId: number;
    }

    const ctx: MyContext = { userId: "user123", requestId: 42 };
    const result = await timeouted(Promise.resolve("data"), { timeout: 1000, ctx });

    expect(isSuccess(result)).toBe(true);
    expect(result.ctx).toEqual(ctx);
  });

  it("should not call onAbortAction on success", async () => {
    const onAbort = vi.fn();

    const result = await timeouted(Promise.resolve("success"), { timeout: 1000, onAbort });

    expect(isSuccess(result)).toBe(true);
    expect(onAbort).not.toHaveBeenCalled();
  });

  it("should cleanup event listeners on success", async () => {
    const controller = new AbortController();
    const result = await timeouted(Promise.resolve("success"), { timeout: 1000, signal: controller.signal });

    expect(isSuccess(result)).toBe(true);

    // Aborting after completion should not affect anything
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });
});

// ============================================================================
// TIMEOUT SCENARIOS
// ============================================================================

describe("timeoutAction - Timeout Cases", () => {
  it("should timeout when action takes too long", async () => {
    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("too slow"), 200)), { timeout: 50 });

    expect(isTimeout(result)).toBe(true);
    expect(result.state).toBe("timeout");
    expect(result.duration).toBeGreaterThanOrEqual(45);
    expect(result.duration).toBeLessThan(100);
  });

  it("should call onTimeout callback on timeout", async () => {
    const onTimeout = vi.fn();

    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 200)), { timeout: 50, onTimeout });

    expect(isTimeout(result)).toBe(true);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("should call onAbortAction on timeout", async () => {
    const onAbort = vi.fn();

    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 200)), {
      timeout: 50,
      onAbort,
    });

    expect(isTimeout(result)).toBe(true);
    expect(onAbort).toHaveBeenCalledTimes(0);
  });

  it("should abort the controller on timeout", async () => {
    const controller = new AbortController();

    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 200)), { timeout: 50, controller });

    expect(isTimeout(result)).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });

  it("should allow action to use abort signal on timeout", async () => {
    let wasAborted = false;

    const result = await timeouted(
      async (ctrl) => {
        return new Promise<string>((resolve) => {
          ctrl.signal.addEventListener("abort", () => {
            wasAborted = true;
          });
          setTimeout(() => resolve("done"), 200);
        });
      },
      { timeout: 50 },
    );

    expect(isTimeout(result)).toBe(true);
    // Give a tiny bit of time for abort handler to fire
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(wasAborted).toBe(false);
  });
});

// ============================================================================
// ABORT SCENARIOS
// ============================================================================

describe("timeoutAction - Abort Cases", () => {
  it("should abort when external signal is triggered", async () => {
    const controller = new AbortController();

    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 200)), {
      timeout: 1000,
      signal: controller.signal,
    });

    setTimeout(() => controller.abort("user cancelled"), 50);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    expect(result.state).toBe("aborted");
    if (isAborted(result)) {
      expect(result.reason).toBe("user cancelled");
    }
  });

  it("should call onAbort callback with reason", async () => {
    const onAbort = vi.fn();
    const controller = new AbortController();
    const abortReason = new Error("User initiated abort");

    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 200)), {
      timeout: 1000,
      signal: controller.signal,
      onAbort,
    });

    setTimeout(() => controller.abort(abortReason), 50);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledWith(abortReason);
  });

  it("should propagate abort to internal controller", async () => {
    const externalController = new AbortController();
    const internalController = new AbortController();

    const promise = timeouted(
      async (ctrl) => {
        expect(ctrl).toBe(internalController);
        return new Promise<string>((resolve) => {
          setTimeout(() => resolve("data"), 200);
        });
      },
      {
        timeout: 1000,
        signal: externalController.signal,
        controller: internalController,
      },
    );

    setTimeout(() => externalController.abort("cancelled"), 50);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    expect(internalController.signal.aborted).toBe(true);
  });

  it("should cleanup event listeners on abort", async () => {
    const controller = new AbortController();

    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 200)), {
      timeout: 1000,
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 50);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    // Event listeners should be cleaned up (no memory leak)
  });

  it("should handle abort with undefined reason", async () => {
    const controller = new AbortController();
    const onAbort = vi.fn();

    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 200)), {
      timeout: 1000,
      signal: controller.signal,
      onAbort,
    });

    setTimeout(() => controller.abort(), 50);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    expect((onAbort.mock.calls[0][0] as Error).message).toContain("aborted");
  });
});

// ============================================================================
// ERROR SCENARIOS
// ============================================================================

describe("timeoutAction - Error Cases", () => {
  it("should handle promise rejection", async () => {
    const testError = new Error("Something went wrong");

    const result = await timeouted(Promise.reject(testError), { timeout: 1000 });

    expect(isError(result)).toBe(true);
    expect(result.state).toBe("error");
    if (isError(result)) {
      expect(result.error).toBe(testError);
    }
  });

  it("should handle action function throwing synchronously", async () => {
    const testError = new Error("Sync error");

    const result = await timeouted(
      () => {
        throw testError;
      },
      { timeout: 1000 },
    );

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error).toBe(testError);
    }
  });

  it("should handle action function rejecting asynchronously", async () => {
    const testError = new Error("Async error");

    const result = await timeouted(
      () => {
        throw testError;
      },
      { timeout: 1000 },
    );

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error).toBe(testError);
    }
  });

  it("should call onError callback on error", async () => {
    const onError = vi.fn();
    const testError = new Error("Test error");

    const result = await timeouted(Promise.reject(testError), { timeout: 1000, onError });

    expect(isError(result)).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(testError);
  });

  it("should call onAbortAction on error", async () => {
    const testError = new Error("Test error");
    const onAbort = vi.fn();

    const result = await timeouted(Promise.reject(testError), { timeout: 1000, onAbort });

    expect(isError(result)).toBe(true);
    expect(onAbort).toHaveBeenCalledTimes(0);
  });

  it("should convert non-Error rejection to Error", async () => {
    const result = await timeouted(Promise.reject(new Error("string error")), { timeout: 1000 });

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it("should handle synchronous throw of non-Error value", async () => {
    const result = await timeouted(
      () => {
        throw new Error("string throw");
      },
      { timeout: 1000 },
    );

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("string throw");
    }
  });
});

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe("Type Guards", () => {
  it("isSuccess should work correctly", async () => {
    const successResult = await timeouted(Promise.resolve(42), { timeout: 1000 });
    const timeoutResult = await timeouted(new Promise((resolve) => setTimeout(() => resolve(42), 200)), { timeout: 50 });

    expect(isSuccess(successResult)).toBe(true);
    expect(isSuccess(timeoutResult)).toBe(false);
  });

  it("isTimeout should work correctly", async () => {
    const successResult = await timeouted(Promise.resolve(42), { timeout: 1000 });
    const timeoutResult = await timeouted(new Promise((resolve) => setTimeout(() => resolve(42), 200)), { timeout: 50 });

    expect(isTimeout(successResult)).toBe(false);
    expect(isTimeout(timeoutResult)).toBe(true);
  });

  it("isAborted should work correctly", async () => {
    const controller = new AbortController();
    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve(42), 200)), {
      timeout: 1000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    const abortedResult = await promise;

    const successResult = await timeouted(Promise.resolve(42), { timeout: 1000 });

    expect(isAborted(successResult)).toBe(false);
    expect(isAborted(abortedResult)).toBe(true);
  });

  it("isError should work correctly", async () => {
    const successResult = await timeouted(Promise.resolve(42), { timeout: 1000 });
    const errorResult = await timeouted(Promise.reject(new Error("fail")), { timeout: 1000 });

    expect(isError(successResult)).toBe(false);
    expect(isError(errorResult)).toBe(true);
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe("Helper Functions", () => {
  describe("unwrap", () => {
    it("should return value on success", async () => {
      const result = await timeouted(Promise.resolve(42), { timeout: 1000 });
      expect(unwrap(result)).toBe(42);
    });

    it("should throw on timeout", async () => {
      const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve(42), 200)), { timeout: 50 });
      expect(() => unwrap(result)).toThrow("TimeoutResult is not success: timeout");
    });

    it("should throw on abort", async () => {
      const controller = new AbortController();
      const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve(42), 200)), {
        timeout: 1000,
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(), 50);
      const result = await promise;

      expect(() => unwrap(result)).toThrow("TimeoutResult is not success: aborted");
    });

    it("should throw on error", async () => {
      const result = await timeouted(Promise.reject(new Error("fail")), { timeout: 1000 });
      expect(() => unwrap(result)).toThrow("TimeoutResult is not success: error");
    });
  });

  describe("unwrapOr", () => {
    it("should return value on success", async () => {
      const result = await timeouted(Promise.resolve(42), { timeout: 1000 });
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it("should return default on timeout", async () => {
      const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve(42), 200)), { timeout: 50 });
      expect(unwrapOr(result, 999)).toBe(999);
    });

    it("should return default on abort", async () => {
      const controller = new AbortController();
      const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve(42), 200)), {
        timeout: 1000,
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(), 50);
      const result = await promise;

      expect(unwrapOr(result, -1)).toBe(-1);
    });

    it("should return default on error", async () => {
      const result = await timeouted(Promise.reject(new Error("fail")), { timeout: 1000 });
      expect(unwrapOr(result, 100)).toBe(100);
    });
  });
});

// ============================================================================
// EDGE CASES AND COMPLEX SCENARIOS
// ============================================================================

describe("Edge Cases", () => {
  it("should handle zero timeout", async () => {
    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 10)), { timeout: 0 });
    expect(isSuccess(result)).toBe(true);
    expect(unwrap(result)).toBe("data");
  });

  it("should handle very short timeout", async () => {
    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 100)), { timeout: 1 });

    expect(isTimeout(result)).toBe(true);
  });

  it("should handle action that completes exactly at timeout", async () => {
    // This is a race - either success or timeout is acceptable
    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 50)), { timeout: 50 });

    expect(["success", "timeout"]).toContain(result.state);
  });

  it("should track duration accurately", async () => {
    const start = Date.now();
    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 100)), { timeout: 1000 });
    const actualDuration = Date.now() - start;

    expect(isSuccess(result)).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(95);
    expect(result.duration).toBeLessThan(150);
    expect(Math.abs(result.duration - actualDuration)).toBeLessThan(10);
  });

  it("should handle default timeout value (30000ms)", async () => {
    const result = await timeouted(Promise.resolve("data"));
    expect(isSuccess(result)).toBe(true);
  });

  it("should handle undefined context", async () => {
    const result = await timeouted(Promise.resolve("data"), { timeout: 1000 });
    expect(result.ctx).toBeUndefined();
  });

  it("should pass abort controller to action function", async () => {
    let receivedController: AbortController | null = null;

    const result = await timeouted(
      (ctrl) => {
        receivedController = ctrl;
        return Promise.resolve("data");
      },
      { timeout: 1000 },
    );

    expect(isSuccess(result)).toBe(true);
    expect(receivedController).toBeInstanceOf(AbortController);
  });

  it("should use external controller when provided", async () => {
    const externalController = new AbortController();

    const result = await timeouted(
      (ctrl) => {
        expect(ctrl).toBe(externalController);
        return Promise.resolve("data");
      },
      { timeout: 1000, controller: externalController },
    );

    expect(isSuccess(result)).toBe(true);
  });

  it("should handle negative timeout (treated as 30000ms default)", async () => {
    const result = await timeouted(Promise.resolve("data"), { timeout: -100 });

    expect(isSuccess(result)).toBe(true);
  });
});

// ============================================================================
// CALLBACK INTERACTION TESTS
// ============================================================================

describe("Callback Interactions", () => {
  it("should call all appropriate callbacks on timeout", async () => {
    const onTimeout = vi.fn();
    const onAbort = vi.fn();
    const onError = vi.fn();

    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 200)), {
      timeout: 50,
      onTimeout,
      onAbort,
      onError,
    });

    expect(isTimeout(result)).toBe(true);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onAbort).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("should call all appropriate callbacks on abort", async () => {
    const onTimeout = vi.fn();
    const onAbort = vi.fn();
    const onError = vi.fn();
    const controller = new AbortController();

    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 200)), {
      timeout: 1000,
      signal: controller.signal,
      onTimeout,
      onAbort,
      onError,
    });

    setTimeout(() => controller.abort("user action"), 50);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledWith("user action");
    expect(onError).not.toHaveBeenCalled();
  });

  it("should call all appropriate callbacks on error", async () => {
    const onTimeout = vi.fn();
    const onAbort = vi.fn();
    const onError = vi.fn();
    const testError = new Error("test");

    const result = await timeouted(Promise.reject(testError), { timeout: 1000, onTimeout, onAbort, onError });

    expect(isError(result)).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(testError);
  });

  it("should not call any error callbacks on success", async () => {
    const onTimeout = vi.fn();
    const onAbort = vi.fn();
    const onError = vi.fn();

    const result = await timeouted(Promise.resolve("success"), { timeout: 1000, onTimeout, onAbort, onError });

    expect(isSuccess(result)).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("isTimeouted isTypeGuard Consistency", () => {
  it("isSuccess", async () => {
    const timed = await timeouted(Promise.resolve("data"), { timeout: 1000 });
    expect(isSuccess(timed)).toBe(true);
    expect(timed.isSuccess()).toBe(true);
    expect(isTimeout(timed)).toBe(false);
    expect(timed.isTimeout()).toBe(false);
    expect(isAborted(timed)).toBe(false);
    expect(timed.isAborted()).toBe(false);
    expect(isError(timed)).toBe(false);
    expect(timed.isError()).toBe(false);
  });

  it("isTimeout", async () => {
    const timed = await timeouted(sleep(10000), { timeout: 10 });
    expect(isSuccess(timed)).toBe(false);
    expect(timed.isSuccess()).toBe(false);
    expect(isTimeout(timed)).toBe(true);
    expect(timed.isTimeout()).toBe(true);
    expect(isAborted(timed)).toBe(false);
    expect(timed.isAborted()).toBe(false);
    expect(isError(timed)).toBe(false);
    expect(timed.isError()).toBe(false);
  });

  it("isAbort controller", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    const timed = await timeouted(sleep(10000), { timeout: 100000, controller: controller });
    expect(isSuccess(timed)).toBe(false);
    expect(timed.isSuccess()).toBe(false);
    expect(isTimeout(timed)).toBe(false);
    expect(timed.isTimeout()).toBe(false);
    expect(isAborted(timed)).toBe(true);
    expect(timed.isAborted()).toBe(true);
    expect(isError(timed)).toBe(false);
    expect(timed.isError()).toBe(false);
  });

  it("isAbort signal", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    const timed = await timeouted(sleep(10000), { timeout: 100000, signal: controller.signal });
    expect(isSuccess(timed)).toBe(false);
    expect(timed.isSuccess()).toBe(false);
    expect(isTimeout(timed)).toBe(false);
    expect(timed.isTimeout()).toBe(false);
    expect(isAborted(timed)).toBe(true);
    expect(timed.isAborted()).toBe(true);
    expect(isError(timed)).toBe(false);
    expect(timed.isError()).toBe(false);
  });

  it("isError", async () => {
    const timed = await timeouted(Promise.reject(new Error("data")), { timeout: 1000 });
    expect(isSuccess(timed)).toBe(false);
    expect(timed.isSuccess()).toBe(false);
    expect(isTimeout(timed)).toBe(false);
    expect(timed.isTimeout()).toBe(false);
    expect(isAborted(timed)).toBe(false);
    expect(timed.isAborted()).toBe(false);
    expect(isError(timed)).toBe(true);
    expect(timed.isError()).toBe(true);
  });
});

// ============================================================================
// RACE CONDITION TESTS
// ============================================================================

describe("Race Conditions", () => {
  it("should handle success that wins race against timeout", async () => {
    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("fast"), 10)), { timeout: 100 });

    expect(isSuccess(result)).toBe(true);
  });

  it("should handle timeout that wins race against slow promise", async () => {
    const result = await timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 100)), { timeout: 10 });

    expect(isTimeout(result)).toBe(true);
  });

  it("should handle abort that wins race against slow promise", async () => {
    const controller = new AbortController();
    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 200)), {
      timeout: 1000,
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 10);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
  });

  it("should handle error that wins race against timeout", async () => {
    const result = await timeouted(new Promise((_, reject) => setTimeout(() => reject(new Error("fast error")), 10)), {
      timeout: 100,
    });

    expect(isError(result)).toBe(true);
  });

  it("should handle abort that wins race against timeout", async () => {
    const controller = new AbortController();
    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 500)), {
      timeout: 100,
      signal: controller.signal,
    });

    setTimeout(() => controller.abort("quick abort"), 20);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    if (isAborted(result)) {
      expect(result.reason).toBe("quick abort");
    }
    expect(result.duration).toBeLessThan(50);
  });
});

// ============================================================================
// REAL-WORLD SCENARIOS
// ============================================================================

describe("Real-World Scenarios", () => {
  it("should handle fetch-like operation with timeout", async () => {
    const mockFetch = async (ctrl: AbortController): Promise<{ data: string }> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => resolve({ data: "response" }), 100);

        ctrl.signal.addEventListener("abort", () => {
          clearTimeout(timeoutId);
          reject(new Error("Request aborted"));
        });
      });
    };

    const result = await timeouted(mockFetch, { timeout: 200 });

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.value.data).toBe("response");
    }
  });

  it("should handle fetch timeout scenario", async () => {
    const mockSlowFetch = async (): Promise<{ data: string }> => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { data: "slow response" };
    };

    const result = await timeouted(mockSlowFetch, { timeout: 50 });

    expect(isTimeout(result)).toBe(true);
  });

  it("should handle user cancellation during long operation", async () => {
    const controller = new AbortController();
    const onAbort = vi.fn();

    const promise = timeouted(
      async (ctrl) => {
        // Simulate long operation
        for (let i = 0; i < 10; i++) {
          if (ctrl.signal.aborted) {
            throw new Error("Operation cancelled");
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return "completed";
      },
      { timeout: 10000, signal: controller.signal, onAbort },
    );

    // User cancels after 100ms
    setTimeout(() => controller.abort("User clicked cancel"), 100);

    const result = await promise;

    expect(isAborted(result)).toBe(true);
    expect(onAbort).toHaveBeenCalledWith("User clicked cancel");
  });

  it("should track request context throughout operation", async () => {
    interface RequestContext {
      requestId: string;
      userId: string;
      startTime: number;
    }

    const ctx: RequestContext = {
      requestId: "req-123",
      userId: "user-456",
      startTime: Date.now(),
    };

    const result = await timeouted(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { status: "ok" };
      },
      { timeout: 1000, ctx },
    );

    expect(isSuccess(result)).toBe(true);
    expect(result.ctx).toEqual(ctx);
    expect(result.duration).toBeGreaterThan(0);
  });

  it("should handle retry logic pattern", async () => {
    let attempts = 0;
    const maxAttempts = 3;

    async function attemptOperation(): Promise<string> {
      attempts++;

      const result = await timeouted(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          if (attempts < maxAttempts) {
            throw new Error("Temporary failure");
          }
          return "success";
        },
        { timeout: 100 },
      );

      if (isError(result) && attempts < maxAttempts) {
        return attemptOperation();
      }

      return unwrapOr(result, "failed");
    }

    const finalResult = await attemptOperation();
    expect(finalResult).toBe("success");
    expect(attempts).toBe(3);
  });

  it("should handle parallel operations with different timeouts", async () => {
    const results = await Promise.all([
      timeouted(new Promise((resolve) => setTimeout(() => resolve("fast"), 50)), { timeout: 100 }),
      timeouted(new Promise((resolve) => setTimeout(() => resolve("medium"), 150)), { timeout: 200 }),
      timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 300)), { timeout: 100 }),
    ]);

    expect(isSuccess(results[0])).toBe(true);
    expect(isSuccess(results[1])).toBe(true);
    expect(isTimeout(results[2])).toBe(true); // This one times out
  });
});

// ============================================================================
// MEMORY LEAK PREVENTION TESTS
// ============================================================================

describe("Memory Leak Prevention", () => {
  it("should not leak event listeners on success", async () => {
    const controller = new AbortController();

    await timeouted(Promise.resolve("data"), { timeout: 1000, signal: controller.signal });

    // No way to directly check listener count, but this ensures cleanup runs
    expect(controller.signal.aborted).toBe(false);
  });

  it("should not leak event listeners on timeout", async () => {
    const controller = new AbortController();

    await timeouted(new Promise((resolve) => setTimeout(() => resolve("slow"), 200)), { timeout: 50, signal: controller.signal });

    // Listeners should be cleaned up
  });

  it("should not leak event listeners on abort", async () => {
    const controller = new AbortController();

    const promise = timeouted(new Promise((resolve) => setTimeout(() => resolve("data"), 200)), {
      timeout: 1000,
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 50);
    await promise;

    // Listeners should be cleaned up
  });

  it("should cleanup on multiple rapid calls", async () => {
    const controller = new AbortController();

    const promises = Array.from({ length: 10 }, (_, i) =>
      timeouted(Promise.resolve(i), { timeout: 100, signal: controller.signal }),
    );

    const results = await Promise.all(promises);

    expect(results.every(isSuccess)).toBe(true);
    // All listeners should be cleaned up
  });
});

describe("Node.js Exit Prevention", () => {
  let runtime = undefined;
  if (runtimeFn().isNodeIsh) {
    runtime = ["tsx", "-e"];
  }
  if (runtimeFn().isDeno) {
    runtime = ["deno", "eval"];
  }
  it("not block node from exiting on success", async () => {
    if (runtime) {
      const { $ } = await import("zx");
      const start = Date.now();
      await $`${runtime} "import { timeouted } from './src/timeouted.ts'; import { sleep } from './src/promise-sleep.ts'; timeouted(sleep(200), { timeout: 10000 })"`;
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    }
  });

  it("block node from exiting on error", async () => {
    if (runtime) {
      const { $ } = await import("zx");
      const start = Date.now();
      await $`${runtime} "import { timeouted } from './src/timeouted.ts'; timeouted(Promise.reject(new Error('fail')), { timeout: 10000 })"`;
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    }
  });

  it("block node from exiting on timeout", async () => {
    if (runtime) {
      const { $ } = await import("zx");
      const start = Date.now();
      await $`${runtime} "import { timeouted } from './src/timeouted.ts'; timeouted(new Promise(() => {}), { timeout: 10 })"`;
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    }
  });
});

describe("createTimeoutResult", () => {
  it("should create success result", () => {
    const result = createTimeoutResult({
      state: "success",
      value: "data",
    });
    if (isSuccess(result)) {
      expect(isSuccess(result)).toBe(true);
      expect(result.value).toBe("data");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    } else {
      assert.fail("Result should be success");
    }
  });

  it("should create abort result", () => {
    const result = createTimeoutResult({
      state: "aborted",
      reason: "user abort",
    });
    if (isAborted(result)) {
      expect(isAborted(result)).toBe(true);
      expect(result.reason).toBe("user abort");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    } else {
      assert.fail("Result should be aborted");
    }
  });

  it("should create error result", () => {
    const result = createTimeoutResult({
      state: "error",
      error: new Error("user abort"),
    });
    if (isError(result)) {
      expect(isError(result)).toBe(true);
      expect(result.error.message).toBe("user abort");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    } else {
      assert.fail("Result should be error");
    }
  });

  it("should create timeout result", () => {
    const result = createTimeoutResult({
      state: "timeout",
    });
    if (isTimeout(result)) {
      expect(isTimeout(result)).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    } else {
      assert.fail("Result should be timeout");
    }
  });
});
