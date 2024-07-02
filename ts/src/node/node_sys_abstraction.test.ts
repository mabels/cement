import { ExecException, exec } from "node:child_process";

function exitHandler(errCode: number, larg: string, done: () => void) {
  return (err: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => {
    if (err) {
      expect(err.code).toBe(errCode);
    }
    if (stdout) {
      const res = stdout
        .toString()
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const out = JSON.parse(line);
          return out;
        })
        .map((obj) => {
          delete obj.pid;
          return obj;
        });
      expect(res).toEqual([
        {
          larg: larg,
        },
        {
          larg: larg,
          msg: "Called OnExit 1",
        },
        {
          larg: larg,
          msg: "Called OnExit 2",
        },
      ]);
      done();
    }
    if (stderr) {
      expect(stderr).toEqual({});
    }
  };
}

it("just-exit", () => {
  return new Promise<void>((done) => {
    exec("tsx src/test/test-exit-handler.ts exit24", exitHandler(24, "exit24", done));
  });
});

it("throw", () => {
  return new Promise<void>((done) => {
    exec("tsx src/test/test-exit-handler.ts throw", exitHandler(19, "throw", done));
  });
});

it("via sigint", () => {
  return new Promise<void>((done) => {
    exec("tsx src/test/test-exit-handler.ts sigint", exitHandler(2, "sigint", done));
  });
});

it("via sigterm", () => {
  return new Promise<void>((done) => {
    exec("tsx src/test/test-exit-handler.ts sigterm", exitHandler(9, "sigterm", done));
  });
});

it("via sigquit", () => {
  return new Promise<void>((done) => {
    exec("tsx src/test/test-exit-handler.ts sigquit", exitHandler(3, "sigquit", done));
  });
});
