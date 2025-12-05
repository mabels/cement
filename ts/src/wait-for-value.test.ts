import { WaitingForValue, sleep, Option } from "@adviser/cement";
import { it, vi, expect } from "vitest";

it("waitFor void", async () => {
  const wfv = new WaitingForValue();
  const size = 10;

  for (let i = 0; i < size; i++) {
    const promiseWaits = Promise.all(
      Array(size)
        .fill(0)
        .map(() => wfv.waitValue()),
    );
    const results = vi.fn();
    void promiseWaits.then(results);
    await sleep(10);
    expect(results).not.toHaveBeenCalled();
    wfv.setValue(Option.None());
    await sleep(10);
    expect(results).not.toHaveBeenCalled();
    wfv.setValue(Option.Some(undefined));
    await sleep(10);
    await promiseWaits;
    expect(results).toHaveBeenCalledTimes(1);
    expect(results).toHaveBeenCalledWith(Array(size).fill(undefined));

    wfv.setValue(Option.Some(42 as never));
    const promiseWaits2 = Promise.all(
      Array(size)
        .fill(0)
        .map(() => wfv.waitValue()),
    ).then(results);
    await sleep(10);
    await promiseWaits2;
    expect(results).toHaveBeenCalledTimes(2);
    expect(results.mock.calls).toEqual([[Array(size).fill(undefined)], [Array(size).fill(42)]]);
    wfv.init();
  }
});

it("waitFor object", async () => {
  const wfv = new WaitingForValue<{
    value: number;
  }>();
  const size = 10;

  for (let i = 0; i < size; i++) {
    const promiseWaits = Promise.all(
      Array(size)
        .fill(0)
        .map(() => wfv.waitValue()),
    );
    const results = vi.fn();
    void promiseWaits.then(results);
    await sleep(10);
    expect(results).not.toHaveBeenCalled();
    wfv.setValue(Option.None());
    await sleep(10);
    expect(results).not.toHaveBeenCalled();
    wfv.setValue(Option.Some({ value: 0 }));
    await sleep(10);
    await promiseWaits;
    expect(results).toHaveBeenCalledTimes(1);
    expect(results).toHaveBeenCalledWith(Array(size).fill({ value: 0 }));

    wfv.setValue(Option.Some({ value: 42 }));
    const promiseWaits2 = Promise.all(
      Array(size)
        .fill(0)
        .map(() => wfv.waitValue()),
    ).then(results);
    await sleep(10);
    await promiseWaits2;
    expect(results).toHaveBeenCalledTimes(2);
    expect(results.mock.calls).toEqual([[Array(size).fill({ value: 0 })], [Array(size).fill({ value: 42 })]]);
    wfv.init();
  }
});

it("waitFor preset value", async () => {
  const wfv = new WaitingForValue<number>({ presetValue: Option.Some(7) });
  const size = 10;

  const promiseWaits = Promise.all(
    Array(size)
      .fill(0)
      .map(() => wfv.waitValue()),
  );
  const results = vi.fn();
  void promiseWaits.then(results);
  await sleep(10);
  await promiseWaits;
  expect(results).toHaveBeenCalledTimes(1);
  expect(results).toHaveBeenCalledWith(Array(size).fill(7));
  wfv.setValue(Option.Some(42));
  const promiseWaits2 = Promise.all(
    Array(size)
      .fill(0)
      .map(() => wfv.waitValue()),
  ).then(results);
  await sleep(10);
  await promiseWaits2;
  expect(results).toHaveBeenCalledTimes(2);
  expect(results.mock.calls).toEqual([[Array(size).fill(7)], [Array(size).fill(42)]]);
});
