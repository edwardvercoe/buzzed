import path from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItem,
  nativeImage,
  Notification,
  Tray,
} from 'electron';
import { MacOSCaffeinateController } from './caffeinate-controller';
import { validateTotalMinutes } from './duration';
import { AwakeSessionManager } from './session-manager';
import type { AwakeState, TimerSubmissionResult } from './types';

let tray: Tray | null = null;
let timerWindow: BrowserWindow | null = null;
let statusItem: MenuItem | null = null;
let session: AwakeSessionManager | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let quitting = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, silent: true }).show();
}

function assetPath(filename: string): string {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(base, 'assets', filename);
}

function loadTrayImage(filename: string) {
  const image = nativeImage.createFromPath(assetPath(filename));
  image.setTemplateImage(true);
  return image;
}

function formatRemaining(deadlineMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function statusLabel(state: AwakeState): string {
  if (state.mode === 'inactive') return 'Inactive';
  if (state.mode === 'indefinite') return 'Active — Until turned off';
  return `Active — ${formatRemaining(state.deadlineMs)} remaining`;
}

function updateStatusLabel(): void {
  if (statusItem && session) statusItem.label = statusLabel(session.getState());
}

function refreshMenu(): void {
  if (!tray || !session) return;

  const state = session.getState();
  const loginSettings = app.getLoginItemSettings({ type: 'mainAppService' });

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: statusLabel(state), enabled: false },
    { type: 'separator' },
    {
      label: 'Keep Mac Awake',
      type: 'checkbox',
      checked: state.mode !== 'inactive',
      click: (item) => {
        const action = item.checked ? session?.activateIndefinite() : session?.deactivate();
        void action?.finally(refreshMenu);
      },
    },
    {
      label: 'Start Timer',
      submenu: [
        timerMenuItem('15 Minutes', 15),
        timerMenuItem('30 Minutes', 30),
        timerMenuItem('1 Hour', 60),
        timerMenuItem('2 Hours', 120),
        { type: 'separator' },
        { label: 'Custom…', click: openTimerWindow },
      ],
    },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: loginSettings.openAtLogin,
      click: (item) => updateLoginItem(item.checked),
    },
  ];

  if (loginSettings.status === 'requires-approval') {
    template.push({ label: 'Login item: Approval required', enabled: false });
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Quit Buzzed',
      accelerator: 'Command+Q',
      click: () => {
        quitting = true;
        session?.shutdown();
        app.quit();
      },
    },
  );

  const menu = Menu.buildFromTemplate(template);
  statusItem = menu.items[0] ?? null;
  tray.setContextMenu(menu);
  tray.setImage(loadTrayImage(state.mode === 'inactive' ? 'inactiveTemplate.png' : 'activeTemplate.png'));
  tray.setToolTip(state.mode === 'inactive' ? 'Buzzed — Inactive' : 'Buzzed — Keeping Mac awake');
}

function timerMenuItem(label: string, durationMinutes: number): Electron.MenuItemConstructorOptions {
  return {
    label,
    click: () => {
      void session?.activateTimed(durationMinutes).finally(refreshMenu);
    },
  };
}

function updateLoginItem(openAtLogin: boolean): void {
  app.setLoginItemSettings({ openAtLogin, type: 'mainAppService' });
  const updated = app.getLoginItemSettings({ type: 'mainAppService' });

  if (openAtLogin && updated.status === 'requires-approval') {
    notify('Buzzed needs approval', 'Allow Buzzed in System Settings → General → Login Items.');
  } else if (openAtLogin && !updated.openAtLogin) {
    notify('Could not enable Launch at Login', 'This unsigned build may need to be added manually in System Settings.');
  }

  refreshMenu();
}

function openTimerWindow(): void {
  if (timerWindow) {
    timerWindow.show();
    timerWindow.focus();
    return;
  }

  timerWindow = new BrowserWindow({
    width: 360,
    height: 248,
    title: 'Buzzed Timer',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  timerWindow.setMenuBarVisibility(false);
  timerWindow.once('ready-to-show', () => timerWindow?.show());
  timerWindow.on('closed', () => {
    timerWindow = null;
  });

  if (TIMER_WINDOW_VITE_DEV_SERVER_URL) {
    void timerWindow.loadURL(TIMER_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void timerWindow.loadFile(path.join(__dirname, `../renderer/${TIMER_WINDOW_VITE_NAME}/index.html`));
  }
}

function initialize(): void {
  app.setName('Buzzed');
  app.dock?.hide();

  session = new AwakeSessionManager(new MacOSCaffeinateController(), {
    onStateChange: () => refreshMenu(),
    onTimerExpired: (durationMinutes) => {
      notify('Buzzed turned off', `Your ${durationMinutes}-minute awake timer has ended.`);
    },
    onFailure: (error) => {
      notify('Buzzed stopped unexpectedly', error.message);
    },
  });

  tray = new Tray(loadTrayImage('inactiveTemplate.png'));
  refreshMenu();
  countdownInterval = setInterval(updateStatusLabel, 1_000);
}

ipcMain.handle('timer:submit', async (_event, totalMinutes: unknown): Promise<TimerSubmissionResult> => {
  const validation = validateTotalMinutes(totalMinutes);
  if (!validation.ok) return validation;
  if (!session) return { ok: false, error: 'Buzzed is not ready.' };

  await session.activateTimed(validation.totalMinutes);
  if (session.getState().mode !== 'timed') {
    return { ok: false, error: 'Unable to start caffeinate.' };
  }

  timerWindow?.close();
  return { ok: true };
});

app.on('second-instance', () => {
  timerWindow?.show();
  timerWindow?.focus();
});

app.on('before-quit', () => {
  quitting = true;
  if (countdownInterval) clearInterval(countdownInterval);
  session?.shutdown();
});

app.on('window-all-closed', () => {
  if (quitting) app.quit();
});

if (gotSingleInstanceLock) {
  void app.whenReady().then(() => {
    if (process.platform !== 'darwin') {
      dialog.showErrorBox('Buzzed requires macOS', 'This build supports macOS only.');
      app.quit();
      return;
    }

    initialize();
  });
}
