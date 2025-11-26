import {
  BaseBasicRuntimeSysAbstractionParams,
  BaseBasicSysAbstraction,
  WrapperBasicSysAbstraction,
} from "../base-sys-abstraction.js";
import { BasicRuntimeService, BasicSysAbstraction } from "../sys-abstraction.js";
import { Env, envFactory, EnvFactory } from "../sys-env.js";
import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";
import { ConsoleWriterStream } from "../utils/console-write-stream.js";

class WebSystemService implements BasicRuntimeService {
  readonly _txtEnDe: TxtEnDecoder;
  readonly _envFactory: EnvFactory;
  readonly _stdoutFactory: () => WritableStream<Uint8Array>;
  constructor(ende: TxtEnDecoder, envFactory: EnvFactory, stdoutFactory: () => WritableStream<Uint8Array>) {
    this._txtEnDe = ende;
    this._envFactory = envFactory;
    this._stdoutFactory = stdoutFactory;
  }
  Env(): Env {
    return this._envFactory();
  }
  Args(): string[] {
    throw new Error("Args-Method not implemented.");
  }
  Stdout(): WritableStream<Uint8Array> {
    return this._stdoutFactory();
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

let baseBasicSysAbstraction: BaseBasicSysAbstraction | undefined = undefined;
export function WebBasicSysAbstraction(param: Partial<BaseBasicRuntimeSysAbstractionParams>): BasicSysAbstraction {
  const ende = param.TxtEnDecoder ?? TxtEnDecoderSingleton();
  baseBasicSysAbstraction =
    baseBasicSysAbstraction ??
    new BaseBasicSysAbstraction({
      TxtEnDecoder: ende,
    });
  return new WrapperBasicSysAbstraction(baseBasicSysAbstraction, {
    basicRuntimeService: new WebSystemService(ende, envFactory, () => new ConsoleWriterStream()),
    ...param,
  });
}
