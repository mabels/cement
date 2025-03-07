import { BaseBasicSysAbstraction, WrapperBasicSysAbstraction, WrapperBasicSysAbstractionParams } from "../base-sys-abstraction.js";
import { ResolveOnce } from "../resolve-once.js";
import { BasicRuntimeService, BasicSysAbstraction } from "../sys-abstraction.js";
import { Env, envFactory } from "../sys-env.js";
import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";

export class NodeRuntimeService implements BasicRuntimeService {
  readonly _txtEnDe: TxtEnDecoder;
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
  constructor(ende: TxtEnDecoder) {
    this._txtEnDe = ende;
    this._gthis = globalThis as unknown as NodeRuntimeService["_gthis"];
  }
  Env(): Env {
    return envFactory();
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

const baseSysAbstraction = new ResolveOnce<BaseBasicSysAbstraction>();
export function NodeBasicSysAbstraction(param?: WrapperBasicSysAbstractionParams): BasicSysAbstraction {
  const my = baseSysAbstraction.once(() => {
    return new BaseBasicSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || TxtEnDecoderSingleton(),
    });
  });
  return new WrapperBasicSysAbstraction(my, {
    basicRuntimeService: new NodeRuntimeService(param?.TxtEnDecoder ?? my._txtEnDe),
    ...param,
  });
}
