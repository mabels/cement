import { Result } from "../result.js";

// Tested in txt-en-decoder.test.ts

interface GlobalBuffer {
  Buffer?: {
    isBuffer: (obj: unknown) => obj is {
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

/**
 * Coerces various binary types into Uint8Array with Result-based error handling.
 *
 * Converts ArrayBuffer, ArrayBufferView, Node.js Buffer, or Result-wrapped values
 * into Uint8Array. Returns Result.Err for unsupported types like Blob (use
 * asyncCoerceIntoUint8 for Blobs). Handles Result-wrapped inputs by unwrapping
 * and recursively coercing.
 *
 * @param raw - Binary data to coerce (ArrayBuffer, TypedArray, Buffer, or Result-wrapped)
 * @returns Result.Ok with Uint8Array or Result.Err with error message
 *
 * @example
 * ```typescript
 * // ArrayBuffer
 * const result1 = coerceIntoUint8(new ArrayBuffer(10));
 * if (result1.isOk()) {
 *   const bytes = result1.unwrap(); // Uint8Array
 * }
 *
 * // TypedArray
 * const result2 = coerceIntoUint8(new Int32Array([1, 2, 3]));
 *
 * // Result-wrapped input
 * const wrapped = Result.Ok(new ArrayBuffer(5));
 * const result3 = coerceIntoUint8(wrapped); // Unwraps and converts
 *
 * // Blob not supported (use asyncCoerceIntoUint8)
 * const result4 = coerceIntoUint8(new Blob(['data']));
 * // Returns Result.Err("Blob not supported")
 * ```
 */
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

/**
 * Asynchronously coerces various binary types including Blob into Uint8Array.
 *
 * Handles all types supported by coerceIntoUint8 plus async operations:
 * - Promise-wrapped values
 * - Blob (converts via arrayBuffer())
 * - Result-wrapped Promises
 *
 * @param raw - Binary data or Promise thereof (including Blob)
 * @returns Promise resolving to Result.Ok with Uint8Array or Result.Err
 *
 * @example
 * ```typescript
 * // Blob support
 * const blob = new Blob(['Hello, World!']);
 * const result1 = await asyncCoerceIntoUint8(blob);
 * if (result1.isOk()) {
 *   const bytes = result1.unwrap();
 * }
 *
 * // Promise-wrapped
 * const promise = fetch('/data').then(r => r.arrayBuffer());
 * const result2 = await asyncCoerceIntoUint8(promise);
 *
 * // Result-wrapped Promise
 * const wrapped = Promise.resolve(Result.Ok(new ArrayBuffer(10)));
 * const result3 = await asyncCoerceIntoUint8(wrapped);
 * ```
 */
export async function asyncCoerceIntoUint8(raw: AsyncToUInt8): Promise<Result<Uint8Array>> {
  let resolved = await raw;
  if (resolved instanceof Blob) {
    resolved = await resolved.arrayBuffer();
  }
  return coerceIntoUint8(resolved as ToUInt8);
}
