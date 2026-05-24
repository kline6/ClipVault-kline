/**
 * ClipVault - 数据库模块 (sql.js 版)
 *
 * sql.js 是纯内存数据库，需要手动读写文件来持久化。
 */

import initSqlJs from 'sql.js';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ClipVaultDB {
    /**
     * @param {string|null} dbPath - 文件路径, null 为纯内存 (测试用)
     */
    constructor(dbPath = null) {
        this._dbPath = dbPath;
        this._db = null;
        this._ready = this._init();
    }

    async _init() {
        const SQL = await initSqlJs({
            locateFile: file => join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
        });

        // 如果有文件路径且文件已存在，从文件加载
        if (this._dbPath && existsSync(this._dbPath)) {
            const fileBuffer = readFileSync(this._dbPath);
            this._db = new SQL.Database(fileBuffer);
        } else {
            this._db = new SQL.Database();
        }

        this._db.run('PRAGMA foreign_keys = ON');
        this._db.run(`
            CREATE TABLE IF NOT EXISTS clips (
                id         TEXT PRIMARY KEY,
                type       TEXT NOT NULL DEFAULT 'text',
                text       TEXT,
                image_path TEXT,
                pinned     INTEGER DEFAULT 0,
                copy_count INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )
        `);
        this._db.run(`
            CREATE TABLE IF NOT EXISTS tags (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        `);
        this._db.run(`
            CREATE TABLE IF NOT EXISTS clip_tags (
                clip_id TEXT REFERENCES clips(id) ON DELETE CASCADE,
                tag_id  INTEGER REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (clip_id, tag_id)
            )
        `);

        // 首次创建时保存
        this._save();
    }

    async ready() {
        await this._ready;
        return this;
    }

    /**
     * 将内存数据库写入磁盘
     */
    _save() {
        if (!this._dbPath || !this._db) return;
        const dir = dirname(this._dbPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const data = this._db.export();  // Uint8Array
        writeFileSync(this._dbPath, Buffer.from(data));
    }

    _now() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    _query(sql, params = []) {
        const stmt = this._db.prepare(sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    }

    _queryOne(sql, params = []) {
        const rows = this._query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }

    // ===== 写入操作后自动保存 =====

    insert({ type = 'text', text = null, image_path = null }) {
        const id = randomUUID();
        const now = this._now();
        this._db.run(
            `INSERT INTO clips (id, type, text, image_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, type, text, image_path, now, now]
        );
        this._save();
        return this.getById(id);
    }

    update(id, { text }) {
        const existing = this._queryOne('SELECT id FROM clips WHERE id = ?', [id]);
        if (!existing) return null;
        this._db.run('UPDATE clips SET text = ?, updated_at = ? WHERE id = ?', [text, this._now(), id]);
        this._save();
        return this.getById(id);
    }

    delete(id) {
        const existing = this._queryOne('SELECT id FROM clips WHERE id = ?', [id]);
        if (!existing) return false;
        this._db.run('DELETE FROM clip_tags WHERE clip_id = ?', [id]);
        this._db.run('DELETE FROM clips WHERE id = ?', [id]);
        this._save();
        return true;
    }

    togglePin(id) {
        this._db.run(
            `UPDATE clips SET pinned = CASE WHEN pinned = 0 THEN 1 ELSE 0 END, updated_at = ? WHERE id = ?`,
            [this._now(), id]
        );
        this._save();
        return this.getById(id);
    }

    incrementCopyCount(id) {
        this._db.run('UPDATE clips SET copy_count = copy_count + 1, updated_at = ? WHERE id = ?', [this._now(), id]);
        this._save();
        return this.getById(id);
    }

    addTag(clipId, tagName) {
        this._db.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [tagName]);
        const tag = this._queryOne('SELECT id FROM tags WHERE name = ?', [tagName]);
        if (tag) {
            this._db.run('INSERT OR IGNORE INTO clip_tags (clip_id, tag_id) VALUES (?, ?)', [clipId, tag.id]);
        }
        this._save();
    }

    removeTag(clipId, tagName) {
        const tag = this._queryOne('SELECT id FROM tags WHERE name = ?', [tagName]);
        if (!tag) return;
        this._db.run('DELETE FROM clip_tags WHERE clip_id = ? AND tag_id = ?', [clipId, tag.id]);
        this._save();
    }

    clearAll() {
        this._db.run('DELETE FROM clip_tags');
        this._db.run('DELETE FROM clips');
        this._db.run('DELETE FROM tags');
        this._save();
    }

    /**
     * 删除超过指定小时数的记录 (跳过置顶)
     * 返回删除数量
     */
    deleteExpired(hours) {
        const rows = this._query(
            `SELECT id FROM clips WHERE pinned = 0
             AND datetime(created_at, '+' || ? || ' hours') < datetime('now', 'localtime')`,
            [hours]
        );
        for (const row of rows) {
            this._db.run('DELETE FROM clip_tags WHERE clip_id = ?', [row.id]);
            this._db.run('DELETE FROM clips WHERE id = ?', [row.id]);
        }
        if (rows.length > 0) this._save();
        return rows.length;
    }

    /**
     * 复制时重置计时 (更新 created_at 为当前时间)
     */
    resetExpiry(id) {
        const now = this._now();
        this._db.run('UPDATE clips SET created_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
        this._save();
    }

    importData(records) {
        if (!Array.isArray(records) || records.length === 0) return 0;
        for (const item of records) {
            this._db.run(
                `INSERT INTO clips (id, type, text, image_path, pinned, copy_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.id || randomUUID(),
                    item.type || 'text',
                    item.text || null,
                    item.image_path || null,
                    item.pinned ? 1 : 0,
                    item.copy_count || 0,
                    item.created_at || this._now(),
                    item.updated_at || item.created_at || this._now(),
                ]
            );
        }
        this._save();
        return records.length;
    }

    // ===== 只读操作 =====

    getById(id) {
        const clip = this._queryOne('SELECT * FROM clips WHERE id = ?', [id]);
        if (!clip) return null;
        return { ...clip, tags: this._getClipTags(id) };
    }

    getAll({ search = null, tag = null, pinned = null, type = null } = {}) {
        let sql = 'SELECT DISTINCT c.* FROM clips c';
        const conditions = [];
        const params = [];

        if (tag) {
            sql += ' JOIN clip_tags ct ON c.id = ct.clip_id JOIN tags t ON ct.tag_id = t.id';
            conditions.push('t.name = ?');
            params.push(tag);
        }
        if (search) {
            conditions.push('LOWER(c.text) LIKE ?');
            params.push(`%${search.toLowerCase()}%`);
        }
        if (pinned !== null) {
            conditions.push('c.pinned = ?');
            params.push(pinned ? 1 : 0);
        }
        if (type) {
            conditions.push('c.type = ?');
            params.push(type);
        }

        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY c.created_at DESC';

        const clips = this._query(sql, params);
        return clips.map(clip => ({ ...clip, tags: this._getClipTags(clip.id) }));
    }

    getAllTags() {
        const rows = this._query('SELECT name FROM tags ORDER BY name');
        return rows.map(r => r.name);
    }

    _getClipTags(clipId) {
        const rows = this._query(
            `SELECT t.name FROM tags t
             JOIN clip_tags ct ON t.id = ct.tag_id
             WHERE ct.clip_id = ? ORDER BY t.name`,
            [clipId]
        );
        return rows.map(r => r.name);
    }

    close() {
        this._save();
        if (this._db) this._db.close();
    }
}
