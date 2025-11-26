interface IType {
  readonly type: string;
}
class _Required implements IType {
  readonly type = "REQUIRED";
}

class _Optional implements IType {
  readonly type = "OPTIONAL";
}

export const param: {
  REQUIRED: _Required;
  OPTIONAL: _Optional;
} = {
  REQUIRED: new _Required(),
  OPTIONAL: new _Optional(),
};
export type param = (typeof param)[keyof typeof param];

export type WithCement<T> = T & {
  readonly cement: {
    readonly runtimeFn: typeof import("./runtime.js").runtimeFn;
    // readonly WrapperBasicSysAbstractionFactory: typeof import("./base-sys-abstraction.js").WrapperBasicSysAbstractionFactory;
    readonly WrapperBasicSysAbstraction: typeof import("./base-sys-abstraction.js").WrapperBasicSysAbstraction;
    readonly WrapperRuntimeSysAbstraction: typeof import("./base-sys-abstraction.js").WrapperRuntimeSysAbstraction;
    readonly TxtEnDecoderSingleton: typeof import("./txt-en-decoder.js").TxtEnDecoderSingleton;
    readonly ConsoleWriterStream: typeof import("./utils/console-write-stream.js").ConsoleWriterStream;
    readonly envFactory: typeof import("./sys-env.js").envFactory;
    readonly BaseBasicSysAbstraction: typeof import("./base-sys-abstraction.js").BaseBasicSysAbstraction;
    readonly BaseSysAbstraction: typeof import("./base-sys-abstraction.js").BaseSysAbstraction;
  };
};

export const hasHostPartProtocols: Set<string> = new Set<string>(["http", "https", "ws", "wss"]);

export const Level = {
  WARN: "warn",
  DEBUG: "debug",
  INFO: "info",
  ERROR: "error",
};

export type Level = (typeof Level)[keyof typeof Level];

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
