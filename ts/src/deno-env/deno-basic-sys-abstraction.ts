/// <reference types="deno" />

import {
  BaseBasicRuntimeSysAbstractionParams,
  BaseBasicSysAbstraction,
  WrapperBasicSysAbstraction,
} from "../base-sys-abstraction.js";
import { BasicRuntimeService, BasicSysAbstraction } from "../sys-abstraction.js";
import { Env, envFactory, EnvFactory } from "../sys-env.js";
import { TxtEnDecoderSingleton } from "../txt-en-decoder.js";

export class DenoRuntimeService implements BasicRuntimeService {
  readonly _envFactory: EnvFactory;
  constructor(envFactory: EnvFactory) {
    this._envFactory = envFactory;
  }
  Env(): Env {
    return this._envFactory();
  }

  Args(): string[] {
    return Deno.args;
  }

  Stdout(): WritableStream<Uint8Array> {
    return Deno.stdout.writable;
  }
  Stderr(): WritableStream<Uint8Array> {
    return Deno.stderr.writable;
  }
}

let baseBasicSysAbstraction: BaseBasicSysAbstraction | undefined = undefined;
export function DenoBasicSysAbstraction(param: Partial<BaseBasicRuntimeSysAbstractionParams> = {}): BasicSysAbstraction {
  const ende = param.TxtEnDecoder ?? TxtEnDecoderSingleton();
  baseBasicSysAbstraction =
    baseBasicSysAbstraction ??
    new BaseBasicSysAbstraction({
      TxtEnDecoder: ende,
    });
  return new WrapperBasicSysAbstraction(baseBasicSysAbstraction, {
    basicRuntimeService: new DenoRuntimeService(envFactory),
    ...param,
  });
}
