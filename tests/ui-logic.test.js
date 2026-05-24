/**
 * ClipVault - 前端逻辑测试 (TDD 阶段 4)
 *
 * 纯函数测试，不依赖 DOM 或 React。
 *
 * 运行: npx vitest run tests/ui-logic.test.js
 */

import { describe, it, expect } from 'vitest';
import { searchFilter, sortClips, extractTags, formatTime, truncateText, validateClip } from '../renderer/utils.js';

describe('前端逻辑 (ui-logic)', () => {

    // ===== 搜索过滤 =====
    describe('searchFilter', () => {
        const clips = [
            { id: '1', text: 'hello world', tags: ['greeting'] },
            { id: '2', text: 'react hooks', tags: ['code'] },
            { id: '3', text: 'hello react', tags: ['code', 'greeting'] },
        ];

        it('按文本匹配', () => {
            const result = searchFilter(clips, 'hello');
            expect(result.length).toBe(2);
        });

        it('按标签匹配', () => {
            const result = searchFilter(clips, 'code');
            expect(result.length).toBe(2);
        });

        it('不区分大小写', () => {
            const result = searchFilter(clips, 'HELLO');
            expect(result.length).toBe(2);
        });

        it('空搜索词返回全部', () => {
            expect(searchFilter(clips, '').length).toBe(3);
            expect(searchFilter(clips, '  ').length).toBe(3);
            expect(searchFilter(clips, null).length).toBe(3);
        });

        it('无匹配返回空数组', () => {
            expect(searchFilter(clips, 'xyz').length).toBe(0);
        });
    });

    // ===== 排序 =====
    describe('sortClips', () => {
        it('置顶优先', () => {
            const clips = [
                { id: '1', pinned: 0, created_at: '2026-05-23 10:00:00' },
                { id: '2', pinned: 1, created_at: '2026-05-23 08:00:00' },
                { id: '3', pinned: 0, created_at: '2026-05-23 12:00:00' },
            ];
            const sorted = sortClips(clips);
            expect(sorted[0].id).toBe('2');
        });

        it('同为置顶 → 按时间倒序', () => {
            const clips = [
                { id: '1', pinned: 1, created_at: '2026-05-23 08:00:00' },
                { id: '2', pinned: 1, created_at: '2026-05-23 12:00:00' },
            ];
            const sorted = sortClips(clips);
            expect(sorted[0].id).toBe('2');
        });

        it('非置顶 → 按时间倒序', () => {
            const clips = [
                { id: '1', pinned: 0, created_at: '2026-05-23 08:00:00' },
                { id: '2', pinned: 0, created_at: '2026-05-23 12:00:00' },
                { id: '3', pinned: 0, created_at: '2026-05-23 10:00:00' },
            ];
            const sorted = sortClips(clips);
            expect(sorted.map(c => c.id)).toEqual(['2', '3', '1']);
        });

        it('不修改原数组', () => {
            const clips = [
                { id: '1', pinned: 0, created_at: '2026-05-23 10:00:00' },
                { id: '2', pinned: 1, created_at: '2026-05-23 08:00:00' },
            ];
            const original = [...clips];
            sortClips(clips);
            expect(clips).toEqual(original);
        });
    });

    // ===== 标签提取 =====
    describe('extractTags', () => {
        it('提取所有不重复标签并排序', () => {
            const clips = [
                { tags: ['work', 'code'] },
                { tags: ['personal'] },
                { tags: ['work', 'note'] },
            ];
            const tags = extractTags(clips);
            expect(tags).toEqual(['code', 'note', 'personal', 'work']);
        });

        it('空数据返回空数组', () => {
            expect(extractTags([])).toEqual([]);
        });

        it('无标签记录', () => {
            const clips = [{ tags: [] }, { tags: [] }];
            expect(extractTags(clips)).toEqual([]);
        });
    });

    // ===== 时间格式化 =====
    describe('formatTime', () => {
        it('60秒内 → "刚刚"', () => {
            const now = new Date('2026-05-23T14:30:22');
            expect(formatTime('2026-05-23 14:30:00', now)).toBe('刚刚');
        });

        it('3分钟前', () => {
            const now = new Date('2026-05-23T14:33:00');
            expect(formatTime('2026-05-23 14:30:00', now)).toBe('3分钟前');
        });

        it('2小时前', () => {
            const now = new Date('2026-05-23T16:30:00');
            expect(formatTime('2026-05-23 14:30:00', now)).toBe('2小时前');
        });

        it('昨天 → "昨天 HH:MM"', () => {
            const now = new Date('2026-05-24T10:00:00');
            const result = formatTime('2026-05-23 14:30:00', now);
            expect(result).toBe('昨天 14:30');
        });

        it('更早 → "M月D日 HH:MM"', () => {
            const now = new Date('2026-05-28T10:00:00');
            const result = formatTime('2026-05-23 14:30:00', now);
            expect(result).toBe('5月23日 14:30');
        });

        it('跨年 → "YYYY年M月D日"', () => {
            const now = new Date('2027-01-02T10:00:00');
            const result = formatTime('2026-05-23 14:30:00', now);
            expect(result).toBe('2026年5月23日');
        });
    });

    // ===== 文本截断 =====
    describe('truncateText', () => {
        it('短文本不截断', () => {
            expect(truncateText('hello', 100)).toBe('hello');
        });

        it('超长文本截断 + "..."', () => {
            const long = 'a'.repeat(400);
            const result = truncateText(long, 300);
            expect(result.length).toBe(303); // 300 + '...'
            expect(result.endsWith('...')).toBe(true);
        });

        it('恰好等于限制不截断', () => {
            const text = 'a'.repeat(100);
            expect(truncateText(text, 100)).toBe(text);
        });

        it('默认限制 300', () => {
            const long = 'a'.repeat(400);
            const result = truncateText(long);
            expect(result.length).toBe(303);
        });
    });

    // ===== 数据验证 =====
    describe('validateClip', () => {
        it('空文本无效', () => {
            expect(validateClip({ text: '' }).valid).toBe(false);
        });

        it('纯空白无效', () => {
            expect(validateClip({ text: '   ' }).valid).toBe(false);
        });

        it('有效文本', () => {
            expect(validateClip({ text: 'hello' }).valid).toBe(true);
        });

        it('重复标签无效', () => {
            const result = validateClip({ text: 'test', tags: ['work', 'work'] });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('重复');
        });

        it('不重复标签有效', () => {
            expect(validateClip({ text: 'test', tags: ['work', 'code'] }).valid).toBe(true);
        });
    });
});
