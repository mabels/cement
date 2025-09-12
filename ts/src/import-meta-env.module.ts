import { Env, EnvActions } from "./sys-env.js";

export function testInjectImportMetaEnv(env?: Record<string, string>): void {
  (import.meta as { env?: Record<string, string> }).env = {
    ...((import.meta as { env?: Record<string, string> }).env ?? {}),
    ...(env ?? {}),
  };
}

class ImportMetaEnv implements EnvActions {
  readonly #wrap: EnvActions;
  constructor(ea: EnvActions) {
    this.#wrap = ea;
  }
  active(): boolean {
    return this.#wrap.active();
  }
  register(env: Env): Env {
    return this.#wrap.register(env);
  }

  get(key: string): string | undefined {
    const v = this.#wrap.get(key);
    if (v) {
      return v;
    }
    return (import.meta as { env?: Record<string, string> }).env?.[key];
  }
  set(key: string, value?: string): void {
    this.#wrap.set(key, value);
  }
  delete(key: string): void {
    this.#wrap.delete(key);
  }
  keys(): string[] {
    const metaEnv = (import.meta as { env?: Record<string, string> }).env;
    if (metaEnv) {
      return Array.from(new Set([...this.#wrap.keys(), ...Object.keys(metaEnv)])).sort();
    }
    return this.#wrap.keys();
  }
}

export function wrapImportMetaEnv(ea: EnvActions): EnvActions {
  return new ImportMetaEnv(ea);
}
