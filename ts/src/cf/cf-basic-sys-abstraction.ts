import type {
  BaseBasicSysAbstraction,
  BasicRuntimeService,
  BasicSysAbstraction,
  Env,
  EnvFactory,
  TxtEnDecoder,
  WithCementWrapperSysAbstractionParams,
} from "@adviser/cement";

export class CFRuntimeService implements BasicRuntimeService {
  readonly _txtEnDe: TxtEnDecoder;
  readonly _envFactory: EnvFactory;
  constructor(ende: TxtEnDecoder, envFactory: EnvFactory) {
    this._txtEnDe = ende;
    this._envFactory = envFactory;
  }
  Env(): Env {
    return this._envFactory();
  }
  Args(): string[] {
    throw new Error("Args-Method not implemented.");
  }

  Stdout(): WritableStream<Uint8Array> {
    return CFWriteableStream((chunk) => {
      const decoded = this._txtEnDe.decode(chunk);
      // eslint-disable-next-line no-console
      console.log(decoded.trimEnd());
      return Promise.resolve();
    });
  }
  Stderr(): WritableStream<Uint8Array> {
    return CFWriteableStream((chunk) => {
      const decoded = this._txtEnDe.decode(chunk);
      // eslint-disable-next-line no-console
      console.error(decoded.trimEnd());
      return Promise.resolve();
    });
  }
}

function consumeReadableStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writeFn: (chunk: Uint8Array) => Promise<void>,
): void {
  reader
    .read()
    .then(({ done, value }) => {
      if (done) {
        return;
      }
      writeFn(value)
        .then(() => {
          consumeReadableStream(reader, writeFn);
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error("consumeReadableStream:writeFn", e);
        });
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("consumeReadableStream:read", e);
    });
}

function CFWriteableStream(writeFn: (chunk: Uint8Array) => Promise<void>): WritableStream<Uint8Array> {
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  consumeReadableStream(ts.readable.getReader(), writeFn);
  return ts.writable;
}

let baseSysAbstraction: BaseBasicSysAbstraction | undefined = undefined;
export function CFBasicSysAbstraction(param: WithCementWrapperSysAbstractionParams): BasicSysAbstraction {
  const ende = param?.TxtEnDecoder || param.cement.TxtEnDecoderSingleton();
  baseSysAbstraction =
    baseSysAbstraction ??
    new param.cement.BaseBasicSysAbstraction({
      TxtEnDecoder: ende,
    });
  return new param.cement.WrapperBasicSysAbstraction(baseSysAbstraction, {
    basicRuntimeService: new CFRuntimeService(ende, param.cement.envFactory),
    ...param,
  });
}
