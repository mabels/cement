const possibleJSONre = new RegExp(
  '^\\s*(?:\\{.*\\}|\\[.*\\]|"(?:[^"\\\\]|\\\\.)*"|true|false|null|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\s*$',
);

export interface IsJSONResult<T> {
  readonly isJSON: boolean;
  readonly parsed?: T;
}

export function isJSON<T = unknown>(str: string): IsJSONResult<T> {
  if (possibleJSONre.test(str)) {
    try {
      const parsed = JSON.parse(str) as T;
      return { isJSON: true, parsed };
    } catch {
      /* noop */
    }
  }
  return { isJSON: false };
}
