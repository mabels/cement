import { describe, it, expect } from "vitest";
import { KeyedNgItem, KeyedNg, ResolveOnce, ResolveSeq } from "@adviser/cement";

interface TestKeyType {
  x: number;
  y: number;
}

interface TestKeyResult {
  X: number;
  Y: number;
  refKey: string;
}

interface TestCtx {
  bla: boolean;
}

interface TestOnceType {
  resX: number;
  resY: number;
  keyItem: KeyedNgItem<TestKeyType, TestKeyResult, TestCtx>;
}

describe("KeyedFactory with ResolveOnce", () => {
  it("works with resolve once", () => {
    const my = new KeyedNg({
      createValue: (item): ResolveOnce<TestOnceType, KeyedNgItem<TestKeyType, TestKeyResult, TestCtx>> => {
        return new ResolveOnce<TestOnceType, KeyedNgItem<TestKeyType, TestKeyResult, TestCtx>>({
          ...item,
          value: { X: item.givenKey.x, Y: item.givenKey.y, refKey: item.refKey },
          ctx: item.ctx,
        });
      },
      key2string: (givenKey: TestKeyType): string => givenKey.x + "---" + givenKey.y,
      ctx: { bla: true },
    });
    const once = my.get({ x: 3, y: 4 }, { bla: false }).once((ronce) => {
      const { refKey, givenKey, ctx } = ronce.ctx;
      return {
        resX: givenKey.x * 2,
        resY: givenKey.y * 3,
        keyItem: {
          refKey,
          givenKey,
          value: {
            X: givenKey.x,
            Y: givenKey.y,
            refKey,
          },
          ctx,
        },
      };
    });
    expect(once).toEqual({
      resX: 6,
      resY: 12,
      keyItem: {
        refKey: "3---4",
        givenKey: { x: 3, y: 4 },
        value: { X: 3, Y: 4, refKey: "3---4" },
        ctx: { bla: false },
      },
    });
  });

  it("works with resolve seq", async () => {
    const my = new KeyedNg({
      createValue: (item): ResolveSeq<TestOnceType, KeyedNgItem<TestKeyType, TestCtx, TestCtx>> => {
        return new ResolveSeq<TestOnceType, KeyedNgItem<TestKeyType, TestCtx, TestCtx>>({
          ...item,
          value: item.ctx,
          ctx: item.ctx,
        });
      },
      key2string: (givenKey: TestKeyType): string => givenKey.x + "---" + givenKey.y,
      ctx: { bla: true },
    });
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const once = await my.get({ x: 3, y: 4 }, { bla: false }).add((item) => {
      return {
        resX: item.givenKey.x * 2,
        resY: item.givenKey.y * 3,
        keyItem: {
          refKey: item.refKey,
          givenKey: item.givenKey,
          value: {
            X: item.givenKey.x,
            Y: item.givenKey.y,
            refKey: item.refKey,
          },
          ctx: item.ctx,
        },
      };
    });
    expect(once).toEqual({
      resX: 6,
      resY: 12,
      keyItem: {
        refKey: "3---4",
        givenKey: { x: 3, y: 4 },
        value: { X: 3, Y: 4, refKey: "3---4" },
        ctx: { bla: false },
      },
    });
  });

  it("keyed factory", () => {
    const my = new KeyedNg({
      createValue: (item): { X: number; Y: number; key: string } => ({
        X: item.givenKey.x,
        Y: item.givenKey.y,
        key: item.refKey,
      }),
      key2string: (key: { x: number; y: number }): string => key.x + "," + key.y,
      ctx: { bla: true },
    });

    const obj = my.get({ x: 1, y: 2 });
    expect(obj).toEqual({ X: 1, Y: 2, key: "1,2" });
    expect(my.get({ x: 1, y: 2 })).toBe(obj);
    expect(my.get({ x: 1, y: 2 })).toBe(obj);
    expect(my.get({ x: 1, y: 2 })).toBe(obj);
    expect(my.get({ x: 1, y: 2 })).toBe(obj);
    expect(my.values()).toEqual([
      {
        ctx: {
          bla: true,
        },
        givenKey: {
          x: 1,
          y: 2,
        },
        refKey: "1,2",
        value: {
          X: 1,
          Y: 2,
          key: "1,2",
        },
      },
    ]);
    const oitem = my.getItem({ x: 1, y: 2 });
    expect(oitem).toEqual({
      ctx: {
        bla: true,
      },
      givenKey: {
        x: 1,
        y: 2,
      },
      refKey: "1,2",
      value: {
        X: 1,
        Y: 2,
        key: "1,2",
      },
    });

    const oitem2 = my.getItem({ x: 2, y: 2 }, { bla: false });
    expect(oitem2).toEqual({
      ctx: {
        bla: false,
      },
      givenKey: {
        x: 2,
        y: 2,
      },
      refKey: "2,2",
      value: {
        X: 2,
        Y: 2,
        key: "2,2",
      },
    });
  });
});
