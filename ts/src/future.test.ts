import { Future } from "./future";

it("Create Future Happy", async () => {
  const future = new Future();
  const promise = future.asPromise();
  expect(promise).toBeInstanceOf(Promise);

  const asynced = new Promise((resolve, reject) => {
    promise.then(resolve).catch(reject);
  });
  future.resolve("Hello World");

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

  try {
    await asynced;
    expect("Why").toBe("Sad World");
  } catch (error) {
    expect(error).toBe("Sad World");
  }
});
