/* ============================================
   app.js — Main Application Logic
   GitHub Dashboard with D3.js Mind Map
   ============================================ */

// ============================================
// Storage Manager
// ============================================
class StorageManager {
  constructor() {
    this.key = 'github_dashboard_data';
  }

  getDefaultData() {
    return {
      categories: [
        { id: this.genId(), name: 'Claude Code', icon: '🤖', color: '#6940a5', repos: [] },
        { id: this.genId(), name: 'Antigravity', icon: '🚀', color: '#2eaadc', repos: [] },
        { id: this.genId(), name: 'n8n Automation', icon: '⚡', color: '#d9730d', repos: [] },
        { id: this.genId(), name: 'AI Memory', icon: '🧠', color: '#0f7b6c', repos: [] }
      ],
      settings: {
        theme: 'dark',
        openrouterApiKey: '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'
      }
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return this.getDefaultData();
      const data = JSON.parse(raw);
      // Ensure settings exist
      if (!data.settings) data.settings = this.getDefaultData().settings;
      if (!data.categories) data.categories = [];
      return data;
    } catch {
      return this.getDefaultData();
    }
  }

  save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  genId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  exportJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-dashboard-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.categories) throw new Error('Invalid format');
          resolve(data);
        } catch (err) {
          reject(new Error('File không hợp lệ'));
        }
      };
      reader.onerror = () => reject(new Error('Không thể đọc file'));
      reader.readAsText(file);
    });
  }
}

// ============================================
// Toast Manager
// ============================================
class ToastManager {
  constructor(container) {
    this.container = container;
  }

  show(message, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast__message">${message}</span>
      <button class="toast__close" onclick="this.parentElement.remove()">✕</button>
    `;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// ============================================
// Mind Map Renderer (D3.js)
// ============================================
class MindMap {
  constructor(container) {
    this.container = container;
    this.svg = null;
    this.g = null;
    this.zoom = null;
    this.tree = null;
    this.data = null;
    this.onNodeClick = null;
    this.onNodeRightClick = null;
    this.margin = { top: 40, right: 200, bottom: 40, left: 80 };
    this.nodeWidth = 220;
    this.nodeHeight = 110;
    this.duration = 400;
  }

  init() {
    // Clear existing
    this.container.innerHTML = '';

    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // Main group
    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.margin.left}, ${height / 2})`);

    // Tree layout
    this.tree = d3.tree()
      .nodeSize([this.nodeHeight + 20, this.nodeWidth + 60])
      .separation((a, b) => a.parent === b.parent ? 1.2 : 1.8);
  }

  /**
   * Convert app data to D3 hierarchy format
   */
  buildHierarchy(categories, searchTerm = '') {
    const search = searchTerm.toLowerCase();

    const children = categories
      .map(cat => {
        const repos = cat.repos
          .filter(r => {
            if (!search) return true;
            return r.name.toLowerCase().includes(search)
              || r.description?.toLowerCase().includes(search)
              || r.ai_analysis?.summary?.toLowerCase().includes(search)
              || r.ai_analysis?.features?.some(f => f.toLowerCase().includes(search))
              || r.notes?.toLowerCase().includes(search)
              || r.customTags?.some(t => t.toLowerCase().includes(search));
          })
          .map(repo => {
            // Level 3: Details (features + use cases)
            const details = [];
            if (repo.ai_analysis?.features) {
              repo.ai_analysis.features.slice(0, 4).forEach(f => {
                const label = typeof f === 'string' ? f : (f.name_vi || f.name_en || String(f));
                details.push({ name: label, type: 'feature', _repo: repo });
              });
            }
            if (repo.ai_analysis?.useCases) {
              repo.ai_analysis.useCases.slice(0, 2).forEach(u => {
                const label = typeof u === 'string' ? u : (u.title || u.description || String(u));
                details.push({ name: label, type: 'usecase', _repo: repo });
              });
            }

            return {
              name: repo.name,
              type: 'repo',
              data: repo,
              _collapsed: repo._collapsed !== false ? true : false,
              children: details.length > 0 ? details : undefined
            };
          });

        if (search && repos.length === 0) return null;

        return {
          name: cat.name,
          type: 'category',
          data: cat,
          _collapsed: cat._collapsed || false,
          children: repos.length > 0 ? repos : undefined
        };
      })
      .filter(Boolean);

    return {
      name: '🗺️ Dashboard',
      type: 'root',
      children: children.length > 0 ? children : undefined
    };
  }

  /**
   * Render the mind map
   */
  render(categories, searchTerm = '') {
    if (!this.svg) this.init();

    const hierarchyData = this.buildHierarchy(categories, searchTerm);
    const root = d3.hierarchy(hierarchyData);

    // Handle collapsed nodes
    root.each(d => {
      if (d.data._collapsed && d.children) {
        d._children = d.children;
        d.children = null;
      }
    });

    this.data = root;
    this.update(root);
  }

  update(source) {
    // Compute layout
    this.tree(this.data);

    const nodes = this.data.descendants();
    const links = this.data.links();

    // --------- LINKS ---------
    const link = this.g.selectAll('.link')
      .data(links, d => d.target.data.name + d.target.depth);

    // Enter
    const linkEnter = link.enter()
      .insert('path', 'g')
      .attr('class', 'link')
      .attr('d', () => {
        const o = { x: source.x0 || source.x, y: source.y0 || source.y };
        return this.diagonal({ x: o.x, y: o.y }, { x: o.x, y: o.y });
      })
      .style('opacity', 0);

    // Update + Enter
    const linkMerge = linkEnter.merge(link);
    linkMerge.transition().duration(this.duration)
      .attr('d', d => this.diagonal(d.source, d.target))
      .style('opacity', 1)
      .style('stroke', d => {
        if (d.target.data.type === 'category') return d.target.data.data?.color || 'var(--link-color)';
        return 'var(--link-color)';
      });

    // Exit
    link.exit().transition().duration(this.duration)
      .attr('d', () => {
        const o = { x: source.x, y: source.y };
        return this.diagonal({ x: o.x, y: o.y }, { x: o.x, y: o.y });
      })
      .style('opacity', 0)
      .remove();

    // --------- NODES ---------
    const node = this.g.selectAll('.node-group')
      .data(nodes, d => d.data.name + d.depth + (d.data.data?.id || ''));

    // Enter
    const nodeEnter = node.enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', `translate(${source.y0 || source.y}, ${source.x0 || source.x})`)
      .style('opacity', 0);

    // Add foreignObject for HTML cards
    nodeEnter.each(function(d) {
      const g = d3.select(this);
      const fo = g.append('foreignObject');

      let cardClass = 'node-card';
      let width, height;

      if (d.data.type === 'root') {
        cardClass += ' node-card--category';
        width = 220;
        height = 60;
      } else if (d.data.type === 'category') {
        cardClass += ' node-card--category';
        width = 220;
        height = 66;
      } else if (d.data.type === 'repo') {
        cardClass += ' node-card--repo';
        width = 280;
        height = 160;
      } else {
        cardClass += ' node-card--detail';
        width = 240;
        height = 80;
      }

      fo.attr('width', width + 20)
        .attr('height', height + 16)
        .attr('x', -10)
        .attr('y', -(height + 16) / 2)
        .style('overflow', 'visible');

      const card = fo.append('xhtml:div')
        .attr('class', cardClass)
        .style('width', width + 'px')
        .style('min-height', height + 'px')
        .style('height', 'auto')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('justify-content', 'center')
        .style('cursor', 'pointer')
        .style('overflow', 'visible');

      if (d.data.type === 'root') {
        card.html(`
          <div class="node-card__title" style="font-size:15px;font-weight:700">🗺️ GitHub Dashboard</div>
        `);
      } else if (d.data.type === 'category') {
        const cat = d.data.data;
        const repoCount = cat.repos ? cat.repos.length : 0;
        card.style('border-left', `4px solid ${cat.color}`);
        card.html(`
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">${cat.icon || '📁'}</span>
            <div>
              <div class="node-card__title" style="font-size:14px;font-weight:600">${cat.name}</div>
              <div class="node-card__subtitle">${repoCount} repo${repoCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
          ${d._children ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">Click để mở rộng ▸</div>' : ''}
        `);
      } else if (d.data.type === 'repo') {
        const repo = d.data.data;
        card.html(`
          <div class="node-card__title">${repo.name}</div>
          <div class="node-card__subtitle">${(repo.description || '').length > 80 ? repo.description.substring(0, 80) + '…' : (repo.description || '')}</div>
          <div class="node-card__meta">
            <span class="node-card__badge">⭐ ${formatNumber(repo.stars)}</span>
            <span class="node-card__badge">🔀 ${formatNumber(repo.forks)}</span>
            ${repo.language ? `<span class="node-card__badge">${repo.language}</span>` : ''}
          </div>
        `);
      } else {
        // Detail node (feature / usecase)
        const icon = d.data.type === 'feature' ? '⚡' : '🎯';
        card.html(`
          <div style="display:flex;align-items:flex-start;gap:6px">
            <span style="font-size:12px;flex-shrink:0">${icon}</span>
            <span class="node-card__title" style="font-size:12px;font-weight:400">${d.data.name}</span>
          </div>
        `);
      }
    });

    // Click handler
    nodeEnter.on('click', (event, d) => {
      event.stopPropagation();

      if (d.data.type === 'root') return;

      // Toggle collapse
      if (d.data.type === 'category' || d.data.type === 'repo') {
        if (d.children) {
          d._children = d.children;
          d.children = null;
          d.data._collapsed = true;
        } else if (d._children) {
          d.children = d._children;
          d._children = null;
          d.data._collapsed = false;
        }
        this.update(d);
      }

      // Notify click handler
      if (this.onNodeClick) {
        this.onNodeClick(d.data);
      }
    });

    // Right-click handler
    nodeEnter.on('contextmenu', (event, d) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.onNodeRightClick) {
        this.onNodeRightClick(event, d.data);
      }
    });

    // Update + Enter transition
    const nodeMerge = nodeEnter.merge(node);
    nodeMerge.transition().duration(this.duration)
      .attr('transform', d => `translate(${d.y}, ${d.x})`)
      .style('opacity', 1);

    // Exit
    node.exit().transition().duration(this.duration)
      .attr('transform', `translate(${source.y}, ${source.x})`)
      .style('opacity', 0)
      .remove();

    // Store old positions
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  /**
   * Create a diagonal (curved path) between two nodes
   */
  diagonal(s, d) {
    return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
  }

  /**
   * Zoom controls
   */
  zoomIn() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
  }

  zoomOut() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.7);
  }

  zoomReset() {
    const rect = this.container.getBoundingClientRect();
    this.svg.transition().duration(500).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(this.margin.left, rect.height / 2)
    );
  }

  /**
   * Handle window resize
   */
  resize() {
    if (!this.svg) return;
    const rect = this.container.getBoundingClientRect();
    this.svg.attr('width', rect.width).attr('height', rect.height);
  }
}

// ============================================
// Utility
// ============================================
function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('vi-VN', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

// ============================================
// Main Application
// ============================================
class App {
  constructor() {
    this.storage = new StorageManager();
    this.toast = new ToastManager(document.getElementById('toastContainer'));
    this.data = this.storage.load();
    this.mindMap = null;
    this.searchTerm = '';
    this.selectedCategory = null;

    this.initTheme();
    this.initMindMap();
    this.bindEvents();
    this.renderSidebar();
    this.renderMindMap();
    this.loadApiKey();
  }

  // ---- Theme ----
  initTheme() {
    const theme = this.data.settings?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    this.data.settings.theme = next;
    this.save();
  }

  // ---- API Key ----
  loadApiKey() {
    const input = document.getElementById('apiKeyInput');
    if (this.data.settings?.openrouterApiKey) {
      input.value = this.data.settings.openrouterApiKey;
    }
  }

  saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    this.data.settings.openrouterApiKey = key;
    this.save();
  }

  // ---- Mind Map ----
  initMindMap() {
    const container = document.getElementById('mindmapContainer');
    this.mindMap = new MindMap(container);

    this.mindMap.onNodeClick = (nodeData) => {
      if (nodeData.type === 'repo') {
        this.showDetail(nodeData.data);
      }
    };

    this.mindMap.onNodeRightClick = (event, nodeData) => {
      this.showContextMenu(event, nodeData);
    };
  }

  renderMindMap() {
    const hasRepos = this.data.categories.some(c => c.repos.length > 0);
    const emptyState = document.getElementById('emptyState');
    const zoomControls = document.getElementById('zoomControls');

    if (!hasRepos) {
      emptyState.style.display = 'flex';
      zoomControls.style.display = 'none';
      // Clear SVG if exists
      const container = document.getElementById('mindmapContainer');
      const svg = container.querySelector('svg');
      if (svg) svg.remove();
      this.mindMap.svg = null;
      return;
    }

    emptyState.style.display = 'none';
    zoomControls.style.display = 'flex';

    this.mindMap.render(this.data.categories, this.searchTerm);
  }

  // ---- Sidebar ----
  renderSidebar() {
    const list = document.getElementById('categoryList');
    const quickSelect = document.getElementById('quickCategorySelect');
    const modalSelect = document.getElementById('modalCategorySelect');

    // Category list
    list.innerHTML = this.data.categories.map(cat => `
      <li class="category-item ${this.selectedCategory === cat.id ? 'active' : ''}" data-id="${cat.id}">
        <span class="category-item__icon">${cat.icon || '📁'}</span>
        <span class="category-item__name">${cat.name}</span>
        <span class="category-item__count">${cat.repos.length}</span>
        <button class="category-item__delete" data-id="${cat.id}" title="Xóa">🗑</button>
      </li>
    `).join('');

    // Category select options
    const options = '<option value="">— Chọn danh mục —</option>' +
      this.data.categories.map(cat =>
        `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
      ).join('');

    quickSelect.innerHTML = options;
    modalSelect.innerHTML = options;
  }

  // ---- Add Repo ----
  async addRepo(url, categoryId, formType = 'quick') {
    if (!url || !categoryId) {
      this.toast.show('Vui lòng nhập link và chọn danh mục', 'error');
      return;
    }

    const spinnerEl = document.getElementById(formType === 'quick' ? 'quickAddSpinner' : 'modalSpinner');
    const textEl = document.getElementById(formType === 'quick' ? 'quickAddText' : 'modalSubmitText');

    if (spinnerEl) spinnerEl.style.display = 'inline-block';
    if (textEl) textEl.textContent = 'Đang phân tích...';

    try {
      // 1. Fetch from GitHub
      const repoInfo = await githubAPI.analyze(url);

      // 2. Check duplicate
      const category = this.data.categories.find(c => c.id === categoryId);
      if (!category) throw new Error('Danh mục không tồn tại');
      if (category.repos.find(r => r.url === repoInfo.htmlUrl || r.name === repoInfo.name)) {
        throw new Error('Repo đã tồn tại trong danh mục này');
      }

      // 3. AI Analysis
      if (textEl) textEl.textContent = 'AI đang phân tích...';
      const analysis = await aiAnalyzer.analyze(repoInfo, this.data.settings?.openrouterApiKey);

      // 4. Save
      const newRepo = {
        id: this.storage.genId(),
        url: repoInfo.htmlUrl,
        name: repoInfo.name,
        fullName: repoInfo.fullName,
        owner: repoInfo.owner,
        description: repoInfo.description,
        stars: repoInfo.stars,
        forks: repoInfo.forks,
        language: repoInfo.language,
        topics: repoInfo.topics,
        homepage: repoInfo.homepage,
        license: repoInfo.license,
        createdAt: repoInfo.createdAt,
        updatedAt: repoInfo.updatedAt,
        openIssues: repoInfo.openIssues,
        addedAt: new Date().toISOString(),
        ai_analysis: analysis,
        _collapsed: true
      };

      category.repos.push(newRepo);
      this.save();

      // 5. Update UI
      this.renderSidebar();
      this.renderMindMap();
      this.toast.show(`Đã thêm ${repoInfo.name} vào ${category.name}`, 'success');

      // Close modal if open
      if (formType === 'modal') {
        this.closeModal('addRepoModal');
      }

      // Clear form
      const urlInput = document.getElementById(formType === 'quick' ? 'quickUrlInput' : 'modalUrlInput');
      if (urlInput) urlInput.value = '';

    } catch (err) {
      this.toast.show(err.message, 'error');
    } finally {
      if (spinnerEl) spinnerEl.style.display = 'none';
      if (textEl) textEl.textContent = 'Phân tích & Thêm';
    }
  }

  // ---- Categories ----
  addCategory(name, icon, color) {
    if (!name.trim()) {
      this.toast.show('Tên danh mục không được trống', 'error');
      return;
    }

    const editId = document.getElementById('editCategoryId').value;

    if (editId) {
      // Edit existing
      const cat = this.data.categories.find(c => c.id === editId);
      if (cat) {
        cat.name = name.trim();
        cat.icon = icon || '📁';
        cat.color = color;
        this.toast.show(`Đã cập nhật danh mục "${name}"`, 'success');
      }
    } else {
      // Add new
      this.data.categories.push({
        id: this.storage.genId(),
        name: name.trim(),
        icon: icon || '📁',
        color: color,
        repos: []
      });
      this.toast.show(`Đã thêm danh mục "${name}"`, 'success');
    }

    this.save();
    this.renderSidebar();
    this.renderMindMap();
    this.closeModal('addCategoryModal');
  }

  deleteCategory(id) {
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat) return;

    if (cat.repos.length > 0) {
      if (!confirm(`Xóa danh mục "${cat.name}" và tất cả ${cat.repos.length} repos bên trong?`)) return;
    }

    this.data.categories = this.data.categories.filter(c => c.id !== id);
    this.save();
    this.renderSidebar();
    this.renderMindMap();
    this.toast.show(`Đã xóa danh mục "${cat.name}"`, 'info');
  }

  deleteRepo(categoryId, repoId) {
    const cat = this.data.categories.find(c => c.id === categoryId);
    if (!cat) return;
    const repo = cat.repos.find(r => r.id === repoId);
    if (!repo) return;

    cat.repos = cat.repos.filter(r => r.id !== repoId);
    this.save();
    this.renderSidebar();
    this.renderMindMap();
    this.closeDetail();
    this.toast.show(`Đã xóa ${repo.name}`, 'info');
  }

  // ---- Detail Panel (Premium Redesign) ----
  showDetail(repo) {
    if (!repo) return;
    const panel = document.getElementById('detailPanel');
    const body = document.getElementById('detailBody');

    const a = repo.ai_analysis || {};

    // Helper: difficulty badge color
    const diffColors = { 'Dễ': '#0f7b6c', 'Trung bình': '#d9730d', 'Khó': '#e03e3e', 'Rất khó': '#ad1a72' };
    const diffColor = a.difficulty ? (diffColors[a.difficulty.level] || '#d9730d') : '#d9730d';

    // Helper: value score bar
    const valScore = a.practicalValue?.score || 0;
    const valColor = valScore >= 7 ? '#0f7b6c' : valScore >= 4 ? '#d9730d' : '#e03e3e';

    // Helper: render features (supports both old array of strings and new detailed format)
    const renderFeatures = () => {
      if (a.featuresDetailed && a.featuresDetailed.length > 0) {
        return a.featuresDetailed.map(f => `
          <div class="detail-feature-card">
            <div class="detail-feature-card__header">
              <span class="detail-feature-card__icon">${f.icon || '⚡'}</span>
              <div class="detail-feature-card__names">
                <span class="detail-feature-card__name-vi">${f.name_vi || f.name_en}</span>
                ${f.name_en ? `<span class="detail-feature-card__name-en">${f.name_en}</span>` : ''}
              </div>
            </div>
            ${f.explanation ? `<p class="detail-feature-card__desc">${f.explanation}</p>` : ''}
          </div>
        `).join('');
      } else if (a.features && a.features.length > 0) {
        return a.features.map(f => `
          <div class="detail-feature-card">
            <div class="detail-feature-card__header">
              <span class="detail-feature-card__icon">⚡</span>
              <div class="detail-feature-card__names">
                <span class="detail-feature-card__name-vi">${typeof f === 'string' ? f : (f.name_vi || f.name_en || f)}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
      return '';
    };

    // Helper: render use cases (supports both old string array and new object format)
    const renderUseCases = () => {
      if (!a.useCases || a.useCases.length === 0) return '';
      return a.useCases.map(u => {
        if (typeof u === 'string') {
          return `<div class="detail-usecase"><span class="detail-usecase__icon">🎯</span><div><span class="detail-usecase__title">${u}</span></div></div>`;
        }
        return `
          <div class="detail-usecase">
            <span class="detail-usecase__icon">${u.icon || '🎯'}</span>
            <div>
              <span class="detail-usecase__title">${u.title}</span>
              ${u.description ? `<p class="detail-usecase__desc">${u.description}</p>` : ''}
            </div>
          </div>
        `;
      }).join('');
    };

    body.innerHTML = `
      <!-- ===== HERO HEADER ===== -->
      <div class="detail-hero">
        <div class="detail-hero__banner"></div>
        <div class="detail-hero__content">
          <h2 class="detail-hero__title">${repo.name}</h2>
          ${repo.owner ? `<span class="detail-hero__owner">bởi ${repo.owner}</span>` : ''}
        </div>
      </div>

      <!-- ===== DESCRIPTION ===== -->
      <p class="detail-panel__description">${repo.description || 'Không có mô tả'}</p>

      <!-- ===== STATS GRID ===== -->
      <div class="detail-stats-grid">
        <div class="detail-stat-card">
          <span class="detail-stat-card__icon">⭐</span>
          <span class="detail-stat-card__value">${formatNumber(repo.stars)}</span>
          <span class="detail-stat-card__label">Yêu thích</span>
        </div>
        <div class="detail-stat-card">
          <span class="detail-stat-card__icon">🔀</span>
          <span class="detail-stat-card__value">${formatNumber(repo.forks)}</span>
          <span class="detail-stat-card__label">Phân nhánh</span>
        </div>
        <div class="detail-stat-card">
          <span class="detail-stat-card__icon">💻</span>
          <span class="detail-stat-card__value">${repo.language || 'N/A'}</span>
          <span class="detail-stat-card__label">Ngôn ngữ</span>
        </div>
        <div class="detail-stat-card">
          <span class="detail-stat-card__icon">📋</span>
          <span class="detail-stat-card__value">${repo.openIssues || 0}</span>
          <span class="detail-stat-card__label">Vấn đề mở</span>
        </div>
      </div>

      <!-- ===== TOPICS ===== -->
      ${repo.topics && repo.topics.length > 0 ? `
        <div class="topic-tags" style="margin-bottom:var(--space-xl)">
          ${repo.topics.map(t => `<span class="topic-tag">${t}</span>`).join('')}
        </div>
      ` : ''}

      <!-- ===== TÓM TẮT NHANH ===== -->
      ${a.quickSummary ? `
        <div class="detail-eli5">
          <div class="detail-eli5__header">
            <span class="detail-eli5__emoji">📌</span>
            <span class="detail-eli5__title">Tóm tắt nhanh</span>
            <span class="detail-eli5__badge">AI</span>
          </div>
          <div class="detail-eli5__content">${a.quickSummary}</div>
        </div>
      ` : a.eli5 || a.explanation ? `
        <div class="detail-eli5">
          <div class="detail-eli5__header">
            <span class="detail-eli5__emoji">🧒</span>
            <span class="detail-eli5__title">Giải thích đơn giản</span>
            <span class="detail-eli5__badge">ELI5</span>
          </div>
          <div class="detail-eli5__content">${a.eli5 || a.explanation}</div>
        </div>
      ` : ''}

      <!-- ===== TỔNG QUAN DỰ ÁN ===== -->
      ${a.overview ? `
        <div class="detail-section">
          <div class="detail-section__title">🗂️ Tổng quan dự án</div>
          <div class="detail-section__content">${a.overview.purpose || ''}</div>
          ${a.overview.targetAudience ? `
            <div class="detail-audience">
              <span class="detail-audience__icon">👥</span>
              <span class="detail-audience__text"><strong>Đối tượng:</strong> ${a.overview.targetAudience}</span>
            </div>
          ` : ''}
          ${a.overview.components && a.overview.components.length > 0 ? `
            <div class="detail-components">
              <div class="detail-components__title">📁 Thành phần chính:</div>
              <div class="detail-components__list">
                ${a.overview.components.map(c => `
                  <div class="detail-component-item">
                    <span class="detail-component-item__name">${c.name || ''}</span>
                    <span class="detail-component-item__desc">${c.description || ''}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      ` : a.problemSolved ? `
        <div class="detail-section">
          <div class="detail-section__title">🔍 Nó giải quyết vấn đề gì?</div>
          <div class="detail-problem">${a.problemSolved}</div>
        </div>
      ` : ''}

      <!-- ===== VẤN ĐỀ GIẢI QUYẾT (với ví dụ) ===== -->
      ${a.problemsSolved && a.problemsSolved.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">🔍 Giải quyết vấn đề gì?</div>
          <div class="detail-problems-list">
            ${a.problemsSolved.map(p => `
              <div class="detail-problem-card">
                <div class="detail-problem-card__header">
                  <span class="detail-problem-card__icon">${p.icon || '❓'}</span>
                  <span class="detail-problem-card__title">${p.problem || ''}</span>
                </div>
                ${p.explanation ? `<p class="detail-problem-card__explain">${p.explanation}</p>` : ''}
                ${p.example ? `
                  <div class="detail-problem-card__example">
                    <span class="detail-problem-card__example-label">💡 Ví dụ:</span>
                    <span>${p.example}</span>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ===== TÍNH NĂNG CHÍNH ===== -->
      ${a.keyFeatures && a.keyFeatures.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">⚡ Tính năng chính</div>
          <div class="detail-features-grid">
            ${a.keyFeatures.map(f => `
              <div class="detail-feature-card">
                <div class="detail-feature-card__header">
                  <span class="detail-feature-card__icon">${f.icon || '⚡'}</span>
                  <div class="detail-feature-card__names">
                    <span class="detail-feature-card__name-vi">${f.name || ''}</span>
                    ${f.nameEn ? `<span class="detail-feature-card__name-en">${f.nameEn}</span>` : ''}
                  </div>
                </div>
                ${f.description ? `<p class="detail-feature-card__desc">${f.description}</p>` : ''}
                ${f.example ? `
                  <div class="detail-feature-card__example">
                    <span>💡</span> <span>${f.example}</span>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : (a.featuresDetailed && a.featuresDetailed.length > 0) || (a.features && a.features.length > 0) ? `
        <div class="detail-section">
          <div class="detail-section__title">⚡ Tính năng chính</div>
          <div class="detail-features-grid">
            ${renderFeatures()}
          </div>
        </div>
      ` : ''}

      <!-- ===== HƯỚNG DẪN CÀI ĐẶT ===== -->
      ${a.installation && a.installation.methods && a.installation.methods.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">📥 Hướng dẫn cài đặt</div>
          <div class="detail-install-methods">
            ${a.installation.methods.map(m => `
              <div class="detail-install-method ${m.recommended ? 'detail-install-method--recommended' : ''}">
                <div class="detail-install-method__header">
                  <span class="detail-install-method__name">${m.name || 'Cài đặt'}</span>
                  ${m.recommended ? '<span class="detail-install-method__badge">⭐ Khuyên dùng</span>' : ''}
                </div>
                ${m.steps && m.steps.length > 0 ? `
                  <div class="detail-install-steps">
                    ${m.steps.map((step, i) => `
                      <div class="detail-install-step">
                        <span class="detail-install-step__num">${i + 1}</span>
                        <code class="detail-install-step__code">${step}</code>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : a.quickStart ? `
        <div class="detail-quickstart">
          <span class="detail-quickstart__icon">🚀</span>
          <div>
            <div class="detail-quickstart__title">Bắt đầu nhanh</div>
            <div class="detail-quickstart__content">${a.quickStart}</div>
          </div>
        </div>
      ` : ''}

      <!-- ===== ĐÁNH GIÁ: ĐỘ KHÓ + GIÁ TRỊ ===== -->
      ${a.difficulty || a.practicalValue ? `
        <div class="detail-assessment">
          ${a.difficulty ? `
            <div class="detail-assessment__item">
              <div class="detail-assessment__header">
                <span>📊 Độ khó</span>
                <span class="detail-badge" style="background:${diffColor}15;color:${diffColor};border:1px solid ${diffColor}30">${a.difficulty.level}</span>
              </div>
              <p class="detail-assessment__desc">${a.difficulty.description}</p>
            </div>
          ` : ''}

          ${a.practicalValue ? `
            <div class="detail-assessment__item">
              <div class="detail-assessment__header">
                <span>💎 Giá trị thực tế</span>
                <span class="detail-badge" style="background:${valColor}15;color:${valColor};border:1px solid ${valColor}30">${valScore}/10</span>
              </div>
              <div class="detail-value-bar">
                <div class="detail-value-bar__fill" style="width:${valScore * 10}%;background:${valColor}"></div>
              </div>
              <p class="detail-assessment__desc">${a.practicalValue.reason}</p>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- ===== HIỆU QUẢ ===== -->
      ${a.effectiveness && a.effectiveness.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">✅ Dấu hiệu hiệu quả</div>
          <div class="detail-effectiveness">
            ${a.effectiveness.map(e => `
              <div class="detail-effectiveness__item">
                <span class="detail-effectiveness__check">✓</span>
                <span>${e}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ===== ỨNG DỤNG THỰC TẾ (backward-compat) ===== -->
      ${!a.problemsSolved && a.useCases && a.useCases.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">🎯 Ứng dụng thực tế</div>
          <div class="detail-usecases-list">
            ${renderUseCases()}
          </div>
        </div>
      ` : ''}

      <!-- ===== ĐIỂM MẤU CHỐT ===== -->
      ${a.keyTakeaway ? `
        <div class="detail-takeaway">
          <div class="detail-takeaway__content">${a.keyTakeaway}</div>
        </div>
      ` : ''}

      <!-- ===== CÔNG CỤ TƯƠNG TỰ ===== -->
      ${a.alternatives && a.alternatives.length > 0 ? `
        <div class="detail-section">
          <div class="detail-section__title">🔄 Công cụ tương tự</div>
          <div class="detail-alternatives">
            ${a.alternatives.map(alt => `<span class="detail-alt-pill">${alt}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ===== LIÊN KẾT ===== -->
      <div class="detail-section">
        <div class="detail-section__title">🔗 Liên kết</div>
        <div class="detail-links">
          <a href="${repo.url}" target="_blank" rel="noopener" class="detail-link detail-link--github">
            <span>📂</span> Mở trên GitHub <span class="detail-link__arrow">→</span>
          </a>
          ${repo.homepage ? `
            <a href="${repo.homepage}" target="_blank" rel="noopener" class="detail-link detail-link--website">
              <span>🌐</span> Website chính thức <span class="detail-link__arrow">→</span>
            </a>
          ` : ''}
        </div>
      </div>

      <!-- ===== GHI CHÚ CÁ NHÂN ===== -->
      <div class="detail-notes">
        <div class="detail-notes__header">📝 Ghi chú cá nhân</div>
        <textarea class="detail-notes__textarea" id="repoNotes" 
          data-repo-id="${repo.id}" 
          placeholder="Viết ghi chú về repo này...">${repo.notes || ''}</textarea>
        <div class="detail-notes__saved" id="notesSaved">✓ Đã lưu</div>
      </div>

      <!-- ===== TAGS CÁ NHÂN ===== -->
      <div class="detail-tags">
        <div class="detail-tags__header">🏷️ Tags</div>
        <div class="detail-tags__list" id="repoTagsList">
          ${(repo.customTags || []).map(tag => `
            <span class="detail-tag">
              ${tag}
              <button class="detail-tag__remove" data-tag="${tag}" data-repo-id="${repo.id}">✕</button>
            </span>
          `).join('')}
        </div>
        <div class="detail-tags__input-wrap">
          <input type="text" class="detail-tags__input" id="tagInput" placeholder="Thêm tag..." data-repo-id="${repo.id}">
          <button class="detail-tags__add-btn" id="addTagBtn">+ Thêm</button>
        </div>
      </div>

      <!-- ===== FOOTER ===== -->
      <div class="detail-footer">
        <div class="detail-footer__item">
          <span>📅 Thêm vào:</span> ${formatDate(repo.addedAt)}
        </div>
        <div class="detail-footer__item">
          <span>🔄 Cập nhật:</span> ${formatDate(repo.updatedAt)}
        </div>
        ${repo.license ? `
          <div class="detail-footer__item">
            <span>📜 Giấy phép:</span> ${repo.license}
          </div>
        ` : ''}
      </div>

      <!-- ===== ACTIONS ===== -->
      <div class="detail-actions">
        <button class="btn btn--secondary" id="compareThisBtn" data-repo-id="${repo.id}">📊 So sánh</button>
        <a href="${repo.url}" target="_blank" rel="noopener" class="btn btn--primary" style="text-decoration:none;text-align:center">🔗 GitHub</a>
      </div>
    `;

    panel.classList.add('open');

    // Bind notes auto-save
    const notesEl = document.getElementById('repoNotes');
    if (notesEl) {
      let saveTimeout;
      notesEl.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          this.saveRepoNote(notesEl.dataset.repoId, notesEl.value);
        }, 800);
      });
    }

    // Bind tag add
    const addTagBtn = document.getElementById('addTagBtn');
    const tagInput = document.getElementById('tagInput');
    if (addTagBtn && tagInput) {
      const addTag = () => {
        const tag = tagInput.value.trim();
        if (tag) {
          this.addRepoTag(tagInput.dataset.repoId, tag);
          tagInput.value = '';
        }
      };
      addTagBtn.addEventListener('click', addTag);
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addTag(); }
      });
    }

    // Bind tag remove
    document.getElementById('repoTagsList')?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.detail-tag__remove');
      if (removeBtn) {
        this.removeRepoTag(removeBtn.dataset.repoId, removeBtn.dataset.tag);
      }
    });

    // Bind compare button
    document.getElementById('compareThisBtn')?.addEventListener('click', (e) => {
      this.toggleCompare(e.target.dataset.repoId);
    });
  }

  closeDetail() {
    document.getElementById('detailPanel').classList.remove('open');
  }

  // ---- Context Menu ----
  showContextMenu(event, nodeData) {
    const menu = document.getElementById('contextMenu');
    let items = '';

    if (nodeData.type === 'category') {
      items = `
        <button class="context-menu__item" data-action="editCat" data-id="${nodeData.data.id}">✏️ Sửa danh mục</button>
        <div class="context-menu__divider"></div>
        <button class="context-menu__item context-menu__item--danger" data-action="deleteCat" data-id="${nodeData.data.id}">🗑 Xóa danh mục</button>
      `;
    } else if (nodeData.type === 'repo') {
      const catId = this.findCategoryOfRepo(nodeData.data.id);
      const isComparing = this.compareSet?.has(nodeData.data.id);
      items = `
        <button class="context-menu__item" data-action="viewRepo" data-repo='${JSON.stringify({ catId, repoId: nodeData.data.id })}'>👁 Xem chi tiết</button>
        <button class="context-menu__item" data-action="openGithub" data-url="${nodeData.data.url}">🔗 Mở trên GitHub</button>
        <button class="context-menu__item context-menu__item--compare" data-action="toggleCompare" data-repo-id="${nodeData.data.id}">${isComparing ? '✅ Bỏ so sánh' : '📊 Thêm so sánh'}</button>
        <div class="context-menu__divider"></div>
        <button class="context-menu__item context-menu__item--danger" data-action="deleteRepo" data-repo='${JSON.stringify({ catId, repoId: nodeData.data.id })}'>🗑 Xóa repo</button>
      `;
    }

    menu.innerHTML = items;
    menu.style.display = 'block';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
  }

  hideContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
  }

  findCategoryOfRepo(repoId) {
    for (const cat of this.data.categories) {
      if (cat.repos.find(r => r.id === repoId)) return cat.id;
    }
    return null;
  }

  // ---- Modals ----
  openModal(id) {
    document.getElementById(id).classList.add('open');
    // Auto-select active category in repo modal
    if (id === 'addRepoModal') {
      const sel = document.getElementById('modalCategorySelect');
      const target = this.selectedCategory || (this.data.categories[0]?.id ?? '');
      if (target && sel) sel.value = target;
    }
  }

  closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  // ---- Save ----
  save() {
    this.storage.save(this.data);
  }

  // ---- Events ----
  bindEvents() {
    const self = this;

    // Theme toggles
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('sidebarThemeToggle').addEventListener('click', () => this.toggleTheme());

    // Sidebar toggle
    document.getElementById('toggleSidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this.renderMindMap();
    });

    // Quick add form
    document.getElementById('quickAddForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('quickUrlInput').value;
      const catId = document.getElementById('quickCategorySelect').value;
      await this.addRepo(url, catId, 'quick');
    });

    // Add repo button → open modal
    document.getElementById('addRepoBtn').addEventListener('click', () => this.openModal('addRepoModal'));
    document.getElementById('emptyAddBtn')?.addEventListener('click', () => this.openModal('addRepoModal'));

    // Add repo modal form
    document.getElementById('addRepoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('modalUrlInput').value;
      const catId = document.getElementById('modalCategorySelect').value;
      await this.addRepo(url, catId, 'modal');
    });

    // Cancel modal
    document.getElementById('cancelModalBtn').addEventListener('click', () => this.closeModal('addRepoModal'));

    // Add category button
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
      document.getElementById('categoryModalTitle').textContent = 'Thêm Danh mục';
      document.getElementById('categoryNameInput').value = '';
      document.getElementById('categoryIconInput').value = '';
      document.getElementById('editCategoryId').value = '';
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      document.querySelector('.color-swatch[data-color="#2eaadc"]').classList.add('selected');
      document.getElementById('categoryColorInput').value = '#2eaadc';
      this.openModal('addCategoryModal');
    });

    // Add category form
    document.getElementById('addCategoryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('categoryNameInput').value;
      const icon = document.getElementById('categoryIconInput').value;
      const color = document.getElementById('categoryColorInput').value;
      this.addCategory(name, icon, color);
    });

    document.getElementById('cancelCategoryBtn').addEventListener('click', () => this.closeModal('addCategoryModal'));

    // Color picker
    document.getElementById('colorPicker').addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      document.getElementById('categoryColorInput').value = swatch.dataset.color;
    });

    // Category list clicks
    document.getElementById('categoryList').addEventListener('click', (e) => {
      // Delete button
      const deleteBtn = e.target.closest('.category-item__delete');
      if (deleteBtn) {
        e.stopPropagation();
        this.deleteCategory(deleteBtn.dataset.id);
        return;
      }

      // Category item click → highlight
      const item = e.target.closest('.category-item');
      if (item) {
        this.selectedCategory = item.dataset.id;
        this.renderSidebar();
      }
    });

    // Close detail
    document.getElementById('closeDetailBtn').addEventListener('click', () => this.closeDetail());

    // Context menu actions
    document.getElementById('contextMenu').addEventListener('click', (e) => {
      const btn = e.target.closest('.context-menu__item');
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === 'editCat') {
        const cat = this.data.categories.find(c => c.id === btn.dataset.id);
        if (cat) {
          document.getElementById('categoryModalTitle').textContent = 'Sửa Danh mục';
          document.getElementById('categoryNameInput').value = cat.name;
          document.getElementById('categoryIconInput').value = cat.icon;
          document.getElementById('editCategoryId').value = cat.id;
          document.getElementById('categoryColorInput').value = cat.color;
          document.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.toggle('selected', s.dataset.color === cat.color);
          });
          this.openModal('addCategoryModal');
        }
      } else if (action === 'deleteCat') {
        this.deleteCategory(btn.dataset.id);
      } else if (action === 'viewRepo') {
        const { catId, repoId } = JSON.parse(btn.dataset.repo);
        const cat = this.data.categories.find(c => c.id === catId);
        const repo = cat?.repos.find(r => r.id === repoId);
        if (repo) this.showDetail(repo);
      } else if (action === 'openGithub') {
        window.open(btn.dataset.url, '_blank');
      } else if (action === 'toggleCompare') {
        this.toggleCompare(btn.dataset.repoId);
      } else if (action === 'deleteRepo') {
        const { catId, repoId } = JSON.parse(btn.dataset.repo);
        this.deleteRepo(catId, repoId);
      }

      this.hideContextMenu();
    });

    // Close context menu on click outside
    document.addEventListener('click', () => this.hideContextMenu());

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

    // API Key save on blur
    document.getElementById('apiKeyInput').addEventListener('blur', () => this.saveApiKey());

    // Zoom controls
    document.getElementById('zoomInBtn')?.addEventListener('click', () => this.mindMap.zoomIn());
    document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.mindMap.zoomOut());
    document.getElementById('zoomResetBtn')?.addEventListener('click', () => this.mindMap.zoomReset());

    // Export / Import
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.storage.exportJSON(this.data);
      this.toast.show('Đã xuất dữ liệu', 'success');
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const imported = await this.storage.importJSON(file);
        this.data = imported;
        this.save();
        this.renderSidebar();
        this.renderMindMap();
        this.loadApiKey();
        this.initTheme();
        this.toast.show('Đã nhập dữ liệu thành công', 'success');
      } catch (err) {
        this.toast.show(err.message, 'error');
      }
      e.target.value = '';
    });

    // Resize
    window.addEventListener('resize', () => {
      if (this.mindMap) this.mindMap.resize();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // ESC to close panels/modals/command palette
      if (e.key === 'Escape') {
        const cmdPalette = document.getElementById('cmdPalette');
        if (cmdPalette.classList.contains('open')) {
          cmdPalette.classList.remove('open');
          return;
        }
        this.closeDetail();
        this.hideContextMenu();
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
      // Ctrl+K for Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.openCommandPalette();
      }
    });

    // Compare FAB buttons
    document.getElementById('compareFabBtn')?.addEventListener('click', () => this.showCompareModal());
    document.getElementById('compareFabClear')?.addEventListener('click', () => this.clearCompare());
    document.getElementById('closeCompareBtn')?.addEventListener('click', () => {
      document.getElementById('compareModal').classList.remove('open');
    });

    // Command palette overlay click
    document.getElementById('cmdPalette')?.addEventListener('click', (e) => {
      if (e.target.id === 'cmdPalette') {
        e.target.classList.remove('open');
      }
    });

    // Initialize compare set
    this.compareSet = new Set();
  }

  // ==============================
  // FEATURE: Notes & Tags
  // ==============================
  findRepoById(repoId) {
    for (const cat of this.data.categories) {
      const repo = cat.repos.find(r => r.id === repoId);
      if (repo) return repo;
    }
    return null;
  }

  saveRepoNote(repoId, note) {
    const repo = this.findRepoById(repoId);
    if (!repo) return;
    repo.notes = note;
    this.save();
    // Show saved indicator
    const savedEl = document.getElementById('notesSaved');
    if (savedEl) {
      savedEl.classList.add('visible');
      setTimeout(() => savedEl.classList.remove('visible'), 1500);
    }
  }

  addRepoTag(repoId, tag) {
    const repo = this.findRepoById(repoId);
    if (!repo) return;
    if (!repo.customTags) repo.customTags = [];
    const normalizedTag = tag.toLowerCase().trim();
    if (repo.customTags.includes(normalizedTag)) {
      this.toast.show('Tag đã tồn tại', 'info');
      return;
    }
    repo.customTags.push(normalizedTag);
    this.save();
    this.showDetail(repo); // Re-render
    this.toast.show(`Đã thêm tag "${normalizedTag}"`, 'success');
  }

  removeRepoTag(repoId, tag) {
    const repo = this.findRepoById(repoId);
    if (!repo || !repo.customTags) return;
    repo.customTags = repo.customTags.filter(t => t !== tag);
    this.save();
    this.showDetail(repo); // Re-render
  }

  // ==============================
  // FEATURE: Compare Repos
  // ==============================
  toggleCompare(repoId) {
    if (!this.compareSet) this.compareSet = new Set();
    if (this.compareSet.has(repoId)) {
      this.compareSet.delete(repoId);
      this.toast.show('Đã bỏ khỏi so sánh', 'info');
    } else {
      if (this.compareSet.size >= 5) {
        this.toast.show('Tối đa 5 repos để so sánh', 'error');
        return;
      }
      this.compareSet.add(repoId);
      this.toast.show('Đã thêm vào so sánh', 'success');
    }
    this.updateCompareFab();
  }

  updateCompareFab() {
    const fab = document.getElementById('compareFab');
    const count = document.getElementById('compareFabCount');
    if (this.compareSet.size > 0) {
      fab.style.display = 'flex';
      count.textContent = this.compareSet.size;
    } else {
      fab.style.display = 'none';
    }
  }

  clearCompare() {
    this.compareSet.clear();
    this.updateCompareFab();
    this.toast.show('Đã bỏ chọn tất cả', 'info');
  }

  showCompareModal() {
    if (this.compareSet.size < 2) {
      this.toast.show('Chọn ít nhất 2 repos để so sánh', 'error');
      return;
    }

    const repos = [];
    for (const id of this.compareSet) {
      const repo = this.findRepoById(id);
      if (repo) repos.push(repo);
    }

    if (repos.length < 2) {
      this.toast.show('Không đủ repos để so sánh', 'error');
      return;
    }

    const body = document.getElementById('compareBody');
    const metrics = [
      { key: 'stars', label: '⭐ Stars', format: v => formatNumber(v || 0), higher: true },
      { key: 'forks', label: '🔀 Forks', format: v => formatNumber(v || 0), higher: true },
      { key: 'language', label: '💻 Ngôn ngữ', format: v => v || 'N/A' },
      { key: 'openIssues', label: '📋 Issues mở', format: v => v || 0, higher: false },
      { key: 'license', label: '📜 Giấy phép', format: v => v || 'N/A' },
      { key: '_difficulty', label: '📊 Độ khó', format: (v, r) => r.ai_analysis?.difficulty?.level || 'N/A' },
      { key: '_value', label: '💎 Giá trị', format: (v, r) => (r.ai_analysis?.practicalValue?.score || 0) + '/10', higher: true, getValue: r => r.ai_analysis?.practicalValue?.score || 0 },
      { key: '_tags', label: '🏷️ Tags', format: (v, r) => (r.customTags || []).join(', ') || '—' },
    ];

    let tableHTML = '<table class="compare-table">';
    // Header row
    tableHTML += '<thead><tr><th></th>';
    repos.forEach(r => {
      tableHTML += `<th class="compare-repo-header">
        <span class="compare-repo-name">${r.name}</span>
        <span class="compare-repo-owner">${r.owner || ''}</span>
      </th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    // Metric rows with best/worst highlighting
    metrics.forEach(m => {
      const values = repos.map(r => {
        if (m.getValue) return m.getValue(r);
        return r[m.key];
      });
      const numericValues = values.filter(v => typeof v === 'number');
      const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : null;
      const minVal = numericValues.length > 0 ? Math.min(...numericValues) : null;

      tableHTML += `<tr><td>${m.label}</td>`;
      repos.forEach((r, i) => {
        const displayValue = m.format(r[m.key], r);
        let cls = '';
        if (m.higher !== undefined && typeof values[i] === 'number' && maxVal !== minVal) {
          if (m.higher && values[i] === maxVal) cls = 'compare-best';
          else if (m.higher && values[i] === minVal) cls = 'compare-worst';
          else if (!m.higher && values[i] === minVal) cls = 'compare-best';
          else if (!m.higher && values[i] === maxVal) cls = 'compare-worst';
        }
        tableHTML += `<td class="${cls}">${displayValue}</td>`;
      });
      tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    body.innerHTML = tableHTML;

    document.getElementById('compareModal').classList.add('open');
  }

  // ==============================
  // FEATURE: Command Palette
  // ==============================
  openCommandPalette() {
    const overlay = document.getElementById('cmdPalette');
    const input = document.getElementById('cmdPaletteInput');
    overlay.classList.add('open');
    input.value = '';
    input.focus();
    this._cmdActiveIndex = 0;
    this.updateCommandPaletteResults('');

    // Remove old listeners
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', () => {
      this._cmdActiveIndex = 0;
      this.updateCommandPaletteResults(newInput.value);
    });

    newInput.addEventListener('keydown', (e) => {
      const items = document.querySelectorAll('.cmd-palette__item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._cmdActiveIndex = Math.min(this._cmdActiveIndex + 1, items.length - 1);
        this.highlightCmdItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._cmdActiveIndex = Math.max(this._cmdActiveIndex - 1, 0);
        this.highlightCmdItem(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = items[this._cmdActiveIndex];
        if (active) active.click();
      }
    });

    newInput.focus();
  }

  highlightCmdItem(items) {
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this._cmdActiveIndex);
      if (i === this._cmdActiveIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  updateCommandPaletteResults(query) {
    const container = document.getElementById('cmdPaletteResults');
    const q = query.toLowerCase().trim();

    // Build items list
    const allItems = [];

    // Repos
    this.data.categories.forEach(cat => {
      cat.repos.forEach(repo => {
        allItems.push({
          type: 'repo',
          icon: '📦',
          title: repo.name,
          desc: repo.description || cat.name,
          badge: cat.name,
          action: () => { this.showDetail(repo); document.getElementById('cmdPalette').classList.remove('open'); }
        });
      });
    });

    // Categories
    this.data.categories.forEach(cat => {
      allItems.push({
        type: 'category',
        icon: cat.icon || '📁',
        title: cat.name,
        desc: `${cat.repos.length} repos`,
        badge: 'Danh mục',
        action: () => {
          this.selectedCategory = cat.id;
          this.renderSidebar();
          document.getElementById('cmdPalette').classList.remove('open');
        }
      });
    });

    // Actions
    const actions = [
      { icon: '＋', title: 'Thêm Repo mới', desc: 'Mở form thêm repo', badge: 'Thao tác', action: () => { this.openModal('addRepoModal'); document.getElementById('cmdPalette').classList.remove('open'); } },
      { icon: '📁', title: 'Thêm Danh mục', desc: 'Tạo danh mục mới', badge: 'Thao tác', action: () => { document.getElementById('categoryModalTitle').textContent = 'Thêm Danh mục'; document.getElementById('editCategoryId').value = ''; this.openModal('addCategoryModal'); document.getElementById('cmdPalette').classList.remove('open'); } },
      { icon: '📤', title: 'Xuất dữ liệu', desc: 'Export JSON', badge: 'Thao tác', action: () => { this.storage.exportJSON(this.data); this.toast.show('Đã xuất dữ liệu', 'success'); document.getElementById('cmdPalette').classList.remove('open'); } },
      { icon: '📊', title: 'So sánh repos', desc: `${this.compareSet?.size || 0} repos đã chọn`, badge: 'Thao tác', action: () => { this.showCompareModal(); document.getElementById('cmdPalette').classList.remove('open'); } },
      { icon: '🌙', title: 'Chuyển theme', desc: 'Dark/Light mode', badge: 'Thao tác', action: () => { this.toggleTheme(); document.getElementById('cmdPalette').classList.remove('open'); } },
    ];
    actions.forEach(a => allItems.push({ ...a, type: 'action' }));

    // Filter
    const filtered = q
      ? allItems.filter(item => {
          const searchText = `${item.title} ${item.desc} ${item.badge}`.toLowerCase();
          return q.split(' ').every(word => searchText.includes(word));
        })
      : allItems;

    // Group
    const groups = {};
    filtered.forEach(item => {
      const groupName = item.type === 'repo' ? 'Repos' : item.type === 'category' ? 'Danh mục' : 'Thao tác';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });

    // Render
    if (filtered.length === 0) {
      container.innerHTML = '<div class="cmd-palette__empty">Không tìm thấy kết quả</div>';
      return;
    }

    let html = '';
    let globalIndex = 0;
    for (const [groupName, items] of Object.entries(groups)) {
      html += `<div class="cmd-palette__group-title">${groupName}</div>`;
      items.slice(0, 8).forEach((item, i) => {
        const isActive = globalIndex === this._cmdActiveIndex;
        html += `
          <div class="cmd-palette__item${isActive ? ' active' : ''}" data-index="${globalIndex}">
            <span class="cmd-palette__item-icon">${item.icon}</span>
            <div class="cmd-palette__item-content">
              <div class="cmd-palette__item-title">${item.title}</div>
              <div class="cmd-palette__item-desc">${item.desc || ''}</div>
            </div>
            <span class="cmd-palette__item-badge">${item.badge || ''}</span>
          </div>
        `;
        globalIndex++;
      });
    }
    container.innerHTML = html;

    // Bind click handlers
    const flatItems = [];
    for (const items of Object.values(groups)) {
      flatItems.push(...items.slice(0, 8));
    }
    container.querySelectorAll('.cmd-palette__item').forEach((el, i) => {
      el.addEventListener('click', () => {
        if (flatItems[i]?.action) flatItems[i].action();
      });
      el.addEventListener('mouseenter', () => {
        this._cmdActiveIndex = i;
        this.highlightCmdItem(container.querySelectorAll('.cmd-palette__item'));
      });
    });
  }
}

// ============================================
// Initialize App
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
