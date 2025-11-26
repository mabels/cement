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
import { WebBasicSysAbstraction } from "./web-env/index.js";
import { Env } from "./sys-env.js";
import { CFBasicSysAbstraction } from "./cf-env/index.js";
import { DenoBasicSysAbstraction } from "./deno-env/index.js";
import { NodeBasicSysAbstraction } from "./node-env/index.js";
import { WithCement } from "@adviser/cement";
import { addCement } from "./add-cement-do-not-export.js";

/**
 * Real-time implementation using system clock.
 *
 * Provides actual current time and real delays. Use for production code.
 */
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

/**
 * Constant time implementation for deterministic testing.
 *
 * Always returns the same fixed date (2021-02-01). Sleep operations
 * complete immediately without delay. Useful for reproducible tests.
 */
export class ConstTime extends Time {
  Now(): Date {
    return new Date(2021, 1, 1, 0, 0, 0, 0);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Sleep(duration: number): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Stepped time implementation for controlled testing.
 *
 * Advances time in 1-second increments on each Now() call. Sleep operations
 * advance time without delay. Useful for testing time-dependent behavior.
 */
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

/**
 * Creates a Time implementation based on the specified mode.
 *
 * @param timeMode - Time behavior mode (REAL, CONST, or STEP)
 * @returns Time implementation matching the mode
 *
 * @example
 * ```typescript
 * // Production: uses real system time
 * const realTime = TimeFactory(TimeMode.REAL);
 *
 * // Testing: constant time
 * const constTime = TimeFactory(TimeMode.CONST);
 *
 * // Testing: stepped time
 * const stepTime = TimeFactory(TimeMode.STEP);
 * ```
 */
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

/**
 * Random number generator with deterministic modes for testing.
 *
 * Provides random number generation that can operate in different modes:
 * - RANDOM: Uses Math.random() for real random values
 * - CONST: Always returns a constant value (0.5 * max) for reproducible tests
 * - STEP: Returns incrementing values for predictable test sequences
 *
 * @example
 * ```typescript
 * // Production: real randomness
 * const random = new RandomService(RandomMode.RANDOM);
 * const value = random.Random0ToValue(100); // 0-100
 *
 * // Testing: constant value
 * const constRandom = new RandomService(RandomMode.CONST);
 * const value = constRandom.Random0ToValue(100); // Always 50
 *
 * // Testing: stepped sequence
 * const stepRandom = new RandomService(RandomMode.STEP);
 * const v1 = stepRandom.Random0ToValue(100); // 0.01
 * const v2 = stepRandom.Random0ToValue(100); // 0.02
 * ```
 */
export class RandomService {
  readonly _mode: RandomMode;
  _step = 0;
  constructor(mode: RandomMode) {
    this._mode = mode;
  }
  /**
   * Generates a random number between 0 and the specified value.
   *
   * @param value - Maximum value (exclusive upper bound)
   * @returns Random number in range [0, value)
   */
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

/**
 * ID generator with deterministic modes for testing.
 *
 * Generates unique identifiers with support for different modes:
 * - UUID: Uses crypto.randomUUID() for real UUIDs (default)
 * - CONST: Always returns the same constant ID for reproducible tests
 * - STEP: Returns incrementing IDs (STEPId-0, STEPId-1, etc.) for predictable sequences
 *
 * @example
 * ```typescript
 * // Production: real UUIDs
 * const idService = new IdService(IDMode.UUID);
 * const id = idService.NextId(); // "550e8400-e29b-41d4-a716-446655440000"
 *
 * // Testing: constant ID
 * const constId = new IdService(IDMode.CONST);
 * const id1 = constId.NextId(); // "VeryUniqueID"
 * const id2 = constId.NextId(); // "VeryUniqueID"
 *
 * // Testing: stepped sequence
 * const stepId = new IdService(IDMode.STEP);
 * const id1 = stepId.NextId(); // "STEPId-0"
 * const id2 = stepId.NextId(); // "STEPId-1"
 * ```
 */
export class IdService {
  readonly _mode: IDMode;
  _step = 0;
  constructor(mode?: IDMode) {
    if (!mode) {
      mode = IDMode.UUID;
    }
    this._mode = mode;
  }
  /**
   * Generates the next unique identifier.
   *
   * @returns Unique ID string based on the configured mode
   */
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

/**
 * Base system abstraction for platform-independent services.
 *
 * Provides core services that work across all JavaScript runtimes:
 * - Time: Real system time implementation
 * - ID Generation: UUID-based unique identifiers
 * - Random Numbers: Math.random()-based generation
 * - Text Encoding/Decoding: UTF-8 conversion utilities
 *
 * This is the foundation for both basic and full system abstractions,
 * containing services that don't require filesystem or system access.
 *
 * @example
 * ```typescript
 * const base = new BaseBasicSysAbstraction({
 *   TxtEnDecoder: new TxtEnDecoder()
 * });
 *
 * const now = base._time.Now();
 * const id = base._idService.NextId();
 * const random = base._randomService.Random0ToValue(100);
 * ```
 */
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

/**
 * Full system abstraction with filesystem and system service access.
 *
 * Extends BaseBasicSysAbstraction with platform-specific services:
 * - FileSystem: File I/O operations
 * - SystemService: Process, environment, and system-level operations
 *
 * Used in Node.js and Deno environments where full system access is available.
 * Not suitable for browser or Cloudflare Workers environments.
 *
 * @example
 * ```typescript
 * const sys = new BaseSysAbstraction({
 *   TxtEnDecoder: new TxtEnDecoder(),
 *   FileSystem: new NodeFileService(),
 *   SystemService: new NodeSystemService()
 * });
 *
 * // Access filesystem
 * const content = await sys._fileSystem.readFile('/path/to/file');
 *
 * // Access environment
 * const env = sys._systemService.getEnv();
 * ```
 */
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

export type BaseBasicRuntimeSysAbstractionParams =
  | (BasicRuntimeService & BasicSysAbstractionParams)
  | (BasicRuntimeService & BaseSysAbstractionParams);

export type WithCementWrapperSysAbstractionParams = WithCement<Partial<BaseBasicRuntimeSysAbstractionParams>>;
/**
 * Creates a BasicSysAbstraction instance for the current runtime environment.
 *
 * Automatically detects the JavaScript runtime (Browser, Node.js, Deno, or
 * Cloudflare Workers) and returns the appropriate system abstraction implementation.
 * Supports optional configuration for time, ID, and random number generation modes,
 * useful for testing with deterministic behavior.
 *
 * @param params - Optional configuration for time, ID, and random modes
 * @returns BasicSysAbstraction instance for the current runtime
 * @throws Error if the runtime cannot be detected
 *
 * @example
 * ```typescript
 * // Production: auto-detect runtime with defaults
 * const sys = BasicSysAbstractionFactory();
 * const now = sys.Time().Now();
 * const id = sys.NextId();
 *
 * // Testing: deterministic behavior
 * const testSys = BasicSysAbstractionFactory({
 *   TimeMode: TimeMode.CONST,
 *   IdMode: IDMode.STEP,
 *   RandomMode: RandomMode.CONST
 * });
 * const constTime = testSys.Time().Now(); // Always 2021-02-01
 * const id1 = testSys.NextId(); // "STEPId-0"
 * const id2 = testSys.NextId(); // "STEPId-1"
 * ```
 */

export function BasicSysAbstractionFactory(params?: WrapperBasicSysAbstractionParams): BasicSysAbstraction {
  const fn = runtimeFn();
  switch (true) {
    case fn.isBrowser:
      return WebBasicSysAbstraction(addCement(params));
    case fn.isDeno:
      return DenoBasicSysAbstraction(addCement(params));
    case fn.isCFWorker:
      return CFBasicSysAbstraction(addCement(params));
    case fn.isNodeIsh:
      return NodeBasicSysAbstraction(addCement(params));
    default:
      throw new Error("Unknown runtime");
  }
}

/**
 * BasicSysAbstraction implementation with configurable service modes.
 *
 * Wraps a base system abstraction and allows overriding time, ID, and random
 * number generation modes. This is the primary implementation returned by
 * BasicSysAbstractionFactory and provides the unified interface for all
 * platform-independent system services.
 *
 * Delegates runtime-specific operations (Stdout, Stderr, Env, Args) to the
 * underlying runtime service while providing configurable implementations for
 * testable services (Time, ID, Random).
 *
 * @example
 * ```typescript
 * // Created via factory
 * const sys = BasicSysAbstractionFactory({
 *   TimeMode: TimeMode.STEP,
 *   IdMode: IDMode.UUID,
 *   RandomMode: RandomMode.RANDOM
 * });
 *
 * // Use time service
 * const time = sys.Time();
 * const now = time.Now();
 * await time.Sleep(1000);
 *
 * // Use ID service
 * const id = sys.NextId();
 *
 * // Use random service
 * const random = sys.Random0ToValue(100);
 *
 * // Access runtime services
 * const stdout = sys.Stdout();
 * const env = sys.Env();
 * const args = sys.Args();
 * ```
 */
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

/**
 * Full system abstraction with filesystem and system service access.
 *
 * Extends WrapperBasicSysAbstraction with filesystem and system services,
 * providing the complete system abstraction interface. Used in environments
 * with full system access (Node.js, Deno) where filesystem operations,
 * process management, and environment access are available.
 *
 * Inherits all configurable services from WrapperBasicSysAbstraction (Time,
 * ID, Random) and adds FileSystem and SystemService access.
 *
 * @example
 * ```typescript
 * // Created via runtime-specific factory
 * const sys = NodeSysAbstraction({
 *   TimeMode: TimeMode.REAL,
 *   IdMode: IDMode.UUID
 * });
 *
 * // Use basic services
 * const time = sys.Time();
 * const id = sys.NextId();
 *
 * // Use filesystem
 * const fs = sys.FileSystem();
 * const content = await fs.readFile('/path/to/file');
 *
 * // Use system services
 * const system = sys.System();
 * const env = system.getEnv();
 * system.exit(0);
 * ```
 */
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
