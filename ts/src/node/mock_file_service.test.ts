import { MockFileService } from "./mock_file_service";

it("writeFileString", async () => {
  const f = new MockFileService();
  const fname = f.abs("test.txt");
  await f.writeFileString(fname, "hello");
  expect(f.files).toEqual({
    [fname]: {
      name: fname,
      content: "hello",
    },
  });
});
