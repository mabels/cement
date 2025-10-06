import type { Env, EnvActions } from "./sys-env.js";

export class ImportMetaEnv implements EnvActions {
  readonly importMetaEnv? = undefined;
  active(): boolean {
    throw new Error("Method not implemented.");
  }
  register(env: Env): Env {
    throw new Error("Method not implemented.");
  }
  get(key: string): string | undefined {
    throw new Error("Method not implemented.");
  }
  set(key: string, value?: string): void {
    throw new Error("Method not implemented.");
  }
  delete(key: string): void {
    throw new Error("Method not implemented.");
  }
  keys(): string[] {
    throw new Error("Method not implemented.");
  }
}

export function wrapImportMetaEnv(ea: EnvActions): EnvActions {
  return ea;
}
