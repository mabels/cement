import { Result } from "./result";
import { CoerceURI } from "./uri";

export enum Level {
  WARN = "warn",
  DEBUG = "debug",
  INFO = "info",
  ERROR = "error",
}

export type Serialized = string | number | boolean;
export type FnSerialized = () => Serialized;

export class LogValue {
  constructor(readonly fn: FnSerialized) {}
  value(): Serialized {
    return this.fn();
  }
  toJSON(): Serialized {
    return this.value();
  }
}

export type LogSerializable = Record<string, LogValue | Promise<LogValue>>;

export function removeSelfRef(): (key: unknown, val: unknown) => unknown {
  const cache = new Set();
  return function (key: unknown, value: unknown) {
    if (typeof value === "object" && value !== null) {
      // Duplicate reference found, discard key
      if (cache.has(value)) return "...";
      cache.add(value);
    }
    return value;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function asyncLogValue(val: () => Promise<Serialized>): Promise<LogValue> {
  // return Promise.resolve(logValue(val));
  throw new Error("Not implemented");
}

export function logValue(val: Serialized | FnSerialized | LogSerializable | undefined | null): LogValue {
  switch (typeof val) {
    case "function":
      return new LogValue(val);
    case "string":
      return new LogValue(() => {
        try {
          const ret = JSON.parse(val);
          if (typeof ret === "object" && ret !== null) {
            return ret;
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // do nothing
        }
        return val.toString();
      });
    case "number":
      return new LogValue(() => val);
    case "boolean":
      return new LogValue(() => val);
    case "object":
      return new LogValue(() => JSON.parse(JSON.stringify(val, removeSelfRef())));
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

export interface LoggerInterface<R> {
  Module(key: string): R;
  // if modules is empty, set for all Levels
  EnableLevel(level: Level, ...modules: string[]): R;
  DisableLevel(level: Level, ...modules: string[]): R;

  SetDebug(...modules: (string | string[])[]): R;

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

  Err(err: unknown): R; // could be Error, or something which coerces to string
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
