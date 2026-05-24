/**
 * ClipVault - 数据库层测试 (TDD, sql.js 版)
 *
 * 运行: npx vitest run tests/db.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClipVaultDB } from '../main/db.js';

describe('ClipVaultDB', () => {
    let db;

    beforeEach(async () => {
        db = new ClipVaultDB();
        await db.ready();
    });

    afterEach(() => {
        db.close();
    });

    // ===== 初始化 =====
    describe('初始化', () => {
        it('应创建 clips 表', () => {
            const rows = db._query("SELECT name FROM sqlite_master WHERE type='table' AND name='clips'");
            expect(rows.length).toBe(1);
        });

        it('应创建 tags 表', () => {
            const rows = db._query("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'");
            expect(rows.length).toBe(1);
        });

        it('应创建 clip_tags 关联表', () => {
            const rows = db._query("SELECT name FROM sqlite_master WHERE type='table' AND name='clip_tags'");
            expect(rows.length).toBe(1);
        });
    });

    // ===== 插入 =====
    describe('插入记录', () => {
        it('插入文字记录 → 返回完整对象', () => {
            const clip = db.insert({ type: 'text', text: 'hello world' });
            expect(clip).toHaveProperty('id');
            expect(clip.type).toBe('text');
            expect(clip.text).toBe('hello world');
            expect(clip.pinned).toBe(0);
            expect(clip.copy_count).toBe(0);
            expect(clip).toHaveProperty('created_at');
        });

        it('插入图片记录 → type=image', () => {
            const clip = db.insert({ type: 'image', image_path: '/images/abc.png' });
            expect(clip.type).toBe('image');
            expect(clip.image_path).toBe('/images/abc.png');
        });

        it('插入时自动生成不同 id', () => {
            const c1 = db.insert({ type: 'text', text: 'a' });
            const c2 = db.insert({ type: 'text', text: 'b' });
            expect(c1.id).not.toBe(c2.id);
        });

        it('created_at 格式正确', () => {
            const clip = db.insert({ type: 'text', text: 'test' });
            expect(clip.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        });
    });

    // ===== 查询 =====
    describe('查询记录', () => {
        it('全部 → 按 created_at DESC', () => {
            // 手动插入不同时间确保排序确定
            db.importData([
                { type: 'text', text: 'first', created_at: '2026-05-23 10:00:00' },
                { type: 'text', text: 'second', created_at: '2026-05-23 12:00:00' },
            ]);
            const all = db.getAll();
            expect(all.length).toBe(2);
            expect(all[0].text).toBe('second');
        });

        it('按关键词搜索', () => {
            db.insert({ type: 'text', text: 'hello world' });
            db.insert({ type: 'text', text: 'react hooks' });
            db.insert({ type: 'text', text: 'hello react' });
            const results = db.getAll({ search: 'hello' });
            expect(results.length).toBe(2);
        });

        it('搜索不区分大小写', () => {
            db.insert({ type: 'text', text: 'Hello World' });
            expect(db.getAll({ search: 'hello' }).length).toBe(1);
        });

        it('按 tag 过滤', () => {
            const c1 = db.insert({ type: 'text', text: 'work task' });
            const c2 = db.insert({ type: 'text', text: 'personal' });
            db.addTag(c1.id, 'work');
            db.addTag(c2.id, 'personal');
            const results = db.getAll({ tag: 'work' });
            expect(results.length).toBe(1);
            expect(results[0].text).toBe('work task');
        });

        it('按 pinned 过滤', () => {
            const c1 = db.insert({ type: 'text', text: 'pinned' });
            db.insert({ type: 'text', text: 'normal' });
            db.togglePin(c1.id);
            expect(db.getAll({ pinned: true }).length).toBe(1);
        });

        it('按 type=image 过滤', () => {
            db.insert({ type: 'text', text: 'text' });
            db.insert({ type: 'image', image_path: '/img.png' });
            expect(db.getAll({ type: 'image' }).length).toBe(1);
        });

        it('结果包含 tags 数组', () => {
            const clip = db.insert({ type: 'text', text: 'tagged' });
            db.addTag(clip.id, 'work');
            db.addTag(clip.id, 'important');
            const result = db.getAll();
            expect(result[0].tags).toContain('work');
            expect(result[0].tags).toContain('important');
        });

        it('空数据库返回空数组', () => {
            expect(db.getAll()).toEqual([]);
        });
    });

    // ===== 更新 =====
    describe('更新记录', () => {
        it('更新 text', () => {
            const clip = db.insert({ type: 'text', text: 'old' });
            const updated = db.update(clip.id, { text: 'new' });
            expect(updated.text).toBe('new');
        });

        it('更新后 updated_at 变化', () => {
            const clip = db.insert({ type: 'text', text: 'test' });
            const updated = db.update(clip.id, { text: 'changed' });
            expect(updated.updated_at >= clip.created_at).toBe(true);
        });

        it('不存在的记录 → null', () => {
            expect(db.update('nonexistent', { text: 'x' })).toBeNull();
        });
    });

    // ===== 删除 =====
    describe('删除记录', () => {
        it('删除记录', () => {
            const clip = db.insert({ type: 'text', text: 'delete me' });
            expect(db.delete(clip.id)).toBe(true);
            expect(db.getAll().length).toBe(0);
        });

        it('CASCADE 删除 tag 关联', () => {
            const clip = db.insert({ type: 'text', text: 'tagged' });
            db.addTag(clip.id, 'work');
            db.delete(clip.id);
            const links = db._query('SELECT * FROM clip_tags WHERE clip_id = ?', [clip.id]);
            expect(links.length).toBe(0);
        });

        it('不存在的记录 → false', () => {
            expect(db.delete('nonexistent')).toBe(false);
        });
    });

    // ===== 置顶 =====
    describe('置顶', () => {
        it('toggle 0 → 1', () => {
            const clip = db.insert({ type: 'text', text: 'pin' });
            expect(db.togglePin(clip.id).pinned).toBe(1);
        });

        it('toggle 1 → 0', () => {
            const clip = db.insert({ type: 'text', text: 'unpin' });
            db.togglePin(clip.id);
            expect(db.togglePin(clip.id).pinned).toBe(0);
        });
    });

    // ===== 复制计数 =====
    describe('复制计数', () => {
        it('递增 copy_count', () => {
            const clip = db.insert({ type: 'text', text: 'copy' });
            expect(db.incrementCopyCount(clip.id).copy_count).toBe(1);
            expect(db.incrementCopyCount(clip.id).copy_count).toBe(2);
        });
    });

    // ===== 标签 =====
    describe('标签管理', () => {
        it('addTag', () => {
            const clip = db.insert({ type: 'text', text: 'tagged' });
            db.addTag(clip.id, 'work');
            expect(db.getAll()[0].tags).toContain('work');
        });

        it('addTag 不重复', () => {
            const clip = db.insert({ type: 'text', text: 'tagged' });
            db.addTag(clip.id, 'work');
            db.addTag(clip.id, 'work');
            expect(db.getAll()[0].tags.filter(t => t === 'work').length).toBe(1);
        });

        it('addTag 自动创建 tag 记录', () => {
            const clip = db.insert({ type: 'text', text: 'a' });
            db.addTag(clip.id, 'newtag');
            expect(db.getAllTags()).toContain('newtag');
        });

        it('removeTag', () => {
            const clip = db.insert({ type: 'text', text: 'tagged' });
            db.addTag(clip.id, 'work');
            db.addTag(clip.id, 'personal');
            db.removeTag(clip.id, 'work');
            const tags = db.getAll()[0].tags;
            expect(tags).not.toContain('work');
            expect(tags).toContain('personal');
        });

        it('removeTag 不存在的标签 → 无报错', () => {
            const clip = db.insert({ type: 'text', text: 'tagged' });
            expect(() => db.removeTag(clip.id, 'nope')).not.toThrow();
        });

        it('getAllTags 去重 + 排序', () => {
            const c1 = db.insert({ type: 'text', text: 'a' });
            const c2 = db.insert({ type: 'text', text: 'b' });
            db.addTag(c1.id, 'work');
            db.addTag(c1.id, 'code');
            db.addTag(c2.id, 'personal');
            db.addTag(c2.id, 'work');
            expect(db.getAllTags()).toEqual(['code', 'personal', 'work']);
        });

        it('getAllTags 空时返回 []', () => {
            expect(db.getAllTags()).toEqual([]);
        });
    });

    // ===== 清空 =====
    describe('清空全部', () => {
        it('删除所有记录 + 关联', () => {
            const clip = db.insert({ type: 'text', text: 'a' });
            db.addTag(clip.id, 'work');
            db.clearAll();
            expect(db.getAll().length).toBe(0);
            expect(db._query('SELECT * FROM clip_tags').length).toBe(0);
        });
    });

    // ===== 导入 =====
    describe('批量导入', () => {
        it('导入多条记录', () => {
            const count = db.importData([
                { type: 'text', text: 'a', created_at: '2026-01-01 10:00:00' },
                { type: 'text', text: 'b', created_at: '2026-01-02 10:00:00' },
            ]);
            expect(count).toBe(2);
            expect(db.getAll().length).toBe(2);
        });

        it('保留原始时间', () => {
            db.importData([{ type: 'text', text: 'old', created_at: '2025-06-15 08:30:00' }]);
            expect(db.getAll()[0].created_at).toBe('2025-06-15 08:30:00');
        });

        it('空数组返回 0', () => {
            expect(db.importData([])).toBe(0);
        });
    });

    // ===== 按 ID =====
    describe('getById', () => {
        it('找到记录', () => {
            const clip = db.insert({ type: 'text', text: 'find me' });
            expect(db.getById(clip.id).text).toBe('find me');
        });

        it('不存在返回 null', () => {
            expect(db.getById('nonexistent')).toBeNull();
        });
    });
});
