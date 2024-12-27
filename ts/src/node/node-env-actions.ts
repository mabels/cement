import { ResolveOnce } from "../resolve-once.js";
import { runtimeFn } from "../runtime.js";
import { Env, EnvActions, EnvFactoryOpts } from "../sys-env.js";

const once = new ResolveOnce<NodeEnvActions>();
export class NodeEnvActions implements EnvActions {
  readonly #node = globalThis as unknown as { process: { env: Record<string, string> } };

  static new(opts: Partial<EnvFactoryOpts>): EnvActions {
    return once.once(() => new NodeEnvActions(opts));
  }

  readonly opts: Partial<EnvFactoryOpts>;
  private constructor(opts: Partial<EnvFactoryOpts>) {
    this.opts = opts;
  }

  register(env: Env): Env {
    for (const key of env.keys()) {
      this._env[key] = env.get(key) || "";
    }
    return env;
  }

  active(): boolean {
    return runtimeFn().isNodeIsh;
    // typeof this.#node === "object" && typeof this.#node.process === "object" && typeof this.#node.process.env === "object";
  }
  readonly _env: Record<string, string> = this.active() ? this.#node.process.env : {};
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
