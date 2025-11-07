/**
 * Path component type constants for representing special path elements.
 *
 * Uses bit flags to identify different path components:
 * - Slash: Path separator (/)
 * - Root: Absolute path root (/)
 * - Up: Parent directory (..)
 * - Noop: Current directory (.)
 */
export const PartType = {
  Slash: 0x1,
  Root: 0x3,
  Up: 0x4 /* /../ */,
  Noop: 0x8 /* ./ */,
  // RootUp = 0x8 /* ../ */,
};

export type PartType = (typeof PartType)[keyof typeof PartType];

export type PathItem = string | PartType;

/**
 * Path builder for constructing and manipulating filesystem paths.
 *
 * Represents a path as an array of parts (strings and special PartType tokens).
 * Provides methods for adding path components and converting to string representation.
 */
export class Path {
  readonly parts: PathItem[];
  constructor(parts: PathItem[] = []) {
    this.parts = parts;
  }

  /**
   * Converts the path parts to a string representation.
   *
   * @returns Path as a string with proper separators
   *
   * @example
   * ```typescript
   * const path = new Path([PartType.Root, 'home', PartType.Slash, 'user']);
   * path.toString(); // '/home/user'
   * ```
   */
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

  /**
   * Adds a path component to the path.
   *
   * Handles special cases like duplicate slashes, "." and ".." segments.
   *
   * @param part - Path component to add (string or PartType)
   * @throws Error if adding absolute part to absolute path
   *
   * @example
   * ```typescript
   * const path = new Path();
   * path.add(PartType.Root);
   * path.add('home');
   * path.add(PartType.Slash);
   * path.add('..');
   * ```
   */
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

/**
 * Parses a path string into a Path object with structured parts.
 *
 * Splits the path into components, identifying root, slashes, and segments.
 * Consecutive slashes are collapsed into single separators.
 *
 * @param path - Path string to parse
 * @returns Path object with structured components
 *
 * @example
 * ```typescript
 * const path = splitPath('/home/user/docs');
 * // Path with parts: [Root, 'home', Slash, 'user', Slash, 'docs']
 *
 * const relative = splitPath('../config/app.json');
 * // Path with parts: [Up, Slash, 'config', Slash, 'app.json']
 * ```
 */
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

/**
 * Joins multiple path segments into a single path string.
 *
 * Intelligently handles slashes between segments, avoiding duplicates while
 * ensuring proper separation. Empty segments are skipped.
 *
 * @param paths - Path segments to join
 * @returns Joined path string
 *
 * @example
 * ```typescript
 * pathJoin('/home', 'user', 'docs');
 * // '/home/user/docs'
 *
 * pathJoin('/api/', '/users/', 'profile');
 * // '/api//users/profile'
 *
 * pathJoin('src', 'utils', 'path.ts');
 * // 'src/utils/path.ts'
 * ```
 */
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

/**
 * Resolves a relative path against a base path and normalizes the result.
 *
 * If the relative path is absolute, returns it directly. Otherwise, joins
 * the base and relative paths, then normalizes by resolving ".." (parent)
 * and "." (current) directory references.
 *
 * @param path - Base path to resolve against
 * @param relative - Relative path to resolve (or absolute path)
 * @returns Normalized resolved path
 *
 * @example
 * ```typescript
 * relativePath('/home/user', 'docs/file.txt');
 * // '/home/user/docs/file.txt'
 *
 * relativePath('/home/user/project', '../config.json');
 * // '/home/user/config.json'
 *
 * relativePath('/home/user', '/etc/hosts');
 * // '/etc/hosts' (absolute path takes precedence)
 *
 * relativePath('/a/b/c', '../../d');
 * // '/a/d'
 * ```
 */
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
