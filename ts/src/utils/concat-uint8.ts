/**
 * Concatenates multiple Uint8Arrays into a single Uint8Array.
 *
 * Allocates a single buffer and copies each array into it, which is
 * more efficient than spread-based approaches for many or large arrays.
 *
 * @param arrays - Zero or more Uint8Arrays to concatenate
 * @returns A new Uint8Array containing all bytes in order
 *
 * @example
 * ```typescript
 * const a = new Uint8Array([1, 2, 3]);
 * const b = new Uint8Array([4, 5]);
 * const c = new Uint8Array([6]);
 *
 * concatUint8(a, b, c); // Uint8Array([1, 2, 3, 4, 5, 6])
 * concatUint8();         // Uint8Array([])
 * concatUint8(a);        // Uint8Array([1, 2, 3])
 * ```
 */
export function concatUint8(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
