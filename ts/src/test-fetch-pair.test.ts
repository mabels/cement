import { TestFetchPair } from "./test-fetch-pair.js";
import { it, expect } from "vitest";

it("should record fetch calls in the calls array", async () => {
  const tfp = TestFetchPair.create();

  tfp.server.onServe((req) => {
    return Promise.resolve(new Response(`Hello from ${req.url}`, { status: 200 }));
  });

  await tfp.client.fetch("http://example.com/first");
  await tfp.client.fetch("http://example.com/second");
  await tfp.client.fetch("http://example.com/third");

  expect(tfp.client.calls).toHaveLength(3);

  expect(tfp.client.calls[0].request.url).toBe("http://example.com/first");
  expect(tfp.client.calls[1].request.url).toBe("http://example.com/second");
  expect(tfp.client.calls[2].request.url).toBe("http://example.com/third");

  expect(await tfp.client.calls[0].response.text()).toBe("Hello from http://example.com/first");
  expect(await tfp.client.calls[1].response.text()).toBe("Hello from http://example.com/second");
  expect(await tfp.client.calls[2].response.text()).toBe("Hello from http://example.com/third");
});

it("should record request options in calls", async () => {
  const tfp = TestFetchPair.create();

  tfp.server.onServe(async (req) => {
    const body = await req.text();
    return new Response(`Received: ${body}`, { status: 201 });
  });

  await tfp.client.fetch("http://example.com/api", {
    method: "POST",
    body: "test data",
    headers: { "Content-Type": "text/plain" },
  });

  expect(tfp.client.calls).toHaveLength(1);
  expect(tfp.client.calls[0].request.method).toBe("POST");
  expect(tfp.client.calls[0].response.status).toBe(201);
});

it("should start with empty calls array", () => {
  const tfp = TestFetchPair.create();
  expect(tfp.client.calls).toEqual([]);
});

it("should work when fetch method is passed without bind", async () => {
  const tfp = TestFetchPair.create();

  tfp.server.onServe((req) => {
    return Promise.resolve(new Response(`Response for ${req.url}`, { status: 200 }));
  });

  const unboundFetch = tfp.client.fetch;

  await unboundFetch("http://example.com/unbound");

  expect(tfp.client.calls).toHaveLength(1);
  expect(tfp.client.calls[0].request.url).toBe("http://example.com/unbound");
  expect(await tfp.client.calls[0].response.text()).toBe("Response for http://example.com/unbound");
});
