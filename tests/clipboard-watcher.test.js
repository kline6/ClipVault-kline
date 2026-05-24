/**
 * ClipVault - 剪切板监控器测试 (TDD 阶段 2)
 *
 * 测试剪切板轮询监控逻辑。
 * 使用 mock clipboard 对象模拟系统剪切板。
 *
 * 运行: npx vitest run tests/clipboard-watcher.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClipboardWatcher } from '../main/clipboard-watcher.js';

describe('ClipboardWatcher', () => {
    let watcher;
    let mockClipboard;
    let callback;

    beforeEach(() => {
        vi.useFakeTimers();
        callback = vi.fn();
        mockClipboard = {
            readText: vi.fn().mockReturnValue(''),
            readImage: vi.fn().mockReturnValue({ isEmpty: () => true, toPNG: () => Buffer.from('') }),
        };
    });

    afterEach(() => {
        if (watcher) watcher.stop();
        vi.useRealTimers();
    });

    // ===== 启动/停止 =====
    describe('启停控制', () => {
        it('start() 创建定时器', () => {
            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();
            expect(watcher.isRunning()).toBe(true);
        });

        it('stop() 清除定时器', () => {
            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();
            watcher.stop();
            expect(watcher.isRunning()).toBe(false);
        });

        it('重复 start 不创建多个定时器', () => {
            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();
            watcher.start(); // 不应报错
            expect(watcher.isRunning()).toBe(true);
        });

        it('未启动时 stop 不报错', () => {
            watcher = new ClipboardWatcher(mockClipboard, callback);
            expect(() => watcher.stop()).not.toThrow();
        });
    });

    // ===== 文字监控 =====
    describe('文字变化检测', () => {
        it('检测到新文字 → 触发 callback', () => {
            // 初始为空 (start() 会读取初始状态)
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            // start() 之后改变剪切板内容
            mockClipboard.readText.mockReturnValue('new text');
            vi.advanceTimersByTime(500);

            expect(callback).toHaveBeenCalledWith({
                type: 'text',
                text: 'new text',
                image: null,
            });
        });

        it('文字未变化 → 不重复触发', () => {
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            mockClipboard.readText.mockReturnValue('same text');
            vi.advanceTimersByTime(500); // 第一次检测 → 触发
            vi.advanceTimersByTime(500); // 第二次检测 → 不触发

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('空文字 → 不触发', () => {
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            vi.advanceTimersByTime(500);

            expect(callback).not.toHaveBeenCalled();
        });

        it('文字变化后 → 触发新 callback', () => {
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            mockClipboard.readText.mockReturnValue('first');
            vi.advanceTimersByTime(500);
            expect(callback).toHaveBeenCalledTimes(1);

            mockClipboard.readText.mockReturnValue('second');
            vi.advanceTimersByTime(500);
            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenLastCalledWith({
                type: 'text',
                text: 'second',
                image: null,
            });
        });
    });

    // ===== 图片监控 =====
    describe('图片变化检测', () => {
        it('检测到新图片 → 触发 callback (type=image)', () => {
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            // start() 之后改变图片
            const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0xAA, 0xBB]);
            const mockImage = {
                isEmpty: () => false,
                toPNG: () => pngData,
                getSize: () => ({ width: 1920, height: 1080 }),
            };
            mockClipboard.readImage.mockReturnValue(mockImage);
            vi.advanceTimersByTime(500);

            expect(callback).toHaveBeenCalledWith({
                type: 'image',
                pngBuffer: pngData,
                width: 1920,
                height: 1080,
            });
        });

        it('图片未变化 (相同尺寸+长度) → 不重复触发', () => {
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            const pngData = Buffer.from([0x89, 0x50]);
            const mockImage = {
                isEmpty: () => false,
                toPNG: () => pngData,
                getSize: () => ({ width: 100, height: 100 }),
            };
            mockClipboard.readImage.mockReturnValue(mockImage);
            vi.advanceTimersByTime(500); // 第一次 → 触发
            vi.advanceTimersByTime(500); // 第二次 → 不触发

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('空图片 → 不触发', () => {
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            vi.advanceTimersByTime(500);

            expect(callback).not.toHaveBeenCalled();
        });

        it('过小图片 (< 2px) → 不触发', () => {
            mockClipboard.readText.mockReturnValue('');
            mockClipboard.readImage.mockReturnValue({ isEmpty: () => true });

            watcher = new ClipboardWatcher(mockClipboard, callback);
            watcher.start();

            mockClipboard.readImage.mockReturnValue({
                isEmpty: () => false,
                toPNG: () => Buffer.from([0x89]),
                getSize: () => ({ width: 1, height: 1 }),
            });
            vi.advanceTimersByTime(500);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    // ===== 图片存储 =====
    describe('图片存储', () => {
        it('saveImageSync 写入文件并返回路径', () => {
            watcher = new ClipboardWatcher(mockClipboard, callback);
            const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
            const path = watcher.saveImageSync(pngBuffer, '/tmp/images');

            expect(path).toContain('clip-');
            expect(path).toMatch(/clip-.+\.png$/);
        });
    });
});
