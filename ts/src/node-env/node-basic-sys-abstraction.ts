import {
  BaseBasicRuntimeSysAbstractionParams,
  BaseBasicSysAbstraction,
  WrapperBasicSysAbstraction,
} from "../base-sys-abstraction.js";
import { BasicRuntimeService, BasicSysAbstraction } from "../sys-abstraction.js";
import { Env, envFactory, EnvFactory } from "../sys-env.js";
import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";

export class NodeRuntimeService implements BasicRuntimeService {
  readonly _txtEnDe: TxtEnDecoder;
  readonly _envFactory: EnvFactory;
  readonly _gthis: {
    process: {
      argv: string[];
      stdout: {
        write(chunk: Uint8Array): void;
      };
      stderr: {
        write(chunk: Uint8Array): void;
      };
    };
  };
  constructor(ende: TxtEnDecoder, envFactory: EnvFactory) {
    this._txtEnDe = ende;
    this._envFactory = envFactory;
    this._gthis = globalThis as unknown as NodeRuntimeService["_gthis"];
  }
  Env(): Env {
    return this._envFactory();
  }

  Args(): string[] {
    return this._gthis.process.argv;
  }

  Stdout(): WritableStream<Uint8Array> {
    return new WritableStream({
      write: (chunk: Uint8Array): void => {
        this._gthis.process.stdout.write(chunk);
      },
    });
  }
  Stderr(): WritableStream<Uint8Array> {
    return new WritableStream<Uint8Array>({
      write: (chunk: Uint8Array): void => {
        this._gthis.process.stderr.write(chunk);
      },
    });
  }
}

let baseSysAbstraction: BaseBasicSysAbstraction | undefined = undefined;

export function NodeBasicSysAbstraction(param: Partial<BaseBasicRuntimeSysAbstractionParams> = {}): BasicSysAbstraction {
  const ende = param.TxtEnDecoder ?? TxtEnDecoderSingleton();
  baseSysAbstraction =
    baseSysAbstraction ??
    new BaseBasicSysAbstraction({
      TxtEnDecoder: ende,
    });
  return new WrapperBasicSysAbstraction(baseSysAbstraction, {
    basicRuntimeService: new NodeRuntimeService(ende, envFactory),
    ...param,
  });
}
