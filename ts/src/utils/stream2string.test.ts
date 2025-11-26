import { TxtEnDecoderSingleton } from "@adviser/cement";
import { stream2string } from "./stream2string.js";

it("stream2string", async () => {
  expect(
    await stream2string(
      new ReadableStream({
        start(controller): void {
          const encoder = TxtEnDecoderSingleton();
          controller.enqueue(encoder.encode("Hello"));
          controller.enqueue(encoder.encode(" "));
          controller.enqueue(encoder.encode("World"));
          controller.enqueue(encoder.encode("!"));
          controller.close();
        },
      }),
    ),
  ).toBe("Hello World!");
});

it("stream2string maxSize", async () => {
  const instr = "Hello World!";
  for (let i = 0; i < instr.length; i++) {
    expect(
      await stream2string(
        new ReadableStream({
          start(controller): void {
            const encoder = TxtEnDecoderSingleton();
            controller.enqueue(encoder.encode("Hello"));
            controller.enqueue(encoder.encode(" "));
            controller.enqueue(encoder.encode("World"));
            controller.enqueue(encoder.encode("!"));
            controller.close();
          },
        }),
        i,
      ),
    ).toBe(instr.slice(0, i));
  }
});
