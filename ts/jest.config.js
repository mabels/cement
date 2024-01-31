/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  modulePathIgnorePatterns: ["dist/", "pubdir"],
  // globalSetup: "./types/entities/setup.js"
};
