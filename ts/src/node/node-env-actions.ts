import { ResolveOnce } from "../resolve-once.js";
import { runtimeFn } from "../runtime.js";
import { Env, EnvActions, EnvFactoryOpts } from "../sys-env.js";

// export interface ImportMetaEnv {
//   import?: {
//     meta?: {
//       env?: Record<string, string>;
//     };
//   };
// }
export class NodeEnvActions implements EnvActions {
  static once = new ResolveOnce<NodeEnvActions>();
  // static cleanPrefixes = ["VITE_"];
  // static addCleanPrefix(prefix: string): void {
  //   if (!prefix.endsWith("_")) {
  //     prefix += "_";
  //   }
  //   if (!NodeEnvActions.cleanPrefixes.includes(prefix)) {
  //     NodeEnvActions.cleanPrefixes.push(prefix);
  //   }
  // }
  readonly #node = globalThis as unknown as { process: { env: Record<string, string> } };
  // readonly #importMetaEnv = globalThis as unknown as ImportMetaEnv;

  // cleanImportMetaEnv(): Record<string, string> {
  //   const metaEnv = this.#importMetaEnv.import?.meta?.env || {};
  //   const cleaned: Record<string, string> = {};
  //   for (const key of Object.keys(metaEnv)) {
  //     const hasCleanPrefix = NodeEnvActions.cleanPrefixes.find((prefix) => key.startsWith(prefix));
  //     if (hasCleanPrefix) {
  //       const cleanedPrefix = key.replace(hasCleanPrefix, "");
  //       const foundCleanPrefix = cleaned[cleanedPrefix];
  //       if (!foundCleanPrefix) {
  //         cleaned[cleanedPrefix] = metaEnv[key];
  //       }
  //     }
  //     cleaned[key] = metaEnv[key];
  //   }
  //   return cleaned;
  // }

  // mergeEnv(): Record<string, string> {
  //   // const importMetaEnv = this.cleanImportMetaEnv();
  //   // console.debug("NodeEnvActions.mergeEnv", importMetaEnv);
  //   const nodeEnv = Object.keys(this.#node.process.env).reduce(
  //     (acc, key) => {
  //       acc[key] = this.#node.process.env[key] || "";
  //       return acc;
  //     },
  //     {} as Record<string, string>,
  //   );
  //   return { ...nodeEnv };
  // }

  static new(opts: Partial<EnvFactoryOpts>): EnvActions {
    return NodeEnvActions.once.once(() => new NodeEnvActions(opts));
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
      // this.#node.process.env[key] = value; // also set in process.env
    }
  }
  delete(key: string): void {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this._env[key];
  }
}
