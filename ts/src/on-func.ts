class OnFuncInstance<Args extends unknown[]> {
  readonly fns = new Set<(a: Args) => void>();

  addFunctions(...fns: ((a: Args) => void)[]): () => void {
    for (const fn of fns) {
      this.fns.add(fn);
    }
    return () => {
      for (const fn of fns) {
        this.fns.delete(fn);
      }
    };
  }

  public invoke(...a: Args): void {
    for (const fn of this.fns) {
      try {
        fn(a);
      } catch (e) {
        // ignore errors
      }
    }
  }

  public async invokeAsync(...a: Args): Promise<void> {
    await Promise.allSettled(Array.from(this.fns).map((fn) => Promise.resolve(fn(a))));
  }
}

interface ReturnOnFunc<Args extends unknown[]> {
  (fn: (...a: Args) => unknown): () => void; // returns unregister function
  invoke(...a: Args): void;
  invokeAsync(...a: Args): Promise<void>;
}

type ExtractArgs<T> = T extends (...args: infer A) => void ? A : never;

export function OnFunc<Fn extends (...args: unknown[]) => unknown>(): ReturnOnFunc<ExtractArgs<Fn>> {
  const instance = new OnFuncInstance<ExtractArgs<Fn>>();
  const ret = instance.addFunctions.bind(instance) as ReturnOnFunc<ExtractArgs<Fn>>;
  ret.invoke = instance.invoke.bind(instance) as ReturnOnFunc<ExtractArgs<Fn>>["invoke"];
  ret.invokeAsync = instance.invokeAsync.bind(instance) as ReturnOnFunc<ExtractArgs<Fn>>["invokeAsync"];
  return ret;
}
