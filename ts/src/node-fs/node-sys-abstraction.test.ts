import type { ExecException, exec } from "node:child_process";
import { runtimeFn } from "@adviser/cement";
import { expect, beforeAll, describe, it } from "vitest";

function exitHandler(errCode: number, larg: string, done: () => void) {
  return (err: ExecException | null, stdout: string | Buffer, stderr: string | Buffer): void => {
    if (err) {
      expect(err.code).toBe(errCode);
    }
    if (stdout) {
      const res = stdout
        .toString()
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const out = JSON.parse(line) as { pid?: number };
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

describe(`${runtimeFn().isDeno ? "deno" : "node"}_sys`, () => {
  if (runtimeFn().isNodeIsh || runtimeFn().isDeno) {
    let fnExec: typeof exec;
    let execHandler = "tsx src/test/test-exit-handler.ts";
    beforeAll(async () => {
      const { exec } = await import("node:child_process");
      fnExec = exec;
      if (runtimeFn().isDeno) {
        execHandler =
          "deno run --quiet --allow-net --allow-read --allow-run --unstable-sloppy-imports src/test/test-exit-handler.ts";
        // // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // const gs = globalThis as any;
        // fnExec = (async (cmd: string, cb: (err: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void) => {
        //   const c = new gs.Deno.Command(cmd.split(" ")[0], {
        //     args: cmd.split(" ").slice(1),
        //     stdout: "piped",
        //     stderr: "piped",
        //   });
        //   const result = await c.output();
        //   const td = new TextDecoder();
        //   cb(result, td.decode(result.stdout), td.decode(result.stderr));
        // }) as unknown as typeof exec;
      }
    });
    it("just-exit", () => {
      return new Promise<void>((done) => {
        fnExec(`${execHandler}  exit24`, exitHandler(24, "exit24", done));
      });
    });

    it("throw", () => {
      return new Promise<void>((done) => {
        fnExec(`${execHandler}  throw`, exitHandler(19, "throw", done));
      });
    });

    it("via sigint", () => {
      return new Promise<void>((done) => {
        fnExec(`${execHandler}  sigint`, exitHandler(2, "sigint", done));
      });
    });

    it("via sigterm", () => {
      return new Promise<void>((done) => {
        fnExec(`${execHandler}  sigterm`, exitHandler(9, "sigterm", done));
      });
    });

    it("via sigquit", () => {
      return new Promise<void>((done) => {
        fnExec(`${execHandler}  sigquit`, exitHandler(3, "sigquit", done));
      });
    });
  } else {
    it.skip("nothing in browser", () => {
      expect(true).toBe(true);
    });
  }
});
