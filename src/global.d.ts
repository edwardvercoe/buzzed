import type { TimerSubmissionResult } from './types';

declare global {
  interface Window {
    buzzed: {
      submitDuration(totalMinutes: number): Promise<TimerSubmissionResult>;
    };
  }
}

export {};
