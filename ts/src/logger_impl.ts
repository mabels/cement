// import { v4 } from "uuid";
import { AsError, Level, Logger, WithLogger } from "./logger";
import { WebSysAbstraction } from "./web/web_sys_abstraction";
import { SysAbstraction } from "./sys_abstraction";

const encoder = new TextEncoder();

type JsonRecord = Record<string, string | number | boolean | unknown>;

export interface LevelHandler {
  enableLevel(level: Level, ...modules: string[]): void;
  disableLevel(level: Level, ...modules: string[]): void;
  setDebug(...modules: (string | string[])[]): void;
  isEnabled(ilevel: unknown, module: unknown): boolean;
}

export class LevelHandlerImpl implements LevelHandler {
  readonly _globalLevels = new Set<Level>([Level.INFO, Level.ERROR, Level.WARN]);
  readonly _modules = new Map<string, Set<Level>>();
  enableLevel(level: Level, ...modules: string[]): void {
    if (modules.length == 0) {
      this._globalLevels.add(level);
      return;
    }
    this.forModules(
      level,
      (p) => {
        this._modules.set(p, new Set([...this._globalLevels, level]));
      },
      ...modules,
    );
  }
  disableLevel(level: Level, ...modules: string[]): void {
    if (modules.length == 0) {
      this._globalLevels.delete(level);
      return;
    }
    this.forModules(
      level,
      (p) => {
        this._modules.delete(p);
      },
      ...modules,
    );
  }

  forModules(level: Level, fnAction: (p: string) => void, ...modules: (string | string[])[]): void {
    for (const m of modules.flat()) {
      const parts = m
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const p of parts) {
        fnAction(p);
      }
    }
  }
  setDebug(...modules: (string | string[])[]): void {
    this.forModules(
      Level.DEBUG,
      (p) => {
        this._modules.set(p, new Set([...this._globalLevels, Level.DEBUG]));
      },
      ...modules,
    );
  }
  isEnabled(ilevel: unknown, module: unknown): boolean {
    const level = ilevel as Level; // what if it's not a level?
    if (module !== undefined) {
      const levels = this._modules.get(module as string);
      if (levels && levels.has(level)) {
        return true;
      }
    }
    if (level === undefined) {
      // this is a plain log
      return true;
    }
    return this._globalLevels.has(level);
  }
}

const levelSingleton = new LevelHandlerImpl();

// globalThis[Symbol("levelSingleton")] = new LevelHandlerImpl()

export class LogWriter {
  readonly _out: WritableStream<Uint8Array>;
  readonly _toFlush: (() => Promise<void>)[] = [];

  constructor(out: WritableStream<Uint8Array>) {
    this._out = out;
  }

  write(encoded: Uint8Array) {
    const my = async () => {
      // const val = Math.random();
      // console.log(">>>My:", val)
      try {
        const writer = this._out.getWriter();
        await writer.ready;
        await writer.write(encoded);
        await writer.releaseLock();
      } catch (err) {
        console.error("Chunk error:", err);
      }
      // console.log("<<<My:", val)
    };
    this._toFlush.push(my);
    this._flush();
  }

  _flushIsRunning = false;
  _flushDoneFns = Array<() => void>();
  _flush(toFlush: (() => Promise<void>)[] | undefined = undefined, done?: () => void): void {
    if (done) {
      this._flushDoneFns.push(done);
    }

    if (this._toFlush.length == 0) {
      // console.log("Flush is stopped", this._toFlush.length)
      this._flushIsRunning = false;
      this._flushDoneFns.forEach((fn) => fn());
      this._flushDoneFns = [];
      return;
    }

    if (!toFlush && this._toFlush.length == 1 && !this._flushIsRunning) {
      this._flushIsRunning = true;
      // console.log("Flush is started", this._toFlush.length)
    } else if (!toFlush) {
      // console.log("flush queue check but is running", this._toFlush.length)
      return;
    }

    // console.log(">>>Msg:", this._toFlush.length)
    const my = this._toFlush.shift();
    my?.().finally(() => {
      // console.log("<<<Msg:", this._toFlush.length)
      this._flush(this._toFlush);
    });
  }
}

export interface LoggerImplParams {
  readonly out?: WritableStream<Uint8Array>;
  readonly logWriter?: LogWriter;
  readonly sys?: SysAbstraction;
  readonly withAttributes?: JsonRecord;
  readonly levelHandler?: LevelHandler;
}
export class LoggerImpl implements Logger {
  readonly _sys: SysAbstraction;
  readonly _attributes: JsonRecord = {};
  readonly _withAttributes: JsonRecord;
  readonly _logWriter: LogWriter;
  readonly _levelHandler: LevelHandler;
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
    if (params.logWriter) {
      this._logWriter = params.logWriter;
    } else {
      if (!params.out) {
        this._logWriter = new LogWriter(this._sys.Stdout());
      } else {
        this._logWriter = new LogWriter(params.out);
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
      this._levelHandler = levelSingleton;
    }
    // console.log("LoggerImpl", this._id, this._attributes, this._withAttributes)
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
    this._attributes["module"] = key;
    this._withAttributes["module"] = key;
    return this;
  }
  SetDebug(...modules: (string | string[])[]): Logger {
    this._levelHandler.setDebug(...modules);

    return this;
  }

  Timestamp(): Logger {
    this._attributes["ts"] = this._sys.Time().Now().toISOString();
    return this;
  }
  Warn(): Logger {
    this._attributes["level"] = Level.WARN;
    return this;
  }
  Log(): Logger {
    return this;
  }
  Debug(): Logger {
    this._attributes["level"] = Level.DEBUG;
    return this;
  }
  Error(): Logger {
    this._attributes["level"] = Level.ERROR;
    return this;
  }
  Info(): Logger {
    this._attributes["level"] = Level.INFO;
    return this;
  }
  Err(err: unknown): Logger {
    if (err instanceof Error) {
      this._attributes["error"] = err.message;
    } else {
      this._attributes["error"] = "" + err;
    }
    return this;
  }
  WithLevel(l: Level): Logger {
    this._attributes["level"] = l;
    return this;
  }

  Str(key: string, value: string): Logger {
    this._attributes[key] = value;
    return this;
  }

  Any(key: string, value: string | number | boolean | JsonRecord): Logger {
    this._attributes[key] = value;
    return this;
  }
  Dur(key: string, nsec: number): Logger {
    this._attributes[key] = `${nsec}ms`;
    // new Intl.DurationFormat("en", { style: "narrow" }).format(nsec);
    return this;
  }
  Uint64(key: string, value: number): Logger {
    this._attributes[key] = value;
    return this;
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
        withAttributes: {
          module: this._attributes["module"],
          ...this._withAttributes,
        },
      }),
    );
  }

  _resetAttributes(fn: () => Error): Error {
    const ret = fn();
    Object.keys(this._attributes).forEach((key) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this._attributes[key];
    });
    Object.assign(this._attributes, this._withAttributes);
    return ret;
  }
  Msg(...args: string[]): AsError {
    const error = this._resetAttributes(() => {
      const doWrite = this._levelHandler.isEnabled(this._attributes["level"], this._attributes["module"]);
      this._attributes["msg"] = args.join(" ");
      if (typeof this._attributes["msg"] === "string" && !this._attributes["msg"].trim().length) {
        delete this._attributes["msg"];
      }
      if (this._attributes["ts"] === "ETERNITY") {
        this.Timestamp();
      }
      const str = JSON.stringify(this._attributes);
      if (doWrite) {
        const encoded = encoder.encode(str + "\n");
        this._logWriter.write(encoded);
      }
      return new Error(str);
    });
    return {
      AsError: () => error,
    };
  }
}

class WithLoggerBuilder implements WithLogger {
  readonly _li: LoggerImpl;
  constructor(li: LoggerImpl) {
    this._li = li;
  }
  Logger(): Logger {
    Object.assign(this._li._withAttributes, this._li._attributes);
    return this._li;
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

  Str(key: string, value: string): WithLogger {
    this._li.Str(key, value);
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
    this._li._attributes["ts"] = "ETERNITY";
    return this;
  }
  Any(key: string, value: JsonRecord): WithLogger {
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
