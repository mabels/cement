import { IDMode, RandomMode, SysAbstraction, SystemService, TimeMode, VoidFunc } from "./sys_abstraction";
import { FileService } from "./file_service";
import { NodeFileService } from "./node_file_service";
import { Time } from "./time";

class SysTime extends Time {
  Now(): Date {
    return new Date();
  }
  Sleep(duration: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }
}

export class ConstTime extends Time {
  Now(): Date {
    return new Date(2021, 1, 1, 0, 0, 0, 0);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Sleep(duration: number): Promise<void> {
    return Promise.resolve();
  }
}

export class StepTime extends Time {
  _step: Date;
  constructor() {
    super();
    this._step = new ConstTime().Now();
  }
  Now() {
    if (this._step.getTime() === 0) {
      this._step = new ConstTime().Now();
      return this._step;
    }
    this._step = new Date(this._step.getTime() + 1000);
    return this._step;
  }
  Sleep(duration: number): Promise<void> {
    this._step = new Date(this._step.getTime() + duration);
    return Promise.resolve();
  }
}

export function TimeFactory(timeMode: TimeMode): Time {
  switch (timeMode) {
    case TimeMode.REAL:
      return new SysTime();
    case TimeMode.CONST:
      return new ConstTime();
    case TimeMode.STEP:
      return new StepTime();
  }
  return new SysTime();
}

const decoder = new TextDecoder();

export class RandomService {
  readonly _mode: RandomMode;
  _step: number = 0;
  constructor(mode: RandomMode) {
    this._mode = mode;
  }
  Random0ToValue(value: number): number {
    switch (this._mode) {
      case RandomMode.CONST:
        return 0.5 * value;
      case RandomMode.STEP:
        this._step += 0.0001;
        return this._step * value;
      case RandomMode.RANDOM:
        return Math.random() * value;
      default:
        throw new Error("Unknown RandomMode");
    }
  }
}

export interface SystemAbstractionImplParams {
  readonly TimeMode?: TimeMode;
  readonly IdMode?: IDMode;
  readonly Stdout?: WritableStream<Uint8Array>;
  readonly Stderr?: WritableStream<Uint8Array>;
  readonly RandomMode?: RandomMode;
  readonly FileSystem?: FileService;
  readonly SystemService?: SystemService;
}

export class IdService {
  readonly _mode: IDMode;
  _step: number = 0;
  constructor(mode?: IDMode) {
    if (!mode) {
      mode = IDMode.UUID;
    }
    this._mode = mode;
  }
  NextId(): string {
    switch (this._mode) {
      case IDMode.UUID:
        return crypto.randomUUID();
      case IDMode.CONST:
        return "VeryUniqueID";
      case IDMode.STEP:
        return `STEPId-${this._step++}`;
      default:
        throw new Error("Unknown IDMode");
    }
  }
}

interface ExitHandler {
  readonly hdl: VoidFunc;
  readonly id: string;
}

export interface ExitService {
  injectExitHandlers(hdls: ExitHandler[]): void;
  exit(code: number): void;
}

export class ExitServiceImpl implements ExitService {
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
        console.error("ExitService: failed to handle exit", err);
        process.exit(code);
      });
  }
}

export class NodeSystemService implements SystemService {
  static readonly _exitHandlers: ExitHandler[] = [];
  readonly _exitService = new ExitServiceImpl();
  constructor() {
    this._exitService.injectExitHandlers(NodeSystemService._exitHandlers);
  }

  Env() {
    return process.env as Record<string, string>;
  }

  Args() {
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

export class NodeSysAbstraction implements SysAbstraction {
  static readonly _time = new SysTime();
  static readonly _stdout = new WritableStream({
    write(chunk) {
      return new Promise((resolve) => {
        const decoded = decoder.decode(chunk);
        console.log(decoded.trimEnd());
        resolve();
      });
    },
  });
  static readonly _stderr = new WritableStream({
    write(chunk) {
      return new Promise((resolve) => {
        const decoded = decoder.decode(chunk);
        console.error(decoded.trimEnd());
        resolve();
      });
    },
  });

  static readonly _idService = new IdService();
  static readonly _randomService = new RandomService(RandomMode.RANDOM);
  static readonly _fileSystem = new NodeFileService();
  static readonly _systemService = new NodeSystemService();

  readonly _time: Time = NodeSysAbstraction._time;
  readonly _stdout: WritableStream = NodeSysAbstraction._stdout;
  readonly _stderr: WritableStream = NodeSysAbstraction._stderr;
  readonly _idService: IdService = NodeSysAbstraction._idService;
  readonly _randomService: RandomService = NodeSysAbstraction._randomService;
  readonly _fileSystem: FileService = NodeSysAbstraction._fileSystem;
  readonly _systemService: SystemService = NodeSysAbstraction._systemService;

  constructor(params?: SystemAbstractionImplParams) {
    if (params) {
      if (params.TimeMode) {
        this._time = TimeFactory(params.TimeMode);
      }
      if (params.Stdout) {
        this._stdout = params.Stdout;
      }
      if (params.Stderr) {
        this._stderr = params.Stderr;
      }
      if (params.IdMode) {
        this._idService = new IdService(params.IdMode);
      }
      if (params.RandomMode) {
        this._randomService = new RandomService(params.RandomMode);
      }
      if (params.FileSystem) {
        this._fileSystem = params.FileSystem;
      }
      if (params.SystemService) {
        this._systemService = params.SystemService;
      }
    }
  }

  Time(): Time {
    return this._time;
  }
  NextId(): string {
    return this._idService.NextId();
  }
  Random0ToValue(value: number): number {
    return this._randomService.Random0ToValue(value);
  }
  Stdout(): WritableStream {
    return this._stdout;
  }
  Stderr(): WritableStream {
    return this._stderr;
  }

  System(): SystemService {
    return this._systemService;
  }
  FileSystem(): FileService {
    return this._fileSystem;
  }
}
