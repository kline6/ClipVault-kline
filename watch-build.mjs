/**
 * ClipVault - 自动监听 + 打包
 *
 * 监听 main/ 和 renderer/ 目录，文件变化时自动重新打包。
 * 运行: node watch-build.mjs
 */

import { watch } from 'fs';
import { existsSync, readdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

let building = false;
let pending = false;
let debounceTimer = null;

const watchDirs = [
    join(__dirname, 'main'),
    join(__dirname, 'renderer'),
    join(__dirname, 'package.json'),
];

function log(msg) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    console.log(`  [${time}] ${msg}`);
}

function build() {
    if (building) {
        pending = true;
        return;
    }
    building = true;
    log('Rebuilding...');

    try {
        execSync('node build.mjs', { cwd: __dirname, stdio: 'inherit' });
        log('Build complete! dist/ClipVault-win32-x64/ClipVault.exe');
    } catch (err) {
        log('Build failed: ' + err.message.split('\n')[0]);
    }

    building = false;

    if (pending) {
        pending = false;
        setTimeout(build, 500);
    }
}

function watchDir(dir) {
    if (!existsSync(dir)) return;

    if (dir.endsWith('.json')) {
        // watch single file
        watch(dir, { persistent: true }, (eventType) => {
            if (eventType) scheduleBuild(dir);
        });
        return;
    }

    // watch directory
    watch(dir, { persistent: true, recursive: true }, (eventType, filename) => {
        if (!filename) return;
        // ignore node_modules, libs, dist
        if (filename.includes('node_modules') || filename.includes('libs') || filename.includes('dist')) return;
        scheduleBuild(join(dir, filename));
    });
}

function scheduleBuild(filepath) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const rel = relative(__dirname, filepath || '');
        log(`Changed: ${rel}`);
        build();
    }, 800);
}

// ===== 启动 =====
console.log('');
console.log('  ============================');
console.log('  ClipVault Watch & Build');
console.log('  ============================');
console.log('');
console.log('  Watching for changes...');
console.log('');

for (const dir of watchDirs) {
    watchDir(dir);
    const name = relative(__dirname, dir);
    log(`Watching: ${name}/`);
}

console.log('');
console.log('  Press Ctrl+C to stop');
console.log('');

// 首次打包
build();
