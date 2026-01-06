import { FileService } from "./file-service.js";
import { Env } from "./sys-env.js";
import { Time } from "./time.js";

export const TimeMode = {
  REAL: "real",
  CONST: "const",
  STEP: "step",
};
export type TimeMode = (typeof TimeMode)[keyof typeof TimeMode];

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
  OnExit(hdl: VoidFunc): VoidFunc;
  Exit(code: number): void;
}

export interface RuntimeSysAbstraction extends BasicSysAbstraction {
  System(): SystemService;
  FileSystem(): FileService;
}

export interface BasicRuntimeService {
  Stdout(): WritableStream<Uint8Array>;
  Stderr(): WritableStream<Uint8Array>;
  Env(): Env;
  Args(): string[];
}

export interface BasicSysAbstraction extends BasicRuntimeService {
  Time(): Time;
  NextId(): string;
  Random0ToValue(value: number): number;
}
