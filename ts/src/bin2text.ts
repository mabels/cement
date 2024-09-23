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
