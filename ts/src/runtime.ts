/**
 * Runtime environment detection result.
 *
 * Provides boolean flags indicating which JavaScript runtime environment
 * the code is currently executing in. Only one flag should be true at a time,
 * allowing for runtime-specific behavior and feature detection.
 *
 * @example
 * ```typescript
 * const runtime = runtimeFn();
 * if (runtime.isNodeIsh) {
 *   console.log('Running in Node.js or Bun');
 * } else if (runtime.isBrowser) {
 *   console.log('Running in a browser');
 * }
 * ```
 */
export interface Runtime {
  /** True if running in Node.js or Node-compatible runtime (e.g., Bun) */
  isNodeIsh: boolean;
  /** True if running in a web browser */
  isBrowser: boolean;
  /** True if running in Deno */
  isDeno: boolean;
  /** True if running in React Native */
  isReactNative: boolean;
  /** True if running in Cloudflare Workers */
  isCFWorker: boolean;
}

/**
 * Checks if a nested property path exists on an object.
 *
 * Recursively traverses dot-separated property paths to determine if they exist
 * and are truthy. Used internally for runtime environment detection by checking
 * for environment-specific global objects.
 *
 * @param value - Dot-separated property path to check (e.g., "process.versions.node")
 * @param ref - Object to check properties on (defaults to globalThis)
 * @returns True if the full path exists and all values are truthy
 *
 * @example
 * ```typescript
 * isSet("process.versions.node"); // true in Node.js
 * isSet("Deno"); // true in Deno
 * isSet("navigator.userAgent"); // true in browsers
 * ```
 */
function isSet(value: string, ref: Record<string, unknown> = globalThis): boolean {
  const [head, ...tail] = value.split(".");
  if (["object", "function"].includes(typeof ref) && ref && ["object", "function"].includes(typeof ref[head]) && ref[head]) {
    if (tail.length <= 1) {
      return true;
    }
    return isSet(tail.join("."), ref[head] as Record<string, unknown>);
  }
  return false;
}

/**
 * Detects the current JavaScript runtime environment.
 *
 * Performs feature detection to identify which runtime environment the code
 * is executing in. Checks for environment-specific global objects and APIs
 * in priority order:
 * 1. Cloudflare Workers (caches.default + WebSocketPair)
 * 2. React Native (navigator.product === "ReactNative")
 * 3. Deno (global Deno object)
 * 4. Node.js (process.versions.node)
 * 5. Browser (none of the above)
 *
 * The detection is mutually exclusive - only one environment flag will be true.
 *
 * @returns Runtime object with boolean flags for each environment
 *
 * @example
 * ```typescript
 * const runtime = runtimeFn();
 *
 * if (runtime.isNodeIsh) {
 *   // Use Node.js APIs
 *   const fs = require('fs');
 * } else if (runtime.isBrowser) {
 *   // Use browser APIs
 *   console.log(window.location.href);
 * } else if (runtime.isDeno) {
 *   // Use Deno APIs
 *   const file = await Deno.readTextFile('./config.json');
 * } else if (runtime.isCFWorker) {
 *   // Use Cloudflare Workers APIs
 *   const cache = caches.default;
 * }
 * ```
 */
export function runtimeFn(): Runtime {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gt: any = globalThis;
  let isReactNative =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    isSet("navigator.product") && typeof gt["navigator"] === "object" && gt["navigator"]["product"] === "ReactNative";
  let isNodeIsh = false;
  if (!isSet("Deno")) {
    isNodeIsh = isSet("process.versions.node") && !isReactNative;
  }
  let isDeno = isSet("Deno");
  const isCFWorker = isSet("caches.default") && isSet("WebSocketPair");
  if (isCFWorker) {
    isDeno = false;
    isNodeIsh = false;
    isReactNative = false;
  }
  return {
    isNodeIsh,
    isBrowser: !(isNodeIsh || isDeno || isCFWorker || isReactNative),
    isDeno,
    isReactNative,
    isCFWorker,
  };
}
