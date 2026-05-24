/**
 * ClipVault - 前端工具函数
 *
 * 纯函数，可独立测试。
 */

/**
 * 搜索过滤: 按文本和标签匹配
 */
export function searchFilter(clips, query) {
    if (!query || !query.trim()) return clips;
    const q = query.toLowerCase().trim();
    return clips.filter(clip =>
        (clip.text && clip.text.toLowerCase().includes(q)) ||
        (clip.tags && clip.tags.some(t => t.includes(q)))
    );
}

/**
 * 排序: 置顶优先 → 时间倒序
 */
export function sortClips(clips) {
    return [...clips].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.created_at || '').localeCompare(a.created_at || '');
    });
}

/**
 * 提取所有不重复标签 (排序)
 */
export function extractTags(clips) {
    const tagSet = new Set();
    clips.forEach(clip => {
        if (clip.tags) clip.tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
}

/**
 * 格式化时间
 * @param {string} dateStr - SQLite datetime 格式 "YYYY-MM-DD HH:MM:SS"
 * @param {Date} [now] - 当前时间 (测试用)
 */
export function formatTime(dateStr, now) {
    if (!dateStr) return '';
    const date = new Date(dateStr.replace(' ', 'T'));
    const current = now || new Date();
    const diff = current - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    // 60秒内
    if (seconds < 60) return '刚刚';

    // 60分钟内
    if (minutes < 60) return `${minutes}分钟前`;

    // 计算日历天差
    const startOfToday = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.floor((startOfToday - startOfDate) / 86400000);

    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');

    // 今天 (超过60分钟)
    if (dayDiff === 0) return `${hours}小时前`;

    // 昨天
    if (dayDiff === 1) return `昨天 ${hh}:${mm}`;

    // 同年
    if (date.getFullYear() === current.getFullYear()) {
        return `${date.getMonth() + 1}月${date.getDate()}日 ${hh}:${mm}`;
    }

    // 跨年
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 截断文本
 */
export function truncateText(text, maxLen = 300) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
}

/**
 * 验证剪切板记录
 */
export function validateClip({ text, tags } = {}) {
    if (!text || !text.trim()) {
        return { valid: false, error: '文本内容不能为空' };
    }
    if (tags && tags.length > 0) {
        const unique = new Set(tags);
        if (unique.size !== tags.length) {
            return { valid: false, error: '标签不能重复' };
        }
    }
    return { valid: true };
}
