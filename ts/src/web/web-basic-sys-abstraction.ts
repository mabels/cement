import type {
  WithCementWrapperSysAbstractionParams,
  BasicRuntimeService,
  BaseBasicSysAbstraction,
  TxtEnDecoder,
  EnvFactory,
  Env,
  BasicSysAbstraction,
} from "@adviser/cement";

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
export function WebBasicSysAbstraction(param: WithCementWrapperSysAbstractionParams): BasicSysAbstraction {
  const ende = param.TxtEnDecoder ?? param.cement.TxtEnDecoderSingleton();
  baseBasicSysAbstraction =
    baseBasicSysAbstraction ??
    new param.cement.BaseBasicSysAbstraction({
      TxtEnDecoder: ende,
    });
  return new param.cement.WrapperBasicSysAbstraction(baseBasicSysAbstraction, {
    basicRuntimeService: new WebSystemService(ende, param.cement.envFactory, () => new param.cement.ConsoleWriterStream()),
    ...param,
  });
}
