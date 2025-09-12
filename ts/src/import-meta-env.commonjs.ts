import type { EnvActions } from "./sys-env.js";

export function testInjectImportMetaEnv(_env?: Record<string, string>): void {
  // noop
}

export function wrapImportMetaEnv(ea: EnvActions): EnvActions {
  return ea;
}
