import type { Env, EnvActions, EnvFactoryOpts, WithCement } from "@adviser/cement";

// export interface ImportMetaEnv {
//   import?: {
//     meta?: {
//       env?: Record<string, string>;
//     };
//   };
// }

let once: NodeEnvActions | undefined = undefined;

export class NodeEnvActions implements EnvActions {
  readonly #node = globalThis as unknown as { process: { env: Record<string, string> } };
  readonly _env: Record<string, string>;

  static new(opts: WithCement<Partial<EnvFactoryOpts>>): EnvActions {
    once = once ?? new NodeEnvActions(opts);
    return once;
  }

  readonly opts: WithCement<Partial<EnvFactoryOpts>>;
  private constructor(opts: WithCement<Partial<EnvFactoryOpts>>) {
    this.opts = opts;
    this._env = this.active() ? this.#node.process.env : {};
  }

  register(env: Env): Env {
    for (const key of env.keys()) {
      this._env[key] = env.get(key) || "";
    }
    return env;
  }

  active(): boolean {
    return this.opts.cement.runtimeFn().isNodeIsh;
  }
  keys(): string[] {
    return Object.keys(this._env);
  }
  get(key: string): string | undefined {
    return this._env[key];
  }
  set(key: string, value?: string): void {
    if (value) {
      this._env[key] = value;
    }
  }
  delete(key: string): void {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this._env[key];
  }
}
