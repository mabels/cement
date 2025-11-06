import { Future } from "@adviser/cement";

it("Create Future Happy", async () => {
  const future = new Future();
  const promise = future.asPromise();
  expect(promise).toBeInstanceOf(Promise);

  const asynced = new Promise((resolve, reject) => {
    promise.then(resolve).catch(reject);
  });
  future.resolve("Hello World");
  future.resolve("1 Ignores");
  future.resolve("2 Ignores");

  expect(await asynced).toBe("Hello World");
});

it("Create Future Sad", async () => {
  const future = new Future();
  const promise = future.asPromise();
  expect(promise).toBeInstanceOf(Promise);

  const asynced = new Promise((resolve, reject) => {
    promise.then(resolve).catch(reject);
  });
  future.reject("Sad World");
  future.reject("1 Ignores");
  future.reject("2 Ignores");

  try {
    await asynced;
    expect("Why").toBe("Sad World");
  } catch (error) {
    expect(error).toBe("Sad World");
  }
});

it("Create Future with Context", () => {
  const future = new Future<{ name: string }, { id: number }>({ id: 42 });
  expect(future.ctx?.id).toBe(42);
});

it("Future create a unique id per instance could be used as transaction id", () => {
  const future1 = new Future();
  const future2 = new Future();
  expect(future1.id()).not.toBe(future2.id());
});
