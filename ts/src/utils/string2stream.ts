export function string2stream(str: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return uint8array2stream(encoder.encode(str));
}

export function uint8array2stream(str: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(str);
      controller.close();
    },
  });
}
