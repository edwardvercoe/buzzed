import { describe, expect, it } from 'vitest';
import { validateDurationParts, validateTotalMinutes } from '../src/duration';

describe('duration validation', () => {
  it('accepts valid hour and minute combinations', () => {
    expect(validateDurationParts('0', '1')).toEqual({ ok: true, totalMinutes: 1 });
    expect(validateDurationParts('2', '30')).toEqual({ ok: true, totalMinutes: 150 });
    expect(validateDurationParts('24', '0')).toEqual({ ok: true, totalMinutes: 1_440 });
  });

  it('rejects zero, values over 24 hours, and malformed input', () => {
    expect(validateDurationParts('0', '0').ok).toBe(false);
    expect(validateDurationParts('24', '1').ok).toBe(false);
    expect(validateDurationParts('1.5', '0').ok).toBe(false);
    expect(validateDurationParts('-1', '30').ok).toBe(false);
    expect(validateDurationParts('', '30').ok).toBe(false);
  });

  it('validates the IPC value independently', () => {
    expect(validateTotalMinutes(60)).toEqual({ ok: true, totalMinutes: 60 });
    expect(validateTotalMinutes(0).ok).toBe(false);
    expect(validateTotalMinutes(1_441).ok).toBe(false);
    expect(validateTotalMinutes('60').ok).toBe(false);
  });
});
