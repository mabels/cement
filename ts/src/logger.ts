export enum Level {
  WARN = "warn",
  DEBUG = "debug",
  INFO = "info",
  ERROR = "error",
}

export interface LoggerInterface<R> {
  Module(key: string): R;
  SetDebug(...modules: (string | string[])[]): R;

  Str(key: string, value: string): R;
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
}
export interface WithLogger extends LoggerInterface<WithLogger> {
  Logger(): Logger;
}

export interface Logger extends LoggerInterface<Logger> {
  With(): WithLogger;

  Msg(...args: string[]): void;
  Flush(): Promise<void>;
}
