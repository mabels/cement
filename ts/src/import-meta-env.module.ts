import { Env, EnvActions } from "./sys-env.js";

export class ImportMetaEnv implements EnvActions {
  readonly #wrap: EnvActions;
  readonly importMetaEnv? = (import.meta as { env?: Record<string, string> }).env || {};

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
    return this.importMetaEnv[key];
  }
  set(key: string, value?: string): void {
    this.#wrap.set(key, value);
  }
  delete(key: string): void {
    this.#wrap.delete(key);
  }
  keys(): string[] {
    return Array.from(new Set([...this.#wrap.keys(), ...Object.keys(this.importMetaEnv)])).sort();
  }
}

export function wrapImportMetaEnv(ea: EnvActions): EnvActions {
  return new ImportMetaEnv(ea);
}
