import { bin2string } from "./bin2text.js";
import { Result } from "./result.js";
import { TxtEnDecoder } from "./txt-en-decoder.js";
import { CoerceURI } from "./uri.js";

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
    try {
      // console.log("LogValue.value", this.fn.toString());
      return this.fn();
    } catch (e) {
      return `LogValue:${(e as Error).message}`;
    }
  }
  toJSON(): Serialized | Serialized[] {
    return this.value();
  }
}

export type LogSerializable = Record<string, LogValue | Promise<LogValue>>;

// export function sanitizeSerialize(lineEnd?: string): (key: unknown, val: unknown) => unknown {
//   const cache = new Set();
//   return function (this: unknown, key: unknown, value: unknown) {
//     if (typeof value === "object" && value !== null) {
//       // Duplicate reference found, discard key
//       if (cache.has(value)) return "...";
//       cache.add(value);
//     }
//     return lineEnd ? value + lineEnd : value;
//   };
// }

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
      if (val === null) {
        return new LogValue(() => "null");
      }
      if (ArrayBuffer.isView(val)) {
        return logValue(bin2string(val, 512));
      }
      if (Array.isArray(val)) {
        return new LogValue(() => (val as Serialized[]).map((v) => logValue(v).value() as Serialized));
      }
      // if (val instanceof Response) {
      //   // my = my.clone() as unknown as LogValue | Serialized[] | null
      //   // const rval = my as unknown as Partial<Response>;
      //   // delete rval.clone
      //   // delete rval.blob
      // }
      if (val instanceof Headers) {
        return new LogValue(() => Object.fromEntries(val.entries()) as unknown as Serialized);
      }
      if (val instanceof ReadableStream) {
        return new LogValue(() => ">Stream<");
      }
      if (val instanceof Promise) {
        return new LogValue(() => ">Promise<");
      }

      // Duplicate reference found, discard key
      if (state.has(val)) {
        return new LogValue(() => "...");
      }
      state.add(val);
      if (typeof val.toJSON === "function") {
        return new LogValue(() => val.toJSON());
      }

      const res: Record<string, LogValue> = {};
      const typedVal = val as unknown as Record<string, LogValueArg>;
      for (const key in typedVal) {
        const element = typedVal[key];
        if (element instanceof LogValue) {
          res[key] = element;
        } else {
          if (typeof element !== "function") {
            res[key] = logValue(element, state);
          }
          // res[key] = logValue(element, state);
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

export type HttpType = Response | Result<Response> | Request | Result<Request>;

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

  Str<T extends string | Record<string, string>>(key: T, value?: T extends string ? string : undefined): R;
  Uint64<T extends string | Record<string, number>>(key: T, value?: T extends string ? number : undefined): R;
  Int<T extends string | Record<string, number>>(key: T, value?: T extends string ? number : undefined): R;
  Bool<T extends string | Record<string, unknown>>(key: T, value?: T extends string ? unknown : undefined): R;
  Any<T extends string | Record<string, unknown>>(key: T, value?: T extends string ? unknown : undefined): R;

  // first string is the key
  // first response is Response
  // first request is Request
  Http(...mix: (HttpType|string)[]): R;
  Pair(x: Record<string, unknown>): R;

  Error(): R;
  Warn(): R;
  Debug(): R;
  Log(): R;
  WithLevel(level: Level): R;

  Err(err: unknown | Result<unknown> | Error): R; // could be Error, or something which coerces to string
  Info(): R;
  Timestamp(): R;
  Dur(key: string, nsec: number): R;
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
  ResultError<T>(): Result<T>;
}

export interface Logger extends LoggerInterface<Logger> {
  With(): WithLogger;

  Msg(...args: string[]): AsError;
  Flush(): Promise<void>;
}
