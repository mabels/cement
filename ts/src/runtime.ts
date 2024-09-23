export interface Runtime {
  isNodeIsh: boolean;
  isBrowser: boolean;
  isDeno: boolean;
  isReactNative: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSet(value: string, ref: any = globalThis): boolean {
  const [head, ...tail] = value.split(".");
  if (["object", "function"].includes(typeof ref) && ref && ["object", "function"].includes(typeof ref[head]) && ref[head]) {
    if (tail.length <= 1) {
      return true;
    }
    return isSet(tail.join("."), ref[head]);
  }
  return false;
}

export function runtimeFn(): Runtime {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gt: any = globalThis;
  const isReactNative =
    isSet("navigator.product") && typeof gt["navigator"] === "object" && gt["navigator"]["product"] === "ReactNative";
  const isNodeIsh = isSet("process.versions.node") && !isReactNative;
  const isDeno = isSet("Deno") && !isReactNative;
  return {
    isNodeIsh,
    isBrowser: !(isNodeIsh || isDeno) && !isReactNative,
    isDeno,
    isReactNative,
  };
}
