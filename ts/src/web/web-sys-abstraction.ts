import { BaseSysAbstraction, WrapperSysAbstraction, WrapperSysAbstractionParams } from "../base-sys-abstraction.ts";
import { FileService, NamedWritableStream } from "../file-service.ts";
import { SysAbstraction, SystemService, VoidFunc } from "../sys-abstraction.ts";
import { Env, envFactory } from "../sys-env.ts";
import { Utf8EnDecoderSingleton } from "../txt-en-decoder.ts";

class WebFileService implements FileService {
  get baseDir(): string {
    throw new Error("basedir-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(fname: string): Promise<NamedWritableStream> {
    throw new Error("create-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  readFileString(fname: string): Promise<string> {
    throw new Error("readFileString-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  writeFileString(fname: string, content: string): Promise<void> {
    throw new Error("writeFileString-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  abs(fname: string): string {
    throw new Error("abs-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  join(...paths: string[]): string {
    throw new Error("join-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  relative(from: string, to?: string | undefined): string {
    throw new Error("relative-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dirname(fname: string): string {
    throw new Error("dirname-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  basename(fname: string): string {
    throw new Error("basename-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nodeImport(fname: string): string {
    throw new Error("nodeImport-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isAbsolute(fname: string): boolean {
    throw new Error("isAbsolute-Method not implemented.");
  }
}

class WebSystemService implements SystemService {
  Env(): Env {
    return envFactory();
  }
  Args(): string[] {
    throw new Error("Args-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  OnExit(hdl: VoidFunc): VoidFunc {
    throw new Error("OnExit-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Exit(code: number): void {
    throw new Error("Exit-Method not implemented.");
  }
}

let my: BaseSysAbstraction | undefined = undefined;
export function WebSysAbstraction(param?: WrapperSysAbstractionParams): SysAbstraction {
  if (!my) {
    my = new BaseSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || Utf8EnDecoderSingleton(),
      FileSystem: new WebFileService(),
      SystemService: new WebSystemService(),
    });
  }
  return new WrapperSysAbstraction(my, param);
}
