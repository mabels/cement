export interface TxtEnDecoder {
  encode(str: string): Uint8Array;
  decode(data: Uint8Array): string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class Utf8EnDecoder implements TxtEnDecoder {
  encode(str: string): Uint8Array {
    return encoder.encode(str);
  }
  decode(data: Uint8Array): string {
    return decoder.decode(data);
  }
}

const utf8EnDecoder = new Utf8EnDecoder();
export function Utf8EnDecoderSingleton(): TxtEnDecoder {
  return utf8EnDecoder;
}
