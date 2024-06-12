/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  modulePathIgnorePatterns: ["dist/", "pubdir"],
  // globalSetup: "./types/entities/setup.js"
};
