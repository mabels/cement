import path from "node:path";
import fs from "node:fs/promises";
import { FileService, NamedWritableStream } from "./file_service";

export interface FileCollector {
  readonly name: string;
  content: string;
}

export class MockFileService implements FileService {
  readonly baseDir: string;
  constructor(baseDir: string = process.cwd()) {
    this.baseDir = this.abs(baseDir);
  }

  nodeImport(fname: string): string {
    // console.log('nodeImport:'+ fname);
    if (path.isAbsolute(fname)) {
      return fname;
    } else {
      return "./" + path.normalize(fname);
    }
  }

  readFileString(fname: string): Promise<string> {
    return fs.readFile(fname, { encoding: "utf-8" });
  }

  dirname(fname: string): string {
    return path.dirname(fname);
  }

  basename(fname: string): string {
    return path.basename(fname);
  }

  join(...paths: string[]): string {
    return path.join(...paths);
  }

  relative(from: string, to?: string): string {
    if (to === undefined) {
      to = from;
      from = process.cwd();
    }
    const ret = path.relative(from, to);
    // console.log('relative:'+ from + " -> " + to +   "= " + ret);
    return ret;
  }

  abs(fname: string): string {
    if (this.isAbsolute(fname)) {
      return fname;
    } else {
      const cwd = process.cwd();
      return path.resolve(cwd, fname);
    }
  }

  isAbsolute(fname: string): boolean {
    return path.isAbsolute(fname);
  }

  readonly files = {} as Record<string, FileCollector>;

  async create(fname: string): Promise<NamedWritableStream> {
    let oName = fname;
    if (!path.isAbsolute(fname)) {
      oName = this.abs(fname);
    }

    const fc = {
      name: oName,
      content: "",
    };
    this.files[oName] = fc;
    const decoder = new TextDecoder();

    return {
      name: oName,
      stream: new WritableStream<Uint8Array>({
        write(chunk) {
          fc.content = fc.content + decoder.decode(chunk);
        },
        close() {},
        abort() {
          throw new Error("not implemented");
        },
      }),
    };
  }
}
