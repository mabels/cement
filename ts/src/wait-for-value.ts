import { Future } from "./future.js";
import { Option } from "./option.js";
import { ResolveOnce } from "./resolve-once.js";

/**
 * Configuration options for WaitingForValue.
 */
export interface WaitingForValueProps<T> {
  /**
   * Optional preset value to initialize the WaitingForValue with.
   * If provided and Some, the value is immediately available.
   */
  readonly presetValue?: Option<T>;
}

/**
 * A utility for managing a value that may not be immediately available.
 * Allows multiple callers to await the same value efficiently, with all
 * waiters resolved when the value becomes available.
 *
 * @template T - The type of value being waited for
 *
 * @example
 * ```ts
 * const waiting = new WaitingForValue<string>();
 *
 * // Multiple callers can await the value
 * const promise1 = waiting.waitValue();
 * const promise2 = waiting.waitValue();
 *
 * // Set the value - all waiters are resolved
 * waiting.setValue(Option.Some("hello"));
 *
 * // Both promises resolve to "hello"
 * ```
 */
export class WaitingForValue<T = void> {
  #value!: Option<T>;
  #waitFuture?: Future<T>;
  #waitValue!: () => Promise<T>;

  /**
   * Creates a new WaitingForValue instance.
   *
   * @param opts - Configuration options
   */
  constructor(opts: WaitingForValueProps<T> = {}) {
    this.init(opts.presetValue);
  }

  /**
   * Initializes or reinitializes the WaitingForValue with an optional preset value.
   * If a preset value is provided and is Some, the value is immediately available.
   * Otherwise, sets up the waiting mechanism for future value resolution.
   *
   * @param presetValue - Optional initial value
   */
  init(presetValue: Option<T> = Option.None()): void {
    this.#value = presetValue;
    if (this.#value.IsSome()) {
      return this.setValue(this.#value);
    }
    const myFuture = (this.#waitFuture = new Future<T>());
    const resolveOnce = new ResolveOnce<T>();
    this.#waitValue = (): Promise<T> => resolveOnce.once(async () => myFuture.asPromise());
  }

  /**
   * Sets the value and resolves all pending waiters.
   * If called when no value exists, resolves the waiting Future.
   * If called when a value already exists, updates the value and resets the waiting mechanism.
   * Does nothing if the provided value is None.
   *
   * @param value - The value to set (wrapped in Option)
   */
  setValue(value: Option<T>): void {
    if (value.IsNone()) {
      return;
    }
    switch (true) {
      case this.#value.IsNone():
        // need to resolve waiters
        this.#value = value;
        this.#waitFuture?.resolve(value.unwrap());
        break;
      case this.#value.IsSome(): {
        this.#value = value;
        this.#waitFuture = undefined;
        const resolveOnce = new ResolveOnce<T>();
        this.#waitValue = (): Promise<T> => resolveOnce.once(() => Promise.resolve(value.unwrap()));
        break;
      }
    }
  }

  /**
   * Returns a promise that resolves when the value becomes available.
   * If the value is already set, returns a promise that resolves immediately.
   * Multiple calls to this method are safe and efficient - all callers share
   * the same resolution logic thanks to ResolveOnce.
   *
   * @returns A promise that resolves to the value
   */
  waitValue(): Promise<T> {
    return this.#waitValue();
  }

  value(): Option<T> {
    return this.#value;
  }
}
