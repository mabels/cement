export type StripCommand = string | RegExp;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripper<T>(strip: StripCommand | StripCommand[], obj: T): Record<string, any> {
  const strips = Array.isArray(strip) ? strip : [strip];
  const restrips = strips.map((s) => {
    if (typeof s === "string") {
      const escaped = s.replace(/[-\\[\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\^\\$\\|]/g, "\\$&");
      return new RegExp(`^${escaped}$`);
    }
    return s;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return localStripper(undefined, restrips, obj) as Record<string, any>;
}

function localStripper<T>(path: string | undefined, restrips: RegExp[], obj: T): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj;
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
          ret[key] = ret[key].reduce((acc, v, i) => {
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
