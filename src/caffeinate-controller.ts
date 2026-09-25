import { spawn, type ChildProcess } from 'node:child_process';

export type UnexpectedExitHandler = (error?: Error) => void;

export interface CaffeinateController {
  start(onUnexpectedExit: UnexpectedExitHandler): Promise<void>;
  stop(): void;
  isRunning(): boolean;
}

export class MacOSCaffeinateController implements CaffeinateController {
  private child: ChildProcess | null = null;
  private readonly expectedStops = new WeakSet<ChildProcess>();

  isRunning(): boolean {
    return this.child !== null;
  }

  start(onUnexpectedExit: UnexpectedExitHandler): Promise<void> {
    if (this.child) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const child = spawn(
        '/usr/bin/caffeinate',
        ['-d', '-i', '-w', String(process.pid)],
        { shell: false, stdio: 'ignore' },
      );

      this.child = child;
      let settled = false;

      child.once('spawn', () => {
        settled = true;
        resolve();
      });

      child.once('error', (error) => {
        if (this.child === child) this.child = null;

        if (!settled) {
          settled = true;
          reject(error);
          return;
        }

        if (!this.expectedStops.has(child)) onUnexpectedExit(error);
      });

      child.once('exit', (code, signal) => {
        if (this.child === child) this.child = null;
        if (this.expectedStops.has(child)) return;

        const detail = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
        onUnexpectedExit(new Error(`caffeinate exited with ${detail}`));
      });
    });
  }

  stop(): void {
    const child = this.child;
    if (!child) return;

    this.child = null;
    this.expectedStops.add(child);
    child.kill('SIGTERM');
  }
}
