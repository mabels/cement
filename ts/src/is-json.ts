const possibleJSONre = new RegExp(
  '^\\s*(?:\\{.*\\}|\\[.*\\]|"(?:[^"\\\\]|\\\\.)*"|true|false|null|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\s*$',
);

export interface IsJSONResult<T> {
  readonly isJSON: boolean;
  readonly parsed?: T;
}

/**
 * Checks if a string contains valid JSON and optionally parses it.
 *
 * Uses a regex pre-check to quickly eliminate non-JSON strings before attempting
 * to parse. Returns both a boolean flag and the parsed result if successful.
 *
 * @template T - The expected type of the parsed JSON (default: unknown)
 * @param str - The string to check and parse
 * @returns Object with isJSON boolean and optional parsed value
 *
 * @example
 * ```typescript
 * const result = isJSON<{ name: string }>('{"name": "Alice"}');
 * if (result.isJSON) {
 *   console.log(result.parsed.name); // "Alice"
 * }
 *
 * const invalid = isJSON('not json');
 * console.log(invalid.isJSON); // false
 * ```
 */
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
