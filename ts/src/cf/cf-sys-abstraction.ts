import { BaseSysAbstraction, WrapperSysAbstraction, WrapperSysAbstractionParams } from "../base-sys-abstraction.js";
import { ResolveOnce } from "../resolve-once.js";
import { runtimeFn } from "../runtime.js";
import { SysAbstraction, SystemService, VoidFunc } from "../sys-abstraction.js";
import { Env, EnvActions, envFactory, EnvFactoryOpts, EnvImpl } from "../sys-env.js";
import { Utf8EnDecoderSingleton } from "../txt-en-decoder.js";
import { WebFileService } from "../web/web-sys-abstraction.js";

const once = new ResolveOnce<CFEnvActions>();
export class CFEnvActions implements EnvActions {
  readonly cfEnv: Map<string, string>;
  env?: EnvImpl;
  static new(opts: Partial<EnvFactoryOpts>): EnvActions {
    return once.once(() => new CFEnvActions(opts));
  }
  static inject(o: Record<string, string>): void {
    const env = CFEnvActions.new({}) as CFEnvActions;
    for (const key in o) {
      const value = o[key];
      if (typeof value === "string") {
        env.env?.set(key, value);
      }
    }
  }
  private constructor(env: Partial<EnvFactoryOpts>) {
    this.cfEnv = new Map<string, string>(Object.entries(env.presetEnv || {}));
  }
  active(): boolean {
    return runtimeFn().isCFWorker;
  }
  register(env: Env): Env {
    this.env = env as EnvImpl;
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

export class CFSystemService implements SystemService {
  Env(): Env {
    return envFactory();
  }
  Args(): string[] {
    throw new Error("Args-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  OnExit(hdl: VoidFunc): VoidFunc {
    throw new Error("OnExit-Method not implemented.");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Exit(code: number): void {
    throw new Error("Exit-Method not implemented.");
  }
}

let my: BaseSysAbstraction | undefined = undefined;
export function CFSysAbstraction(param?: WrapperSysAbstractionParams): SysAbstraction {
  if (!my) {
    my = new BaseSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || Utf8EnDecoderSingleton(),
      FileSystem: new WebFileService(),
      SystemService: new CFSystemService(),
    });
  }
  return new WrapperSysAbstraction(my, param);
}
