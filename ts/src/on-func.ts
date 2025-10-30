// eslint-disable-next-line @typescript-eslint/no-explicit-any
class OnFuncInstance<Args extends any[]> {
  readonly #fns = new Set<(...a: Args) => void>();

  addFunction(fn: (...a: Args) => unknown): () => void {
    this.#fns.add(fn);
    return () => {
      this.#fns.delete(fn);
    };
  }

  public invoke(...a: Args): void {
    for (const fn of this.#fns) {
      try {
        fn(...a);
      } catch (e) {
        // ignore errors
      }
    }
  }

  public clear(): void {
    this.#fns.clear();
  }

  public async invokeAsync(...a: Args): Promise<void> {
    await Promise.allSettled(Array.from(this.#fns).map((fn) => Promise.resolve(fn(...a))));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ReturnOnFunc<Args extends any[]> {
  (fn: (...a: Args) => unknown): () => void; // returns unregister function
  invoke(...a: Args): void;
  invokeAsync(...a: Args): Promise<void>;
  clear(): void;
}

type ExtractArgs<T> = T extends (...args: infer A) => unknown ? A : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function OnFunc<Fn extends (...args: any[]) => unknown>(): ReturnOnFunc<ExtractArgs<Fn>> {
  const instance = new OnFuncInstance<ExtractArgs<Fn>>();
  const ret = instance.addFunction.bind(instance) as ReturnOnFunc<ExtractArgs<Fn>>;
  ret.invoke = instance.invoke.bind(instance) as ReturnOnFunc<ExtractArgs<Fn>>["invoke"];
  ret.invokeAsync = instance.invokeAsync.bind(instance) as ReturnOnFunc<ExtractArgs<Fn>>["invokeAsync"];
  ret.clear = instance.clear.bind(instance) as ReturnOnFunc<ExtractArgs<Fn>>["clear"];
  return ret;
}
