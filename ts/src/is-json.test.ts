import { isJSON } from "./is-json.js";

describe("isJSON", () => {
  it("should detect valid JSON object", () => {
    const result = isJSON('{"a":1,"b":2}');
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toEqual({ a: 1, b: 2 });
  });

  it("should detect valid JSON array", () => {
    const result = isJSON("[1,2,3]");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toEqual([1, 2, 3]);
  });

  it("should detect valid JSON string", () => {
    const result = isJSON('"hello"');
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toBe("hello");
  });

  it("should detect valid JSON number", () => {
    const result = isJSON("123");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toBe(123);
  });

  it("should detect valid JSON boolean true", () => {
    const result = isJSON("true");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toBe(true);
  });

  it("should detect valid JSON boolean false", () => {
    const result = isJSON("false");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toBe(false);
  });

  it("should detect valid JSON null", () => {
    const result = isJSON("null");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toBe(null);
  });

  it("should detect valid JSON with whitespace", () => {
    const result = isJSON("   [1, 2, 3]   ");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toEqual([1, 2, 3]);
  });

  it("should return false for invalid JSON", () => {
    const result = isJSON("{a:1}");
    expect(result.isJSON).toBe(false);
    expect(result.parsed).toBeUndefined();
  });

  it("should return false for non-JSON string", () => {
    const result = isJSON("hello");
    expect(result.isJSON).toBe(false);
    expect(result.parsed).toBeUndefined();
  });

  it("should return false for empty string", () => {
    const result = isJSON("");
    expect(result.isJSON).toBe(false);
    expect(result.parsed).toBeUndefined();
  });

  it("should return false for malformed JSON", () => {
    const result = isJSON('{"a":1,}');
    expect(result.isJSON).toBe(false);
    expect(result.parsed).toBeUndefined();
  });

  it("should handle numbers with exponent", () => {
    const result = isJSON("1e3");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toBe(1000);
  });

  it("should handle negative numbers", () => {
    const result = isJSON("-42");
    expect(result.isJSON).toBe(true);
    expect(result.parsed).toBe(-42);
  });
});
