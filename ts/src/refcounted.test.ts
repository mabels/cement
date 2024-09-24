import { wrapRefcounted } from "./refcounted.js";

class RealInstance {
  x: number;
  isOpen = true;
  constructor(x: number) {
    this.x = x;
  }
  wurst(): number {
    return this.x++;
  }
  close(): void {
    if (!this.isOpen) {
      throw new Error("already closed");
    }
    this.isOpen = false;
  }
}

it("simple", () => {
  const obj = wrapRefcounted(new RealInstance(42), "close");
  expect(obj.wurst()).toBe(42);
  obj.close();
  expect(() => obj.close()).toThrowError("already closed");
});

it("nested", () => {
  const ri = new RealInstance(42);
  const obj1 = wrapRefcounted(ri, "close");
  const obj2 = wrapRefcounted(ri, "close");
  expect(obj1).toBe(obj2);
  expect(obj1.wurst()).toBe(42);
  expect(obj2.wurst()).toBe(43);
  obj2.close();
  expect(obj2.isOpen).toBe(true);
  expect(obj2.wurst()).toBe(44);
  expect(obj1.wurst()).toBe(45);
  obj1.close();
  expect(obj1.wurst()).toBe(46);
  expect(obj2.isOpen).toBe(false);
  expect(() => obj2.close()).toThrowError("already closed");
});
