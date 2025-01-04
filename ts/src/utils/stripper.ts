export type StripCommand = string | RegExp;

export function stripper<T extends ArrayLike<S> | S, S>(
  strip: StripCommand | StripCommand[],
  obj: T,
): T extends ArrayLike<unknown> ? Record<string, unknown>[] : Record<string, unknown> {
  const strips = Array.isArray(strip) ? strip : [strip];
  const restrips = strips.map((s) => {
    if (typeof s === "string") {
      const escaped = s.replace(/[-\\[\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\^\\$\\|]/g, "\\$&");
      return new RegExp(`^${escaped}$`);
    }
    return s;
  });
  return localStripper(undefined, restrips, obj) as T extends ArrayLike<unknown>
    ? Record<string, unknown>[]
    : Record<string, unknown>;
}

function localStripper<T>(path: string | undefined, restrips: RegExp[], obj: T): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((i) => localStripper(path, restrips, i));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ret = { ...obj } as Record<string, any>;
  const matcher = (key: string, nextPath: string): boolean => {
    for (const re of restrips) {
      if (re.test(key) || re.test(nextPath)) {
        return true;
      }
    }
    return false;
  };
  for (const key in ret) {
    if (Object.prototype.hasOwnProperty.call(ret, key)) {
      let nextPath: string;
      if (path) {
        nextPath = [path, key].join(".");
      } else {
        nextPath = key;
      }
      if (matcher(key, nextPath)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete ret[key];
        continue;
      }
      if (typeof ret[key] === "object") {
        if (Array.isArray(ret[key])) {
          ret[key] = ret[key].reduce((acc: unknown[], v, i) => {
            const toDelete = matcher(key, `${nextPath}[${i}]`);
            if (!toDelete) {
              acc.push(localStripper(`${nextPath}[${i}]`, restrips, v));
            }
            return acc;
          }, []);
        } else {
          ret[key] = localStripper(nextPath, restrips, ret[key]);
        }
      }
    }
  }
  return ret;
}
