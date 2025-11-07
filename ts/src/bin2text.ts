/**
 * Formats binary data as hexdump output with ASCII representation.
 *
 * Produces hexdump-style output similar to `xxd` or `hexdump` commands,
 * showing hex values and ASCII characters side-by-side. Each line shows
 * 16 bytes with offset, hex values, and printable ASCII characters.
 *
 * @param hex - Binary data to format (any ArrayBufferView)
 * @param lineFn - Callback function invoked for each formatted line
 * @param size - Maximum number of bytes to format (0 = all bytes)
 *
 * @example
 * ```typescript
 * const data = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]);
 * bin2text(data, (line) => console.log(line));
 * // Output:
 * // 0000   48 65 6c 6c 6f 20 57 6f 72 6c 64       Hello World
 * ```
 */
export function bin2text(hex: ArrayBufferView, lineFn: (line: string) => void, size = 0): void {
  const arr = new Uint8Array(hex.buffer, hex.byteOffset, hex.byteLength);
  let cutted = "  ";
  if (size == 0) {
    size = arr.length;
  }
  size = Math.min(size, arr.length);
  const cols = 16;
  for (let line = 0; line < size; line += cols) {
    if (line + cols <= size || arr.length == size) {
      // normal line
    } else {
      line = arr.length - (arr.length % cols);
      size = arr.length;
      cutted = ">>";
    }
    const l: string[] = [line.toString(16).padStart(4, "0"), cutted];
    for (let col = 0; col < cols; col++) {
      if (line + col < size) {
        l.push(arr[line + col].toString(16).padStart(2, "0"));
      } else {
        l.push("  ");
      }
      // l.push((col > 0 && col % 4 === 3) ? " " : " ");
      l.push(" ");
    }
    for (let col = 0; col < cols; col++) {
      if (line + col < size) {
        const ch = arr[line + col];
        l.push(ch >= 32 && ch < 127 ? String.fromCharCode(ch) : ".");
      }
    }
    lineFn(l.join(""));
  }
}

/**
 * Formats binary data as a hexdump string.
 *
 * Convenience wrapper around bin2text that returns a single string with
 * newline-separated hexdump lines. Useful for logging or display purposes.
 *
 * @param hex - Binary data to format (any ArrayBufferView)
 * @param size - Maximum number of bytes to format (0 = all bytes)
 * @returns Formatted hexdump as a string
 *
 * @example
 * ```typescript
 * const data = new Uint8Array([72, 101, 108, 108, 111]);
 * const dump = bin2string(data);
 * console.log(dump);
 * // 0000   48 65 6c 6c 6f                       Hello
 * ```
 */
export function bin2string(hex: ArrayBufferView, size = 0): string {
  const collector: string[] = [];
  bin2text(
    hex,
    (line) => {
      collector.push(line);
    },
    size,
  );
  return collector.join("\n");
}
