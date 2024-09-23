import { LevelHandlerImpl } from "../log-level-impl.js";
import { Logger } from "../logger.js";
import { LoggerImpl } from "../logger-impl.js";
import { SysAbstraction } from "../sys-abstraction.js";
import { LogCollector } from "./log-write-stream.js";

export interface MockLoggerReturn {
  readonly logger: Logger;
  readonly logCollector: LogCollector;
}

export function MockLogger(params?: {
  readonly sys?: SysAbstraction;
  readonly pass?: WritableStreamDefaultWriter<Uint8Array>;
  moduleName?: string | string[];
  readonly disableDebug?: boolean;
}): MockLoggerReturn {
  const lc = new LogCollector(params?.pass);
  let modNames = ["MockLogger"];
  if (typeof params?.moduleName === "string") {
    modNames = [params?.moduleName];
  } else if (Array.isArray(params?.moduleName)) {
    modNames = [...params.moduleName, ...modNames];
  }
  const logger = new LoggerImpl({
    out: lc,
    sys: params?.sys,
    levelHandler: new LevelHandlerImpl(),
  })
    .With()
    .Module(modNames[0])
    .Logger();
  if (!params?.disableDebug) {
    logger.SetDebug(...modNames);
  }
  return {
    logCollector: lc,
    logger,
  };
}
