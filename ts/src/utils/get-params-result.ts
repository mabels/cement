import { Result } from "../result.js";
import { param } from "../types.js";

export type MsgFn = (...keys: string[]) => string;
export type KeysParam = (string | MsgFn | Record<string, param | number | string | boolean | undefined | null>)[];

export function getParamsResult(
  keys: KeysParam,
  getParam: { getParam: (key: string) => string | undefined },
): Result<Record<string, string>> {
  const keyDef = keys.flat().reduce(
    (acc, i) => {
      if (typeof i === "string") {
        acc.push({ key: i, def: undefined, isOptional: false });
      } else if (typeof i === "object") {
        acc.push(
          ...Object.keys(i).map((k) => ({
            key: k,
            def: typeof i[k] === "string" ? i[k] : undefined,
            isOptional: i[k] === param.OPTIONAL,
          })),
        );
      }
      return acc;
    },
    [] as { key: string; def?: string; isOptional: boolean }[],
  );
  //.filter((k) => typeof k === "string");
  const msgFn =
    keys.find((k) => typeof k === "function") ||
    ((...keys: string[]): string => {
      const msg = keys.join(",");
      return `missing parameters: ${msg}`;
    });
  const errors: string[] = [];
  const result: Record<string, string> = {};
  for (const kd of keyDef) {
    const val = getParam.getParam(kd.key);
    if (val === undefined) {
      if (typeof kd.def === "string") {
        result[kd.key] = kd.def;
      } else {
        if (!kd.isOptional) {
          errors.push(kd.key);
        }
      }
    } else {
      result[kd.key] = val;
    }
  }
  if (errors.length) {
    return Result.Err(msgFn(...errors));
  }
  return Result.Ok(result);
}
