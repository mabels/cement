import { isPromise } from "../is-promise.js";

export function consumeStream<E, R>(stream: ReadableStream<E>, cb: (msg: E) => R): Promise<R[]> {
  const reader = stream.getReader();
  async function readNext(ret: R[]): Promise<R[]> {
    const { done, value } = await reader.read();
    if (done) {
      return ret;
    }
    return Promise.resolve(cb(value)).then((r) => {
      ret.push(r);
      return readNext(ret);
    });
  }
  return readNext([]);
}

export interface StepCfg {
  readonly chunkSize: number;
  readonly setTimeoutFn: (fn: () => void, delay: number) => void;
}

interface StepArgs<I extends IterableIterator<E> | AsyncIterableIterator<E>, E, R> extends StepCfg {
  readonly iter: I;
  readonly cb: (msg: E, idx: number) => R;
  readonly resolve: (x: R[] | PromiseLike<R[]>) => void;
  readonly reject: (reason: Error) => void;
  readonly ret: R[];
  chunk: number;
}

function step<I extends IterableIterator<E> | AsyncIterableIterator<E>, R, E>(args: StepArgs<I, E, R>): Promise<void> {
  const item = args.iter.next();
  return Promise.resolve(item).then(({ done, value }: { done?: boolean; value: E }) => {
    if (done) {
      args.resolve(args.ret);
      return Promise.resolve();
    }
    try {
      return Promise.resolve(args.cb(value, args.ret.length)).then((r) => {
        args.ret.push(r);
        if (isPromise(item) && args.chunk >= args.chunkSize) {
          args.setTimeoutFn(() => {
            args.chunk = 0;
            void step(args);
          }, 0);
          return Promise.resolve();
        } else {
          args.chunk++;
          return step(args);
        }
      });
    } catch (e) {
      args.reject(e as Error);
      return Promise.resolve();
    }
  });
}

export function consumeIterator<I extends IterableIterator<E> | AsyncIterableIterator<E>, E, R>(
  iter: I,
  cb: (msg: E) => R,
  params: Partial<StepCfg> = {},
): Promise<R[]> {
  return new Promise<R[]>((resolve, reject) => {
    const ret: R[] = [];
    void step({
      setTimeoutFn: setTimeout,
      chunkSize: 16,
      ...params,
      iter,
      cb,
      reject,
      resolve,
      chunk: 0,
      ret,
    });
  });
}
