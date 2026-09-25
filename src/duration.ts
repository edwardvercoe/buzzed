export const MAX_DURATION_MINUTES = 24 * 60;

export type DurationValidation =
  | { ok: true; totalMinutes: number }
  | { ok: false; error: string };

function parseWholeNumber(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validateDurationParts(
  hoursValue: string,
  minutesValue: string,
): DurationValidation {
  const hours = parseWholeNumber(hoursValue);
  const minutes = parseWholeNumber(minutesValue);

  if (hours === null || minutes === null) {
    return { ok: false, error: 'Enter whole numbers for hours and minutes.' };
  }

  if (hours > 24 || minutes > 59) {
    return { ok: false, error: 'Use 0–24 hours and 0–59 minutes.' };
  }

  const totalMinutes = hours * 60 + minutes;
  return validateTotalMinutes(totalMinutes);
}

export function validateTotalMinutes(totalMinutes: unknown): DurationValidation {
  if (!Number.isSafeInteger(totalMinutes)) {
    return { ok: false, error: 'Duration must be a whole number of minutes.' };
  }

  const value = totalMinutes as number;
  if (value < 1 || value > MAX_DURATION_MINUTES) {
    return { ok: false, error: 'Choose a duration from 1 minute to 24 hours.' };
  }

  return { ok: true, totalMinutes: value };
}
