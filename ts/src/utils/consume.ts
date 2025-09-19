import { isPromise } from "../is-promise.js";

export function consumeStream<E, R>(stream: ReadableStream<E>, cb: (msg: E) => R): Promise<R[]> {
  const ret: R[] = [];
  return processStream(stream, (msg) =>
    Promise.resolve(cb(msg)).then((r) => {
      ret.push(r);
    }),
  ).then(() => ret);
}

export function processStream<E, CTX = object>(
  stream: ReadableStream<E>,
  cb: (msg: E, ctx: CTX) => Promise<void> | void,
  ctx: CTX = {} as CTX,
): Promise<void> {
  const reader = stream.getReader();
  function readNext(ctx: CTX): Promise<void> {
    return reader.read().then(({ done, value }) => {
      if (done) {
        return;
      }
      return Promise.resolve(cb(value, ctx)).then(() => readNext(ctx));
    });
  }
  return readNext(ctx);
}

export interface StepCfg<CTX = object> {
  readonly chunkSize: number;
  readonly setTimeoutFn: (fn: () => void, delay: number) => void;
  readonly ctx: CTX;
}

interface StepArgs<I extends IterableIterator<E> | AsyncIterableIterator<E>, E, CTX> extends StepCfg<CTX> {
  readonly iter: I;
  readonly cb: (msg: E, ctx: CTX) => Promise<void> | void;
  readonly resolve: () => void;
  readonly reject: (reason: Error) => void;
  chunk: number;
}

function step<I extends IterableIterator<E> | AsyncIterableIterator<E>, R, E>(args: StepArgs<I, E, R>): Promise<void> {
  const item = args.iter.next();
  return Promise.resolve(item).then(({ done, value }: { done?: boolean; value: E }) => {
    if (done) {
      args.resolve();
      return Promise.resolve();
    }
    try {
      return Promise.resolve(args.cb(value, args.ctx)).then(() => {
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

export function consumeIterator<T, R>(
  iter: IterableIterator<T> | AsyncIterableIterator<T>,
  cb: (msg: T) => R,
  params: Partial<StepCfg<R[]>> = {},
): Promise<R[]> {
  const ret: R[] = [];
  return processIterator<T, R[]>(
    iter,
    (value) =>
      Promise.resolve(cb(value)).then((r) => {
        ret.push(r);
      }),
    { ...params, ctx: params.ctx ?? ret },
  ).then(() => ret);
}

export function processIterator<T, CTX = object>(
  iter: IterableIterator<T> | AsyncIterableIterator<T>,
  cb: (msg: T) => Promise<void> | void,
  params: Partial<StepCfg<CTX>> = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    void step({
      setTimeoutFn: setTimeout,
      chunkSize: 16,
      ctx: {} as CTX,
      ...params,
      iter,
      cb,
      reject,
      resolve,
      chunk: 0,
    });
  });
}
