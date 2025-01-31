import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { FileService, NamedWritableStream } from "../file-service.js";
import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";

export class NodeFileService implements FileService {
  readonly baseDir: string;
  constructor(baseDir: string = process.cwd()) {
    this.baseDir = this.abs(baseDir);
  }

  // nodeImport(fname: string): string {
  //   // console.log('nodeImport:'+ fname);
  //   if (path.isAbsolute(fname)) {
  //     return fname;
  //   } else {
  //     return "./" + path.normalize(fname);
  //   }
  // }

  readFileString(fname: string): Promise<string> {
    return fs.promises.readFile(fname, { encoding: "utf-8" });
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
    if (path.isAbsolute(fname)) {
      return fname;
    } else {
      const cwd = process.cwd();
      return path.resolve(cwd, fname);
    }
  }

  isAbsolute(fname: string): boolean {
    return path.isAbsolute(fname);
  }

  async writeFileString(fname: string, content: string, ende: TxtEnDecoder = TxtEnDecoderSingleton()): Promise<void> {
    const o = await this.create(fname);
    const wr = o.stream.getWriter();
    await wr.write(ende.encode(content));
    await wr.close();
  }

  async create(fname: string): Promise<NamedWritableStream> {
    let oName = fname;
    if (!path.isAbsolute(fname)) {
      oName = this.abs(fname);
    }

    const base = path.dirname(oName);
    await fs.promises.mkdir(base, { recursive: true });
    const out = fs.createWriteStream(oName);
    return {
      name: oName,
      stream: new WritableStream<Uint8Array>({
        write(chunk): void {
          out.write(chunk);
        },
        close(): void {
          out.close();
        },
        abort(): void {
          throw new Error("not implemented");
        },
      }),
    };
  }
}
