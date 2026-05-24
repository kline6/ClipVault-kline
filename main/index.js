/**
 * ClipVault - Electron 主进程
 */

import { app, BrowserWindow, clipboard, ipcMain, dialog } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ClipVaultDB } from './db.js';
import { ClipboardWatcher } from './clipboard-watcher.js';
import { createHandlers } from './ipc-handlers.js';
import { createTray } from './tray.js';
import { Settings } from './settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 防止未捕获异常导致进程卡死
process.on('uncaughtException', (err) => {
    console.error('[FATAL]', err);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    console.error('[FATAL]', err);
    process.exit(1);
});

let mainWindow = null;
let tray = null;
let db = null;
let watcher = null;
let settings = null;
let autoDeleteTimer = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        backgroundColor: '#F8C9D2',
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
    });

    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => { mainWindow = null; });

    // 关闭行为
    mainWindow.on('close', async (e) => {
        if (app.isQuitting) return;

        e.preventDefault();

        const action = settings.get('closeAction');

        if (action === 'minimize') {
            mainWindow.hide();
        } else if (action === 'exit') {
            app.isQuitting = true;
            app.quit();
        } else {
            // ask
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['最小化到后台', '完全退出', '取消'],
                defaultId: 0,
                cancelId: 2,
                title: 'ClipVault',
                message: '关闭 ClipVault？',
                detail: '最小化到后台会继续监控剪切板',
            });

            if (result.response === 0) {
                mainWindow.hide();
            } else if (result.response === 1) {
                app.isQuitting = true;
                app.quit();
            }
            // response === 2: 取消，什么都不做
        }
    });
}

function registerIPC() {
    const handlers = createHandlers(db, clipboard);

    for (const [channel, handler] of Object.entries(handlers)) {
        ipcMain.handle(channel, async (event, params) => {
            try {
                return await handler(event, params);
            } catch (err) {
                console.error(`[IPC] ${channel}:`, err.message);
                return { error: err.message };
            }
        });
    }

    // 窗口控制
    ipcMain.handle('win:min', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize(); return true; });
    ipcMain.handle('win:max', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return true;
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
        return true;
    });
    ipcMain.handle('win:close', () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); return true; });

    // 设置
    ipcMain.handle('settings:get', () => settings.getAll());
    ipcMain.handle('settings:set', (_e, { key, value }) => {
        settings.set(key, value);
        applySetting(key, value);
        return settings.getAll();
    });
    ipcMain.handle('settings:setMultiple', (_e, obj) => {
        settings.setMultiple(obj);
        for (const [k, v] of Object.entries(obj)) applySetting(k, v);
        return settings.getAll();
    });
}

function applySetting(key, value) {
    if (key === 'autoStart') {
        app.setLoginItemSettings({ openAtLogin: value });
    }
    if (key === 'autoDeleteHours') {
        setupAutoDelete();
    }
}

// 自动删除过期记录
function setupAutoDelete() {
    if (autoDeleteTimer) clearInterval(autoDeleteTimer);
    const hours = settings.get('autoDeleteHours');
    if (hours <= 0) return;

    // 每分钟检查一次
    autoDeleteTimer = setInterval(() => {
        if (!db) return;
        const count = db.deleteExpired(hours);
        if (count > 0 && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('clips:refresh');
        }
    }, 60000);

    // 启动时立即清理一次
    if (db) {
        const count = db.deleteExpired(hours);
        if (count > 0) console.log(`[MAIN] auto-deleted ${count} expired clips`);
    }
}

function startClipboardWatcher() {
    const imagesDir = join(app.getPath('userData'), 'clipvault-images');

    watcher = new ClipboardWatcher(clipboard, (data) => {
        let clip;
        if (data.type === 'text') {
            clip = db.insert({ type: 'text', text: data.text });
        } else if (data.type === 'image' && data.pngBuffer) {
            const imagePath = watcher.saveImageSync(data.pngBuffer, imagesDir);
            clip = db.insert({ type: 'image', image_path: imagePath });
        }
        if (clip && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('clip:new', clip);
        }
    });

    watcher.start();
}

// ===== 单实例锁 =====
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    // 已有实例在运行，直接退出
    app.quit();
} else {
    // 第二个实例尝试启动时，聚焦已有窗口
    app.on('second-instance', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        const settingsPath = join(app.getPath('userData'), 'settings.json');
        settings = new Settings(settingsPath);
        console.log('[MAIN] settings:', settingsPath);

        app.setLoginItemSettings({ openAtLogin: settings.get('autoStart') });

        const dbPath = join(app.getPath('userData'), 'clipvault.db');
        db = new ClipVaultDB(dbPath);
        await db.ready();
        console.log('[MAIN] db ready:', dbPath);

        registerIPC();
        createWindow();

        tray = createTray(mainWindow, () => {
            app.isQuitting = true;
            app.quit();
        });

        startClipboardWatcher();
        setupAutoDelete();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
            else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
        });

        app.on('window-all-closed', () => {});

        app.on('before-quit', () => {
            if (autoDeleteTimer) { clearInterval(autoDeleteTimer); autoDeleteTimer = null; }
            if (watcher) { try { watcher.stop(); } catch (_) {} watcher = null; }
            if (db) { try { db.close(); } catch (_) {} db = null; }
            if (tray) { try { tray.destroy(); } catch (_) {} tray = null; }

            // 清理完后强制退出，防止进程卡死
            setImmediate(() => process.exit(0));
        });
    });
} // end else (single instance)
