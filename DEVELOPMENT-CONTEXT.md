# GitHub Dashboard — Development Context
> Cập nhật: 2026-04-26 | Conversation ID: `adf2893e-084f-4355-953d-6006c182c96f`

---

## 📁 Cấu trúc dự án

```
GITHUB DASHBOARD/
├── index.html    (287 dòng)  — Cấu trúc UI, modals, sidebar
├── app.js        (1807 dòng) — Logic chính: StorageManager, MindMap (D3.js), App class
├── ai.js         (905 dòng)  — GitHubAPI + AIAnalyzer (OpenRouter)
├── style.css     (3010 dòng) — Notebook/Chalkboard theme, responsive
├── demo.html     (11325 bytes) — Demo page
├── .env.local    — API keys (không commit)
└── .gitignore
```

## 🏗️ Kiến trúc

### Classes chính trong `app.js`:
| Class | Vai trò |
|-------|---------|
| `StorageManager` | CRUD localStorage (`github_dashboard_data`) |
| `MindMap` | Render D3.js mind map (Root → Category → Repo → Detail nodes) |
| `App` | Orchestrator: sidebar, modals, events, detail panel, compare |

### Classes chính trong `ai.js`:
| Class | Vai trò |
|-------|---------|
| `GitHubAPI` | Parse URL, fetch repo info, README, languages |
| `AIAnalyzer` | Gọi OpenRouter (Gemini 2.0 Flash), fallback analysis |

### Data Format (localStorage):
```json
{
  "categories": [
    {
      "id": "abc123",
      "name": "Claude Code",
      "icon": "🤖",
      "color": "#6940a5",
      "repos": [
        {
          "id": "xyz789",
          "url": "https://github.com/owner/repo",
          "name": "repo-name",
          "fullName": "owner/repo",
          "description": "...",
          "stars": 1234,
          "language": "TypeScript",
          "updatedAt": "2026-04-20T...",
          "addedAt": "2026-04-25T...",
          "analysis": { /* AI deep analysis JSON */ },
          "notes": "",
          "tags": []
        }
      ]
    }
  ],
  "settings": {
    "theme": "dark",
    "openrouterApiKey": "sk-or-v1-..."
  }
}
```

## ✅ Tính năng đã hoàn thiện

1. **Mind Map (D3.js)** — Render tree: Root → Categories → Repos → Details (Features/Use Cases)
2. **Sidebar** — CRUD categories, emoji picker (40 icons), click để filter
3. **Add Repo Modal** — Paste GitHub URL → fetch info → AI analysis → save
4. **Detail Panel** — Tóm tắt AI, thống kê, tính năng, cài đặt, ghi chú, tags
5. **Command Palette** — `Ctrl+K` để tìm kiếm nhanh
6. **Compare Mode** — Chọn tối đa 5 repos, so sánh bảng
7. **Dark/Light Theme** — Notebook (light) / Chalkboard (dark)
8. **Export/Import** — Xuất/nhập JSON data
9. **Toast Notifications** — Thông báo hành động
10. **AI Fallback** — Phân tích dựa README + metadata khi không có API key

## 🔧 Cấu hình kỹ thuật

- **AI Model:** `google/gemini-2.0-flash-001` qua OpenRouter
- **D3.js:** v7 (CDN)
- **Fonts:** Playwrite VN, Mali, Baloo 2, Quicksand (Google Fonts CDN)
- **Deploy:** Vercel
- **Git:** `main` branch, latest commit `fe3766e`

## 🎨 Design System

- **Light theme:** Notebook paper (`#fdf8e8` bg, ink colors, ruled lines)
- **Dark theme:** Chalkboard (`#1a2a1a` bg, chalk colors)
- **CSS Variables:** Đầy đủ design tokens (colors, spacing, radius, shadows, transitions)
- **Radius:** Sketchy/imperfect style (6-18px)
- **Animations:** `--transition-fast/normal/slow`

---

## 🚀 KẾ HOẠCH PHÁT TRIỂN — 6 Tính năng mới

### Nguyên tắc:
- ❌ **KHÔNG** thêm library nào — tất cả vanilla JS + D3.js
- ✅ **GIỮ** Notebook/Chalkboard theme
- ✅ **Responsive** ≥ 768px
- ✅ **Persist** qua localStorage

---

### Phase 1: Nền tảng UX ⬅️ BẮT ĐẦU TỪ ĐÂY

#### 🔥 #2 Repo Pulse & Activity Heatmap
**Mục tiêu:** Repo node trên mind map "đập tim" nếu repo active gần đây. Hover hiện mini heatmap 7 ngày.

**Tasks:**
- [ ] CSS `@keyframes repo-pulse` — 2 mức: hot (đỏ, <24h), warm (vàng, <72h) → `style.css`
- [ ] `MindMap.update()` gắn class `.repo-pulse--hot` / `.repo-pulse--warm` dựa trên `updatedAt` → `app.js`
- [ ] `GitHubAPI.fetchRecentActivity(owner, repo)` gọi Events API → `ai.js`
- [ ] Mini heatmap bar (7 cột = 7 ngày) trong tooltip khi hover repo node → `app.js` + `style.css`
- [ ] Fallback graceful khi rate limit (không crash khi 403) → `ai.js`

**Kỹ thuật:**
```css
/* Ví dụ CSS cần thêm */
@keyframes repo-pulse-hot {
  0%, 100% { box-shadow: 0 0 5px var(--accent-red); }
  50% { box-shadow: 0 0 20px var(--accent-red), 0 0 40px rgba(224,80,80,0.3); }
}
.repo-pulse--hot { animation: repo-pulse-hot 1.5s ease-in-out infinite; }
```

```js
// Trong MindMap.update(), sau khi render nodes:
const now = Date.now();
nodes.forEach(node => {
  if (node.data.type === 'repo') {
    const updated = new Date(node.data.updatedAt).getTime();
    const hours = (now - updated) / 3600000;
    if (hours < 24) node.data.pulseClass = 'repo-pulse--hot';
    else if (hours < 72) node.data.pulseClass = 'repo-pulse--warm';
  }
});
```

---

#### 🧲 #3 Drag & Drop giữa Categories
**Mục tiêu:** Kéo repo từ category này sang category khác trên sidebar.

**Tasks:**
- [ ] Sidebar hiện repos bên trong mỗi category (expandable) → `app.js` `renderSidebar()`
- [ ] `draggable="true"` + `dragstart`/`dragend` events cho repo items → `app.js`
- [ ] `dragover`/`drop` events cho category items → `app.js`
- [ ] CSS highlight drop zone (border glow) → `style.css`
- [ ] Method `moveRepo(repoId, fromCatId, toCatId)` + save + re-render → `app.js`

**Kỹ thuật:**
```js
// Native HTML5 Drag & Drop — không cần library
repoItem.setAttribute('draggable', 'true');
repoItem.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/plain', JSON.stringify({ repoId, fromCatId }));
  repoItem.classList.add('dragging');
});

categoryItem.addEventListener('dragover', (e) => {
  e.preventDefault();
  categoryItem.classList.add('drag-over');
});

categoryItem.addEventListener('drop', (e) => {
  const { repoId, fromCatId } = JSON.parse(e.dataTransfer.getData('text/plain'));
  this.moveRepo(repoId, fromCatId, targetCatId);
});
```

---

### Phase 2: AI Power

#### 🔮 #4 AI Chat với Repo
**Mục tiêu:** Chat box trong Detail Panel — hỏi bất kì về repo, AI trả lời dựa trên README + analysis.

**Tasks:**
- [ ] HTML chat section trong Detail Panel: input + messages area → render trong `app.js` `showDetail()`
- [ ] CSS chat bubble: user (phải, xanh), AI (trái, xám) → `style.css`
- [ ] `AIAnalyzer.chatWithRepo(repoId, question)` — prompt kèm context repo → `ai.js`
- [ ] `App.handleRepoChat()` — message history, render, loading state → `app.js`
- [ ] Typing indicator + disabled input khi chờ → `style.css` + `app.js`

---

#### 🎯 #1 Learning Path Generator
**Mục tiêu:** Chọn 3-5 repos → AI tạo lộ trình học tập từ dễ đến khó.

**Tasks:**
- [ ] `AIAnalyzer.generateLearningPath()` — prompt sắp xếp repos theo thứ tự học → `ai.js`
- [ ] Nút "🎯 Tạo lộ trình" trên Compare FAB (khi ≥2 repos) → `index.html`
- [ ] Modal `learningPathModal` + timeline layout → `index.html` + `style.css`
- [ ] `App.showLearningPath()` gọi AI và render → `app.js`
- [ ] Nút "📋 Copy Markdown" export → `app.js`

---

### Phase 3: Polish

#### 📊 #5 Dashboard Statistics
**Mục tiêu:** Modal thống kê: donut chart ngôn ngữ, bar chart stars, summary cards.

**Tasks:**
- [ ] Nút "📊 Thống kê" vào header + command palette → `index.html` + `app.js`
- [ ] Modal `statsModal` layout grid 2x2 → `index.html` + `style.css`
- [ ] Donut chart ngôn ngữ (D3.js) → `app.js`
- [ ] Horizontal bar chart top 10 stars (D3.js) → `app.js`
- [ ] Summary cards: tổng repos, stars, ngôn ngữ phổ biến nhất → `app.js`

---

#### ⌨️ #6 Vim-style Keyboard Navigation
**Mục tiêu:** `j/k/h/l` di chuyển trên mind map, `Enter` mở detail, `g` zoom-to-fit.

**Tasks:**
- [ ] `focusedNode` property + CSS `.node-card--focused` → `app.js` + `style.css`
- [ ] Keydown listener `j/k/h/l/Enter/g` (skip khi focus input) → `app.js`
- [ ] `navigateToNode(direction)` traverse D3 hierarchy → `app.js`
- [ ] Auto-pan SVG viewport → `app.js`
- [ ] Hint overlay khi nhấn `?` → `app.js` + `style.css`

---

## 📌 Ghi chú quan trọng

1. **API Key** đã hardcode trong `app.js` line 24 (OpenRouter) — cân nhắc move sang env
2. **GitHub API Rate Limit:** 60 requests/hour không auth — cần xử lý graceful
3. **AI Response Format:** JSON thuần (không markdown), cấu trúc deep + backward-compatible
4. **D3.js nodes** dùng `foreignObject` để nhúng HTML cards
5. **Conversation ID để tiếp tục:** `adf2893e-084f-4355-953d-6006c182c96f`

## 🔗 Quick Start cho phiên tiếp theo

```
Tôi muốn tiếp tục phát triển GitHub Dashboard.
Đọc file DEVELOPMENT-CONTEXT.md trong dự án để nắm context.
Bắt đầu triển khai Phase 1: Repo Pulse + Drag & Drop.
```
