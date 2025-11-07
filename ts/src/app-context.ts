/**
 * Type guard to check if a value is an AppContext instance.
 *
 * @param ctx - Value to check
 * @returns True if value is an AppContext instance
 *
 * @example
 * ```typescript
 * const ctx = new AppContext();
 * if (isAppContext(ctx)) {
 *   ctx.set('key', 'value');
 * }
 * ```
 */
export function isAppContext(ctx: unknown): ctx is AppContext {
  return AppContext.is(ctx);
}

/**
 * Context container for storing and retrieving runtime values.
 *
 * AppContext provides a type-safe key-value store for application configuration
 * and runtime state. Useful for passing configuration like URLs, credentials,
 * or other runtime parameters through an application.
 *
 * @example
 * ```typescript
 * const ctx = new AppContext();
 * ctx.set('apiUrl', 'https://api.example.com');
 * ctx.set('timeout', 5000);
 *
 * const url = ctx.get<string>('apiUrl');
 * const timeout = ctx.get<number>('timeout');
 * ```
 */
export class AppContext {
  private readonly ctx: Map<string, unknown> = new Map<string, unknown>();

  /**
   * Type guard to check if a value is an AppContext instance.
   *
   * @param ctx - Value to check
   * @returns True if value is an AppContext instance
   */
  static is(ctx: unknown): ctx is AppContext {
    return ctx instanceof AppContext && "ctx" in ctx && ctx.ctx instanceof Map;
  }

  /**
   * Merges multiple contexts or objects into a single AppContext.
   *
   * Combines values from multiple AppContext instances or plain objects.
   * Later values overwrite earlier ones for duplicate keys. Undefined values
   * are skipped.
   *
   * @param ctxs - AppContext instances, plain objects, or undefined values to merge
   * @returns New AppContext containing merged values
   *
   * @example
   * ```typescript
   * const ctx1 = new AppContext().set('a', 1).set('b', 2);
   * const ctx2 = new AppContext().set('b', 3).set('c', 4);
   * const obj = { d: 5 };
   *
   * const merged = AppContext.merge(ctx1, ctx2, obj);
   * // Contains: { a: 1, b: 3, c: 4, d: 5 }
   * ```
   */
  static merge(...ctxs: (AppContext | undefined | Record<string, unknown>)[]): AppContext {
    const merged = new AppContext();
    for (const ctx of ctxs) {
      if (!ctx) continue;
      let entries: [string, unknown][] = [];
      if (isAppContext(ctx)) {
        entries = Array.from(ctx.ctx.entries());
      } else if (typeof ctx === "object" && ctx !== null) {
        entries = Object.entries(ctx);
      }
      for (const [key, value] of entries) {
        merged.ctx.set(key, value);
      }
    }
    return merged;
  }

  /**
   * Sets a value in the context.
   *
   * @template T - Type of the value being stored
   * @param key - Key to store the value under
   * @param value - Value to store
   * @returns This AppContext instance for chaining
   *
   * @example
   * ```typescript
   * ctx.set('apiUrl', 'https://api.example.com')
   *    .set('timeout', 5000)
   *    .set('retries', 3);
   * ```
   */
  set<T>(key: string, value: T): AppContext {
    this.ctx.set(key, value);
    return this;
  }

  /**
   * Retrieves a value from the context.
   *
   * @template T - Expected type of the value
   * @param key - Key to retrieve
   * @returns The value if present, undefined otherwise
   *
   * @example
   * ```typescript
   * const url = ctx.get<string>('apiUrl');
   * const timeout = ctx.get<number>('timeout');
   * ```
   */
  get<T>(key: string): T | undefined {
    return this.ctx.get(key) as T;
  }

  /**
   * Deletes a value from the context.
   *
   * @param key - Key to delete
   *
   * @example
   * ```typescript
   * ctx.delete('temporaryKey');
   * ```
   */
  delete(key: string): void {
    this.ctx.delete(key);
  }

  /**
   * Converts the context to a plain object.
   *
   * @returns Plain object containing all key-value pairs
   *
   * @example
   * ```typescript
   * const ctx = new AppContext()
   *   .set('a', 1)
   *   .set('b', 2);
   *
   * const obj = ctx.asObj();
   * // { a: 1, b: 2 }
   * ```
   */
  asObj(): Record<string, unknown> {
    return Object.fromEntries(this.ctx.entries());
  }
}
