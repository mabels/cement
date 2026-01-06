import { KeyedResolvOnce } from "./resolve-once.js";

export const RandomMode = {
  CONST: "const",
  STEP: "step",
  RANDOM: "random",
};
export type RandomMode = (typeof RandomMode)[keyof typeof RandomMode];

export const IDMode = {
  UUID: "uuid",
  CONST: "const",
  STEP: "step",
};
export type IDMode = (typeof IDMode)[keyof typeof IDMode];

/**
 * ID generator with deterministic modes for testing.
 *
 * Generates unique identifiers with support for different modes:
 * - UUID: Uses crypto.randomUUID() for real UUIDs (default)
 * - CONST: Always returns the same constant ID for reproducible tests
 * - STEP: Returns incrementing IDs (STEPId-0, STEPId-1, etc.) for predictable sequences
 *
 * @example
 * ```typescript
 * // Production: real UUIDs
 * const idService = new IdService(IDMode.UUID);
 * const id = idService.NextId(); // "550e8400-e29b-41d4-a716-446655440000"
 *
 * // Testing: constant ID
 * const constId = new IdService(IDMode.CONST);
 * const id1 = constId.NextId(); // "VeryUniqueID"
 * const id2 = constId.NextId(); // "VeryUniqueID"
 *
 * // Testing: stepped sequence
 * const stepId = new IdService(IDMode.STEP);
 * const id1 = stepId.NextId(); // "STEPId-0"
 * const id2 = stepId.NextId(); // "STEPId-1"
 * ```
 */
const idServices = new KeyedResolvOnce<IdService>();
export class IdService {
  readonly _mode: IDMode;
  _step = 0;

  static create(mode?: IDMode): IdService {
    return idServices.get(mode ?? IDMode.UUID).once(() => new IdService(mode));
  }

  private constructor(mode?: IDMode) {
    if (!mode) {
      mode = IDMode.UUID;
    }
    this._mode = mode;
  }
  /**
   * Generates the next unique identifier.
   *
   * @returns Unique ID string based on the configured mode
   */
  NextId(): string {
    switch (this._mode) {
      case IDMode.UUID:
        return crypto.randomUUID();
      case IDMode.CONST:
        return "VeryUniqueID";
      case IDMode.STEP:
        return `STEPId-${this._step++}`;
      default:
        throw new Error("Unknown IDMode");
    }
  }
}

/**
 * Random number generator with deterministic modes for testing.
 *
 * Provides random number generation that can operate in different modes:
 * - RANDOM: Uses Math.random() for real random values
 * - CONST: Always returns a constant value (0.5 * max) for reproducible tests
 * - STEP: Returns incrementing values for predictable test sequences
 *
 * @example
 * ```typescript
 * // Production: real randomness
 * const random = new RandomService(RandomMode.RANDOM);
 * const value = random.Random0ToValue(100); // 0-100
 *
 * // Testing: constant value
 * const constRandom = new RandomService(RandomMode.CONST);
 * const value = constRandom.Random0ToValue(100); // Always 50
 *
 * // Testing: stepped sequence
 * const stepRandom = new RandomService(RandomMode.STEP);
 * const v1 = stepRandom.Random0ToValue(100); // 0.01
 * const v2 = stepRandom.Random0ToValue(100); // 0.02
 * ```
 */
const randomServices = new KeyedResolvOnce<RandomService>();
export class RandomService {
  readonly _mode: RandomMode;
  _step = 0;
  static create(mode: RandomMode): RandomService {
    return randomServices.get(mode).once(() => new RandomService(mode));
  }
  private constructor(mode: RandomMode) {
    this._mode = mode;
  }
  /**
   * Generates a random number between 0 and the specified value.
   *
   * @param value - Maximum value (exclusive upper bound)
   * @returns Random number in range [0, value)
   */
  Random0ToValue(value: number): number {
    switch (this._mode) {
      case RandomMode.CONST:
        return 0.5 * value;
      case RandomMode.STEP:
        this._step += 0.0001;
        return this._step * value;
      case RandomMode.RANDOM:
        return Math.random() * value;
      default:
        throw new Error("Unknown RandomMode");
    }
  }
}
