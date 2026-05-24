/**
 * ClipVault - 剪切板监控模块
 *
 * 轮询系统剪切板，检测文字和图片变化。
 * 图片只调用一次 toPNG()，同步写入文件，确保不损坏。
 */

import { randomUUID } from 'crypto';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

export class ClipboardWatcher {
    constructor(clipboard, callback, interval = 500) {
        this.clipboard = clipboard;
        this.callback = callback;
        this.interval = interval;
        this._timer = null;
        this._lastText = '';
        this._lastImageSize = { width: 0, height: 0 };
        this._lastImageBufferLen = 0;
    }

    start() {
        if (this._timer) return;

        // 读取初始状态 (不触发 callback)
        this._lastText = this.clipboard.readText() || '';
        const img = this.clipboard.readImage();
        if (img && !img.isEmpty()) {
            const size = img.getSize();
            this._lastImageSize = size;
            const buf = img.toPNG();
            this._lastImageBufferLen = buf.length;
        }

        this._timer = setInterval(() => this._check(), this.interval);
    }

    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    isRunning() {
        return this._timer !== null;
    }

    /**
     * 保存 PNG buffer 到磁盘 (同步写入，确保完成)
     * 返回文件路径
     */
    saveImageSync(pngBuffer, imagesDir) {
        mkdirSync(imagesDir, { recursive: true });
        const filename = `clip-${randomUUID()}.png`;
        const filePath = join(imagesDir, filename);
        writeFileSync(filePath, pngBuffer);
        return filePath;
    }

    _check() {
        // 1. 检查文字
        const currentText = this.clipboard.readText() || '';
        if (currentText && currentText !== this._lastText) {
            this._lastText = currentText;
            this._lastImageSize = { width: 0, height: 0 };
            this._lastImageBufferLen = 0;
            this.callback({ type: 'text', text: currentText });
            return;
        }

        // 2. 检查图片
        const currentImage = this.clipboard.readImage();
        if (currentImage && !currentImage.isEmpty()) {
            const size = currentImage.getSize();
            // 过滤无效图片 (1x1 像素等)
            if (size.width < 2 || size.height < 2) return;

            // 只调用一次 toPNG()
            const pngBuffer = currentImage.toPNG();
            if (!pngBuffer || pngBuffer.length === 0) return;

            const changed =
                size.width !== this._lastImageSize.width ||
                size.height !== this._lastImageSize.height ||
                pngBuffer.length !== this._lastImageBufferLen;

            if (changed) {
                this._lastImageSize = size;
                this._lastImageBufferLen = pngBuffer.length;
                this._lastText = '';

                // 直接传递 PNG buffer，避免重复 toPNG()
                this.callback({
                    type: 'image',
                    pngBuffer: pngBuffer,
                    width: size.width,
                    height: size.height,
                });
            }
        }
    }
}
