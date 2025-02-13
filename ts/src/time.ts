export abstract class Time {
  abstract Now(add?: number): Date;
  abstract Sleep(duration: Duration): Promise<void>;
  TimeSince(start: Date): Duration {
    const now = this.Now();
    return now.getTime() - start.getTime();
  }
}

export type Duration = number;

export const TimeUnits = {
  Microsecond: 1,
  Second: 1000 * 1, //Microsecond,
  Minute: 60 * 1000 * 1, //Second,
  Hour: 60 * 60 * 1000 * 1, // Minute,
};
export type TimeUnit = keyof typeof TimeUnits;
