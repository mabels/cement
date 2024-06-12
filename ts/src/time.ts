export abstract class Time {
  abstract Now(): Date;
  abstract Sleep(duration: Duration): Promise<void>;
  TimeSince(start: Date): Duration {
    const now = this.Now();
    return now.getTime() - start.getTime();
  }
}

export type Duration = number;

export enum TimeUnits {
  Microsecond = 1,
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member
  Second = 1000 * Microsecond,
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member
  Minute = 60 * Second,
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member
  Hour = 60 * Minute,
}
