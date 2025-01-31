import { exception2Result, Result } from "./result.js";
import { AsyncToEnDecoder, ToEnDecoder, TxtEnDecoder, Utf8EnDecoderSingleton } from "./txt-en-decoder.js";

export interface JSONEndeCoder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stringify<T>(input: Result<T> | T, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string;
  asyncStringify<T>(
    input: Promise<Result<T> | T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    replacer?: (this: any, key: string, value: any) => any,
    space?: string | number,
  ): Promise<string>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uint8ify<T>(input: Result<T> | T, replacer?: (this: any, key: string, value: any) => any, space?: string | number): Uint8Array;
  asyncUint8ify<T>(
    input: Promise<Result<T> | T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    replacer?: (this: any, key: string, value: any) => any,
    space?: string | number,
  ): Promise<Uint8Array>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse<T>(input: ToEnDecoder, reviver?: (this: any, key: string, value: any) => any): Result<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asyncParse<T>(input: AsyncToEnDecoder, reviver?: (this: any, key: string, value: any) => any): Promise<Result<T>>;
}

class JSONOps implements JSONEndeCoder {
  readonly txtOps: TxtEnDecoder;
  constructor(txtOps: TxtEnDecoder) {
    this.txtOps = txtOps;
  }
  async asyncStringify<T>(
    input: Promise<Result<T> | T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    replacer?: (this: any, key: string, value: any) => any,
    space?: string | number,
  ): Promise<string> {
    const resolved = await input;
    return this.stringify(resolved, replacer, space);
  }
  async asyncUint8ify<T>(
    input: Promise<Result<T> | T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    replacer?: (this: any, key: string, value: any) => any,
    space?: string | number,
  ): Promise<Uint8Array> {
    const resolved = await input;
    return this.uint8ify(resolved, replacer, space);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async asyncParse<T>(input: AsyncToEnDecoder, reviver?: (this: any, key: string, value: any) => any): Promise<Result<T>> {
    return this.parse(await this.txtOps.asyncDecode(input), reviver);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stringify<T>(input: Result<T> | T, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string {
    return JSON.stringify(Result.Is(input) ? input.unwrap() : input, replacer, space);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uint8ify<T>(input: Result<T> | T, replacer?: (this: any, key: string, value: any) => any, space?: string | number): Uint8Array {
    return this.txtOps.encode(this.stringify(input, replacer, space));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse<T>(input: ToEnDecoder, reviver?: (this: any, key: string, value: any) => any): Result<T> {
    return exception2Result(() => JSON.parse(this.txtOps.decode(input), reviver) as T) as Result<T>;
  }
}

let jsonEnCoder: JSONEndeCoder;
export function JSONEnDecoderSingleton(txtEnde?: TxtEnDecoder): JSONEndeCoder {
  let needNew = false;
  if (txtEnde && txtEnde !== Utf8EnDecoderSingleton()) {
    needNew = !!txtEnde;
    txtEnde = txtEnde ?? Utf8EnDecoderSingleton();
  }
  if (needNew && txtEnde) {
    return new JSONOps(txtEnde);
  }
  jsonEnCoder = jsonEnCoder ?? new JSONOps(Utf8EnDecoderSingleton());
  return jsonEnCoder;
}
