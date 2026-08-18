const pad = (value: number) => String(value).padStart(2, "0");

export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateTimeValue(date = new Date()) {
  return `${localDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isTodayOrLater(value: string, now = new Date()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= localDateValue(now);
}

export function isFutureDateTime(value: string, now = new Date()) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}
