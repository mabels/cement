import { utils } from "@adviser/cement";

it("string2stream", async () => {
  const inStr = utils.string2stream("Hello World!");
  expect(await utils.stream2string(inStr)).toBe("Hello World!");
});
