import { describe, expect, it } from "vitest";
import {
  isFutureDateTime,
  isTodayOrLater,
  localDateTimeValue,
  localDateValue,
} from "./future";

const now = new Date(2026, 7, 17, 12, 30);

describe("future commitment dates", () => {
  it("formats local date controls without UTC date drift", () => {
    expect(localDateValue(now)).toBe("2026-08-17");
    expect(localDateTimeValue(now)).toBe("2026-08-17T12:30");
  });

  it("accepts today and future dates but rejects past or malformed values", () => {
    expect(isTodayOrLater("2026-08-17", now)).toBe(true);
    expect(isTodayOrLater("2026-08-18", now)).toBe(true);
    expect(isTodayOrLater("2026-08-16", now)).toBe(false);
    expect(isTodayOrLater("", now)).toBe(false);
  });

  it("requires rescheduling to be later than now", () => {
    expect(isFutureDateTime("2026-08-17T12:31", now)).toBe(true);
    expect(isFutureDateTime("2026-08-17T12:29", now)).toBe(false);
  });
});
