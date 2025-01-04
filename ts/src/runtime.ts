export interface Runtime {
  isNodeIsh: boolean;
  isBrowser: boolean;
  isDeno: boolean;
  isReactNative: boolean;
  isCFWorker: boolean;
}

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

// caches.default or WebSocketPair

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
