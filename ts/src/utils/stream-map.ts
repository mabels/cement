export interface StreamMap<T, U> {
  Map(s: T, idx: number): U | Promise<U>;
  readonly Close?: () => void;
}
export function streamMap<T, U>(s: ReadableStream<T>, sm: StreamMap<T, U>): ReadableStream<U> {
  const state = { reader: s.getReader(), streamMap: sm, idx: 0 };
  return new ReadableStream<U>({
    async pull(controller): Promise<void> {
      const { done, value } = await state.reader.read();
      if (done) {
        if (state.streamMap.Close) {
          state.streamMap.Close();
        }
        controller.close();
        return;
      }
      const promiseOrU = state.streamMap.Map(value, state.idx++);
      let mapped: U;
      if (promiseOrU instanceof Promise || typeof (promiseOrU as { then: () => void }).then === "function") {
        mapped = await promiseOrU;
      } else {
        mapped = promiseOrU;
      }
      controller.enqueue(mapped);
    },
  });
}

export async function devnull<T>(a: ReadableStream<T>): Promise<number> {
  const reader = a.getReader();
  let cnt = 0;
  while (true) {
    const { done } = await reader.read();
    if (done) {
      break;
    }
    cnt++;
  }
  return cnt;
}

export function array2stream<T>(a: T[]): ReadableStream<T> {
  let i = 0;
  return new ReadableStream<T>({
    pull(controller): void {
      if (i >= a.length) {
        controller.close();
        return;
      }
      controller.enqueue(a[i]);
      i++;
    },
  });
}

export async function stream2array<T>(a: ReadableStream<T>): Promise<T[]> {
  const ret: T[] = [];
  const reader = a.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    ret.push(value);
  }
  return ret;
}
