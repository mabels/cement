export const PartType = {
  Slash: 0x1,
  Root: 0x3,
  Up: 0x4 /* /../ */,
  Noop: 0x8 /* ./ */,
  // RootUp = 0x8 /* ../ */,
};

export type PartType = (typeof PartType)[keyof typeof PartType];

export type PathItem = string | PartType;

export class Path {
  readonly parts: PathItem[];
  constructor(parts: PathItem[] = []) {
    this.parts = parts;
  }

  toString(): string {
    return this.parts
      .map((part) => {
        if (typeof part === "string") {
          return part;
        } else {
          switch (part) {
            case PartType.Slash:
            case PartType.Root:
              return "/";
            case PartType.Up:
              return "..";
            default:
              return part;
          }
        }
      })
      .join("");
  }

  add(part: PathItem): void {
    if (this.parts.includes(PartType.Root) && part === PartType.Root) {
      throw new Error("Cannot add absolute part to absolute path");
    }
    const last = this.parts[this.parts.length - 1] as PartType;
    if (last & PartType.Slash && part === PartType.Slash) {
      return;
    }
    switch (part) {
      case ".":
        this.parts.push(PartType.Noop);
        return;
      case "..":
        part = PartType.Up;
    }

    // if (part === PartType.Up && last === PartType.Slash) {
    //     this.parts[this.parts.length - 1] = PartType.Up
    //     return
    // }
    if (last === PartType.Noop && part === PartType.Slash) {
      if (last === PartType.Noop) {
        this.parts.pop();
      }
      return;
    }
    this.parts.push(part);
  }
}

export function splitPath(path: string): Path {
  const p = new Path();
  if (path === "") {
    return p;
  }
  for (let count = 0; path.length; count++) {
    // const ipath = path
    if (path.match(/^\/+/)) {
      if (count === 0) {
        p.add(PartType.Root);
      } else {
        p.add(PartType.Slash);
      }
      path = path.replace(/^\/+/, "");
    } else {
      const part = path.replace(/\/.*$/, "");
      p.add(part);
      path = path.replace(/^[^/]+/, "");
    }
  }
  return p;
}

export function pathJoin(...paths: string[]): string {
  let prev = "";
  const res: string[] = [];
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    if (path === "") {
      continue;
    }
    // i + 1 !== paths.length &&
    if (!(prev.endsWith("/") || path.startsWith("/"))) {
      if (prev !== "") {
        res.push("/");
      }
      res.push(path);
    } else {
      res.push(path);
    }
    prev = path;
  }
  return res.join("");
}

export function relativePath(path: string, relative: string): string {
  const relativeParts = splitPath(relative);
  let result: string;
  if (relativeParts.parts[0] === PartType.Root) {
    result = relative;
  } else {
    result = pathJoin(path, relative);
  }
  const unoptPath = splitPath(result);
  // console.log("What", result, unoptPath.parts)
  const out: PathItem[] = [];
  let topUp = false;
  for (const part of unoptPath.parts) {
    switch (part) {
      case PartType.Root:
        out.push(PartType.Root);
        break;
      case PartType.Up:
        if (out.length && !topUp) {
          const last = out.length - 1;
          if (typeof out[last] === "string" && (out[last - 1] as PartType) == PartType.Root) {
            out.pop();
          } else {
            out.pop();
            out.pop();
          }
          if (out.length === 0) {
            topUp = !topUp ? true : topUp;
            out.push(PartType.Up);
          }
        } else {
          out.push(PartType.Up);
        }
        break;
      case PartType.Slash:
        if (!((out[out.length - 1] as PartType) & PartType.Slash)) {
          out.push(PartType.Slash);
        }
        break;
      default:
        out.push(part);
        break;
    }
  }
  return new Path(out).toString();
  // return pathParts
  //     .filter((part, index) => part !== relativeParts[index])
  //     .join("")
}
