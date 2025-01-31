import { Result } from "../result.js";

// Tested in txt-en-decoder.test.ts

interface GlobalBuffer {
  Buffer?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isBuffer: (obj: any) => obj is {
      buffer: ArrayBufferLike;
      byteOffset: number;
      byteLength: number;
    };
  };
}
const globalBuffer = globalThis as GlobalBuffer;

export type ToUInt8Plain = Uint8Array | ArrayBuffer | ArrayBufferView;
export type ToUInt8Async = ToUInt8Plain | Blob;
export type ToUInt8 = ToUInt8Plain | Result<ToUInt8Plain>;
export type AsyncToUInt8 = ToUInt8Async | Result<ToUInt8Async> | Promise<ToUInt8Async> | Promise<Result<ToUInt8Async>>;

export function coerceIntoUint8(raw: ToUInt8): Result<Uint8Array> {
  if (raw instanceof ArrayBuffer) {
    return Result.Ok(new Uint8Array(raw));
  }
  if (ArrayBuffer.isView(raw)) {
    return Result.Ok(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  if (raw instanceof Blob) {
    return Result.Err("Blob not supported");
  }
  if (globalBuffer.Buffer && globalBuffer.Buffer.isBuffer(raw)) {
    return Result.Ok(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
  }
  if (raw instanceof Uint8Array) {
    return Result.Ok(raw);
  }
  if (Result.Is(raw)) {
    if (raw.isErr()) {
      return Result.Err(raw);
    }
    return coerceIntoUint8(raw.unwrap());
  }
  return Result.Err("Not a Uint8Array");
}

export async function asyncCoerceIntoUint8(raw: AsyncToUInt8): Promise<Result<Uint8Array>> {
  let resolved = await raw;
  if (resolved instanceof Blob) {
    resolved = await resolved.arrayBuffer();
  }
  return coerceIntoUint8(resolved as ToUInt8);
}
