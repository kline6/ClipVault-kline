/**
 * ClipVault 构建脚本
 */

import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('');
console.log('  ============================');
console.log('  ClipVault Build');
console.log('  ============================');
console.log('');

// ===== 1. 复制 lucide 到本地 =====
console.log('  [1/2] Bundling lucide icons...');

const libsDir = join(__dirname, 'renderer', 'libs');
if (!existsSync(libsDir)) mkdirSync(libsDir, { recursive: true });

const lucideSrc = join(__dirname, 'node_modules', 'lucide', 'dist', 'umd', 'lucide.min.js');
const lucideDst = join(libsDir, 'lucide.min.js');

if (existsSync(lucideSrc)) {
    copyFileSync(lucideSrc, lucideDst);
    console.log('  [OK] lucide copied');
} else {
    console.log('  [WARN] lucide not found, using CDN');
}

// ===== 2. 更新 HTML =====
console.log('  [2/2] Patching HTML...');

const htmlPath = join(__dirname, 'renderer', 'index.html');
let html = readFileSync(htmlPath, 'utf-8');

if (existsSync(lucideDst)) {
    html = html.replace(
        /<script src="https:\/\/unpkg\.com\/lucide@latest"><\/script>/,
        '<script src="libs/lucide.min.js"></script>'
    );
    writeFileSync(htmlPath, html);
    console.log('  [OK] HTML patched');
} else {
    console.log('  [OK] CDN mode');
}

// ===== 3. 打包 (prune 掉 devDependencies，只留 sql.js) =====
console.log('');
console.log('  Packaging...');
console.log('');

try {
    execSync(
        'npx @electron/packager . ClipVault --platform=win32 --arch=x64 --out=dist --overwrite --prune',
        { cwd: __dirname, stdio: 'inherit' }
    );
} catch (err) {
    console.error('');
    console.error('  BUILD FAILED:', err.message);
    process.exit(1);
}

// ===== 4. 确保 sql.js WASM 在打包结果中 =====
const appDir = join(__dirname, 'dist', 'ClipVault-win32-x64', 'resources', 'app');
const sqlDst = join(appDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

if (!existsSync(sqlDst)) {
    console.log('');
    console.log('  WASM not found in package, copying manually...');
    const sqlSrc = join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const sqlDstDir = join(appDir, 'node_modules', 'sql.js', 'dist');
    if (existsSync(sqlSrc)) {
        mkdirSync(sqlDstDir, { recursive: true });
        copyFileSync(sqlSrc, sqlDst);
        console.log('  [OK] WASM copied');
    } else {
        console.error('  [ERROR] sql-wasm.wasm not found in node_modules!');
    }
} else {
    console.log('  [OK] WASM already in package');
}

console.log('');
console.log('  ============================');
console.log('  BUILD SUCCESS!');
console.log('  Output: dist/ClipVault-win32-x64/ClipVault.exe');
console.log('  ============================');
console.log('');
