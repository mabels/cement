// import { v4 } from "uuid";
import YAML from "yaml";
import {
  AsError,
  FnSerialized,
  LogSerializable,
  Level,
  Logger,
  logValue,
  Serialized,
  WithLogger,
  removeSelfRef,
  Sized,
  Lengthed,
  LogValue,
  asyncLogValue,
  LevelHandler,
  LogFormatter,
  LogValueArg,
} from "./logger.js";
import { WebSysAbstraction } from "./web/web-sys-abstraction.js";
import { SysAbstraction } from "./sys-abstraction.js";
import { Result } from "./result.js";
import { CoerceURI, URI } from "./uri.js";
import { runtimeFn } from "./runtime.js";
import { ConsoleWriterStream } from "./utils/console-write-stream.js";
import { LogWriterStream } from "./log-writer-impl.js";
import { TxtEnDecoder, Utf8EnDecoderSingleton } from "./txt-en-decoder.js";
import { LevelHandlerSingleton } from "./log-level-impl.js";

function getLen(value: unknown): LogValue {
  if (Array.isArray(value)) {
    return logValue(() => value.length);
  } else if (typeof value === "string") {
    return logValue(() => value.length);
  } else if (typeof value === "object" && value !== null) {
    if (typeof (value as Sized).size === "number") {
      return logValue(() => (value as Sized).size);
    } else if (typeof (value as Lengthed).length === "number") {
      return logValue(() => (value as Lengthed).length);
    }
    return logValue(() => Object.keys(value).length);
  }
  return logValue(() => -1);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hash(value: unknown): string {
  // const hasher = createHash("sha256");
  // hasher.update(JSON.stringify(value, removeSelfRef()));
  // return hasher.digest("hex");
  return "not implemented";
}

function toLogValue(lop: LogValue | Promise<LogValue>): LogValue | undefined {
  if (lop && typeof (lop as Promise<LogValue>).then === "function") {
    throw new Error("async logValue Not implemented");
  }
  return lop as LogValue;
}

export class JSONFormatter implements LogFormatter {
  private readonly _txtEnDe: TxtEnDecoder;
  private readonly _space?: number;
  constructor(txtEnde: TxtEnDecoder, space?: number) {
    this._txtEnDe = txtEnde;
    this._space = space;
  }
  format(attr: LogSerializable): Uint8Array {
    return this._txtEnDe.encode(JSON.stringify(attr, removeSelfRef(), this._space) + "\n");
  }
}

export class YAMLFormatter implements LogFormatter {
  private readonly _txtEnDe: TxtEnDecoder;
  private readonly _space?: number;
  constructor(txtEnde: TxtEnDecoder, space?: number) {
    this._txtEnDe = txtEnde;
    this._space = space;
  }
  format(attr: LogSerializable): Uint8Array {
    return this._txtEnDe.encode("---\n" + YAML.stringify(attr, removeSelfRef(), this._space) + "\n");
  }
}

export interface LoggerImplParams {
  readonly out?: WritableStream<Uint8Array>;
  readonly logWriter?: LogWriterStream;
  readonly sys?: SysAbstraction;
  readonly withAttributes?: LogSerializable;
  readonly levelHandler?: LevelHandler;
  readonly txtEnDe?: TxtEnDecoder;
  readonly formatter?: LogFormatter;
}

export class LoggerImpl implements Logger {
  readonly _sys: SysAbstraction;
  readonly _attributes: LogSerializable = {};
  readonly _withAttributes: LogSerializable;
  readonly _logWriter: LogWriterStream;
  readonly _levelHandler: LevelHandler;
  readonly _txtEnDe: TxtEnDecoder;
  _formatter: LogFormatter;
  // readonly _id: string = "logger-" + Math.random().toString(36)

  constructor(params?: LoggerImplParams) {
    if (!params) {
      params = {};
    }
    if (!params.sys) {
      this._sys = WebSysAbstraction();
    } else {
      this._sys = params.sys;
    }
    if (!params.txtEnDe) {
      this._txtEnDe = Utf8EnDecoderSingleton();
    } else {
      this._txtEnDe = params.txtEnDe;
    }
    if (!params.formatter) {
      this._formatter = new JSONFormatter(this._txtEnDe);
    } else {
      this._formatter = params.formatter;
    }

    if (params.logWriter) {
      this._logWriter = params.logWriter;
    } else {
      if (!params.out) {
        const rt = runtimeFn();
        let stream: WritableStream<Uint8Array>;
        if (rt.isBrowser) {
          stream = new ConsoleWriterStream();
        } else {
          if (rt.isNodeIsh || rt.isReactNative || rt.isDeno) {
            stream = this._sys.Stdout();
          } else {
            throw new Error("No output defined for runtime");
          }
        }
        this._logWriter = new LogWriterStream(stream);
      } else {
        this._logWriter = new LogWriterStream(params.out);
      }
    }
    if (!params.withAttributes) {
      this._withAttributes = {};
    } else {
      this._withAttributes = { ...params.withAttributes };
    }
    this._attributes = { ...this._withAttributes };
    if (params.levelHandler) {
      this._levelHandler = params.levelHandler;
    } else {
      this._levelHandler = LevelHandlerSingleton();
    }
    // console.log("LoggerImpl", this._id, this._attributes, this._withAttributes)
  }

  TxtEnDe(): TxtEnDecoder {
    return this._txtEnDe;
  }

  Attributes(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this._attributes, removeSelfRef()));
    // return Array.from(Object.entries(this._attributes)).reduce(
    //   (acc, [key, value]) => {
    //     if (value instanceof LogValue) {
    //       acc[key] = value.value();
    //     }
    //     return acc;
    //   },
    //   {} as Record<string, unknown>,
    // );
  }

  SetExposeStack(enable?: boolean): Logger {
    this._levelHandler.setExposeStack(enable);
    return this;
  }

  EnableLevel(level: Level, ...modules: string[]): Logger {
    this._levelHandler.enableLevel(level, ...modules);
    return this;
  }
  DisableLevel(level: Level, ...modules: string[]): Logger {
    this._levelHandler.disableLevel(level, ...modules);
    return this;
  }

  Module(key: string): Logger {
    this._attributes["module"] = logValue(key);
    this._withAttributes["module"] = logValue(key);
    return this;
  }
  // if the string is "*" it will enable for all modules
  SetDebug(...modules: (string | string[])[]): Logger {
    this._levelHandler.setDebug(...modules);
    return this;
  }

  SetFormatter(formatter: LogFormatter): Logger {
    this._formatter = formatter;
    return this;
  }

  Timestamp(): Logger {
    this._attributes["ts"] = logValue(() => this._sys.Time().Now().toISOString());
    return this;
  }
  Warn(): Logger {
    this._attributes["level"] = logValue(Level.WARN);
    return this;
  }
  Log(): Logger {
    return this;
  }
  Debug(): Logger {
    this._attributes["level"] = logValue(Level.DEBUG);
    return this;
  }
  Error(): Logger {
    this._attributes["level"] = logValue(Level.ERROR);
    return this;
  }
  Info(): Logger {
    this._attributes["level"] = logValue(Level.INFO);
    return this;
  }
  Err(err: unknown | Result<unknown> | Error): Logger {
    if (Result.Is(err)) {
      if (err.isOk()) {
        this.Result("noerror", err);
      } else {
        this.Result("error", err);
      }
    } else if (err instanceof Error) {
      this._attributes["error"] = logValue(err.message);
      if (this._levelHandler.isStackExposed) {
        this._attributes["stack"] = logValue(err.stack?.split("\n").map((s) => s.trim()));
      }
    } else {
      this._attributes["error"] = logValue("" + err);
    }
    return this;
  }
  WithLevel(l: Level): Logger {
    this._attributes["level"] = logValue(l);
    return this;
  }

  Ref(key: string, action: { toString: () => string } | FnSerialized): Logger {
    if (typeof action === "function") {
      this._attributes[key] = logValue(action as FnSerialized);
    } else if (typeof action.toString === "function") {
      this._attributes[key] = logValue(() => action.toString());
    } else {
      this._attributes[key] = logValue("INVALID REF");
    }
    return this;
  }
  Bool(key: string, value: unknown): Logger {
    this._attributes[key] = logValue(!!value);
    return this;
  }
  Result<T>(key: string, res: Result<T, Error>): Logger {
    if (res.isOk()) {
      this._attributes[key] = logValue(res.Ok() as Serialized);
    } else {
      this.Err(res.Err());
    }
    return this;
  }

  Len(value: unknown, key = "len"): Logger {
    this._attributes[key] = getLen(value);
    return this;
  }

  Hash(value: unknown, key = "hash"): Logger {
    this._attributes[key] = asyncLogValue(async () => `${getLen(value).value()}:${await hash(value)}`);
    return this;
  }

  Url(url: CoerceURI, key = "url"): Logger {
    this.Ref(key, () => URI.from(url).toString());
    return this;
  }

  Str(key: string, value?: string): Logger {
    this._attributes[key] = logValue(value);
    return this;
  }

  Any(key: string, value?: string | number | boolean | LogSerializable): Logger {
    this._attributes[key] = logValue(value as LogValueArg);
    return this;
  }
  Dur(key: string, nsec: number): Logger {
    this._attributes[key] = logValue(`${nsec}ms`);
    // new Intl.DurationFormat("en", { style: "narrow" }).format(nsec);
    return this;
  }
  Uint64(key: string, value: number): Logger {
    this._attributes[key] = logValue(value);
    return this;
  }
  Int(key: string, value: number): Logger {
    return this.Uint64(key, value);
  }

  async Flush(): Promise<void> {
    return new Promise((resolve) => {
      this._logWriter._flush(undefined, resolve);
    });
  }

  With(): WithLogger {
    // console.log("WithLoggerBuilder.With", this._id, this._attributes, this._withAttributes);
    return new WithLoggerBuilder(
      new LoggerImpl({
        logWriter: this._logWriter,
        sys: this._sys,
        levelHandler: this._levelHandler,
        formatter: this._formatter,
        withAttributes: {
          module: this._attributes["module"],
          ...this._withAttributes,
        },
      }),
    );
  }

  _resetAttributes(fn: () => () => Uint8Array): () => Uint8Array {
    const ret = fn();
    Object.keys(this._attributes).forEach((key) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this._attributes[key];
    });
    Object.assign(this._attributes, this._withAttributes);
    return ret;
  }

  Msg(...args: string[]): AsError {
    const fnError = this._resetAttributes(() => {
      const doWrite = this._levelHandler.isEnabled(
        toLogValue(this._attributes["level"])?.value(),
        toLogValue(this._attributes["module"])?.value(),
      );
      this._attributes["msg"] = logValue(args.join(" "));
      const msg = this._attributes["msg"].value();
      if (typeof msg === "string" && !msg.trim().length) {
        delete this._attributes["msg"];
      }
      let fnRet = (): Uint8Array => this._formatter.format({ ...this._attributes });
      if (doWrite) {
        const encoded = fnRet();
        this._logWriter.write(encoded);
        fnRet = (): Uint8Array => encoded;
      }
      return fnRet;
    });
    const asError = (): Error => new Error(this._txtEnDe.decode(fnError()));
    return {
      ResultError: () => Result.Err(asError()),
      AsError: asError,
    };
  }
}

class WithLoggerBuilder implements WithLogger {
  readonly _li: LoggerImpl;
  constructor(li: LoggerImpl) {
    this._li = li;
  }

  TxtEnDe(): TxtEnDecoder {
    return this._li.TxtEnDe();
  }

  Logger(): Logger {
    Object.assign(this._li._withAttributes, this._li._attributes);
    return this._li;
  }

  Attributes(): Record<string, unknown> {
    return { ...this._li._attributes };
  }

  SetExposeStack(enable?: boolean): WithLogger {
    this._li._levelHandler.setExposeStack(enable);
    return this;
  }

  SetFormatter(fmt: LogFormatter): WithLogger {
    this._li.SetFormatter(fmt);
    return this;
  }

  EnableLevel(level: Level, ...modules: string[]): WithLogger {
    this._li._levelHandler.enableLevel(level, ...modules);
    return this;
  }
  DisableLevel(level: Level, ...modules: string[]): WithLogger {
    this._li._levelHandler.enableLevel(level, ...modules);
    return this;
  }

  Module(key: string): WithLogger {
    this._li.Module(key);
    return this;
  }
  SetDebug(...modules: (string | string[])[]): WithLogger {
    this._li.SetDebug(...modules);
    return this;
  }

  Str(key: string, value?: string): WithLogger {
    this._li.Str(key, value);
    return this;
  }

  Len(value: unknown, key?: string): WithLogger {
    this._li.Len(value, key);
    return this;
  }

  Hash(value: unknown, key?: string): WithLogger {
    this._li.Hash(value, key);
    return this;
  }

  Ref(key: string, action: Serialized | FnSerialized): WithLogger {
    this._li.Ref(key, action);
    return this;
  }
  Bool(key: string, value: unknown): WithLogger {
    this._li.Bool(key, value);
    return this;
  }
  Result<T>(key: string, res: Result<T, Error>): WithLogger {
    this._li.Result(key, res);
    return this;
  }
  Url(url: CoerceURI, key?: string): WithLogger {
    this._li.Url(url, key);
    return this;
  }
  Int(key: string, value: number): WithLogger {
    this._li.Int(key, value);
    return this;
  }

  Log(): WithLogger {
    this._li.Log();
    return this;
  }

  WithLevel(level: Level): WithLogger {
    this._li.WithLevel(level);
    return this;
  }

  Error(): WithLogger {
    this._li.Error();
    return this;
  }
  Warn(): WithLogger {
    this._li.Error();
    return this;
  }
  Debug(): WithLogger {
    this._li.Debug();
    return this;
  }
  Err(err: unknown): WithLogger {
    this._li.Err(err);
    return this;
  }
  Info(): WithLogger {
    this._li.Info();
    return this;
  }
  Timestamp(): WithLogger {
    this._li.Timestamp();
    return this;
  }
  Any(key: string, value: LogSerializable): WithLogger {
    this._li.Any(key, value);
    return this;
  }
  Dur(key: string, nsec: number): WithLogger {
    this._li.Dur(key, nsec);
    return this;
  }
  Uint64(key: string, value: number): WithLogger {
    this._li.Uint64(key, value);
    return this;
  }
}
