import { Lazy } from "./resolve-once.js";
import { Result } from "./result.js";
import { coerceIntoUint8, ToUInt8 } from "./utils/coerce-uint8.js";

export type ToDecoder = ToUInt8 | string | Result<string>;
export type AsyncToDecoder = ToDecoder | Blob | Promise<ToDecoder | Blob>;

export interface TxtEnDecoder {
  encode(input: string): Uint8Array;
  decode(input?: ToDecoder): string;
  asyncDecode(input?: AsyncToDecoder): Promise<string>;
}

class TxtOps implements TxtEnDecoder {
  readonly encoder = new TextEncoder();
  readonly decoder = new TextDecoder();

  encode(str: string): Uint8Array {
    return this.encoder.encode(str);
  }
  decode(data?: ToDecoder): string {
    if (!data) {
      return "";
    }
    if (Result.Is(data)) {
      if (data.isErr()) {
        throw data.Err();
      }
      // only for string let do coerceInto the work
      const unwrapped = data.unwrap();
      if (typeof unwrapped === "string") {
        return this.decode(unwrapped);
      }
    }
    if (typeof data === "string") {
      return data;
    }
    return this.decoder.decode(coerceIntoUint8(data as ToUInt8).Ok());
  }

  async asyncDecode(data?: AsyncToDecoder): Promise<string> {
    if (!data) {
      return "";
    }
    let resolved = await data;
    if (resolved instanceof Blob) {
      resolved = await resolved.arrayBuffer();
    }
    return this.decode(resolved);
  }
}

export const TxtEnDecoderSingleton: () => TxtEnDecoder = Lazy((): TxtEnDecoder => new TxtOps());
