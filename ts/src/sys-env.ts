import { DenoEnvActions } from "./deno/deno-env-actions.js";
import { NodeEnvActions } from "./node/node-env-actions.js";
import { BrowserEnvActions } from "./web/web-env-actions.js";
import { CFEnvActions } from "./cf/cf-env-actions.js";
import { KeyedResolvOnce } from "./resolve-once.js";
import { Result } from "./result.js";
import { getParamsResult, KeysParam } from "./utils/get-params-result.js";
import { wrapImportMetaEnv, ImportMetaEnv } from "@adviser/cement/import-meta-env";

export type EnvTuple = ([string, string] | [string, string][] | Record<string, string> | Iterator<[string, string]>)[];

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

export interface EnvFactoryOpts {
  readonly symbol: string; // default "CP_ENV" used by BrowserEnvActions
  readonly presetEnv: Map<string, string>;
  testPatchImportMetaEnv?: Record<string, string>;
  readonly id: string; // to reinit in tests
}

type OnSetFn = (key: string, value?: string) => void;
export interface OnSetItem {
  readonly filter: Set<string>;
  readonly fn: OnSetFn;
}

export interface Env extends EnvMap {
  onSet(fn: OnSetFn, ...filter: string[]): void;

  gets(...kparams: KeysParam): Result<Record<string, string>>;
  sets(...keys: EnvTuple): void;
}

export type EnvFactoryFn = (opts: Partial<EnvFactoryOpts>) => EnvActions;

const envActions: { id: string; fn: EnvFactoryFn }[] = [
  { id: "cf", fn: (opts: Partial<EnvFactoryOpts>): EnvActions => CFEnvActions.new(opts) },
  { id: "node", fn: (opts: Partial<EnvFactoryOpts>): EnvActions => NodeEnvActions.new(opts) },
  { id: "deno", fn: (opts: Partial<EnvFactoryOpts>): EnvActions => DenoEnvActions.new(opts) },
  { id: "browser", fn: (opts: Partial<EnvFactoryOpts>): EnvActions => BrowserEnvActions.new(opts) },
];

/**
 * Registers a custom environment action factory.
 *
 * Allows registration of platform-specific environment implementations.
 * The factory is added to the beginning of the search list and will be
 * tried first when creating new Env instances.
 *
 * @param fn - Factory function that creates EnvActions for a platform
 * @returns Unregister function to remove the factory
 *
 * @example
 * ```typescript
 * const unregister = registerEnvAction((opts) => {
 *   return new CustomEnvActions(opts);
 * });
 *
 * // Later, remove the factory
 * unregister();
 * ```
 */
export function registerEnvAction(fn: EnvFactoryFn): () => void {
  const id = `id-${Math.random()}`;
  envActions.unshift({ id, fn });
  // rerun envFactory
  _envFactories.unget(id);
  return () => {
    const index = envActions.findIndex((i) => i.id === id);
    if (index >= 0) {
      envActions.splice(index, 1);
    }
  };
}

const _envFactories = new KeyedResolvOnce<Env>();

/**
 * Creates a platform-appropriate environment variable interface.
 *
 * Automatically detects the runtime environment (Node.js, Deno, browser,
 * Cloudflare Workers) and returns an Env instance with platform-specific
 * implementations. Supports preset values, change notifications, and
 * type-safe multi-key retrieval.
 *
 * @param opts - Optional configuration:
 *   - symbol: Key for browser environment storage (default: "CP_ENV")
 *   - presetEnv: Map of preset environment variables
 *   - testPatchImportMetaEnv: Test values to patch into import.meta.env
 *   - id: Identifier for caching/reinitialization
 *
 * @returns Env instance for the detected platform
 * @throws Error if no compatible environment is detected
 *
 * @example
 * ```typescript
 * const env = envFactory();
 *
 * // Get single value
 * const apiKey = env.get('API_KEY');
 *
 * // Get multiple values with Result
 * const config = env.gets('DB_HOST', 'DB_PORT', 'DB_NAME');
 * if (config.isOk()) {
 *   const { DB_HOST, DB_PORT, DB_NAME } = config.unwrap();
 * }
 *
 * // Listen for changes
 * env.onSet((key, value) => {
 *   console.log(`${key} changed to ${value}`);
 * }, 'API_KEY'); // Optional: filter by specific keys
 * ```
 */
export function envFactory(opts: Partial<EnvFactoryOpts> = {}): Env {
  const found = envActions.find((fi) => fi.fn(opts).active());
  if (!found) {
    throw new Error("SysContainer:envFactory: no env available");
  }
  const res = _envFactories.get(opts.id ?? found.id).once(() => {
    const action = wrapImportMetaEnv(found.fn(opts));
    const ret = new EnvImpl(action, opts);
    action.register(ret);
    return ret;
  });
  if (opts.testPatchImportMetaEnv && isImportMetaEnv(res._map) && res._map.importMetaEnv) {
    // do not override possible readonly meta.env
    Object.assign(res._map.importMetaEnv, opts.testPatchImportMetaEnv);
  }
  return res;
}

function isImportMetaEnv(obj: EnvMap): obj is ImportMetaEnv {
  return !!(obj as ImportMetaEnv).importMetaEnv;
}

function isIterable(obj: unknown): obj is Iterable<[string, string]> {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof (obj as Record<symbol, unknown>)[Symbol.iterator] === "function";
}

export class EnvImpl implements Env {
  readonly _map: EnvMap;
  constructor(map: EnvMap, opts: Partial<EnvFactoryOpts> = {}) {
    this._map = map;
    this._updatePresets(opts.presetEnv);
  }
  gets(...kparams: KeysParam): Result<Record<string, string>> {
    return getParamsResult(kparams, {
      getParam: (k) => this.get(k),
    });
  }
  sets(...keys: EnvTuple): void {
    keys.forEach((key) => {
      if (Array.isArray(key)) {
        if (key.length === 2) {
          const [k, v] = key;
          if (typeof k === "string" && typeof v === "string") {
            this.set(k, v);
            return;
          }
        }
        for (const item of key) {
          if (Array.isArray(item)) {
            // [string, string]
            if (item.length === 2) {
              const [k, v] = item;
              if (typeof k === "string" && typeof v === "string") {
                this.set(k, v);
              }
            }
          }
        }
      } else {
        if (isIterable(key)) {
          for (const [k, v] of key) {
            if (typeof k === "string" && typeof v === "string") {
              this.set(k, v);
            }
          }
        } else {
          const rKey = key as Record<string, string>;
          for (const k in rKey) {
            const v = rKey[k];
            if (typeof k === "string" && typeof v === "string") {
              this.set(k, v);
            }
          }
        }
      }
    });
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
          let v: string | undefined;
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
