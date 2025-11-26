import type { Env, EnvActions, EnvFactoryOpts, WithCement } from "@adviser/cement";

interface DenoEnv {
  get: (key: string) => string | undefined;
  toObject: () => Record<string, string>;
  set: (key: string, value: string) => void;
  has: (key: string) => boolean;
  delete: (key: string) => void;
}

let once: DenoEnvActions | undefined = undefined;
export class DenoEnvActions implements EnvActions {
  readonly #deno = globalThis as unknown as {
    Deno: {
      env: DenoEnv;
    };
  };

  static new(opts: WithCement<Partial<EnvFactoryOpts>>): EnvActions {
    once = once ?? new DenoEnvActions(opts);
    return once;
  }

  get _env(): DenoEnv {
    return this.#deno.Deno.env;
  }

  readonly opts: WithCement<Partial<EnvFactoryOpts>>;
  private constructor(opts: WithCement<Partial<EnvFactoryOpts>>) {
    this.opts = opts;
  }

  register(env: Env): Env {
    for (const key of env.keys()) {
      this._env.set(key, env.get(key) || "");
    }
    return env;
  }
  active(): boolean {
    return this.opts.cement.runtimeFn().isDeno;
  }
  keys(): string[] {
    return Object.keys(this._env.toObject());
  }
  get(key: string): string | undefined {
    return this._env.get(key);
  }
  set(key: string, value?: string): void {
    if (value) {
      this._env.set(key, value);
    }
  }
  delete(key: string): void {
    this._env.delete(key);
  }
}
