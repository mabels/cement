import { BaseSysAbstraction, WrapperSysAbstraction, WrapperSysAbstractionParams } from "../base-sys-abstraction.js";
import { SysAbstraction, SystemService, VoidFunc } from "../sys-abstraction.js";
import { Env, envFactory } from "../sys-env.js";
import { TxtEnDecoderSingleton } from "../txt-en-decoder.js";
import { WebFileService } from "../web/web-sys-abstraction.js";

export class CFSystemService implements SystemService {
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
export function CFSysAbstraction(param?: WrapperSysAbstractionParams): SysAbstraction {
  if (!my) {
    my = new BaseSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || TxtEnDecoderSingleton(),
      FileSystem: new WebFileService(),
      SystemService: new CFSystemService(),
    });
  }
  return new WrapperSysAbstraction(my, param);
}
