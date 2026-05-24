/**
 * ClipVault - IPC 处理器测试 (TDD 阶段 3)
 *
 * 测试 IPC 消息处理逻辑。
 * 通过 mock db 和 clipboard 隔离测试。
 *
 * 运行: npx vitest run tests/ipc-handlers.test.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandlers } from '../main/ipc-handlers.js';

describe('IPC Handlers', () => {
    let handlers;
    let mockDb;
    let mockClipboard;

    beforeEach(() => {
        mockDb = {
            insert: vi.fn().mockReturnValue({ id: 'test-id', type: 'text', text: 'test', tags: [] }),
            getAll: vi.fn().mockReturnValue([]),
            getById: vi.fn().mockReturnValue({ id: 'test-id', type: 'text', text: 'test', tags: [] }),
            update: vi.fn().mockReturnValue({ id: 'test-id', type: 'text', text: 'updated', tags: [] }),
            delete: vi.fn().mockReturnValue(true),
            togglePin: vi.fn().mockReturnValue({ id: 'test-id', pinned: 1, tags: [] }),
            incrementCopyCount: vi.fn().mockReturnValue({ id: 'test-id', copy_count: 1, tags: [] }),
            addTag: vi.fn(),
            removeTag: vi.fn(),
            getAllTags: vi.fn().mockReturnValue([]),
            clearAll: vi.fn(),
            importData: vi.fn().mockReturnValue(3),
        };

        mockClipboard = {
            writeText: vi.fn(),
            writeImage: vi.fn(),
        };

        handlers = createHandlers(mockDb, mockClipboard);
    });

    // ===== 获取全部 =====
    describe('clips:get-all', () => {
        it('返回全部记录', () => {
            mockDb.getAll.mockReturnValue([
                { id: '1', text: 'a', tags: [] },
                { id: '2', text: 'b', tags: [] },
            ]);
            const result = handlers['clips:get-all']({}, {});
            expect(result.length).toBe(2);
        });

        it('传递搜索参数', () => {
            handlers['clips:get-all']({}, { search: 'hello' });
            expect(mockDb.getAll).toHaveBeenCalledWith({ search: 'hello', tag: null, pinned: null, type: null });
        });

        it('传递标签过滤', () => {
            handlers['clips:get-all']({}, { tag: 'work' });
            expect(mockDb.getAll).toHaveBeenCalledWith({ search: null, tag: 'work', pinned: null, type: null });
        });

        it('传递置顶过滤', () => {
            handlers['clips:get-all']({}, { pinned: true });
            expect(mockDb.getAll).toHaveBeenCalledWith({ search: null, tag: null, pinned: true, type: null });
        });
    });

    // ===== 添加记录 =====
    describe('clips:add', () => {
        it('添加文字记录 → 调用 db.insert', () => {
            handlers['clips:add']({}, { type: 'text', text: 'hello' });
            expect(mockDb.insert).toHaveBeenCalledWith({ type: 'text', text: 'hello' });
        });

        it('添加图片记录 → 调用 db.insert', () => {
            handlers['clips:add']({}, { type: 'image', image_path: '/img.png' });
            expect(mockDb.insert).toHaveBeenCalledWith({ type: 'image', image_path: '/img.png' });
        });

        it('空文本 → 返回错误', () => {
            const result = handlers['clips:add']({}, { type: 'text', text: '' });
            expect(result.error).toBeDefined();
        });

        it('无 text 无 image_path → 返回错误', () => {
            const result = handlers['clips:add']({}, { type: 'text' });
            expect(result.error).toBeDefined();
        });
    });

    // ===== 更新记录 =====
    describe('clips:update', () => {
        it('更新记录 → 调用 db.update', () => {
            handlers['clips:update']({}, { id: 'test-id', text: 'new text' });
            expect(mockDb.update).toHaveBeenCalledWith('test-id', { text: 'new text' });
        });

        it('记录不存在 → 返回错误', () => {
            mockDb.update.mockReturnValue(null);
            const result = handlers['clips:update']({}, { id: 'nonexistent', text: 'x' });
            expect(result.error).toBeDefined();
        });
    });

    // ===== 删除记录 =====
    describe('clips:delete', () => {
        it('删除记录 → 调用 db.delete', () => {
            mockDb.getById.mockReturnValue({ id: 'test-id', image_path: null });
            handlers['clips:delete']({}, { id: 'test-id' });
            expect(mockDb.delete).toHaveBeenCalledWith('test-id');
        });

        it('删除不存在的记录 → 返回错误', () => {
            mockDb.getById.mockReturnValue(null);
            const result = handlers['clips:delete']({}, { id: 'nonexistent' });
            expect(result.error).toBeDefined();
        });
    });

    // ===== 复制到剪切板 =====
    describe('clips:copy', () => {
        it('复制文字 → clipboard.writeText + 递增计数', async () => {
            mockDb.getById.mockReturnValue({ id: 'test-id', type: 'text', text: 'copy me' });
            mockClipboard.writeText.mockResolvedValue?.();

            await handlers['clips:copy']({}, { id: 'test-id' });
            expect(mockClipboard.writeText).toHaveBeenCalledWith('copy me');
            expect(mockDb.incrementCopyCount).toHaveBeenCalledWith('test-id');
        });

        it('记录不存在 → 返回错误', async () => {
            mockDb.getById.mockReturnValue(null);
            const result = await handlers['clips:copy']({}, { id: 'nonexistent' });
            expect(result.error).toBeDefined();
        });
    });

    // ===== 置顶 =====
    describe('clips:toggle-pin', () => {
        it('切换置顶 → 调用 db.togglePin', () => {
            handlers['clips:toggle-pin']({}, { id: 'test-id' });
            expect(mockDb.togglePin).toHaveBeenCalledWith('test-id');
        });
    });

    // ===== 标签 =====
    describe('标签操作', () => {
        it('clips:add-tag → 调用 db.addTag', () => {
            handlers['clips:add-tag']({}, { id: 'test-id', tag: 'work' });
            expect(mockDb.addTag).toHaveBeenCalledWith('test-id', 'work');
        });

        it('clips:add-tag 空标签 → 返回错误', () => {
            const result = handlers['clips:add-tag']({}, { id: 'test-id', tag: '' });
            expect(result.error).toBeDefined();
        });

        it('clips:remove-tag → 调用 db.removeTag', () => {
            handlers['clips:remove-tag']({}, { id: 'test-id', tag: 'work' });
            expect(mockDb.removeTag).toHaveBeenCalledWith('test-id', 'work');
        });
    });

    // ===== 清空 =====
    describe('clips:clear-all', () => {
        it('清空全部 → 调用 db.clearAll', () => {
            handlers['clips:clear-all']({}, {});
            expect(mockDb.clearAll).toHaveBeenCalled();
        });
    });

    // ===== 导入导出 =====
    describe('导入导出', () => {
        it('clips:export → 返回全部数据', () => {
            mockDb.getAll.mockReturnValue([{ id: '1', text: 'a' }]);
            const result = handlers['clips:export']({}, {});
            expect(result.clips).toBeDefined();
            expect(result.tags).toBeDefined();
        });

        it('clips:import → 调用 db.importData', () => {
            handlers['clips:import']({}, { data: [{ text: 'a' }] });
            expect(mockDb.importData).toHaveBeenCalled();
        });
    });

    // ===== 获取标签 =====
    describe('tags:get-all', () => {
        it('返回标签列表', () => {
            mockDb.getAllTags.mockReturnValue(['work', 'code']);
            const result = handlers['tags:get-all']({}, {});
            expect(result).toEqual(['work', 'code']);
        });
    });
});
