import { runtimeFn } from "../runtime.js";
import { Env, EnvActions, EnvFactoryOpts, EnvImpl } from "../sys-env.js";

let once: CFEnvActions | undefined = undefined;
export class CFEnvActions implements EnvActions {
  readonly injectOnRegister: Record<string, string> = {};
  readonly cfEnv: Map<string, string>;
  readonly opts: Partial<EnvFactoryOpts>;
  env?: EnvImpl;
  static new(opts: Partial<EnvFactoryOpts> = {}): EnvActions {
    once = once ?? new CFEnvActions(opts);
    return once;
  }
  static inject(o: Record<string, string>): void {
    const env = CFEnvActions.new() as CFEnvActions;
    for (const key in o) {
      const value = o[key];
      if (typeof value === "string") {
        if (env.env) {
          env.env.set(key, value);
        } else {
          env.injectOnRegister[key] = value;
        }
      }
    }
  }
  private constructor(env: Partial<EnvFactoryOpts>) {
    this.cfEnv = new Map<string, string>(Object.entries(env.presetEnv || {}));
    this.opts = env;
  }
  active(): boolean {
    return runtimeFn().isCFWorker;
  }
  register(env: Env): Env {
    this.env = env as EnvImpl;
    for (const key in this.injectOnRegister) {
      env.set(key, this.injectOnRegister[key]);
    }
    return env;
  }
  get(key: string): string | undefined {
    return this.cfEnv.get(key);
  }
  set(key: string, value?: string): void {
    if (value) {
      this.cfEnv.set(key, value);
    }
  }
  delete(key: string): void {
    this.cfEnv.delete(key);
  }
  keys(): string[] {
    return Array.from(this.cfEnv.keys());
  }
}
