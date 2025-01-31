import { TxtEnDecoder, TxtEnDecoderSingleton } from "../txt-en-decoder.js";

export function string2stream(str: string, ende: TxtEnDecoder = TxtEnDecoderSingleton()): ReadableStream<Uint8Array> {
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
