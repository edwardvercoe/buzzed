export type AwakeState =
  | { mode: 'inactive' }
  | { mode: 'indefinite' }
  | { mode: 'timed'; deadlineMs: number; durationMinutes: number };

export interface TimerSubmissionResult {
  ok: boolean;
  error?: string;
}
