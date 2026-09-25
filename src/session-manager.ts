import type { AwakeState } from './types';
import type { CaffeinateController } from './caffeinate-controller';

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
};

export interface SessionEvents {
  onStateChange(state: AwakeState): void;
  onTimerExpired(durationMinutes: number): void;
  onFailure(error: Error): void;
}

export class AwakeSessionManager {
  private state: AwakeState = { mode: 'inactive' };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private operation: Promise<void> = Promise.resolve();
  private shuttingDown = false;

  constructor(
    private readonly controller: CaffeinateController,
    private readonly events: SessionEvents,
    private readonly clock: Clock = systemClock,
  ) {}

  getState(): AwakeState {
    return this.state;
  }

  activateIndefinite(): Promise<void> {
    return this.enqueue(async () => {
      if (!(await this.ensureRunning())) return;
      this.clearTimer();
      this.setState({ mode: 'indefinite' });
    });
  }

  activateTimed(durationMinutes: number): Promise<void> {
    return this.enqueue(async () => {
      if (!(await this.ensureRunning())) return;

      this.clearTimer();
      const deadlineMs = this.clock.now() + durationMinutes * 60_000;
      this.setState({ mode: 'timed', deadlineMs, durationMinutes });

      this.timer = this.clock.setTimeout(() => {
        void this.enqueue(async () => {
          const current = this.state;
          if (current.mode !== 'timed' || current.deadlineMs !== deadlineMs) return;

          this.controller.stop();
          this.clearTimer();
          this.setState({ mode: 'inactive' });
          this.events.onTimerExpired(durationMinutes);
        });
      }, Math.max(0, deadlineMs - this.clock.now()));
    });
  }

  deactivate(): Promise<void> {
    return this.enqueue(async () => {
      this.controller.stop();
      this.clearTimer();
      this.setState({ mode: 'inactive' });
    });
  }

  shutdown(): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.clearTimer();
    this.controller.stop();
    this.setState({ mode: 'inactive' });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    if (this.shuttingDown) return Promise.resolve();

    const next = this.operation.then(operation, operation);
    this.operation = next.catch(() => undefined);
    return next;
  }

  private async ensureRunning(): Promise<boolean> {
    if (this.controller.isRunning()) return true;

    try {
      await this.controller.start((error) => this.handleUnexpectedExit(error));
      return true;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.clearTimer();
      this.setState({ mode: 'inactive' });
      this.events.onFailure(error);
      return false;
    }
  }

  private handleUnexpectedExit(error?: Error): void {
    void this.enqueue(async () => {
      this.clearTimer();
      this.setState({ mode: 'inactive' });
      this.events.onFailure(error ?? new Error('caffeinate stopped unexpectedly'));
    });
  }

  private setState(state: AwakeState): void {
    this.state = state;
    this.events.onStateChange(state);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    this.clock.clearTimeout(this.timer);
    this.timer = null;
  }
}
