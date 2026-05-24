/**
 * ClipVault - 设置模块
 *
 * 管理用户偏好设置，JSON 文件持久化。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DEFAULT_SETTINGS = {
    autoDeleteHours: 24,        // 自动删除时间 (小时), 0=不自动删除
    resetOnCopy: true,          // 复制后重置自动删除计时
    closeAction: 'ask',         // 'minimize' | 'exit' | 'ask'
    autoStart: false,           // 开机自启
};

export class Settings {
    constructor(filePath) {
        this._path = filePath;
        this._data = { ...DEFAULT_SETTINGS };
        this._load();
    }

    _load() {
        if (existsSync(this._path)) {
            try {
                const raw = readFileSync(this._path, 'utf-8');
                const parsed = JSON.parse(raw);
                this._data = { ...DEFAULT_SETTINGS, ...parsed };
            } catch {
                this._data = { ...DEFAULT_SETTINGS };
            }
        }
    }

    _save() {
        const dir = dirname(this._path);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(this._path, JSON.stringify(this._data, null, 2));
    }

    get(key) {
        return this._data[key];
    }

    getAll() {
        return { ...this._data };
    }

    set(key, value) {
        this._data[key] = value;
        this._save();
    }

    setMultiple(obj) {
        Object.assign(this._data, obj);
        this._save();
    }
}
