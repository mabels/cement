/*
 * Context class to store and retrieve values
 * it's used to store user runtime values like
 * the url to the ledger
 */

export function isAppContext(ctx: unknown): ctx is AppContext {
  return AppContext.is(ctx);
}

export class AppContext {
  private readonly ctx: Map<string, unknown> = new Map<string, unknown>();

  static is(ctx: unknown): ctx is AppContext {
    return ctx instanceof AppContext && "ctx" in ctx && ctx.ctx instanceof Map;
  }

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

  set<T>(key: string, value: T): AppContext {
    this.ctx.set(key, value);
    return this;
  }
  get<T>(key: string): T | undefined {
    return this.ctx.get(key) as T;
  }
  delete(key: string): void {
    this.ctx.delete(key);
  }

  asObj(): Record<string, unknown> {
    return Object.fromEntries(this.ctx.entries());
  }
}
