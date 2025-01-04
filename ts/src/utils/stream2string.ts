export async function stream2string(stream?: ReadableStream<Uint8Array> | null, maxSize?: number): Promise<string> {
  if (!stream) {
    return Promise.resolve("");
  }
  const reader = stream.getReader();
  let res = "";
  const decoder = new TextDecoder();
  let rSize = 0;
  while (typeof maxSize === "undefined" || rSize < maxSize) {
    try {
      const read = await reader.read();
      if (read.done) {
        break;
      }
      if (maxSize && rSize + read.value.length > maxSize) {
        read.value = read.value.slice(0, maxSize - rSize);
      }
      const block = decoder.decode(read.value, { stream: true });
      rSize += read.value.length;
      res += block;
    } catch (err) {
      return Promise.reject(err as Error);
    }
  }
  return Promise.resolve(res);
}

export async function stream2uint8array(stream?: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
  if (!stream) {
    return Promise.resolve(new Uint8Array());
  }
  const reader = stream.getReader();
  let res = new Uint8Array();
  // eslint-disable-next-line no-constant-condition
  while (1) {
    try {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      res = new Uint8Array([...res, ...value]);
    } catch (err) {
      return Promise.reject(err as Error);
    }
  }
  return Promise.resolve(res);
}
