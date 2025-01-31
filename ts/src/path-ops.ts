export interface PathOps {
  join(...args: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
}

class pathOpsImpl implements PathOps {
  join(...paths: string[]): string {
    return paths.map((i) => i.replace(/\/+$/, "")).join("/");
  }
  #parts(path: string): { dirname: string; basename: string } {
    const splitted = path.split("/");
    const last = splitted.pop();
    if (splitted.length && last === "") {
      return this.#parts(this.join(...splitted));
    }
    return {
      dirname: this.join(...splitted),
      basename: last ?? "",
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
