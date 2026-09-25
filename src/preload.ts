import { contextBridge, ipcRenderer } from 'electron';
import type { TimerSubmissionResult } from './types';

contextBridge.exposeInMainWorld('buzzed', {
  submitDuration: (totalMinutes: number): Promise<TimerSubmissionResult> =>
    ipcRenderer.invoke('timer:submit', totalMinutes),
});
