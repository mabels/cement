import { FileService } from "./file-service.js";
import { runtimeFn } from "./runtime.js";
import {
  TimeMode,
  RandomMode,
  IDMode,
  SystemService,
  VoidFunc,
  BasicSysAbstraction,
  type BasicRuntimeService,
} from "./sys-abstraction.js";
import { Time } from "./time.js";
import { TxtEnDecoder } from "./txt-en-decoder.js";
import { WebBasicSysAbstraction } from "./web/web-basic-sys-abstraction.js";
import { Env } from "./sys-env.js";
import { CFBasicSysAbstraction } from "./cf/cf-basic-sys-abstraction.js";
import { DenoBasicSysAbstraction } from "./deno/deno-basic-sys-abstraction.js";
import { NodeBasicSysAbstraction } from "./node/node-basic-sys-abstraction.js";

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
  readonly _start: Date;
  constructor() {
    super();
    this._step = new ConstTime().Now();
    this._start = this._step;
  }
  Now(steps = 1): Date {
    // if (this._step.getTime() === 0) {
    //   this._step = new ConstTime().Now();
    //   return this._step;
    // }
    for (let i = 0; steps > 0 && i < steps; i++) {
      this._step = new Date(this._step.getTime() + 1000);
    }
    if (steps < 1) {
      this._step = new Date(this._start.getTime() + steps * -1000);
    }
    // this._step = new Date(this._step.getTime() + 1000);
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

export interface BaseBasicSysAbstractionParams {
  readonly TxtEnDecoder: TxtEnDecoder;
}

export interface BaseSysAbstractionParams extends BaseBasicSysAbstractionParams {
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

// some black magic to make it work with CF workers

export class BaseBasicSysAbstraction {
  readonly _time: SysTime = new SysTime();

  // system independent services
  readonly _idService: IdService = new IdService();
  readonly _randomService: RandomService = new RandomService(RandomMode.RANDOM);
  readonly _txtEnDe: TxtEnDecoder;

  constructor(params: BaseBasicSysAbstractionParams) {
    this._txtEnDe = params.TxtEnDecoder;
  }
}

export class BaseSysAbstraction extends BaseBasicSysAbstraction {
  // system related services
  readonly _fileSystem: FileService;
  readonly _systemService: SystemService;

  constructor(params: BaseSysAbstractionParams) {
    super(params);
    this._fileSystem = params.FileSystem;
    this._systemService = params.SystemService;
  }
}

export interface BasicSysAbstractionParams {
  readonly TimeMode: TimeMode;
  readonly IdMode: IDMode;
  readonly RandomMode: RandomMode;
  // readonly FileSystem: FileService;
  // readonly SystemService: SystemService;
  readonly TxtEnDecoder: TxtEnDecoder;
  // readonly BasicRuntimeService: BasicSysAbstraction;
}

export type WrapperBasicSysAbstractionParams = Partial<BasicRuntimeService & BasicSysAbstractionParams>;

export function BasicSysAbstractionFactory(params?: WrapperBasicSysAbstractionParams): BasicSysAbstraction {
  const fn = runtimeFn();
  switch (true) {
    case fn.isBrowser:
      return WebBasicSysAbstraction(params);
    case fn.isDeno:
      return DenoBasicSysAbstraction(params);
    case fn.isCFWorker:
      return CFBasicSysAbstraction(params);
    case fn.isNodeIsh:
      return NodeBasicSysAbstraction(params);
    default:
      throw new Error("Unknown runtime");
  }
}

export class WrapperBasicSysAbstraction implements BasicSysAbstraction {
  readonly _time: Time;
  readonly _idService: IdService;
  readonly _randomService: RandomService;
  readonly _basicRuntimeService: BasicRuntimeService;
  constructor(
    base: BaseBasicSysAbstraction,
    params: Partial<BasicSysAbstractionParams> & { basicRuntimeService: BasicRuntimeService },
  ) {
    this._time = base._time;
    this._basicRuntimeService = params.basicRuntimeService;
    this._idService = base._idService;
    this._randomService = base._randomService;
    if (params.TimeMode) {
      this._time = TimeFactory(params.TimeMode);
    }
    if (params.IdMode) {
      this._idService = new IdService(params.IdMode);
    }
    if (params.RandomMode) {
      this._randomService = new RandomService(params.RandomMode);
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
    return this._basicRuntimeService.Stdout();
  }
  Stderr(): WritableStream {
    return this._basicRuntimeService.Stderr();
  }
  Env(): Env {
    return this._basicRuntimeService.Env();
  }
  Args(): string[] {
    return this._basicRuntimeService.Args();
  }

  // System(): SystemService {
  //   return this._systemService;
  // }
  // FileSystem(): FileService {
  //   return this._fileSystem;
  // }
}
// export const BaseSysAbstraction = new BaseSysAbstractionImpl()

export class WrapperRuntimeSysAbstraction extends WrapperBasicSysAbstraction {
  readonly _systemService: SystemService;
  readonly _fileSystem: FileService;
  constructor(
    base: BaseSysAbstraction,
    params: Partial<BaseBasicSysAbstraction> & {
      systemService?: SystemService;
      fileSystem?: FileService;
      basicRuntimeService: BasicRuntimeService;
    },
  ) {
    super(base, params);
    this._systemService = params.systemService ?? base._systemService;
    this._fileSystem = params.fileSystem ?? base._fileSystem;
  }

  System(): SystemService {
    return this._systemService;
  }
  FileSystem(): FileService {
    return this._fileSystem;
  }
}
