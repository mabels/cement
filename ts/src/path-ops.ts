export interface PathOps {
  join(...args: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
}

class pathOpsImpl implements PathOps {
  join(...paths: string[]): string {
    const parts = this.#parts(paths.filter((i) => i).join("/"));
    if (parts.dirname === "" || parts.dirname === ".") {
      return parts.basename ? parts.basename : ".";
    }
    return parts.dirname + "/" + parts.basename;
  }
  #parts(path: string): { dirname: string; basename: string } {
    // clean up path
    // remove double slashes
    // remove double dots ././
    // remove trailing slashes
    path = path
      .replace(/\/+/g, "/")
      .replace(/(\/\.\/)+/g, "/")
      .replace(/\/+$/, "");
    const splitted = path.split("/");
    if (splitted.length <= 1) {
      return {
        dirname: ".",
        basename: splitted[0] === "." ? "" : splitted[0],
      };
    }
    const basename = splitted.pop();
    if (!basename) {
      throw new Error("basename is undefined");
    }
    return {
      dirname: splitted.join("/").replace(/^\.\//, ""),
      basename,
    };
  }
  dirname(path: string): string {
    return this.#parts(path).dirname;
  }
  basename(path: string): string {
    return this.#parts(path).basename;
  }
}

export const pathOps: PathOps = new pathOpsImpl();
