import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaffeinateController, UnexpectedExitHandler } from '../src/caffeinate-controller';
import { AwakeSessionManager, type Clock, type SessionEvents } from '../src/session-manager';
import type { AwakeState } from '../src/types';

class FakeController implements CaffeinateController {
  running = false;
  starts = 0;
  stops = 0;
  failStart = false;
  onUnexpectedExit: UnexpectedExitHandler | null = null;

  async start(handler: UnexpectedExitHandler): Promise<void> {
    this.starts += 1;
    if (this.failStart) throw new Error('spawn failed');
    this.running = true;
    this.onUnexpectedExit = handler;
  }

  stop(): void {
    if (!this.running) return;
    this.stops += 1;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  exitUnexpectedly(): void {
    this.running = false;
    this.onUnexpectedExit?.(new Error('unexpected exit'));
  }
}

describe('AwakeSessionManager', () => {
  let controller: FakeController;
  let events: SessionEvents;
  let states: AwakeState[];
  let manager: AwakeSessionManager;
  let clock: Clock;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    controller = new FakeController();
    states = [];
    events = {
      onStateChange: (state) => states.push(state),
      onTimerExpired: vi.fn(),
      onFailure: vi.fn(),
    };
    clock = {
      now: () => Date.now(),
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: (handle) => clearTimeout(handle),
    };
    manager = new AwakeSessionManager(controller, events, clock);
  });

  it('starts and stops an indefinite session', async () => {
    await manager.activateIndefinite();
    expect(manager.getState()).toEqual({ mode: 'indefinite' });
    expect(controller.starts).toBe(1);

    await manager.deactivate();
    expect(manager.getState()).toEqual({ mode: 'inactive' });
    expect(controller.stops).toBe(1);
  });

  it('reuses one caffeinate process when replacing sessions', async () => {
    await manager.activateIndefinite();
    await manager.activateTimed(30);
    await manager.activateTimed(60);

    expect(controller.starts).toBe(1);
    expect(manager.getState()).toMatchObject({ mode: 'timed', durationMinutes: 60 });
  });

  it('expires at the absolute deadline even after a delayed timer tick', async () => {
    await manager.activateTimed(15);
    vi.setSystemTime(new Date('2026-01-01T00:16:00Z'));
    await vi.runOnlyPendingTimersAsync();

    expect(manager.getState()).toEqual({ mode: 'inactive' });
    expect(controller.stops).toBe(1);
    expect(events.onTimerExpired).toHaveBeenCalledWith(15);
  });

  it('cancels the old deadline when a timer is replaced', async () => {
    await manager.activateTimed(15);
    await manager.activateTimed(60);
    await vi.advanceTimersByTimeAsync(15 * 60_000);

    expect(manager.getState()).toMatchObject({ mode: 'timed', durationMinutes: 60 });
    expect(events.onTimerExpired).not.toHaveBeenCalled();
  });

  it('stays inactive and reports a spawn failure', async () => {
    controller.failStart = true;
    await manager.activateIndefinite();

    expect(manager.getState()).toEqual({ mode: 'inactive' });
    expect(events.onFailure).toHaveBeenCalledOnce();
  });

  it('returns to inactive after an unexpected process exit', async () => {
    await manager.activateTimed(30);
    controller.exitUnexpectedly();
    await Promise.resolve();
    await Promise.resolve();

    expect(manager.getState()).toEqual({ mode: 'inactive' });
    expect(events.onFailure).toHaveBeenCalledOnce();
  });

  it('cleans up exactly once during shutdown', async () => {
    await manager.activateIndefinite();
    manager.shutdown();
    manager.shutdown();

    expect(controller.stops).toBe(1);
    expect(manager.getState()).toEqual({ mode: 'inactive' });
  });
});
