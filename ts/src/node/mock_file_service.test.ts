import { MockFileService } from "./mock_file_service";

it("writeFileString", async () => {
  const f = new MockFileService();
  await f.writeFileString("test", "hello");
  expect(f.files).toEqual({
    "/mock/test": {
      content: "hello",
      name: "/mock/test",
    },
    test: {
      name: "/mock/test",
      content: "hello",
    },
  });
});
