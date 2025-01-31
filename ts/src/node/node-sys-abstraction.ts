import { SysAbstraction, SystemService, VoidFunc } from "../sys-abstraction.js";
import {
  BaseSysAbstraction,
  ExitHandler,
  ExitService,
  WrapperSysAbstraction,
  WrapperSysAbstractionParams,
} from "../base-sys-abstraction.js";
import { NodeFileService } from "./node-file-service.js";
import { Env, envFactory } from "../sys-env.js";
import { TxtEnDecoderSingleton } from "../txt-en-decoder.js";
import process from "node:process";

export class NodeExitServiceImpl implements ExitService {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    process.on("unhandledRejection", (reason: string, p: Promise<unknown>) => {
      this.exit(19);
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    process.on("uncaughtException", (error: Error) => {
      this.exit(18);
    });
    process.on("close", () => {
      this.exit(0);
    });
    process.on("exit", () => {
      this.exit(0);
    });
    process.on("SIGQUIT", () => {
      this.exit(3);
    });
    process.on("SIGINT", () => {
      this.exit(2);
    });
    process.on("SIGTERM", () => {
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
        process.exit(code);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("ExitService: failed to handle exit", err);
        process.exit(code);
      });
  }
}

export class NodeSystemService implements SystemService {
  static readonly _exitHandlers: ExitHandler[] = [];
  readonly _exitService: ExitService = new NodeExitServiceImpl();
  constructor() {
    this._exitService.injectExitHandlers(NodeSystemService._exitHandlers);
  }

  Env(): Env {
    return envFactory();
  }

  Args(): string[] {
    return process.argv;
  }

  OnExit(hdl: VoidFunc): VoidFunc {
    const id = crypto.randomUUID();
    NodeSystemService._exitHandlers.push({ hdl, id });
    return () => {
      const idx = NodeSystemService._exitHandlers.findIndex((h) => h.id === id);
      if (idx >= 0) {
        NodeSystemService._exitHandlers.splice(idx, 1);
      }
    };
  }

  Exit(code: number): void {
    this._exitService.exit(code);
  }
}

let my: BaseSysAbstraction | undefined = undefined;
export function NodeSysAbstraction(param?: WrapperSysAbstractionParams): SysAbstraction {
  if (!my) {
    my = new BaseSysAbstraction({
      TxtEnDecoder: param?.TxtEnDecoder || TxtEnDecoderSingleton(),
      FileSystem: new NodeFileService(),
      SystemService: new NodeSystemService(),
    });
  }
  return new WrapperSysAbstraction(my, param);
}
