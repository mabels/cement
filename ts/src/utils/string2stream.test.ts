import { stream2string } from "./stream2string";
import { string2stream } from "./string2stream";

it("string2stream", async () => {
  const inStr = string2stream("Hello World!");
  expect(await stream2string(inStr)).toBe("Hello World!");
});
