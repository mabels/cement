import { TxtEnDecoder, Utf8EnDecoderSingleton } from "../txt-en-decoder.ts";

export function string2stream(str: string, ende: TxtEnDecoder = Utf8EnDecoderSingleton()): ReadableStream<Uint8Array> {
  return uint8array2stream(ende.encode(str));
}

export function uint8array2stream(str: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller): void {
      controller.enqueue(str);
      controller.close();
    },
  });
}
