import { MockFileService } from "./mock_file_service";

it("writeFileString", async () => {
  const f = new MockFileService();
  const absFname = f.abs("test");
  await f.writeFileString("test", "hello");
  expect(f.files).toEqual({
    [absFname]: {
      content: "hello",
      name: absFname
    },
    test: {
      name: absFname,
      content: "hello",
    },
  });
});
