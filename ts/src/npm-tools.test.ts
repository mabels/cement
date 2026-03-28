import { it, expect } from "vitest";
import { NPMPackage } from "@adviser/cement";

it("unscoped package, no suffix", () => {
  const p = NPMPackage.parse("react");
  expect(p.givenPkg).toBe("react");
  expect(p.pkg).toBe("react");
  expect(p.suffix).toBeUndefined();
});

it("unscoped package with suffix", () => {
  const p = NPMPackage.parse("react/jsx-runtime");
  expect(p.givenPkg).toBe("react/jsx-runtime");
  expect(p.pkg).toBe("react");
  expect(p.suffix).toBe("/jsx-runtime");
});

it("scoped package, no suffix", () => {
  const p = NPMPackage.parse("@vibes.diy/prompts");
  expect(p.givenPkg).toBe("@vibes.diy/prompts");
  expect(p.pkg).toBe("@vibes.diy/prompts");
  expect(p.suffix).toBeUndefined();
});

it("scoped package with suffix", () => {
  const p = NPMPackage.parse("@vibes.diy/prompts/llms/fireproof.txt");
  expect(p.givenPkg).toBe("@vibes.diy/prompts/llms/fireproof.txt");
  expect(p.pkg).toBe("@vibes.diy/prompts");
  expect(p.suffix).toBe("/llms/fireproof.txt");
});

it("throws on invalid package string", () => {
  expect(() => NPMPackage.parse("@scope-only")).toThrow();
});
