import { bin2string } from "./bin2text.ts";
import { Result } from "./result.ts";
import { TxtEnDecoder } from "./txt-en-decoder.ts";
import { CoerceURI } from "./uri.ts";

export enum Level {
  WARN = "warn",
  DEBUG = "debug",
  INFO = "info",
  ERROR = "error",
}

export type Serialized = string | number | boolean;
export type FnSerialized = () => Serialized | Serialized[];

export class LogValue {
  constructor(readonly fn: FnSerialized) {}
  value(): Serialized | Serialized[] {
    return this.fn();
  }
  toJSON(): Serialized | Serialized[] {
    return this.value();
  }
}

export type LogSerializable = Record<string, LogValue | Promise<LogValue>>;

export function removeSelfRef(lineEnd?: string): (key: unknown, val: unknown) => unknown {
  const cache = new Set();
  return function (key: unknown, value: unknown) {
    if (typeof value === "object" && value !== null) {
      // Duplicate reference found, discard key
      if (cache.has(value)) return "...";
      cache.add(value);
    }
    return lineEnd ? value + lineEnd : value;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function asyncLogValue(val: () => Promise<Serialized>): Promise<LogValue> {
  // return Promise.resolve(logValue(val));
  throw new Error("Not implemented");
}

export type LogValueArg = LogValue | Serialized | Serialized[] | FnSerialized | undefined | null;

export function logValue(val: LogValueArg, state: Set<unknown> = new Set<unknown>([Math.random()])): LogValue {
  switch (typeof val) {
    case "function":
      return new LogValue(val);
    case "string": {
      try {
        const ret = JSON.parse(val);
        if (typeof ret === "object" && ret !== null) {
          return logValue(ret, state);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        if (val.match(/[\n\r]/)) {
          const lines = val.trimEnd().split(/[\n\r]/);
          return new LogValue(() => lines);
        }
      }
      return new LogValue(() => val.toString());
    }
    case "number":
      return new LogValue(() => val);
    case "boolean":
      return new LogValue(() => val);
    case "object": {
      if (ArrayBuffer.isView(val)) {
        return logValue(bin2string(val, 512));
      }
      if (Array.isArray(val)) {
        return new LogValue(() => val.map((v) => logValue(v).value() as Serialized));
      }
      if (val === null) {
        return new LogValue(() => "null");
      }
      // Duplicate reference found, discard key
      if (state.has(val)) {
        return new LogValue(() => "...");
      }
      state.add(val);

      const res: Record<string, LogValue> = {};
      const typedVal = val as unknown as Record<string, LogValueArg>;
      for (const key in typedVal) {
        const element = typedVal[key];
        if (element instanceof LogValue) {
          res[key] = element;
        } else {
          res[key] = logValue(element, state);
        }
      }
      // ugly as hell cast but how declare a self-referencing type?
      return new LogValue(() => res as unknown as Serialized);
    }
    default:
      if (!val) {
        return new LogValue(() => "--Falsy--");
      }
      throw new Error(`Invalid type:${typeof val}`);
  }
}

export interface Sized {
  size: number;
}
export interface Lengthed {
  length: number;
}
export type SizeOrLength = Sized | Lengthed;

export interface LogFormatter {
  format(attr: LogSerializable): Uint8Array;
}

export interface LevelHandler {
  enableLevel(level: Level, ...modules: string[]): void;
  disableLevel(level: Level, ...modules: string[]): void;
  setExposeStack(enable?: boolean): void;
  isStackExposed: boolean;
  setDebug(...modules: (string | string[])[]): void;
  isEnabled(ilevel: unknown, module: unknown): boolean;
}

export interface LoggerInterface<R> {
  TxtEnDe(): TxtEnDecoder;
  Module(key: string): R;
  // if modules is empty, set for all Levels
  EnableLevel(level: Level, ...modules: string[]): R;
  DisableLevel(level: Level, ...modules: string[]): R;

  Attributes(): Record<string, unknown>;

  SetDebug(...modules: (string | string[])[]): R;
  SetExposeStack(enable?: boolean): R;
  SetFormatter(fmt: LogFormatter): R;

  Ref(key: string, action: { toString: () => string } | FnSerialized): R;
  Result<T>(key: string, res: Result<T>): R;
  // default key url
  Url(url: CoerceURI, key?: string): R;
  // len
  Len(value: unknown, key?: string): R;

  Hash(value: unknown, key?: string): R;

  Str(key: string, value?: string): R;
  Error(): R;
  Warn(): R;
  Debug(): R;
  Log(): R;
  WithLevel(level: Level): R;

  Err(err: unknown | Result<unknown> | Error): R; // could be Error, or something which coerces to string
  Info(): R;
  Timestamp(): R;
  Any(key: string, value: unknown): R;
  Dur(key: string, nsec: number): R;
  Uint64(key: string, value: number): R;
  Int(key: string, value: number): R;
  Bool(key: string, value: unknown): R;
}

export function IsLogger(obj: unknown): obj is Logger {
  return (
    typeof obj === "object" &&
    [
      "Module",
      "EnableLevel",
      "DisableLevel",
      "SetDebug",
      "Str",
      "Error",
      "Warn",
      "Debug",
      "Log",
      "WithLevel",
      "Err",
      "Info",
      "Timestamp",
      "Any",
      "Dur",
      "Uint64",
    ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((fn) => typeof (obj as any)[fn] === "function")
      .reduce((a, b) => a && b, true)
  );
}

export interface WithLogger extends LoggerInterface<WithLogger> {
  Logger(): Logger;
}

export interface AsError {
  AsError(): Error;
}

export interface Logger extends LoggerInterface<Logger> {
  With(): WithLogger;

  Msg(...args: string[]): AsError;
  Flush(): Promise<void>;
}
