export interface EnvActions {
  get(key: string): string | undefined;
  set(key: string, value?: string): void;
  del(key: string): void;
  keys(): string[];
  use(): boolean;
}

class NodeEnvActions implements EnvActions {
  readonly #node = globalThis as unknown as { process: { env: Record<string, string> } };

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-unused-vars
  constructor(opts: Partial<EnvFactoryOpts>) {
    // do nothing
  }
  use(): boolean {
    return typeof this.#node === "object" && typeof this.#node.process === "object" && typeof this.#node.process.env === "object";
  }
  readonly #env = this.use() ? process.env : {};
  keys(): string[] {
    return Object.keys(this.#env);
  }
  get(key: string): string | undefined {
    return this.#env[key];
  }
  set(key: string, value?: string): void {
    if (value) {
      this.#env[key] = value;
    }
  }
  del(key: string): void {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.#env[key];
  }
}

class DenoEnvActions implements EnvActions {
  readonly #deno = globalThis as unknown as { Deno: { env: Map<string, string> } };

  readonly #env: Map<string, string>;
  constructor(opts: Partial<EnvFactoryOpts>, env?: Map<string, string>) {
    if (env) {
      this.#env = env;
    } else {
      this.#env = this.use() ? this.#deno.Deno.env : new Map();
    }
  }
  use(): boolean {
    return typeof this.#deno === "object" && typeof this.#deno.Deno === "object" && typeof this.#deno.Deno.env === "object";
  }
  keys(): string[] {
    return Array.from(this.#env.keys());
  }
  get(key: string): string | undefined {
    return this.#env.get(key);
  }
  set(key: string, value?: string): void {
    if (value) {
      this.#env.set(key, value);
    }
  }
  del(key: string): void {
    this.#env.delete(key);
  }
}

class BrowserEnvActions extends DenoEnvActions {
  static globalBEA(sym: symbol) {
    const browser = globalThis as unknown as Record<symbol, BrowserEnvActions>;
    if (typeof browser === "object" && typeof browser[sym] === "object") {
      return { map: browser[sym]._map, finalize: () => browser[sym]._map };
    }
    const map = new Map<string, string>();
    return {
      map,
      finalize: (bea: BrowserEnvActions) => {
        browser[sym] = bea;
        return map;
      },
    };
  }

  readonly _map: Map<string, string>;
  constructor(opts: Partial<EnvFactoryOpts>) {
    const { map, finalize } = BrowserEnvActions.globalBEA(Symbol.for(opts.symbol || "CP_ENV"));
    // not perfect the globalThis will be polluted
    // also in the case it is not need.
    // better we have a lazy init
    super(opts, map);
    this._map = finalize(this);
  }
  use(): boolean {
    return true;
  }
}

interface EnvFactoryOpts {
  readonly symbol: string; // default "CP_ENV" used by BrowserEnvActions
  readonly presetEnv: Map<string, string>;
}

function envFactory(opts: Partial<EnvFactoryOpts> = {}): EnvActions {
  const found = [new NodeEnvActions(opts), new DenoEnvActions(opts), new BrowserEnvActions(opts)].find((env) => env.use());
  if (!found) {
    throw new Error("SysContainer:envFactory: no env available");
  }
  return found;
}

type OnSetFn = (key: string, value?: string) => void;
export interface OnSetItem {
  readonly filter: Set<string>;
  readonly fn: OnSetFn;
}

export interface Env extends Omit<EnvActions, "use"> {
  onSet(fn: OnSetFn, ...filter: string[]): void;
}

export class EnvImpl implements Env {
  readonly #envImpl: EnvActions;
  constructor(opts: Partial<EnvFactoryOpts> = {}) {
    this.#envImpl = envFactory(opts);
    // do nothing
    this.#updatePresets(opts.presetEnv);
  }
  #updatePresets(presetEnv?: Map<string, string>): void {
    if (!presetEnv) {
      return;
    }
    for (const [key, value] of presetEnv) {
      this.#envImpl.set(key, value);
    }
  }
  #applyOnSet(onSet: OnSetItem[], key?: string, value?: string): void {
    onSet.forEach((item) => {
      let keys: string[] = [];
      if (key) {
        keys = [key];
      } else {
        keys = this.#envImpl.keys();
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
            v = this.#envImpl.get(k);
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
  readonly #onSet: OnSetItem[] = [];
  keys(): string[] {
    return this.#envImpl.keys();
  }
  // filter is not set all sets passed
  onSet(fn: OnSetFn, ...filter: string[]): void {
    const item: OnSetItem = { filter: new Set(filter), fn };
    this.#onSet.push(item);
    this.#applyOnSet([item]);
  }
  get(key: string): string | undefined {
    return this.#envImpl.get(key);
  }
  set(key: string, value?: string): void {
    if (!value) {
      return;
    }
    this.#envImpl.set(key, value);
    this.#applyOnSet(this.#onSet, key, value);
  }
  del(key: string): void {
    this.#envImpl.del(key);
    this.#applyOnSet(this.#onSet, key);
  }
}

export const envImpl = new EnvImpl();
