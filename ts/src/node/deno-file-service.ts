import { FileService, NamedWritableStream } from "../file-service.js";
import { TxtEnDecoder, Utf8EnDecoderSingleton } from "../txt-en-decoder.js";
import * as path from "node:path";

const Deno = (globalThis as unknown as { Deno: unknown }).Deno as {
  cwd(): string;
  readFile(fname: string): Promise<Uint8Array>;
  mkdir(base: string, options: { recursive: boolean }): Promise<void>;
  open(fname: string, options: { write: boolean; create: boolean; truncate: boolean }): Promise<WritableStream>;
};

export class DenoFileService implements FileService {
  readonly baseDir: string;
  readonly txtEnde: TxtEnDecoder;
  constructor(baseDir: string = Deno.cwd(), txtEnde: TxtEnDecoder = Utf8EnDecoderSingleton()) {
    this.baseDir = this.abs(baseDir);
    this.txtEnde = txtEnde;
  }

  // nodeImport(fname: string): string {
  //   // console.log('nodeImport:'+ fname);
  //   if (path.isAbsolute(fname)) {
  //     return fname;
  //   } else {
  //     return "./" + path.normalize(fname);
  //   }
  // }

  async readFileString(fname: string): Promise<string> {
    return this.txtEnde.decode(await Deno.readFile(fname));
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
      from = Deno.cwd();
    }
    const ret = path.relative(from, to);
    // console.log('relative:'+ from + " -> " + to +   "= " + ret);
    return ret;
  }

  abs(fname: string): string {
    if (path.isAbsolute(fname)) {
      return fname;
    } else {
      const cwd = Deno.cwd();
      return path.resolve(cwd, fname);
    }
  }

  isAbsolute(fname: string): boolean {
    return path.isAbsolute(fname);
  }

  async writeFileString(fname: string, content: string, ende = Utf8EnDecoderSingleton()): Promise<void> {
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
    await Deno.mkdir(base, { recursive: true });
    const out = await Deno.open(oName, {
      write: true,
      create: true,
      truncate: true,
    });
    return {
      name: oName,
      stream: out,
    };
  }
}
