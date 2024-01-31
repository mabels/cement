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
  Second = 1000 * Microsecond,
  Minute = 60 * Second,
  Hour = 60 * Minute,
}
