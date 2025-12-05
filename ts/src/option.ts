/**
 * Option type for representing values that may or may not exist.
 *
 * Option is a type-safe way to handle nullable values, similar to Rust's Option type.
 * It forces explicit handling of both present (Some) and absent (None) cases without
 * using null or undefined.
 *
 * @template T - The type of the value when present
 *
 * @example
 * ```typescript
 * function findUser(id: string): Option<User> {
 *   const user = users.find(u => u.id === id);
 *   return user ? Option.Some(user) : Option.None();
 * }
 *
 * const result = findUser('123');
 * if (result.IsSome()) {
 *   console.log('Found user:', result.Unwrap());
 * } else {
 *   console.log('User not found');
 * }
 *
 * // Or use From to convert from nullable
 * const maybeUser = Option.From(users[0]); // Some if exists, None if undefined
 * ```
 */
export abstract class Option<T> {
  static Some<T = void>(...args: T[]): Option<T> {
    return args.length >= 1 ? new Some<T>(args[0]) : new Some<T>(undefined as unknown as T);
  }

  static None<T>(): Option<T> {
    return new None();
  }

  static Is<T>(t: unknown): t is Option<T> {
    return t instanceof Option;
  }

  static From<T = void>(...args: (T | undefined | null)[]): Option<T> {
    const t = args.length >= 1 ? args[0] : undefined;
    switch (typeof t) {
      case "undefined":
        return new None();
      // case "boolean":
      // case "number":
      // case "bigint":
      // case "string":
      // case "symbol":
      // case "function":
      //   return new Some(t);
      case "object":
        if (t === null) {
          return new None();
        }
        return new Some(t);
      default:
        return new Some(t);
    }
  }

  toValue(): T | undefined {
    return this.is_some() ? this.unwrap() : undefined;
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
