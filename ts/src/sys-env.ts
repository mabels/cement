import { ResolveOnce } from "./resolve-once.js";

export interface EnvMap {
  get(key: string): string | undefined;
  set(key: string, value?: string): void;
  delete(key: string): void;
  keys(): string[];
}
export interface EnvActions extends EnvMap {
  active(): boolean;
  register(env: Env): Env;
}

class NodeEnvActions implements EnvActions {
  readonly #node = globalThis as unknown as { process: { env: Record<string, string> } };

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-unused-vars
  constructor(opts: Partial<EnvFactoryOpts>) {
    // do nothing
  }

  register(env: Env): Env {
    return env;
  }

  active(): boolean {
    return typeof this.#node === "object" && typeof this.#node.process === "object" && typeof this.#node.process.env === "object";
  }
  readonly _env = this.active() ? this.#node.process.env : {};
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

class DenoEnvActions implements EnvActions {
  readonly #deno = globalThis as unknown as { Deno: { env: Map<string, string> } };

  get _env(): Map<string, string> {
    return this.#deno.Deno.env;
  }

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-unused-vars
  constructor(opts: Partial<EnvFactoryOpts>) {
    // do nothing
  }

  register(env: Env): Env {
    return env;
  }
  active(): boolean {
    return typeof this.#deno === "object" && typeof this.#deno.Deno === "object" && typeof this.#deno.Deno.env === "object";
  }
  keys(): string[] {
    return Array.from(this._env.keys());
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

export class BrowserEnvActions implements EnvActions {
  readonly env: Map<string, string> = new Map<string, string>();
  readonly opts: Partial<EnvFactoryOpts>;
  constructor(opts: Partial<EnvFactoryOpts>) {
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

export interface EnvFactoryOpts {
  readonly symbol: string; // default "CP_ENV" used by BrowserEnvActions
  readonly presetEnv: Map<string, string>;
}

type OnSetFn = (key: string, value?: string) => void;
export interface OnSetItem {
  readonly filter: Set<string>;
  readonly fn: OnSetFn;
}

export interface Env extends EnvMap {
  onSet(fn: OnSetFn, ...filter: string[]): void;
}

export type EnvFactoryFn = (opts: Partial<EnvFactoryOpts>) => EnvActions;

const envActions: { id: string; fn: EnvFactoryFn }[] = [
  { id: "node", fn: (opts: Partial<EnvFactoryOpts>): EnvActions => new NodeEnvActions(opts) },
  { id: "deno", fn: (opts: Partial<EnvFactoryOpts>): EnvActions => new DenoEnvActions(opts) },
  { id: "browser", fn: (opts: Partial<EnvFactoryOpts>): EnvActions => new BrowserEnvActions(opts) },
];

export function registerEnvAction(fn: EnvFactoryFn): () => void {
  const id = `id-${Math.random()}`;
  envActions.unshift({ id, fn });
  // rerun envFactory
  _envFactory.reset();
  return () => {
    const index = envActions.findIndex((i) => i.id === id);
    if (index >= 0) {
      envActions.splice(index, 1);
    }
  };
}

const _envFactory = new ResolveOnce<Env>();
export function envFactory(opts: Partial<EnvFactoryOpts> = {}): Env {
  return _envFactory.once(() => {
    const found = envActions.map((facItem) => facItem.fn(opts)).find((env) => env.active());
    if (!found) {
      throw new Error("SysContainer:envFactory: no env available");
    }
    const ret = new EnvImpl(found, opts);
    found.register(ret);
    return ret;
  });
}

export class EnvImpl implements Env {
  readonly _map: EnvMap;
  constructor(map: EnvMap, opts: Partial<EnvFactoryOpts> = {}) {
    this._map = map;
    this._updatePresets(opts.presetEnv);
  }
  _updatePresets(presetEnv?: Map<string, string>): void {
    if (!presetEnv) {
      return;
    }
    for (const [key, value] of presetEnv) {
      this._map.set(key, value);
    }
  }
  _applyOnSet(onSet: OnSetItem[], key?: string, value?: string): void {
    onSet.forEach((item) => {
      let keys: string[] = [];
      if (key) {
        keys = [key];
      } else {
        keys = this._map.keys();
      }
      keys
        .filter((k) => {
          if (item.filter.size === 0) {
            return true;
          }
          if (item.filter.has(k)) {
            return true;
          }
          return false;
        })
        .forEach((k) => {
          let v;
          if (!key && !value) {
            // init
            v = this._map.get(k);
          } else if (key && !value) {
            // del
            v = undefined;
          } else {
            // set
            v = value;
          }
          item.fn(k, v);
        });
    });
  }
  readonly _onSet: OnSetItem[] = [];
  keys(): string[] {
    return this._map.keys();
  }
  // filter is not set all sets passed
  onSet(fn: OnSetFn, ...filter: string[]): void {
    const item: OnSetItem = { filter: new Set(filter), fn };
    this._onSet.push(item);
    this._applyOnSet([item]);
  }
  get(key: string): string | undefined {
    return this._map.get(key);
  }
  set(key: string, value?: string): void {
    if (!value) {
      return;
    }
    this._map.set(key, value);
    this._applyOnSet(this._onSet, key, value);
  }
  delete(key: string): void {
    this._map.delete(key);
    this._applyOnSet(this._onSet, key);
  }
}

// export const envImpl = new EnvImpl();
