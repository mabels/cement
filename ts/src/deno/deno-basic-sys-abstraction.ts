/// <reference types="deno" />

import type {
  BasicRuntimeService,
  Env,
  BasicSysAbstraction,
  EnvFactory,
  BaseBasicSysAbstraction,
  WithCementWrapperSysAbstractionParams,
} from "@adviser/cement";

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
export function DenoBasicSysAbstraction(param: WithCementWrapperSysAbstractionParams): BasicSysAbstraction {
  const ende = param.TxtEnDecoder ?? param.cement.TxtEnDecoderSingleton();
  baseBasicSysAbstraction =
    baseBasicSysAbstraction ??
    new param.cement.BaseBasicSysAbstraction({
      TxtEnDecoder: ende,
    });
  return new param.cement.WrapperBasicSysAbstraction(baseBasicSysAbstraction, {
    basicRuntimeService: new DenoRuntimeService(param?.cement.envFactory),
    ...param,
  });
}
