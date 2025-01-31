import { Result } from "./result.js";
import { coerceIntoUint8, ToUInt8 } from "./utils/coerce-uint8.js";

export type ToEnDecoder = ToUInt8 | string | Result<string>;
export type AsyncToEnDecoder = ToEnDecoder | Blob | Promise<ToEnDecoder | Blob>;

export interface TxtEnDecoder {
  encode(input: string): Uint8Array;
  decode(input: ToEnDecoder): string;
  asyncDecode(input: AsyncToEnDecoder): Promise<string>;
}

class TxtOps implements TxtEnDecoder {
  readonly encoder = new TextEncoder();
  readonly decoder = new TextDecoder();

  encode(str: string): Uint8Array {
    return this.encoder.encode(str);
  }
  decode(data: ToEnDecoder): string {
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

  async asyncDecode(data: AsyncToEnDecoder): Promise<string> {
    let resolved = await data;
    if (resolved instanceof Blob) {
      resolved = await resolved.arrayBuffer();
    }
    return this.decode(resolved);
  }
}

let txtEnDecoder: TxtEnDecoder;
export function TxtEnDecoderSingleton(): TxtEnDecoder {
  txtEnDecoder = txtEnDecoder ?? new TxtOps();
  return txtEnDecoder;
}
