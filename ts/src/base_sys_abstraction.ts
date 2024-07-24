import { FileService } from "./file_service";
import { TimeMode, RandomMode, IDMode, SystemService, VoidFunc, SysAbstraction } from "./sys_abstraction";
import { Time } from "./time";

export class SysTime extends Time {
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

export class RandomService {
  readonly _mode: RandomMode;
  _step = 0;
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

export class IdService {
  readonly _mode: IDMode;
  _step = 0;
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

export interface BaseSysAbstractionParams {
  readonly FileSystem: FileService;
  readonly SystemService: SystemService;
}

export interface ExitHandler {
  readonly hdl: VoidFunc;
  readonly id: string;
}

export interface ExitService {
  injectExitHandlers(hdls: ExitHandler[]): void;
  exit(code: number): void;
}

const decoder = new TextDecoder();
export class BaseSysAbstraction {
  readonly _time = new SysTime();
  readonly _stdout = new WritableStream({
    write(chunk) {
      return new Promise((resolve) => {
        const decoded = decoder.decode(chunk);
        // eslint-disable-next-line no-console
        console.log(decoded.trimEnd());
        resolve();
      });
    },
  });
  readonly _stderr = new WritableStream({
    write(chunk) {
      return new Promise((resolve) => {
        const decoded = decoder.decode(chunk);
        // eslint-disable-next-line no-console
        console.error(decoded.trimEnd());
        resolve();
      });
    },
  });

  readonly _idService = new IdService();
  readonly _randomService = new RandomService(RandomMode.RANDOM);
  readonly _fileSystem: FileService;
  readonly _systemService: SystemService;

  constructor(params: BaseSysAbstractionParams) {
    this._fileSystem = params.FileSystem;
    this._systemService = params.SystemService;
  }
}

export interface WrapperSysAbstractionParams {
  readonly TimeMode?: TimeMode;
  readonly IdMode?: IDMode;
  readonly Stdout?: WritableStream<Uint8Array>;
  readonly Stderr?: WritableStream<Uint8Array>;
  readonly RandomMode?: RandomMode;
  readonly FileSystem?: FileService;
  readonly SystemService?: SystemService;
}

export class WrapperSysAbstraction implements SysAbstraction {
  readonly _time: Time;
  readonly _stdout: WritableStream<Uint8Array>;
  readonly _stderr: WritableStream<Uint8Array>;
  readonly _idService: IdService;
  readonly _randomService: RandomService;
  readonly _fileSystem: FileService;
  readonly _systemService: SystemService;
  constructor(base: BaseSysAbstraction, params?: WrapperSysAbstractionParams) {
    this._time = base._time;
    this._stdout = base._stdout;
    this._stderr = base._stderr;
    this._idService = base._idService;
    this._randomService = base._randomService;
    this._fileSystem = base._fileSystem;
    this._systemService = base._systemService;
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
// export const BaseSysAbstraction = new BaseSysAbstractionImpl()
