export abstract class Option<T> {
  static Some<T>(t: T): Option<T> {
    return new Some(t);
  }

  static None<T>(): Option<T> {
    return new None();
  }

  static Is<T>(t: unknown): t is Option<T> {
    return t instanceof Option;
  }

  static From<T>(t?: T): Option<T> {
    if (!t) {
      return new None();
    }
    return new Some(t);
  }

  IsNone(): boolean {
    return this.is_none();
  }

  IsSome(): boolean {
    return this.is_some();
  }
  Unwrap(): T {
    return this.unwrap();
  }

  abstract is_none(): boolean;
  abstract is_some(): boolean;
  abstract unwrap(): T;
}

export class Some<T> extends Option<T> {
  private _t: T;
  constructor(_t: T) {
    super();
    this._t = _t;
  }

  is_none(): boolean {
    return false;
  }
  is_some(): boolean {
    return true;
  }
  unwrap(): T {
    return this._t;
  }
}

export class None<T> extends Option<T> {
  is_none(): boolean {
    return true;
  }
  is_some(): boolean {
    return false;
  }
  unwrap(): T {
    throw new Error("None.unwrap");
  }
}

export type WithoutOption<T> = T extends Option<infer U> ? U : T;
