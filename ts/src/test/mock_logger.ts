import { Logger } from "../logger";
import { LoggerImpl } from "../logger_impl";
import { SysAbstraction } from "../sys_abstraction";
import { LogCollector } from "./log_collector";

export interface MockLoggerReturn {
  readonly logger: Logger;
  readonly logCollector: LogCollector;
}

export function MockLogger(params?: {
  readonly sys?: SysAbstraction;
  moduleName?: string | string[];
  readonly disableDebug?: boolean;
}): MockLoggerReturn {
  const lc = new LogCollector();
  let modNames = ["MockLogger"];
  if (typeof params?.moduleName === "string") {
    modNames = [params?.moduleName];
  } else if (Array.isArray(params?.moduleName)) {
    modNames = [...params!.moduleName, ...modNames];
  }
  const logger = new LoggerImpl({ out: lc, sys: params?.sys }).With().Module(modNames[0]).Logger();
  !params?.disableDebug && logger.SetDebug(...modNames);
  return {
    logCollector: lc,
    logger,
  };
}
