import { WithCement } from "./types.js";
import { runtimeFn } from "./runtime.js";
import {
  WrapperBasicSysAbstraction,
  WrapperRuntimeSysAbstraction,
  BaseBasicSysAbstraction,
  BaseSysAbstraction,
} from "./base-sys-abstraction.js";
import { TxtEnDecoderSingleton } from "./txt-en-decoder.js";
import { ConsoleWriterStream } from "./utils/console-write-stream.js";
import { envFactory } from "./sys-env.js";

export function addCement<T>(params: T): WithCement<T> {
  return {
    cement: {
      runtimeFn,
      WrapperBasicSysAbstraction,
      WrapperRuntimeSysAbstraction,
      TxtEnDecoderSingleton,
      ConsoleWriterStream,
      envFactory,
      BaseBasicSysAbstraction,
      BaseSysAbstraction,
    },
    ...params,
  };
}
