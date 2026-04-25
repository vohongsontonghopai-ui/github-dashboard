/* ============================================
   ai.js — GitHub API + OpenRouter AI Integration
   ============================================ */

// ===== GitHub API =====
class GitHubAPI {
  constructor() {
    this.baseUrl = 'https://api.github.com';
  }

  /**
   * Parse a GitHub URL to extract owner and repo name
   * Supports: https://github.com/owner/repo, https://github.com/owner/repo/...
   */
  parseUrl(url) {
    try {
      const parsed = new URL(url.trim());
      if (parsed.hostname !== 'github.com') {
        throw new Error('Không phải link GitHub');
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) {
        throw new Error('Link không hợp lệ. Cần dạng: github.com/owner/repo');
      }
      return { owner: parts[0], repo: parts[1] };
    } catch (e) {
      if (e.message.includes('GitHub') || e.message.includes('Link')) throw e;
      throw new Error('URL không hợp lệ');
    }
  }

  /**
   * Fetch repository information
   */
  async fetchRepoInfo(owner, repo) {
    const resp = await fetch(`${this.baseUrl}/repos/${owner}/${repo}`);
    if (resp.status === 404) throw new Error('Repo không tồn tại');
    if (resp.status === 403) throw new Error('GitHub API rate limit. Vui lòng chờ 1 phút');
    if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
    return resp.json();
  }

  /**
   * Fetch README content (decoded from base64)
   */
  async fetchReadme(owner, repo) {
    try {
      const resp = await fetch(`${this.baseUrl}/repos/${owner}/${repo}/readme`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      // Decode base64 content
      return atob(data.content.replace(/\n/g, ''));
    } catch {
      return null;
    }
  }

  /**
   * Full pipeline: parse URL → fetch info + README
   */
  async analyze(url) {
    const { owner, repo } = this.parseUrl(url);
    const [repoInfo, readme] = await Promise.all([
      this.fetchRepoInfo(owner, repo),
      this.fetchReadme(owner, repo)
    ]);
    return {
      name: repoInfo.name,
      fullName: repoInfo.full_name,
      owner: repoInfo.owner.login,
      description: repoInfo.description || '',
      stars: repoInfo.stargazers_count,
      forks: repoInfo.forks_count,
      language: repoInfo.language || 'N/A',
      topics: repoInfo.topics || [],
      htmlUrl: repoInfo.html_url,
      homepage: repoInfo.homepage || '',
      createdAt: repoInfo.created_at,
      updatedAt: repoInfo.updated_at,
      openIssues: repoInfo.open_issues_count,
      license: repoInfo.license?.name || 'N/A',
      readme: readme
    };
  }
}

// ===== OpenRouter AI Analyzer =====
class AIAnalyzer {
  constructor() {
    this.endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    this.model = 'google/gemini-2.0-flash-001';
  }

  /**
   * Analyze a repo using AI — Deep Vietnamese analysis
   * @param {Object} repoInfo - Repository info from GitHub API
   * @param {string} apiKey - OpenRouter API key
   * @returns {Object} Comprehensive AI analysis result
   */
  async analyze(repoInfo, apiKey) {
    if (!apiKey) {
      return this.fallbackAnalysis(repoInfo);
    }

    const readmeSnippet = repoInfo.readme
      ? repoInfo.readme.substring(0, 6000)
      : 'Không có README';

    const prompt = `Phân tích CHUYÊN SÂU GitHub repository sau. Đọc kỹ README để THỰC SỰ HIỂU dự án này làm gì, giải quyết vấn đề gì, hoạt động thế nào.

=== THÔNG TIN REPO ===
Tên: ${repoInfo.name}
Tác giả: ${repoInfo.owner}
Mô tả: ${repoInfo.description}
Ngôn ngữ: ${repoInfo.language}
Topics: ${repoInfo.topics.join(', ')}
Stars: ${repoInfo.stars} | Forks: ${repoInfo.forks}
License: ${repoInfo.license}

=== README (trích) ===
${readmeSnippet}

=== YÊU CẦU ===
Trả về JSON thuần (KHÔNG markdown, KHÔNG backticks) với cấu trúc CHÍNH XÁC sau.
TOÀN BỘ nội dung phải bằng TIẾNG VIỆT (trừ tên riêng, câu lệnh code, thuật ngữ không thể dịch).
Viết như đang giải thích cho bạn bè hiểu — thân thiện, rõ ràng, có ví dụ cụ thể.

{
  "quickSummary": "📌 Tóm lại: [1-2 câu ngắn nhất mô tả dự án này LÀ GÌ và DÙNG ĐỂ LÀM GÌ]",

  "overview": {
    "purpose": "Giải thích rõ ràng mục đích chính của dự án trong 3-5 câu. Phải trả lời được: Dự án này sinh ra để làm gì? Ai tạo ra nó và tại sao?",
    "components": [
      {
        "name": "Tên file hoặc module chính (vd: CLAUDE.md)",
        "description": "Giải thích file/module này chứa gì, vai trò của nó trong dự án"
      }
    ],
    "targetAudience": "Dự án này dành cho ai? Ai nên quan tâm và tại sao?"
  },

  "problemsSolved": [
    {
      "problem": "Tên vấn đề ngắn gọn bằng tiếng Việt",
      "explanation": "Giải thích vấn đề này là gì, tại sao nó quan trọng. 2-3 câu.",
      "example": "Ví dụ cụ thể, dễ hiểu trong đời thường hoặc khi lập trình",
      "icon": "emoji phù hợp"
    }
  ],

  "keyFeatures": [
    {
      "name": "Tên tính năng/nguyên tắc bằng tiếng Việt",
      "nameEn": "Tên gốc tiếng Anh (nếu có)",
      "description": "Giải thích CHI TIẾT tính năng này làm gì, hoạt động thế nào. 3-5 câu.",
      "example": "Ví dụ cụ thể minh họa cách dùng hoặc cách nó hoạt động",
      "icon": "emoji phù hợp"
    }
  ],

  "installation": {
    "methods": [
      {
        "name": "Tên phương pháp cài đặt (tiếng Việt)",
        "steps": ["Bước 1: ...", "Bước 2: ..."],
        "recommended": true
      }
    ]
  },

  "effectiveness": [
    "Dấu hiệu 1 cho thấy dự án hoạt động hiệu quả",
    "Dấu hiệu 2...",
    "Dấu hiệu 3..."
  ],

  "customization": "Hướng dẫn ngắn cách tùy chỉnh dự án cho phù hợp nhu cầu cá nhân. 2-3 câu.",

  "keyTakeaway": "💡 Điểm chính cần nhớ: [Tóm tắt bản chất dự án trong 1-2 câu dễ nhớ]",

  "difficulty": {
    "level": "Dễ|Trung bình|Khó|Rất khó",
    "description": "Giải thích ai nên dùng, cần kiến thức gì"
  },
  "practicalValue": {
    "score": 1-10,
    "reason": "Tại sao cho điểm này? Giá trị thực tế là gì?"
  },
  "alternatives": ["Tool/lib tương tự 1", "Tool/lib tương tự 2"]
}

QUY TẮC QUAN TRỌNG:
- overview.components: Liệt kê 3-5 thành phần/file chính của dự án, mỗi cái giải thích rõ vai trò
- problemsSolved: 2-4 vấn đề, MỖI CÁI phải có ví dụ cụ thể dễ hiểu
- keyFeatures: 3-6 tính năng CHÍNH, mỗi cái giải thích CHI TIẾT + có ví dụ
- installation.methods: Ít nhất 1 cách cài đặt, trích từ README nếu có
- effectiveness: 3-5 dấu hiệu cụ thể
- KHÔNG viết chung chung. Phải dựa trên NỘI DUNG THỰC TẾ từ README
- TOÀN BỘ bằng tiếng Việt (trừ tên riêng, code)
- Viết thân thiện, dùng emoji hợp lý`;

    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github-dashboard.local',
          'X-OpenRouter-Title': 'GitHub Dashboard'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `Bạn là chuyên gia phân tích và giải thích công nghệ hàng đầu. Nhiệm vụ của bạn là biến các repository GitHub thành BÀI REVIEW CÔNG NGHỆ CHUYÊN SÂU bằng tiếng Việt.

NGUYÊN TẮC:
1. ĐỌC KỸ README — Phải thực sự hiểu dự án trước khi viết. Không đoán mò.
2. GIẢI THÍCH NHƯ DẠY BẠN BÈ — Mỗi khái niệm kỹ thuật cần ví dụ đời thường.
3. CỤ THỂ, KHÔNG CHUNG CHUNG — Thay vì "dự án hữu ích", viết cụ thể hữu ích thế nào.
4. 100% TIẾNG VIỆT — Trừ tên riêng (React, Docker...), code snippet, thuật ngữ không thể dịch.
5. CÓ VÍ DỤ — Mỗi vấn đề, mỗi tính năng phải có ví dụ thực tế.

PHONG CÁCH: Thân thiện, giáo dục, như đang viết blog công nghệ cho người Việt.
FORMAT: Chỉ trả về JSON thuần, KHÔNG markdown, KHÔNG backticks.`
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        console.warn('OpenRouter API error:', resp.status, errData);
        return this.fallbackAnalysis(repoInfo);
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return this.fallbackAnalysis(repoInfo);
      }

      return this.parseAIResponse(content, repoInfo);
    } catch (err) {
      console.warn('AI analysis failed:', err);
      return this.fallbackAnalysis(repoInfo);
    }
  }

  /**
   * Parse AI response — handles new deep format + backward compat
   */
  parseAIResponse(content, repoInfo) {
    try {
      let cleaned = content.trim();

      // Remove markdown code blocks if present
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Build result with new deep fields + backward-compatible fields
      const result = {
        // === NEW DEEP FORMAT ===
        quickSummary: parsed.quickSummary || '',
        overview: parsed.overview || null,
        problemsSolved: Array.isArray(parsed.problemsSolved) ? parsed.problemsSolved : [],
        keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures.slice(0, 8) : [],
        installation: parsed.installation || null,
        effectiveness: Array.isArray(parsed.effectiveness) ? parsed.effectiveness : [],
        customization: parsed.customization || '',
        keyTakeaway: parsed.keyTakeaway || '',

        // === BACKWARD COMPAT for mind map ===
        summary: parsed.quickSummary || parsed.summary || repoInfo.description || '',
        eli5: parsed.quickSummary || parsed.eli5 || '',
        problemSolved: parsed.overview?.purpose || parsed.problemSolved || '',
        featuresDetailed: [],
        features: [],
        useCases: [],
        explanation: parsed.quickSummary || '',
        difficulty: parsed.difficulty || null,
        practicalValue: parsed.practicalValue || null,
        alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 4) : [],
        quickStart: ''
      };

      // Build backward-compat features from keyFeatures
      if (result.keyFeatures.length > 0) {
        result.featuresDetailed = result.keyFeatures.map(f => ({
          name_en: f.nameEn || f.name || '',
          name_vi: f.name || '',
          icon: f.icon || '⚡',
          explanation: f.description || ''
        }));
        result.features = result.keyFeatures.map(f => f.name || f.nameEn || '');
      }

      // Build backward-compat useCases from problemsSolved
      if (result.problemsSolved.length > 0) {
        result.useCases = result.problemsSolved.map(p => ({
          title: p.problem || '',
          icon: p.icon || '🎯',
          description: p.explanation || ''
        }));
      }

      // Build quickStart from installation
      if (result.installation?.methods?.length > 0) {
        const firstMethod = result.installation.methods[0];
        result.quickStart = firstMethod.steps?.[0] || '';
      }

      return result;
    } catch {
      console.warn('Failed to parse AI response, using fallback');
      return this.fallbackAnalysis(repoInfo);
    }
  }

  /**
   * Fallback analysis — Smart extraction from README + metadata, fully Vietnamese
   */
  fallbackAnalysis(repoInfo) {
    const lang = repoInfo.language || '';
    const starsText = this.formatNumber(repoInfo.stars);
    const readme = repoInfo.readme || '';
    const desc = repoInfo.description || '';
    const topics = repoInfo.topics || [];
    const name = repoInfo.name || '';
    const owner = repoInfo.owner || '';

    // --- Deep extraction from README ---
    const extractedFeatures = this._extractKeyFeatures(readme, name);
    const extractedProblems = this._extractProblems(readme, desc);
    const installMethods = this._extractInstallMethods(readme);
    const components = this._extractComponents(readme, name);
    const effectiveness = this._extractEffectiveness(readme);
    const difficulty = this._estimateDifficulty(readme, lang, repoInfo.stars);

    // --- Build quickSummary ---
    const quickSummary = desc
      ? `📌 Tóm lại: ${name} là ${desc.charAt(0).toLowerCase() + desc.slice(1)}`
      : `📌 Tóm lại: ${name} là một dự án ${lang || 'mã nguồn mở'} trên GitHub với ${starsText} lượt yêu thích.`;

    // --- Build overview ---
    const overview = {
      purpose: desc
        ? `${name} được tạo bởi ${owner} nhằm ${desc.charAt(0).toLowerCase() + desc.slice(1)}. ${
            topics.length > 0 ? `Dự án liên quan đến ${topics.slice(0, 4).join(', ')}.` : ''
          } Hiện có ${starsText} stars và ${this.formatNumber(repoInfo.forks)} forks trên GitHub.`
        : `${name} là một dự án ${lang || 'mã nguồn mở'} được phát triển bởi ${owner} trên GitHub.`,
      components: components.length > 0 ? components : [
        { name: 'README.md', description: 'Tài liệu hướng dẫn chính của dự án.' }
      ],
      targetAudience: this._guessTargetAudience(desc, topics, lang)
    };

    // --- Problems ---
    const problemsSolved = extractedProblems.length > 0
      ? extractedProblems
      : this._buildProblemsFromDesc(desc, topics, name);

    // --- Key Features ---
    const keyFeatures = extractedFeatures.length > 0
      ? extractedFeatures
      : this._buildFeaturesFromMetadata(lang, topics, repoInfo).map(f => ({ name: f.name_vi, nameEn: f.name_en, icon: f.icon, description: f.explanation }));

    // --- Installation ---
    const installation = installMethods.length > 0
      ? { methods: installMethods }
      : {
          methods: [{
            name: 'Tải về từ GitHub',
            steps: [
              `git clone https://github.com/${repoInfo.fullName}`,
              `cd ${name}`,
              'Đọc README.md để biết hướng dẫn chi tiết'
            ],
            recommended: true
          }]
        };

    // --- Practical value ---
    const score = Math.min(10, Math.round(
      Math.log10(Math.max(repoInfo.stars, 1)) * 1.8 +
      Math.log10(Math.max(repoInfo.forks, 1)) * 0.7
    ));

    // --- Backward-compat ---
    const featuresDetailed = keyFeatures.map(f => ({
      name_en: f.nameEn || f.name,
      name_vi: f.name,
      icon: f.icon || '⚡',
      explanation: f.description
    }));
    const features = keyFeatures.map(f => f.name);
    const useCases = problemsSolved.map(p => ({
      title: p.problem,
      icon: p.icon || '🎯',
      description: p.explanation
    }));

    return {
      // New deep format
      quickSummary,
      overview,
      problemsSolved,
      keyFeatures,
      installation,
      effectiveness: effectiveness.length > 0
        ? effectiveness
        : [`${name} được cộng đồng đánh giá với ${starsText} stars.`],
      customization: `Bạn có thể tùy chỉnh ${name} theo nhu cầu bằng cách đọc tài liệu hướng dẫn trong README.`,
      keyTakeaway: desc
        ? `💡 Điểm chính: ${name} — ${desc}`
        : `💡 Điểm chính: ${name} là dự án ${lang || 'mã nguồn mở'} đáng chú ý với ${starsText} lượt yêu thích.`,
      // Backward compat
      summary: quickSummary,
      eli5: quickSummary,
      problemSolved: overview.purpose,
      featuresDetailed,
      features,
      useCases,
      explanation: quickSummary,
      difficulty,
      practicalValue: {
        score: Math.max(1, score),
        reason: `${starsText} stars, ${this.formatNumber(repoInfo.forks)} forks — ${score >= 7 ? 'rất được cộng đồng đón nhận' : score >= 4 ? 'có lượng người dùng ổn định' : 'dự án còn mới hoặc niche'}.`
      },
      alternatives: this._findAlternatives(topics, name),
      quickStart: installation.methods[0]?.steps?.[0] || `git clone https://github.com/${repoInfo.fullName}`,
      _fallback: true
    };
  }

  /**
   * Extract key features — adapts _extractFeaturesFromReadme to the format expected by fallbackAnalysis
   */
  _extractKeyFeatures(readme, name) {
    return this._extractFeaturesFromReadme(readme, name).map(f => ({
      name: f.name_vi || f.name_en,
      nameEn: f.name_en,
      icon: f.icon,
      description: f.explanation || ''
    }));
  }

  /**
   * Extract problems/pain points from README and description
   */
  _extractProblems(readme, desc) {
    if (!readme || readme.length < 50) return [];
    const problems = [];
    const icons = ['🔥', '⚠️', '💢', '🚧'];

    // Look for "Why" / "Motivation" / "Problem" sections
    const section = readme.match(/##?\s*(?:Why|Motivation|Problem|Background|Vấn đề)[^\n]*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
    if (section) {
      const bullets = section[1].match(/[-*]\s+([^\n]+)/g) || [];
      bullets.slice(0, 4).forEach((b, i) => {
        let text = b.replace(/^[-*]\s+/, '').replace(/\*+/g, '').trim();
        if (text.length > 8 && text.length < 120) {
          problems.push({ problem: text, icon: icons[i % icons.length], explanation: '' });
        }
      });
    }
    return problems;
  }

  /**
   * Extract installation methods from README
   */
  _extractInstallMethods(readme) {
    if (!readme) return [];
    const methods = [];
    const patterns = [
      { name: 'npm', regex: /```(?:bash|sh|shell)?\s*\n(npm\s+install[^`]+)/i },
      { name: 'yarn', regex: /```(?:bash|sh|shell)?\s*\n(yarn\s+add[^`]+)/i },
      { name: 'pnpm', regex: /```(?:bash|sh|shell)?\s*\n(pnpm\s+(?:add|install)[^`]+)/i },
      { name: 'pip', regex: /```(?:bash|sh|shell)?\s*\n(pip\s+install[^`]+)/i },
      { name: 'cargo', regex: /```(?:bash|sh|shell)?\s*\n(cargo\s+(?:add|install)[^`]+)/i },
      { name: 'Docker', regex: /```(?:bash|sh|shell|dockerfile)?\s*\n(docker\s+(?:run|pull|compose)[^`]+)/i },
      { name: 'Git Clone', regex: /```(?:bash|sh|shell)?\s*\n(git\s+clone[^`]+)/i },
    ];

    for (const p of patterns) {
      const m = readme.match(p.regex);
      if (m) {
        methods.push({
          name: `Cài đặt qua ${p.name}`,
          steps: m[1].trim().split('\n').map(s => s.trim()).filter(Boolean),
          recommended: methods.length === 0
        });
      }
    }
    return methods;
  }

  /**
   * Extract components/modules from README
   */
  _extractComponents(readme, name) {
    if (!readme || readme.length < 100) return [];
    const components = [];

    // Look for h2/h3 headers that look like component names
    const headers = readme.match(/^#{2,3}\s+([^\n#]+)/gm) || [];
    const skipWords = ['install', 'usage', 'license', 'contributing', 'getting started', 'table of contents', 'features', 'overview', 'about', 'introduction', 'prerequisites', 'requirements'];

    headers.slice(0, 8).forEach(h => {
      let text = h.replace(/^#{2,3}\s+/, '').replace(/\*+/g, '').trim();
      if (text.length > 2 && text.length < 60 && !skipWords.some(w => text.toLowerCase().includes(w))) {
        components.push({ name: text, description: '' });
      }
    });

    return components.slice(0, 5);
  }

  /**
   * Extract effectiveness claims from README
   */
  _extractEffectiveness(readme) {
    if (!readme) return [];
    const claims = [];

    // Look for performance/benchmark numbers
    const perfMatches = readme.match(/(?:\d+[x%]\s+(?:faster|smaller|better|improvement|reduction)|(?:faster|smaller|better)\s+(?:than|by)\s+\d+)/gi) || [];
    perfMatches.slice(0, 3).forEach(m => claims.push(m.trim()));

    // Look for stats like "Used by X companies"
    const usageStats = readme.match(/(?:used by|trusted by|serving|powering)\s+[\d,k+]+\s+(?:\w+)/gi) || [];
    usageStats.slice(0, 2).forEach(m => claims.push(m.trim()));

    return claims;
  }

  /**
   * Guess target audience from description and topics
   */
  _guessTargetAudience(desc, topics, lang) {
    const descLower = (desc || '').toLowerCase();
    const topicsLower = topics.map(t => t.toLowerCase());

    if (descLower.includes('beginner') || descLower.includes('learning') || descLower.includes('tutorial')) {
      return 'Người mới học lập trình và developer muốn tìm hiểu thêm.';
    }
    if (topicsLower.some(t => ['devops', 'kubernetes', 'docker', 'infrastructure'].includes(t))) {
      return 'DevOps engineers và system administrators.';
    }
    if (topicsLower.some(t => ['ai', 'machine-learning', 'deep-learning', 'llm'].includes(t))) {
      return 'AI/ML engineers và data scientists.';
    }
    if (topicsLower.some(t => ['react', 'vue', 'angular', 'frontend', 'ui', 'css'].includes(t))) {
      return 'Frontend developers và UI/UX designers.';
    }
    if (topicsLower.some(t => ['api', 'backend', 'server', 'database'].includes(t))) {
      return 'Backend developers và software engineers.';
    }
    if (lang) {
      return `Developers sử dụng ${lang} và cộng đồng mã nguồn mở.`;
    }
    return 'Developers và cộng đồng mã nguồn mở.';
  }

  /**
   * Build problems from description when README extraction fails
   */
  _buildProblemsFromDesc(desc, topics, name) {
    const problems = [];
    const descLower = (desc || '').toLowerCase();

    if (descLower.includes('fast') || descLower.includes('performance') || descLower.includes('speed')) {
      problems.push({ problem: 'Hiệu suất chậm của các giải pháp hiện có', icon: '⚡', explanation: `${name} giải quyết vấn đề tốc độ và hiệu suất.` });
    }
    if (descLower.includes('simple') || descLower.includes('easy') || descLower.includes('lightweight')) {
      problems.push({ problem: 'Phức tạp khi sử dụng các công cụ hiện tại', icon: '🎯', explanation: `${name} đơn giản hóa quy trình.` });
    }
    if (descLower.includes('automat') || descLower.includes('workflow')) {
      problems.push({ problem: 'Công việc lặp đi lặp lại tốn thời gian', icon: '🤖', explanation: `${name} tự động hóa quy trình.` });
    }

    if (problems.length === 0 && desc) {
      problems.push({ problem: `Cung cấp giải pháp: ${desc}`, icon: '💡', explanation: '' });
    }
    if (problems.length === 0) {
      problems.push({ problem: `${name} giải quyết một nhu cầu cụ thể trong cộng đồng developer`, icon: '🔧', explanation: '' });
    }

    return problems;
  }

  /**
   * Extract features from README headings and bullet points
   */
  _extractFeaturesFromReadme(readme, repoName) {
    if (!readme || readme.length < 50) return [];
    const features = [];
    const featureIcons = ['⚡', '🔧', '📦', '🎯', '🛡️', '🚀', '💡', '🔌'];

    // Look for "Features" / "Key Features" / "Highlights" section
    const featureSection = readme.match(/##?\s*(?:Key\s+)?(?:Features|Highlights|What|Capabilities|Tính năng)[^\n]*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
    if (featureSection) {
      const bullets = featureSection[1].match(/[-*✅•]\s+\*?\*?([^\n*]+)/g) || [];
      bullets.slice(0, 6).forEach((b, i) => {
        let text = b.replace(/^[-*✅•]\s+\*?\*?/, '').replace(/\*+/g, '').trim();
        if (text.length > 5 && text.length < 120) {
          features.push({
            name_en: text,
            name_vi: text,
            icon: featureIcons[i % featureIcons.length],
            explanation: ''
          });
        }
      });
    }

    // If no feature section found, extract from first few bullet points
    if (features.length === 0) {
      const bullets = readme.match(/^[-*]\s+\*?\*?([^\n]+)/gm) || [];
      bullets.slice(0, 5).forEach((b, i) => {
        let text = b.replace(/^[-*]\s+\*?\*?/, '').replace(/\*+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
        if (text.length > 8 && text.length < 100 && !text.includes('http') && !text.includes('```')) {
          features.push({
            name_en: text,
            name_vi: text,
            icon: featureIcons[i % featureIcons.length],
            explanation: ''
          });
        }
      });
    }

    return features.slice(0, 6);
  }

  /**
   * Extract use cases from README
   */
  _extractUseCasesFromReadme(readme, desc, topics) {
    if (!readme || readme.length < 100) return [];
    const useCases = [];
    const icons = ['🎯', '💼', '🔬', '📊'];

    // Look for "Usage" / "Use Cases" / "Examples" section
    const usageSection = readme.match(/##?\s*(?:Use\s+Cases?|Usage|Getting\s+Started|Examples|Quick\s+Start|Sử dụng)[^\n]*\n([\s\S]*?)(?=\n##|\n---|\Z)/i);
    if (usageSection) {
      const bullets = usageSection[1].match(/[-*]\s+([^\n]+)/g) || [];
      bullets.slice(0, 4).forEach((b, i) => {
        let text = b.replace(/^[-*]\s+/, '').replace(/\*+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
        if (text.length > 8 && text.length < 120) {
          useCases.push({ title: text, icon: icons[i % icons.length], description: '' });
        }
      });
    }

    return useCases.slice(0, 4);
  }

  /**
   * Extract install/setup command from README
   */
  _extractInstallCommand(readme) {
    if (!readme) return '';
    // Match common install patterns
    const patterns = [
      /```(?:bash|sh|shell)?\s*\n((?:npm|yarn|pnpm|pip|cargo|brew|go)\s+(?:install|add|get)[^\n]+)/i,
      /```(?:bash|sh|shell)?\s*\n(npx\s+[^\n]+)/i,
      /```(?:bash|sh|shell)?\s*\n(git clone[^\n]+)/i,
      /```(?:bash|sh|shell)?\s*\n(curl[^\n]+)/i,
      /```(?:bash|sh|shell)?\s*\n(docker[^\n]+)/i,
    ];
    for (const pat of patterns) {
      const m = readme.match(pat);
      if (m) return m[1].trim();
    }
    return '';
  }

  /**
   * Estimate difficulty from README and repo metadata
   */
  _estimateDifficulty(readme, lang, stars) {
    const readmeLower = (readme || '').toLowerCase();
    const hasDocker = readmeLower.includes('docker');
    const hasK8s = readmeLower.includes('kubernetes') || readmeLower.includes('k8s');
    const hasCli = readmeLower.includes('cli') || readmeLower.includes('command line');
    const hasApi = readmeLower.includes('api key') || readmeLower.includes('api_key');
    const hardLangs = ['Rust', 'C', 'C++', 'Haskell', 'Scala', 'Go'];
    const easyLangs = ['JavaScript', 'Python', 'TypeScript', 'HTML', 'CSS', 'Shell'];

    let score = 2; // base: Trung bình
    if (hardLangs.includes(lang)) score += 1;
    if (easyLangs.includes(lang)) score -= 1;
    if (hasK8s) score += 1;
    if (hasDocker) score += 0.5;
    if (hasApi) score += 0.5;
    if (hasCli) score -= 0.5;
    if (stars > 10000) score -= 0.5; // popular = usually good docs

    const levels = [
      { max: 1, level: 'Dễ', desc: `Dễ sử dụng, phù hợp cho người mới${lang ? ` biết ${lang}` : ''}.` },
      { max: 2.5, level: 'Trung bình', desc: `Cần kiến thức cơ bản${lang ? ` về ${lang}` : ''} để bắt đầu.` },
      { max: 3.5, level: 'Khó', desc: `Cần kinh nghiệm${lang ? ` với ${lang}` : ''} và hiểu kiến trúc hệ thống.` },
      { max: Infinity, level: 'Rất khó', desc: `Dành cho developer có kinh nghiệm, cần nắm vững nhiều công nghệ.` }
    ];

    const result = levels.find(l => score <= l.max);
    return { level: result.level, description: result.desc };
  }

  /**
   * Build ELI5 from actual repo info
   */
  _buildEli5(name, desc, topics, starsText) {
    if (!desc && topics.length === 0) {
      return `${name} là một dự án mã nguồn mở với ${starsText} lượt yêu thích trên GitHub.`;
    }

    const topicStr = topics.slice(0, 3).join(', ');
    const descLower = (desc || '').toLowerCase();

    // Try to create a meaningful analogy based on description keywords
    if (descLower.includes('search') || descLower.includes('tìm kiếm')) {
      return `🔍 Hãy tưởng tượng ${name} giống như một công cụ tìm kiếm siêu nhanh — nó giúp bạn tìm đúng thứ cần tìm trong đống dữ liệu. ${starsText} người đã thấy nó hữu ích! ⭐`;
    }
    if (descLower.includes('automat') || descLower.includes('workflow') || descLower.includes('tự động')) {
      return `🤖 ${name} giống như một robot trợ lý — bạn chỉ cần nói cho nó biết việc cần làm, nó sẽ tự động thực hiện thay bạn. Đã có ${starsText} người dùng! ⭐`;
    }
    if (descLower.includes('api') || descLower.includes('server') || descLower.includes('backend')) {
      return `🏗️ ${name} giống như phần hậu trường của một nhà hát — khán giả không thấy nhưng nó điều khiển mọi thứ đằng sau. Có ${starsText} stars! ⭐`;
    }
    if (descLower.includes('ui') || descLower.includes('component') || descLower.includes('design') || descLower.includes('interface')) {
      return `🎨 ${name} giống như một bộ bút màu cao cấp — giúp bạn tạo giao diện đẹp mà không cần tự vẽ từ đầu. ${starsText} người yêu thích! ⭐`;
    }
    if (descLower.includes('ai') || descLower.includes('machine learning') || descLower.includes('llm') || descLower.includes('model')) {
      return `🧠 ${name} giống như một bộ não nhân tạo — nó có thể học, hiểu và giúp bạn giải quyết vấn đề thông minh hơn. ${starsText} stars! ⭐`;
    }
    if (descLower.includes('test') || descLower.includes('debug')) {
      return `🔬 ${name} giống như một bác sĩ cho code — kiểm tra, phát hiện lỗi và đảm bảo mọi thứ chạy đúng. ${starsText} người tin dùng! ⭐`;
    }
    if (descLower.includes('cli') || descLower.includes('command') || descLower.includes('terminal')) {
      return `⌨️ ${name} là một công cụ dòng lệnh — gõ vài chữ vào terminal, nó sẽ làm phần còn lại. ${starsText} stars! ⭐`;
    }

    // Generic but uses actual desc
    if (desc) {
      return `💡 ${name}: ${desc}. Hiện có ${starsText} lượt yêu thích trên GitHub${topicStr ? ` và liên quan đến ${topicStr}` : ''}. ⭐`;
    }

    return `${name} là một dự án ${topicStr || 'mã nguồn mở'} với ${starsText} stars trên GitHub.`;
  }

  /**
   * Build features from topics and metadata when README extraction fails
   */
  _buildFeaturesFromMetadata(lang, topics, repoInfo) {
    const features = [];
    const starsText = this.formatNumber(repoInfo.stars);

    if (lang) {
      features.push({
        name_en: `Built with ${lang}`,
        name_vi: `Viết bằng ${lang}`,
        icon: '💻',
        explanation: `Dự án được phát triển bằng ${lang}.`
      });
    }

    // Create features from topics
    const topicIcons = {
      'react': '⚛️', 'vue': '💚', 'angular': '🅰️', 'svelte': '🔶',
      'typescript': '🔷', 'python': '🐍', 'rust': '🦀', 'go': '🐹',
      'docker': '🐳', 'kubernetes': '☸️', 'ai': '🧠', 'machine-learning': '🤖',
      'cli': '⌨️', 'api': '🔌', 'database': '🗄️', 'testing': '🧪',
      'security': '🛡️', 'performance': '⚡', 'automation': '🤖',
      'nextjs': '▲', 'nodejs': '💚', 'graphql': '◈', 'rest': '🔗'
    };

    topics.slice(0, 5).forEach(topic => {
      const icon = topicIcons[topic.toLowerCase()] || '🏷️';
      features.push({
        name_en: topic,
        name_vi: topic,
        icon,
        explanation: ''
      });
    });

    // Add community stat
    if (repoInfo.stars > 0) {
      features.push({
        name_en: `${starsText} Stars`,
        name_vi: `${starsText} lượt yêu thích`,
        icon: '⭐',
        explanation: `Được ${starsText} developer đánh dấu yêu thích.`
      });
    }

    if (repoInfo.license && repoInfo.license !== 'N/A') {
      features.push({
        name_en: repoInfo.license,
        name_vi: `Giấy phép: ${repoInfo.license}`,
        icon: '📜',
        explanation: ''
      });
    }

    return features.slice(0, 6);
  }

  /**
   * Build use cases from topics and description
   */
  _buildUseCasesFromTopics(topics, desc, name) {
    const useCases = [];
    const descLower = (desc || '').toLowerCase();
    const topicsLower = topics.map(t => t.toLowerCase());

    // Context-aware use cases
    if (descLower.includes('api') || topicsLower.includes('api')) {
      useCases.push({ title: 'Tích hợp API vào ứng dụng', icon: '🔌', description: `Dùng ${name} như API backend cho dự án.` });
    }
    if (descLower.includes('cli') || topicsLower.includes('cli')) {
      useCases.push({ title: 'Tự động hóa qua dòng lệnh', icon: '⌨️', description: `Chạy ${name} từ terminal để xử lý nhanh.` });
    }
    if (descLower.includes('component') || descLower.includes('ui') || topicsLower.includes('react')) {
      useCases.push({ title: 'Xây dựng giao diện nhanh', icon: '🎨', description: `Sử dụng components từ ${name} trong ứng dụng.` });
    }
    if (descLower.includes('ai') || descLower.includes('llm') || topicsLower.some(t => ['ai', 'machine-learning', 'llm'].includes(t))) {
      useCases.push({ title: 'Ứng dụng AI/ML', icon: '🧠', description: `Tích hợp khả năng AI từ ${name} vào workflow.` });
    }
    if (descLower.includes('test') || topicsLower.includes('testing')) {
      useCases.push({ title: 'Kiểm thử phần mềm', icon: '🧪', description: `Dùng ${name} để test và đảm bảo chất lượng code.` });
    }
    if (descLower.includes('deploy') || descLower.includes('devops') || topicsLower.includes('docker')) {
      useCases.push({ title: 'Triển khai ứng dụng', icon: '🚀', description: `Dùng ${name} trong pipeline CI/CD.` });
    }

    // Always add generic ones if not enough
    if (useCases.length < 2) {
      useCases.push({ title: `Tìm hiểu về ${name}`, icon: '📖', description: `Đọc mã nguồn để học cách ${name} hoạt động.` });
    }
    if (useCases.length < 3) {
      useCases.push({ title: 'Tích hợp vào dự án', icon: '🔧', description: `Sử dụng ${name} như công cụ hoặc thư viện.` });
    }

    return useCases.slice(0, 4);
  }

  /**
   * Find alternatives based on topics
   */
  _findAlternatives(topics, name) {
    const altMap = {
      'react': ['Vue.js', 'Svelte', 'Angular'],
      'vue': ['React', 'Svelte', 'Angular'],
      'express': ['Fastify', 'Koa', 'Hono'],
      'nextjs': ['Nuxt.js', 'Remix', 'SvelteKit'],
      'tailwindcss': ['Bootstrap', 'Chakra UI', 'Ant Design'],
      'prisma': ['Drizzle ORM', 'TypeORM', 'Knex.js'],
      'docker': ['Podman', 'containerd'],
      'tensorflow': ['PyTorch', 'JAX'],
      'pytorch': ['TensorFlow', 'JAX'],
      'langchain': ['LlamaIndex', 'Haystack'],
    };

    for (const topic of topics) {
      const key = topic.toLowerCase();
      if (altMap[key]) return altMap[key].filter(a => a.toLowerCase() !== name.toLowerCase()).slice(0, 3);
    }
    return [];
  }

  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  }
}

// Export instances
const githubAPI = new GitHubAPI();
const aiAnalyzer = new AIAnalyzer();
