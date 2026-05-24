/**
 * ClipVault - 系统托盘 (带自定义图标)
 */

import { Tray, Menu, nativeImage } from 'electron';

function createTrayIcon() {
    // 16x16 粉色剪贴板图标
    const w = 16, h = 16;
    const pixels = Buffer.alloc(w * h * 4, 0); // RGBA

    function setPixel(x, y, r, g, b, a) {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const i = (y * w + x) * 4;
        // premultiply alpha
        const alpha = a / 255;
        pixels[i]     = Math.round(r * alpha); // B (nativeImage uses BGRA on some platforms, but RGBA works with fromBuffer)
        pixels[i + 1] = Math.round(g * alpha); // G
        pixels[i + 2] = Math.round(r * alpha); // R
        pixels[i + 3] = a; // A
    }

    function fillRect(x0, y0, w2, h2, r, g, b, a) {
        for (let y = y0; y < y0 + h2; y++)
            for (let x = x0; x < x0 + w2; x++)
                setPixel(x, y, r, g, b, a);
    }

    // 背景透明
    // 剪贴板主体 (粉色圆角矩形)
    fillRect(3, 4, 10, 11, 244, 114, 182, 255); // 粉色主体
    fillRect(2, 5, 1, 9, 244, 114, 182, 200);   // 左圆角
    fillRect(13, 5, 1, 9, 244, 114, 182, 200);  // 右圆角
    fillRect(4, 3, 8, 1, 244, 114, 182, 200);   // 上圆角
    fillRect(4, 15, 8, 1, 244, 114, 182, 200);  // 下圆角

    // 夹子 (深粉色)
    fillRect(5, 2, 6, 3, 190, 70, 140, 255);
    fillRect(6, 1, 4, 1, 190, 70, 140, 200);

    // 文字线条 (白色)
    fillRect(5, 7, 6, 1, 255, 255, 255, 200);
    fillRect(5, 9, 5, 1, 255, 255, 255, 160);
    fillRect(5, 11, 4, 1, 255, 255, 255, 120);

    return nativeImage.createFromBuffer(pixels, { width: w, height: h });
}

export function createTray(mainWindow, onQuit) {
    const icon = createTrayIcon();
    const tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示 ClipVault',
            click: () => {
                try {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                } catch (_) {}
            },
        },
        { type: 'separator' },
        {
            label: '完全退出',
            click: () => {
                try {
                    if (onQuit) onQuit();
                } catch (_) {}
            },
        },
    ]);

    tray.setToolTip('ClipVault - 剪切板管理器');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        try {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
            }
        } catch (_) {}
    });

    return tray;
}
