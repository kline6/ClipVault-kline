/**
 * ClipVault - IPC 消息处理器
 *
 * 注册所有 Electron IPC 频道处理逻辑。
 * 每个 handler 是一个纯函数，方便测试。
 */

import { nativeImage } from 'electron';

/**
 * 创建 IPC 处理器
 * @param {ClipVaultDB} db - 数据库实例
 * @param {Electron.Clipboard} clipboard - 系统剪切板
 * @returns {Object} handler map
 */
export function createHandlers(db, clipboard) {
    return {
        // ===== 获取全部记录 =====
        'clips:get-all': (_event, params = {}) => {
            return db.getAll({
                search: params.search || null,
                tag: params.tag || null,
                pinned: params.pinned || null,
                type: params.type || null,
            });
        },

        // ===== 添加记录 =====
        'clips:add': (_event, { type = 'text', text, image_path } = {}) => {
            if (type === 'text' && (!text || !text.trim())) {
                return { error: '文本内容不能为空' };
            }
            if (type === 'image' && !image_path) {
                return { error: '图片路径不能为空' };
            }
            return db.insert({ type, text, image_path });
        },

        // ===== 更新记录 =====
        'clips:update': (_event, { id, text }) => {
            if (!id) return { error: '缺少记录 ID' };
            if (!text || !text.trim()) return { error: '文本内容不能为空' };
            const result = db.update(id, { text: text.trim() });
            if (!result) return { error: '记录不存在' };
            return result;
        },

        // ===== 删除记录 =====
        'clips:delete': (_event, { id }) => {
            const clip = db.getById(id);
            if (!clip) return { error: '记录不存在' };
            db.delete(id);
            return { success: true, deletedClip: clip };
        },

        // ===== 复制到剪切板 =====
        'clips:copy': async (_event, { id }) => {
            const clip = db.getById(id);
            if (!clip) return { error: '记录不存在' };

            if (clip.type === 'text') {
                clipboard.writeText(clip.text);
            } else if (clip.type === 'image' && clip.image_path) {
                const img = nativeImage.createFromPath(clip.image_path);
                clipboard.writeImage(img);
            }

            db.incrementCopyCount(id);
            db.resetExpiry(id);  // 复制后重置自动删除计时
            return { success: true };
        },

        // ===== 切换置顶 =====
        'clips:toggle-pin': (_event, { id }) => {
            return db.togglePin(id);
        },

        // ===== 添加标签 =====
        'clips:add-tag': (_event, { id, tag }) => {
            if (!tag || !tag.trim()) return { error: '标签名不能为空' };
            db.addTag(id, tag.trim().toLowerCase());
            return db.getById(id);
        },

        // ===== 删除标签 =====
        'clips:remove-tag': (_event, { id, tag }) => {
            db.removeTag(id, tag);
            return db.getById(id);
        },

        // ===== 清空全部 =====
        'clips:clear-all': () => {
            db.clearAll();
            return { success: true };
        },

        // ===== 导出数据 =====
        'clips:export': () => {
            return {
                clips: db.getAll(),
                tags: db.getAllTags(),
                exportedAt: new Date().toISOString(),
            };
        },

        // ===== 导入数据 =====
        'clips:import': (_event, { data }) => {
            if (!Array.isArray(data)) return { error: '数据格式错误' };
            const count = db.importData(data);
            return { success: true, imported: count };
        },

        // ===== 获取所有标签 =====
        'tags:get-all': () => {
            return db.getAllTags();
        },
    };
}
