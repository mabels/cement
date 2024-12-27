import {
  ExitService,
  ExitHandler,
  BaseSysAbstraction,
  WrapperSysAbstractionParams,
  WrapperSysAbstraction,
} from "../base-sys-abstraction.js";
import { ResolveOnce } from "../resolve-once.js";
import { runtimeFn } from "../runtime.js";
import { SysAbstraction, SystemService, VoidFunc } from "../sys-abstraction.js";
import { Env, EnvActions, envFactory, EnvFactoryOpts } from "../sys-env.js";
import { Utf8EnDecoderSingleton } from "../txt-en-decoder.js";
// import * as process from "node:process";
import { DenoFileService } from "./deno-file-service.js";

const Deno = (globalThis as unknown as { Deno: unknown }).Deno as {
  addSignalListener(sig: string, hdl: () => void): void;
  exit(code?: number): void;
  args: string[];
};

interface DenoEnv {
  get: (key: string) => string | undefined;
  toObject: () => Record<string, string>;
  set: (key: string, value: string) => void;
  has: (key: string) => boolean;
  delete: (key: string) => void;
}

const once = new ResolveOnce<DenoEnvActions>();
export class DenoEnvActions implements EnvActions {
  readonly #deno = globalThis as unknown as {
    Deno: {
      env: DenoEnv;
    };
  };

  static new(opts: Partial<EnvFactoryOpts>): EnvActions {
    return once.once(() => new DenoEnvActions(opts));
  }

  get _env(): DenoEnv {
    return this.#deno.Deno.env;
  }

  readonly opts: Partial<EnvFactoryOpts>;
  private constructor(opts: Partial<EnvFactoryOpts>) {
    this.opts = opts;
  }

  register(env: Env): Env {
    for (const key of env.keys()) {
      this._env.set(key, env.get(key) || "");
    }
    return env;
  }
  active(): boolean {
    return runtimeFn().isDeno;
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

export class DenoExitServiceImpl implements ExitService {
  constructor() {
    globalThis.addEventListener("unhandledrejection", (e) => {
      e.preventDefault();
      this.exit(19);
    });
    globalThis.addEventListener("error", () => {
      this.exit(19);
    });
    globalThis.addEventListener("uncaughtException", () => {
      this.exit(19);
    });

    // process.on("close", () => {
    //   this.exit(0);
    // });
    globalThis.addEventListener("unload", () => {
      this.exit(0);
      // console.log('goodbye!');
    });

    // process.on("exit", () => {
    // });
    Deno.addSignalListener("SIGQUIT", () => {
      this.exit(3);
    });
    Deno.addSignalListener("SIGINT", () => {
      this.exit(2);
    });
    Deno.addSignalListener("SIGTERM", () => {
      this.exit(9);
    });
  }
  _exitHandlers: ExitHandler[] = [];
  injectExitHandlers(hdls: ExitHandler[]): void {
    // console.log("ExitService: injecting exit handlers", hdls)
    this._exitHandlers = hdls;
  }
  invoked = false;
  readonly _handleExit = async (): Promise<void> => {
    if (this.invoked) {
      // console.error("ExitService: already invoked");
      return;
    }
    this.invoked = true;
    for (const h of this._exitHandlers) {
      try {
        // console.log(`ExitService: calling handler ${h.id}`)
        const ret = h.hdl();
        // console.log(`ExitService: called handler ${h.id}`, ret)
        if (typeof (ret as Promise<void>).then === "function") {
          await ret;
        }
      } finally {
        // ignore
      }
    }
  };

  exit(code: number): void {
    // console.log("ExitService: exit called", code)
    this._handleExit()
      .then(() => {
        Deno.exit(code);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("ExitService: failed to handle exit", err);
        Deno.exit(code);
      });
  }
}

export class DenoSystemService implements SystemService {
  static readonly _exitHandlers: ExitHandler[] = [];
  readonly _exitService: ExitService = new DenoExitServiceImpl();
  constructor() {
    this._exitService.injectExitHandlers(DenoSystemService._exitHandlers);
  }

  Env(): Env {
    return envFactory();
  }

  Args(): string[] {
    return Deno.args;
  }

  OnExit(hdl: VoidFunc): VoidFunc {
    const id = crypto.randomUUID();
    DenoSystemService._exitHandlers.push({ hdl, id });
    return () => {
      const idx = DenoSystemService._exitHandlers.findIndex((h) => h.id === id);
      if (idx >= 0) {
        DenoSystemService._exitHandlers.splice(idx, 1);
      }
    };
  }

  Exit(code: number): void {
    this._exitService.exit(code);
  }
}

let my: BaseSysAbstraction | undefined = undefined;
export function DenoSysAbstraction(param?: WrapperSysAbstractionParams): SysAbstraction {
  if (!my) {
    my = new BaseSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || Utf8EnDecoderSingleton(),
      FileSystem: new DenoFileService(),
      SystemService: new DenoSystemService(),
    });
  }
  return new WrapperSysAbstraction(my, param);
}
