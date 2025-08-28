import { BaseBasicSysAbstraction, WrapperBasicSysAbstraction, WrapperBasicSysAbstractionParams } from "../base-sys-abstraction.js";
import { ResolveOnce } from "../resolve-once.js";
import { BasicRuntimeService, BasicSysAbstraction } from "../sys-abstraction.js";
import { Env, envFactory } from "../sys-env.js";
import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";
import { ConsoleWriterStream } from "../utils/console-write-stream.js";

// export class WebFileService implements FileService {
//   get baseDir(): string {
//     throw new Error("basedir-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   create(fname: string): Promise<NamedWritableStream> {
//     throw new Error("create-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   readFileString(fname: string): Promise<string> {
//     throw new Error("readFileString-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   writeFileString(fname: string, content: string): Promise<void> {
//     throw new Error("writeFileString-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   abs(fname: string): string {
//     throw new Error("abs-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   join(...paths: string[]): string {
//     throw new Error("join-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   relative(from: string, to?: string): string {
//     throw new Error("relative-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   dirname(fname: string): string {
//     throw new Error("dirname-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   basename(fname: string): string {
//     throw new Error("basename-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   nodeImport(fname: string): string {
//     throw new Error("nodeImport-Method not implemented.");
//   }
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   isAbsolute(fname: string): boolean {
//     throw new Error("isAbsolute-Method not implemented.");
//   }
// }

class WebSystemService implements BasicRuntimeService {
  readonly _txtEnDe: TxtEnDecoder;
  constructor(ende: TxtEnDecoder) {
    this._txtEnDe = ende;
  }
  Env(): Env {
    return envFactory();
  }
  Args(): string[] {
    throw new Error("Args-Method not implemented.");
  }
  Stdout(): WritableStream<Uint8Array> {
    return new ConsoleWriterStream();
    // const decoder = this._txtEnDe;
    // return new WritableStream({
    //   write(chunk): Promise<void> {
    //     return new Promise((resolve) => {
    //       const decoded = decoder.decode(chunk);
    //       // eslint-disable-next-line no-console
    //       console.log(decoded.trimEnd());
    //       resolve();
    //     });
    //   },
    // });
  }
  Stderr(): WritableStream<Uint8Array> {
    const decoder = this._txtEnDe;
    return new WritableStream({
      write(chunk): Promise<void> {
        return new Promise((resolve) => {
          const decoded = decoder.decode(chunk);
          // eslint-disable-next-line no-console
          console.error(decoded.trimEnd());
          resolve();
        });
      },
    });
  }
}

const baseSysAbstraction = new ResolveOnce<BaseBasicSysAbstraction>();
export function WebBasicSysAbstraction(param?: WrapperBasicSysAbstractionParams): BasicSysAbstraction {
  const my = baseSysAbstraction.once(() => {
    return new BaseBasicSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || TxtEnDecoderSingleton(),
    });
  });
  return new WrapperBasicSysAbstraction(my, {
    basicRuntimeService: new WebSystemService(param?.TxtEnDecoder ?? my._txtEnDe),
    ...param,
  });
}
