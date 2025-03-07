import { BaseBasicSysAbstraction, WrapperBasicSysAbstraction, WrapperBasicSysAbstractionParams } from "../base-sys-abstraction.js";
import { ResolveOnce } from "../resolve-once.js";
import { BasicRuntimeService, BasicSysAbstraction } from "../sys-abstraction.js";
import { Env, envFactory } from "../sys-env.js";
import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";

export class DenoRuntimeService implements BasicRuntimeService {
  readonly _txtEnDe: TxtEnDecoder;
  constructor(ende: TxtEnDecoder) {
    this._txtEnDe = ende;
  }
  Env(): Env {
    return envFactory();
  }

  Args(): string[] {
    return globalThis.Deno.args;
  }

  Stdout(): WritableStream<Uint8Array> {
    return globalThis.Deno.stdout.writable;
  }
  Stderr(): WritableStream<Uint8Array> {
    return globalThis.Deno.stderr.writable;
  }
}

const baseSysAbstraction = new ResolveOnce<BaseBasicSysAbstraction>();
export function DenoBasicSysAbstraction(param?: WrapperBasicSysAbstractionParams): BasicSysAbstraction {
  const my = baseSysAbstraction.once(() => {
    return new BaseBasicSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || TxtEnDecoderSingleton(),
    });
  });
  return new WrapperBasicSysAbstraction(my, {
    basicRuntimeService: new DenoRuntimeService(param?.TxtEnDecoder ?? my._txtEnDe),
    ...param,
  });
}
