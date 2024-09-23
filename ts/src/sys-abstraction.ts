import { FileService } from "./file-service.js";
import { Env } from "./sys-env.js";
import { Time } from "./time.js";

export enum TimeMode {
  REAL = "real",
  CONST = "const",
  STEP = "step",
}

export enum RandomMode {
  CONST = "const",
  STEP = "step",
  RANDOM = "random",
}

export enum IDMode {
  UUID = "uuid",
  CONST = "const",
  STEP = "step",
}

export function String2TimeMode(s?: string): TimeMode {
  switch (s?.toLowerCase()) {
    case "real":
      return TimeMode.REAL;
    case "const":
      return TimeMode.CONST;
    case "step":
      return TimeMode.STEP;
    default:
      return TimeMode.REAL;
  }
}

export type VoidFunc = () => void | Promise<void>;

export interface SystemService {
  Env(): Env;
  Args(): string[];
  OnExit(hdl: VoidFunc): VoidFunc;
  Exit(code: number): void;
}

export interface SysAbstraction {
  Time(): Time;
  Stdout(): WritableStream<Uint8Array>;
  Stderr(): WritableStream<Uint8Array>;
  NextId(): string;
  Random0ToValue(value: number): number;
  System(): SystemService;
  FileSystem(): FileService;
}
