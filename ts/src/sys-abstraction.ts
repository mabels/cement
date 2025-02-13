import { FileService } from "./file-service.js";
import { Env } from "./sys-env.js";
import { Time } from "./time.js";

export const TimeMode = {
  REAL: "real",
  CONST: "const",
  STEP: "step",
};
export type TimeMode = (typeof TimeMode)[keyof typeof TimeMode];

export const RandomMode = {
  CONST: "const",
  STEP: "step",
  RANDOM: "random",
};
export type RandomMode = (typeof RandomMode)[keyof typeof RandomMode];

export const IDMode = {
  UUID: "uuid",
  CONST: "const",
  STEP: "step",
};
export type IDMode = (typeof IDMode)[keyof typeof IDMode];

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
