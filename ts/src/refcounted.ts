type Refcounted<T, M extends string> = T & {
  __refcounted: number;
  __unrefcounted: () => void;
} & Record<M, () => void>;

export function wrapRefcounted<T, M extends string>(t: T, method: M): T {
  const my = t as Refcounted<T, M>;
  my.__refcounted = (my.__refcounted || 0) + 1;
  if (my.__refcounted === 1) {
    my.__unrefcounted = my[method];
    const mRec = my as Record<string, () => void>;
    mRec[method] = function (this: Refcounted<T, M>): void {
      this.__refcounted--;
      if (this.__refcounted === 0) {
        this.__unrefcounted();
      }
      if (this.__refcounted < 0) {
        throw new Error("already closed");
      }
    };
  }
  return t;
}
