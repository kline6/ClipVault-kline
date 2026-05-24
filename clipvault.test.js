/**
 * ClipVault - 单元测试
 * 核心逻辑测试 (纯函数测试)
 *
 * 运行: 在浏览器控制台中粘贴运行，或用 Node.js 执行
 */

const testResults = { passed: 0, failed: 0, errors: [] };

function assert(condition, testName) {
    if (condition) {
        testResults.passed++;
        console.log(`  ✅ ${testName}`);
    } else {
        testResults.failed++;
        testResults.errors.push(testName);
        console.error(`  ❌ ${testName}`);
    }
}

function assertEqual(actual, expected, testName) {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    assert(pass, testName);
    if (!pass) {
        console.error(`     期望: ${JSON.stringify(expected)}`);
        console.error(`     实际: ${JSON.stringify(actual)}`);
    }
}

// ===== Clip 对象工厂 =====
function createClip(text, options = {}) {
    return {
        id: options.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        text,
        timestamp: options.timestamp || Date.now(),
        pinned: options.pinned || false,
        tags: options.tags || [],
        copyCount: options.copyCount || 0,
        ...options
    };
}

// ===== 测试组 1: 创建 Clip 对象 =====
console.log('\n📋 测试组 1: 创建 Clip 对象');

(function testCreateClip() {
    const clip = createClip('hello world');
    assertEqual(typeof clip.id, 'string', 'ID 应该是字符串');
    assertEqual(clip.text, 'hello world', '文本内容应正确');
    assertEqual(clip.pinned, false, '默认不置顶');
    assertEqual(clip.tags.length, 0, '默认无标签');
    assertEqual(clip.copyCount, 0, '默认复制次数为 0');
    assert(typeof clip.timestamp === 'number', '时间戳应该是数字');
})();

(function testCreateClipWithOptions() {
    const clip = createClip('test', { pinned: true, tags: ['work'], copyCount: 5 });
    assertEqual(clip.pinned, true, '可设置为置顶');
    assertEqual(clip.tags, ['work'], '可设置标签');
    assertEqual(clip.copyCount, 5, '可设置复制次数');
})();

// ===== 测试组 2: 添加记录 =====
console.log('\n📋 测试组 2: 添加记录');

(function testAddClip() {
    let clips = [];
    const newClip = createClip('第一条记录');
    clips = [newClip, ...clips];
    assertEqual(clips.length, 1, '添加后应有 1 条记录');
    assertEqual(clips[0].text, '第一条记录', '第一条记录内容正确');

    const second = createClip('第二条记录');
    clips = [second, ...clips];
    assertEqual(clips.length, 2, '添加后应有 2 条记录');
    assertEqual(clips[0].text, '第二条记录', '最新记录在前面');
})();

(function testAddEmptyText() {
    const text = '  ';
    const trimmed = text.trim();
    assertEqual(trimmed, '', '空白文本 trim 后为空');
    // 在实际代码中，空文本不应被添加
})();

// ===== 测试组 3: 删除记录 =====
console.log('\n📋 测试组 3: 删除记录');

(function testDeleteClip() {
    let clips = [
        createClip('clip-1', { id: 'a1' }),
        createClip('clip-2', { id: 'a2' }),
        createClip('clip-3', { id: 'a3' }),
    ];
    clips = clips.filter(c => c.id !== 'a2');
    assertEqual(clips.length, 2, '删除后应有 2 条记录');
    assertEqual(clips.map(c => c.id), ['a1', 'a3'], '删除的记录应消失');
})();

(function testDeleteNonExistent() {
    let clips = [createClip('only', { id: 'x1' })];
    clips = clips.filter(c => c.id !== 'nonexistent');
    assertEqual(clips.length, 1, '删除不存在的记录应无影响');
})();

// ===== 测试组 4: 置顶/取消置顶 =====
console.log('\n📋 测试组 4: 置顶功能');

(function testPinClip() {
    let clip = createClip('pin me', { id: 'p1' });
    assertEqual(clip.pinned, false, '初始不置顶');
    clip = { ...clip, pinned: !clip.pinned };
    assertEqual(clip.pinned, true, '置顶后应为 true');
    clip = { ...clip, pinned: !clip.pinned };
    assertEqual(clip.pinned, false, '再次切换应为 false');
})();

(function testPinSortOrder() {
    let clips = [
        createClip('normal-1', { id: 'n1', pinned: false, timestamp: 3 }),
        createClip('pinned-1', { id: 'p1', pinned: true, timestamp: 1 }),
        createClip('normal-2', { id: 'n2', pinned: false, timestamp: 2 }),
    ];
    clips.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
    });
    assertEqual(clips[0].id, 'p1', '置顶记录应在最前');
    assertEqual(clips[1].id, 'n2', '普通记录按时间倒序');
    assertEqual(clips[2].id, 'n1', '较旧的普通记录在后');
})();

// ===== 测试组 5: 复制计数 =====
console.log('\n📋 测试组 5: 复制计数');

(function testCopyCount() {
    let clip = createClip('copy me', { id: 'c1', copyCount: 0 });
    clip = { ...clip, copyCount: clip.copyCount + 1 };
    assertEqual(clip.copyCount, 1, '复制一次后计数为 1');
    clip = { ...clip, copyCount: clip.copyCount + 1 };
    assertEqual(clip.copyCount, 2, '复制两次后计数为 2');
})();

// ===== 测试组 6: 标签管理 =====
console.log('\n📋 测试组 6: 标签管理');

(function testAddTag() {
    let clip = createClip('tagged', { id: 't1', tags: [] });
    const tag = 'work';
    if (!clip.tags.includes(tag)) {
        clip = { ...clip, tags: [...clip.tags, tag] };
    }
    assertEqual(clip.tags, ['work'], '添加标签后应包含该标签');
})();

(function testAddDuplicateTag() {
    let clip = createClip('tagged', { id: 't2', tags: ['work'] });
    const tag = 'work';
    if (!clip.tags.includes(tag)) {
        clip = { ...clip, tags: [...clip.tags, tag] };
    }
    assertEqual(clip.tags.length, 1, '不应添加重复标签');
})();

(function testRemoveTag() {
    let clip = createClip('tagged', { id: 't3', tags: ['work', 'important'] });
    clip = { ...clip, tags: clip.tags.filter(t => t !== 'work') };
    assertEqual(clip.tags, ['important'], '移除后应只剩一个标签');
})();

(function testRemoveNonExistentTag() {
    let clip = createClip('tagged', { id: 't4', tags: ['work'] });
    clip = { ...clip, tags: clip.tags.filter(t => t !== 'nonexistent') };
    assertEqual(clip.tags, ['work'], '移除不存在的标签应无影响');
})();

// ===== 测试组 7: 编辑记录 =====
console.log('\n📋 测试组 7: 编辑记录');

(function testEditClip() {
    let clips = [createClip('old text', { id: 'e1' })];
    clips = clips.map(c => c.id === 'e1' ? { ...c, text: 'new text' } : c);
    assertEqual(clips[0].text, 'new text', '编辑后文本应更新');
})();

// ===== 测试组 8: 搜索过滤 =====
console.log('\n📋 测试组 8: 搜索过滤');

(function testSearchByText() {
    const clips = [
        createClip('hello world', { id: 's1' }),
        createClip('react hooks', { id: 's2' }),
        createClip('hello react', { id: 's3' }),
    ];
    const q = 'hello';
    const filtered = clips.filter(c => c.text.toLowerCase().includes(q));
    assertEqual(filtered.length, 2, '搜索 "hello" 应找到 2 条');
    assertEqual(filtered.map(c => c.id), ['s1', 's3'], '应匹配包含 hello 的记录');
})();

(function testSearchByTag() {
    const clips = [
        createClip('work task', { id: 'st1', tags: ['work'] }),
        createClip('personal', { id: 'st2', tags: ['personal'] }),
        createClip('work note', { id: 'st3', tags: ['work', 'note'] }),
    ];
    const q = 'work';
    const filtered = clips.filter(c =>
        c.text.toLowerCase().includes(q) || c.tags.some(t => t.includes(q))
    );
    assertEqual(filtered.length, 3, '搜索 "work" 应匹配文本和标签');
})();

(function testFilterByTag() {
    const clips = [
        createClip('a', { id: 'f1', tags: ['work'] }),
        createClip('b', { id: 'f2', tags: ['personal'] }),
        createClip('c', { id: 'f3', tags: ['work', 'important'] }),
    ];
    const tag = 'work';
    const filtered = clips.filter(c => c.tags.includes(tag));
    assertEqual(filtered.length, 2, '按标签 "work" 筛选应有 2 条');
})();

(function testFilterPinned() {
    const clips = [
        createClip('pinned', { id: 'fp1', pinned: true }),
        createClip('normal', { id: 'fp2', pinned: false }),
        createClip('also pinned', { id: 'fp3', pinned: true }),
    ];
    const pinned = clips.filter(c => c.pinned);
    assertEqual(pinned.length, 2, '置顶筛选应有 2 条');
})();

(function testSearchEmpty() {
    const clips = [createClip('test', { id: 'se1' })];
    const q = '';
    const filtered = clips.filter(c => c.text.toLowerCase().includes(q));
    assertEqual(filtered.length, 1, '空搜索应返回全部');
})();

(function testSearchNoMatch() {
    const clips = [createClip('hello', { id: 'sn1' })];
    const q = 'xyz';
    const filtered = clips.filter(c => c.text.toLowerCase().includes(q));
    assertEqual(filtered.length, 0, '无匹配应返回空数组');
})();

// ===== 测试组 9: 所有标签提取 =====
console.log('\n📋 测试组 9: 标签提取');

(function testExtractAllTags() {
    const clips = [
        createClip('a', { tags: ['work', 'code'] }),
        createClip('b', { tags: ['personal'] }),
        createClip('c', { tags: ['work', 'note'] }),
    ];
    const tags = new Set();
    clips.forEach(c => c.tags.forEach(t => tags.add(t)));
    const allTags = Array.from(tags).sort();
    assertEqual(allTags, ['code', 'note', 'personal', 'work'], '应提取出所有不重复标签并排序');
})();

// ===== 测试组 10: 数据持久化 (序列化) =====
console.log('\n📋 测试组 10: 数据序列化');

(function testSerialize() {
    const clips = [
        createClip('test 1', { id: 'd1', pinned: true, tags: ['a'], copyCount: 3 }),
        createClip('test 2', { id: 'd2', tags: ['b', 'c'] }),
    ];
    const json = JSON.stringify(clips);
    const parsed = JSON.parse(json);
    assertEqual(parsed.length, 2, '序列化/反序列化后数量一致');
    assertEqual(parsed[0].text, 'test 1', '文本内容保留');
    assertEqual(parsed[0].pinned, true, '置顶状态保留');
    assertEqual(parsed[0].tags, ['a'], '标签保留');
    assertEqual(parsed[0].copyCount, 3, '复制次数保留');
})();

// ===== 测试组 11: 时间格式化 =====
console.log('\n📋 测试组 11: 时间格式化');

(function testTimeAgo() {
    const timeAgo = (ts) => {
        const diff = Date.now() - ts;
        const s = Math.floor(diff / 1000);
        if (s < 60) return '刚刚';
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}分钟前`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}小时前`;
        const d = Math.floor(h / 24);
        if (d < 7) return `${d}天前`;
        return 'older';
    };

    assertEqual(timeAgo(Date.now()), '刚刚', '当前时间应显示"刚刚"');
    assertEqual(timeAgo(Date.now() - 30000), '刚刚', '30秒前应显示"刚刚"');
    assertEqual(timeAgo(Date.now() - 120000), '2分钟前', '2分钟前应正确');
    assertEqual(timeAgo(Date.now() - 3600000), '1小时前', '1小时前应正确');
    assertEqual(timeAgo(Date.now() - 86400000), '1天前', '1天前应正确');
})();

// ===== 测试组 12: 边界情况 =====
console.log('\n📋 测试组 12: 边界情况');

(function testLargeText() {
    const longText = 'a'.repeat(10000);
    const clip = createClip(longText);
    assertEqual(clip.text.length, 10000, '应支持长文本 (10000字符)');
})();

(function testSpecialCharacters() {
    const special = '<script>alert("xss")</script>';
    const clip = createClip(special);
    assertEqual(clip.text, special, '应保留特殊字符');
})();

(function testUnicodeText() {
    const unicode = '你好世界 🌍 émojis ñ';
    const clip = createClip(unicode);
    assertEqual(clip.text, unicode, '应支持 Unicode 文本');
})();

(function testEmptyTagsArray() {
    const clip = createClip('test', { tags: [] });
    assertEqual(clip.tags.length, 0, '空标签数组应正常');
})();

// ===== 测试结果 =====
console.log('\n' + '='.repeat(50));
console.log(`📊 测试结果: ${testResults.passed} 通过, ${testResults.failed} 失败`);
if (testResults.errors.length > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.errors.forEach(e => console.log(`   - ${e}`));
} else {
    console.log('🎉 所有测试通过!');
}
console.log('='.repeat(50) + '\n');

// 导出结果 (Node.js)
if (typeof module !== 'undefined') {
    module.exports = { testResults };
}
