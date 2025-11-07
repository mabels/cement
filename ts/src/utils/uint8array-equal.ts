/**
 * Compares two Uint8Arrays for byte-by-byte equality.
 *
 * Returns true only if both arrays have the same length and identical
 * bytes at every position. Useful for comparing binary data, hashes, etc.
 *
 * @param a - First Uint8Array to compare
 * @param b - Second Uint8Array to compare
 * @returns True if arrays are equal, false otherwise
 *
 * @example
 * ```typescript
 * const a = new Uint8Array([1, 2, 3]);
 * const b = new Uint8Array([1, 2, 3]);
 * const c = new Uint8Array([1, 2, 4]);
 *
 * UInt8ArrayEqual(a, b); // true
 * UInt8ArrayEqual(a, c); // false
 * ```
 */
export function UInt8ArrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
