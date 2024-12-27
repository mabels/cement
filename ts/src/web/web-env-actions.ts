import { ResolveOnce } from "../resolve-once.js";
import { EnvActions, EnvFactoryOpts, Env } from "../sys-env.js";

const once = new ResolveOnce<BrowserEnvActions>();
export class BrowserEnvActions implements EnvActions {
  readonly env: Map<string, string> = new Map<string, string>();
  readonly opts: Partial<EnvFactoryOpts>;

  static new(opts: Partial<EnvFactoryOpts>): EnvActions {
    return once.once(() => new BrowserEnvActions(opts));
  }

  private constructor(opts: Partial<EnvFactoryOpts>) {
    this.opts = opts;
  }

  get(key: string): string | undefined {
    return this.env.get(key);
  }
  set(key: string, value?: string): void {
    if (value) {
      this.env.set(key, value);
    }
  }
  delete(key: string): void {
    this.env.delete(key);
  }
  keys(): string[] {
    return Array.from(this.env.keys());
  }
  active(): boolean {
    return true; // that should work on every runtime
  }

  register(env: Env): Env {
    const sym = Symbol.for(this.opts.symbol || "CP_ENV");
    const browser = globalThis as unknown as Record<symbol, Env>;
    browser[sym] = env;
    return env;
  }
}
