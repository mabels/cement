export interface CTRsaOtherPrimesInfo {
  d?: string;
  r?: string;
  t?: string;
}

export interface CTJsonWebKey {
  alg?: string;
  crv?: string;
  d?: string;
  dp?: string;
  dq?: string;
  e?: string;
  ext?: boolean;
  k?: string;
  key_ops?: string[];
  kty?: string;
  n?: string;
  oth?: CTRsaOtherPrimesInfo[];
  p?: string;
  q?: string;
  qi?: string;
  use?: string;
  x?: string;
  y?: string;
}

export type CTKeyFormat = "jwk" | "pkcs8" | "raw" | "spki";
export type CTKeyUsage = "decrypt" | "deriveBits" | "deriveKey" | "encrypt" | "sign" | "unwrapKey" | "verify" | "wrapKey";

export interface CTAlgorithm {
  name: string;
}
export type CTAlgorithmIdentifier = CTAlgorithm | string;

export interface CTRsaHashedImportParams extends CTAlgorithm {
  hash: CTAlgorithmIdentifier;
}

export type CTNamedCurve = string;
export interface CTEcKeyImportParams extends CTAlgorithm {
  namedCurve: CTNamedCurve;
}

export interface CTHmacImportParams extends CTAlgorithm {
  hash: CTAlgorithmIdentifier;
  length?: number;
}

export interface CTAesKeyAlgorithm extends CTAlgorithm {
  length: number;
}

export type CTKeyType = "private" | "public" | "secret";

export interface CTCryptoKey {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/algorithm) */
  readonly algorithm: CTAlgorithm;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/extractable) */
  readonly extractable: boolean;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/type) */
  readonly type: CTKeyType;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/usages) */
  readonly usages: CTKeyUsage[];
}

interface CTArrayBufferTypes {
  ArrayBuffer: ArrayBuffer;
}
type CTArrayBufferLike = CTArrayBufferTypes[keyof CTArrayBufferTypes];

export interface CTArrayBufferView {
  /**
   * The ArrayBuffer instance referenced by the array.
   */
  buffer: CTArrayBufferLike;

  /**
   * The length in bytes of the array.
   */
  byteLength: number;

  /**
   * The offset in bytes of the array.
   */
  byteOffset: number;
}

export type CTBufferSource = CTArrayBufferView | ArrayBuffer | Uint8Array;

export interface CryptoRuntime {
  importKey(
    format: CTKeyFormat,
    keyData: CTJsonWebKey | CTBufferSource,
    algorithm: CTAlgorithmIdentifier | CTRsaHashedImportParams | CTEcKeyImportParams | CTHmacImportParams | CTAesKeyAlgorithm,
    extractable: boolean,
    keyUsages: CTKeyUsage[],
  ): Promise<CTCryptoKey>;
  exportKey(format: CTKeyFormat, key: CTCryptoKey): Promise<CTJsonWebKey | ArrayBuffer>;

  //(format: "raw", key: ArrayBuffer, algo: string, extractable: boolean, usages: string[]) => Promise<CryptoKey>;
  decrypt(algo: { name: string; iv: Uint8Array; tagLength: number }, key: CTCryptoKey, data: Uint8Array): Promise<ArrayBuffer>;
  encrypt(algo: { name: string; iv: Uint8Array; tagLength: number }, key: CTCryptoKey, data: Uint8Array): Promise<ArrayBuffer>;
  digestSHA256(data: Uint8Array): Promise<ArrayBuffer>;
  randomBytes(size: number): Uint8Array;
}

function randomBytes(crypto: typeof globalThis.crypto): CryptoRuntime["randomBytes"] {
  return (size: number): Uint8Array => {
    const bytes = new Uint8Array(size);
    if (size > 0) {
      crypto.getRandomValues(bytes);
    }
    return bytes;
  };
}

function digestSHA256(crypto: typeof globalThis.crypto): (data: Uint8Array) => Promise<ArrayBuffer> {
  return (data: Uint8Array): Promise<ArrayBuffer> => {
    return crypto.subtle.digest("SHA-256", data);
  };
}

export function toCryptoRuntime(cryptoOpts: Partial<CryptoRuntime> = {}): CryptoRuntime {
  let crypto: typeof globalThis.crypto;
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    crypto = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
      subtle: {
        importKey: (): Promise<CTCryptoKey> => {
          throw new Error("crypto.subtle.importKey not available");
        },
        exportKey: () => {
          throw new Error("crypto.subtle.exportKey not available");
        },
        encrypt: (): Promise<ArrayBuffer> => {
          throw new Error("crypto.subtle.encrypt not available");
        },
        decrypt: (): Promise<ArrayBuffer> => {
          throw new Error("crypto.subtle.decrypt not available");
        },
        digest: (): Promise<ArrayBuffer> => {
          throw new Error("crypto.subtle.digest not available");
        },
      },
    } as unknown as typeof globalThis.crypto;
  } else {
    crypto = globalThis.crypto;
  }
  const runtime = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    importKey: cryptoOpts.importKey || crypto.subtle.importKey.bind(crypto.subtle),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    exportKey: cryptoOpts.exportKey || crypto.subtle.exportKey.bind(crypto.subtle),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    encrypt: cryptoOpts.encrypt || crypto.subtle.encrypt.bind(crypto.subtle),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    decrypt: cryptoOpts.decrypt || crypto.subtle.decrypt.bind(crypto.subtle),
    randomBytes: cryptoOpts.randomBytes || randomBytes(crypto),
    digestSHA256: cryptoOpts.digestSHA256 || digestSHA256(crypto),
  };
  // console.log("cryptoOpts", cryptoOpts, opts)
  return runtime;
}
