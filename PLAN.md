# ClipVault v2 — Electron 桌面应用方案

---

## 一、审查结论 (同上)

现有 clipvault.html 评分 5/10，核心问题：无系统剪切板监控、浏览器端编译、CDN 离线不可用。详见下方原始审查。

---

## 二、架构方案 (Electron)

### 技术栈

```
框架:      Electron 33+
前端:      React 18 + Tailwind CSS 3 + Lucide Icons
剪切板:    Electron clipboard + nativeImage API
存储:      better-sqlite3 (SQLite)
打包:      electron-builder
测试:      Vitest (主进程/后端逻辑) + Playwright (渲染进程)
```

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程 (main/)                    │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  剪切板监控器     │  │  数据库模块   │  │  IPC 通信层    │  │
│  │  (clipboard API)  │  │ (better-     │  │  (ipcMain)    │  │
│  │  文字 + 图片      │  │  sqlite3)    │  │               │  │
│  └────────┬─────────┘  └──────┬───────┘  └───────┬───────┘  │
│           │                   │                   │          │
│           └───────────────────┼───────────────────┘          │
│                               │                              │
│  ┌──────────────────┐  ┌─────┴─────────┐                    │
│  │  系统托盘         │  │  窗口管理器    │                    │
│  │  (Tray)          │  │  (BrowserWindow)                   │
│  └──────────────────┘  └───────┬───────┘                    │
└────────────────────────────────┼────────────────────────────┘
                                 │ IPC
┌────────────────────────────────▼────────────────────────────┐
│                   Electron 渲染进程 (renderer/)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React 18 应用                             │   │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │   │
│  │  │ 侧边栏   │ │ 剪切板    │ │ 搜索栏  │ │ 设置面板   │  │   │
│  │  │ (导航)   │ │ 网格列表  │ │ (实时)  │ │ (偏好)    │  │   │
│  │  └─────────┘ └──────────┘ └────────┘ └───────────┘  │   │
│  │                                                      │   │
│  │  样式: Tailwind CSS + 自定义 CSS 动画                  │   │
│  │  图标: Lucide React                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 项目结构

```
剪切板i项目/
├── main/                        # Electron 主进程
│   ├── index.js                 # 入口: 创建窗口、系统托盘
│   ├── clipboard-watcher.js     # 剪切板监控 (文字 + 图片)
│   ├── db.js                    # SQLite 数据库操作
│   ├── ipc-handlers.js          # IPC 消息处理器
│   └── tray.js                  # 系统托盘菜单
├── renderer/                    # 渲染进程 (React 前端)
│   ├── index.html               # HTML 入口
│   ├── app.jsx                  # React 根组件
│   ├── components/
│   │   ├── Sidebar.jsx          # 侧边导航栏
│   │   ├── ClipGrid.jsx         # 剪切板记录网格
│   │   ├── ClipCard.jsx         # 单条记录卡片
│   │   ├── SearchBar.jsx        # 搜索栏
│   │   ├── ImageViewer.jsx      # 图片预览弹窗
│   │   ├── Toast.jsx            # 通知组件
│   │   └── EmptyState.jsx       # 空状态引导
│   ├── hooks/
│   │   └── useClips.js          # 剪切板数据 Hook
│   └── styles/
│       └── main.css             # 自定义动画和样式
├── tests/
│   ├── db.test.js               # 数据库测试
│   ├── clipboard-watcher.test.js # 监控器测试
│   ├── ipc-handlers.test.js     # IPC 测试
│   └── ui-logic.test.js         # 前端逻辑测试
├── package.json
├── electron-builder.json        # 打包配置
└── PLAN.md
```

### IPC 通信协议

| 频道 | 方向 | 参数 | 说明 |
|------|------|------|------|
| `clips:get-all` | renderer→main | `{ search?, tag?, pinned? }` | 获取记录列表 |
| `clips:add` | renderer→main | `{ text?, imageData? }` | 手动添加记录 |
| `clips:update` | renderer→main | `{ id, text }` | 编辑记录 |
| `clips:delete` | renderer→main | `{ id }` | 删除记录 |
| `clips:copy` | renderer→main | `{ id }` | 复制到系统剪切板 |
| `clips:toggle-pin` | renderer→main | `{ id }` | 切换置顶 |
| `clips:add-tag` | renderer→main | `{ id, tag }` | 添加标签 |
| `clips:remove-tag` | renderer→main | `{ id, tag }` | 删除标签 |
| `clips:clear-all` | renderer→main | — | 清空全部 |
| `clips:export` | renderer→main | — | 导出 JSON |
| `clips:import` | renderer→main | `{ data }` | 导入 JSON |
| `tags:get-all` | renderer→main | — | 获取所有标签 |
| `clip:new` | main→renderer | `{ clip }` | 自动捕获新剪切板内容推送 |

### 数据模型

```sql
CREATE TABLE clips (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'image'
    text       TEXT,                          -- 文字内容 (type=text)
    image_path TEXT,                          -- 图片文件路径 (type=image)
    pinned     INTEGER DEFAULT 0,
    copy_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE tags (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE clip_tags (
    clip_id TEXT REFERENCES clips(id) ON DELETE CASCADE,
    tag_id  INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (clip_id, tag_id)
);
```

### 剪切板监控策略

```javascript
// 每 500ms 轮询系统剪切板
// 1. 检查文字: clipboard.readText()
// 2. 检查图片: clipboard.readImage() → isEmpty()?
// 3. 对比上一次内容 (文字比对字符串，图片比对尺寸+hash)
// 4. 如果变化 → 存入数据库 → 推送到前端
// 5. 图片存储: NativeImage → PNG Buffer → 写入 userData/images/
```

---

## 三、全新设计系统 — **Cosmic Glow 风格**

### 设计理念

深空宇宙 + 霓虹光效。不是轻飘飘的玻璃态，而是有重量感的深色界面配以精准的光线点缀。每张卡片像是漂浮在深空中的信息终端。

### 色彩系统

```css
:root {
    /* 宇宙深空底色 */
    --bg-void:     #06080d;     /* 最深 - 宇宙黑 */
    --bg-deep:     #0a0e18;     /* 深空 */
    --bg-surface:  #0f1420;     /* 卡片表面 */
    --bg-elevated: #151c2c;     /* 悬浮层 */
    --bg-hover:    #1a2338;     /* 悬停 */

    /* 边框 */
    --border:      #1a2236;     /* 默认 */
    --border-glow: rgba(99, 179, 237, 0.15);  /* 发光边框 */

    /* 霓虹强调色 */
    --neon-cyan:   #22d3ee;     /* 主色 - 霓虹青 */
    --neon-blue:   #3b82f6;     /* 辅助 - 霓虹蓝 */
    --neon-purple: #a78bfa;     /* 点缀 - 霓虹紫 */
    --neon-pink:   #f472b6;     /* 点缀 - 霓虹粉 */

    /* 发光效果 */
    --glow-cyan:   0 0 20px rgba(34, 211, 238, 0.15);
    --glow-blue:   0 0 20px rgba(59, 130, 246, 0.15);
    --glow-purple: 0 0 20px rgba(167, 139, 250, 0.15);

    /* 文本 */
    --text-bright: #f1f5f9;
    --text-primary:#cbd5e1;
    --text-muted:  #64748b;
    --text-dim:    #334155;

    /* 功能色 */
    --success:     #34d399;
    --warning:     #fbbf24;
    --danger:      #f87171;
}
```

### 字体

```
UI 文本:    Inter 400/500/600/700
代码/记录:  JetBrains Mono 400/500
```

### 组件设计

**卡片 ClipCard**
```
背景:     线性渐变 135deg, rgba(白 0.03) → rgba(白 0.01)
边框:     1px solid rgba(白 0.05)
圆角:     16px
内边距:   20px
模糊:     backdrop-filter: blur(16px)
阴影:     0 4px 24px rgba(黑 0.3)

悬停态:
  边框:   1px solid rgba(霓虹青 0.2)
  阴影:   0 8px 32px rgba(黑 0.4), 0 0 24px rgba(霓虹青 0.06)
  上移:   translateY(-3px)
  过渡:   all 0.3s cubic-bezier(0.4, 0, 0.2, 1)

置顶态:
  左边框: 3px solid var(--neon-cyan)
  微弱外发光: box-shadow: -3px 0 12px rgba(霓虹青 0.1)

图片卡片:
  内嵌缩略图 + 底部元信息栏
  悬停显示大图预览按钮
```

**顶栏 Header**
```
背景:     深空底 + 微弱渐变叠加
底部边框: 1px solid rgba(白 0.03)
左侧:     Logo (霓虹青发光) + 标题
中间:     搜索框 (毛玻璃底)
右侧:     新建按钮 (霓虹青渐变) + 工具按钮
```

**侧边栏 Sidebar**
```
宽度:     220px (可收缩)
背景:     var(--bg-deep)
项目:     图标 + 文字 + 数量徽标
激活态:   左侧 2px 霓虹青指示条 + 文字变亮
底部:     设置 / 主题切换 / 关于
```

**按钮系统**
```
主按钮:   霓虹青渐变背景 (22d3ee → 0ea5e9) + 白色文字
          hover: 亮度提升 + 霓虹发光
          active: scale(0.97)

次按钮:   毛玻璃底 + 霓虹青边框 + 霓虹青文字
          hover: 填充霓虹青 10%

图标按钮: 32×32 圆角方块, 毛玻璃底
          hover: 底色变亮 + 图标变色

危险按钮: 红色渐变/红色边框
```

**Toast 通知**
```
位置:     底部居中
样式:     毛玻璃卡片 + 左侧彩色指示条
动画:     从下方弹入 (spring) → 停留 2.5s → 淡出
可堆叠:   多条 toast 垂直排列
```

### 页面布局

```
┌────────────────────────────────────────────────────────────────┐
│  ● ClipVault        [  🔍 搜索剪切板...  ]        [+ 新建] [⚙] │ ← 顶栏 56px
├───────────┬────────────────────────────────────────────────────┤
│           │                                                    │
│  📋 全部   │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  📌 置顶   │  │ 🆕 新捕获  │ │  文字记录 │ │  文字记录 │          │
│  🕐 最近   │  │  闪烁动画  │ │          │ │          │          │
│  🖼 图片   │  └──────────┘ └──────────┘ └──────────┘          │
│  ─────── │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  # 标签   │  │  🖼 图片   │ │  文字记录 │ │  文字记录 │          │
│  # work   │  │  [缩略图]  │ │          │ │          │          │
│  # code   │  └──────────┘ └──────────┘ └──────────┘          │
│           │                                                    │
│           │  ┌──────────┐ ┌──────────┐                       │
│           │  │  文字记录  │ │  🖼 图片   │                       │
│           │  │          │ │  [缩略图]  │                       ← 侧边栏 + 主内容
│           │  └──────────┘ └──────────┘                       │  (masonry 网格)
│           │                                                    │
├───────────┴────────────────────────────────────────────────────┤
│  复制于 2026-05-23 14:30:22  │  共 47 条记录  │  最后捕获: 刚刚  │ ← 底栏 32px
└────────────────────────────────────────────────────────────────┘
```

### 动效清单

| 效果 | 属性 | 时间 | 缓动 |
|------|------|------|------|
| 卡片进入 | fadeInUp + scale(0.95→1) | 350ms | cubic-bezier(0.16,1,0.3,1) |
| 卡片悬停 | translateY(-3px) + 边框发光 | 250ms | ease-out |
| 新捕获闪烁 | border pulse + glow | 800ms | ease-in-out |
| 复制成功 | scale(1→0.95→1) + 青色闪光 | 400ms | spring |
| Toast 进入 | translateY(20→0) + opacity | 300ms | spring |
| Toast 退出 | opacity(1→0) + translateY(-10) | 200ms | ease-in |
| 侧边栏切换 | width 收缩 + opacity | 250ms | ease-in-out |
| 图片预览 | scale(0.9→1) + backdrop blur | 300ms | cubic-bezier(0.16,1,0.3,1) |

### 图片处理

```
捕获:
  clipboard.readImage() → NativeImage
  → toPNG() → Buffer
  → 写入 {userData}/clipvault-images/{id}.png
  → 数据库存 image_path

展示:
  缩略图: 固定高度 160px, object-fit: cover, 圆角
  预览:   点击弹出全屏模态, 居中显示原图
  复制:   读取 PNG Buffer → clipboard.writeImage(NativeImage)
```

---

## 四、TDD 实施计划

### 阶段 1: 数据库层

**测试文件**: `tests/db.test.js`
**实现文件**: `main/db.js`

```
测试用例:
  [x] 初始化数据库 + 创建表
  [x] 插入文字记录 → 验证返回完整对象 (id, type, text, created_at)
  [x] 插入图片记录 → 验证 type='image', image_path 正确
  [x] 查询全部 → 验证按 created_at DESC 排序
  [x] 按关键词搜索 text 字段
  [x] 按 tag 过滤 (JOIN clip_tags)
  [x] 按 pinned=true 过滤
  [x] 按 type='image' 过滤
  [x] 更新 text 内容 → 验证 updated_at 更新
  [x] 删除记录 → 验证关联 tag 也删除 (CASCADE)
  [x] toggle pinned: 0→1→0
  [x] increment copy_count
  [x] 添加 tag → 自动创建 tag 记录 (UPSERT)
  [x] 删除 tag 关联
  [x] 获取所有不重复 tag 列表
  [x] 清空全部记录
  [x] 导入批量数据
```

### 阶段 2: 剪切板监控器

**测试文件**: `tests/clipboard-watcher.test.js`
**实现文件**: `main/clipboard-watcher.js`

```
测试用例:
  [x] 启动监控 → 验证定时器创建
  [x] 停止监控 → 验证定时器清除
  [x] 文字变化检测: mock clipboard 返回不同字符串 → 触发 callback
  [x] 文字去重: 连续相同内容 → 只触发一次
  [x] 空文字忽略: clipboard.readText() = '' → 不触发
  [x] 图片变化检测: mock clipboard 返回 NativeImage → 触发 callback(type='image')
  [x] 图片去重: 连续相同图片 → 只触发一次
  [x] 图片存储: NativeImage → 写入文件 → 返回路径
```

### 阶段 3: IPC 处理器

**测试文件**: `tests/ipc-handlers.test.js`
**实现文件**: `main/ipc-handlers.js`

```
测试用例:
  [x] clips:get-all → 调用 db.getAll + 返回结果
  [x] clips:add (text) → 调用 db.insert → 返回新记录
  [x] clips:add (空) → 返回错误
  [x] clips:update → 调用 db.update → 返回更新后记录
  [x] clips:delete → 调用 db.delete
  [x] clips:copy → 调用 db.incrementCopyCount + clipboard.writeText
  [x] clips:toggle-pin → 调用 db.togglePin
  [x] clips:add-tag / clips:remove-tag
  [x] clips:clear-all → 调用 db.clearAll
  [x] clips:export → 导出 JSON
  [x] tags:get-all → 返回标签列表
```

### 阶段 4: 前端逻辑

**测试文件**: `tests/ui-logic.test.js`

```
测试用例:
  [x] searchFilter: 按文本匹配
  [x] searchFilter: 按标签匹配
  [x] searchFilter: 无搜索词返回全部
  [x] sortClips: 置顶优先 → 时间倒序
  [x] extractTags: 去重 + 排序
  [x] formatTime: "刚刚" (< 60s)
  [x] formatTime: "3分钟前" (< 60min)
  [x] formatTime: "2小时前" (< 24h)
  [x] formatTime: "昨天 14:30" (< 48h)
  [x] formatTime: "5月23日 14:30" (更早)
  [x] truncateText: 超过 300 字截断 + "..."
  [x] validateClip: 空文本无效
  [x] validateClip: 重复标签无效
```

---

## 五、实施顺序

1. [x] **审查** 现有代码 → 完成
2. [x] **方案** 制定 → 完成 (本文档)
3. [ ] **npm init + 依赖安装** electron, better-sqlite3, vitest, tailwindcss, react, lucide-react
4. [ ] **TDD 阶段 1** db.test.js → db.js
5. [ ] **TDD 阶段 2** clipboard-watcher.test.js → clipboard-watcher.js
6. [ ] **TDD 阶段 3** ipc-handlers.test.js → ipc-handlers.js
7. [ ] **TDD 阶段 4** ui-logic.test.js → 前端实现
8. [ ] **主进程入口** main/index.js + main/tray.js
9. [ ] **渲染进程** renderer/ 全部组件 + 样式
10. [ ] **集成验收** 端到端测试 + 打包

---

## 六、原文审查 (保留)

<details>
<summary>点击展开原始 clipvault.html 完整审查</summary>

### Critical
- C1: 无 XSS 防护 — clip.text 渲染未 sanitize
- C2: Babel 浏览器端编译 — 性能差，离线不可用

### High
- H1: 无系统剪切板监控 — 只能手动添加
- H2: localStorage 数据丢失风险 — 浏览器清缓存即丢
- H3: CDN 全部外链 — 无网络白屏
- H4: Masonry 布局不均 — CSS columns 填充问题

### Medium
- M1: Toast 不可堆叠
- M2: 搜索无防抖
- M3: 键盘可访问性差
- M4: 无快速复制快捷键
- M5: 图标组件低效

### Low
- L1: 时间格式不精确
- L2: 无主题切换
- L3: 空状态引导不足

**评分: 5/10**

</details>

---

*方案已更新为 Electron + Cosmic Glow 设计。确认后开始 TDD 实施。*
