import { stripper } from "./stripper.js";

const toStrip = {
  main: "main",
  Main: "main",
  nested: {
    main: "main",
    Main: "main",
    nested: {
      main: "main",
      Main: "main",
    },
  },
  arrays: [
    "main",
    "Main",
    {
      main: "main",
      Main: "main",
      nested: {
        main: "main",
        Main: "main",
      },
    },
  ],
};
it("empty stripper", () => {
  expect(stripper("", toStrip)).toEqual(toStrip);
});

it("array concrete stripper", () => {
  expect(stripper(["main", "Main", "blub"], toStrip)).toEqual({
    nested: {
      nested: {},
    },
    arrays: [
      "main",
      "Main",
      {
        nested: {},
      },
    ],
  });
});

it("array simple regex concrete stripper", () => {
  expect(stripper([/ain$/, "blub"], toStrip)).toEqual({
    nested: {
      nested: {},
    },
    arrays: [
      "main",
      "Main",
      {
        nested: {},
      },
    ],
  });
});

it("array regex concrete stripper", () => {
  expect(stripper([/Main/, "blub"], toStrip)).toEqual({
    main: "main",
    nested: {
      main: "main",
      nested: {
        main: "main",
      },
    },
    arrays: [
      "main",
      "Main",
      {
        main: "main",
        nested: {
          main: "main",
        },
      },
    ],
  });
});

it("array dotted concrete stripper", () => {
  expect(
    stripper(["nested.main", "blub", "nested.nested.Main", "arrays[1]", "arrays[2].main", /arrays.2..nested..ain/], toStrip),
  ).toEqual({
    main: "main",
    Main: "main",
    nested: {
      Main: "main",
      nested: {
        main: "main",
      },
    },
    arrays: [
      "main",
      {
        Main: "main",
        nested: {
          //  "main": "main",
        },
      },
    ],
  });
});
