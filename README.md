# cement

An Agnostic Platform Wrapper

which Provides:

- SysAbstraction
```typescript
export interface SysAbstraction {
  Time(): Time;
  Stdout(): WritableStream<Uint8Array>;
  Stderr(): WritableStream<Uint8Array>;
  NextId(): string;
  Random0ToValue(value: number): number;
  System(): SystemService;
  FileSystem(): FileService;
}
```
- Logger inspired from golang zlogger
```typescript
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
```
