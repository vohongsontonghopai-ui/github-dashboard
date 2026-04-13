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
   * Analyze a repo using AI — Enhanced Vietnamese analysis
   * @param {Object} repoInfo - Repository info from GitHub API
   * @param {string} apiKey - OpenRouter API key
   * @returns {Object} Rich AI analysis result
   */
  async analyze(repoInfo, apiKey) {
    if (!apiKey) {
      return this.fallbackAnalysis(repoInfo);
    }

    const readmeSnippet = repoInfo.readme
      ? repoInfo.readme.substring(0, 5000)
      : 'Không có README';

    const prompt = `Phân tích GitHub repository sau và trả về JSON thuần (KHÔNG markdown, KHÔNG backticks).

Tên: ${repoInfo.name}
Mô tả: ${repoInfo.description}
Ngôn ngữ: ${repoInfo.language}
Topics: ${repoInfo.topics.join(', ')}
Stars: ${repoInfo.stars} | Forks: ${repoInfo.forks}
License: ${repoInfo.license}
README (trích):
${readmeSnippet}

Trả về JSON với cấu trúc CHÍNH XÁC sau (tiếng Việt):
{
  "summary": "Tóm tắt 2-3 câu rõ ràng, dễ hiểu về repo này làm gì",
  "eli5": "Giải thích như cho đứa bé 5 tuổi hiểu — dùng phép so sánh đời thường, ví dụ hình ảnh sinh động. Ví dụ: 'Giống như khi bạn có một hộp bút màu, thay vì phải tự tô từng cái, cái này giúp bạn bấm nút là nó tự tô màu đẹp cho bạn.' Viết 3-5 câu, thân thiện, vui nhộn.",
  "problemSolved": "Nó giải quyết vấn đề gì? Viết 1-2 câu cô đọng.",
  "featuresDetailed": [
    {
      "name_en": "Feature name in English",
      "name_vi": "Tên tính năng tiếng Việt ngắn gọn",
      "icon": "emoji phù hợp với tính năng",
      "explanation": "Giải thích tính năng này làm gì, dễ hiểu cho người mới. 1-2 câu."
    }
  ],
  "useCases": [
    {
      "title": "Tên trường hợp sử dụng",
      "icon": "emoji phù hợp",
      "description": "Mô tả cụ thể cách dùng, 1-2 câu"
    }
  ],
  "difficulty": {
    "level": "Dễ|Trung bình|Khó|Rất khó",
    "description": "Giải thích ngắn ai nên dùng và cần biết gì"
  },
  "practicalValue": {
    "score": 1-10,
    "reason": "Tại sao điểm này? Giá trị thực tế mang lại là gì?"
  },
  "alternatives": ["Tên tool/lib tương tự 1", "Tool tương tự 2"],
  "quickStart": "Hướng dẫn siêu nhanh 1-2 câu cách bắt đầu dùng"
}

LƯU Ý:
- featuresDetailed: 4-6 tính năng, mỗi cái CÓ name_en (tiếng Anh gốc) + name_vi (Việt hóa) + explanation
- useCases: 3-4 trường hợp
- alternatives: 2-3 cái
- Viết tự nhiên, thân thiện, KHÔNG dùng thuật ngữ phức tạp nếu không cần
- eli5 phải thực sự dễ hiểu cho trẻ con, dùng emoji`;

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
              content: 'Bạn là chuyên gia phân tích GitHub repos, giỏi giải thích công nghệ cho người không chuyên. Trả lời bằng tiếng Việt. Chỉ trả về JSON thuần, KHÔNG markdown/code blocks. Hãy viết thân thiện, vui nhộn, dùng emoji hợp lý.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.4,
          max_tokens: 3000
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
   * Parse AI response, handling various JSON formats
   */
  parseAIResponse(content, repoInfo) {
    try {
      let cleaned = content.trim();

      // Remove markdown code blocks if present
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Build backward-compatible + new fields
      const result = {
        summary: parsed.summary || repoInfo.description || '',
        eli5: parsed.eli5 || '',
        problemSolved: parsed.problemSolved || '',
        featuresDetailed: Array.isArray(parsed.featuresDetailed) ? parsed.featuresDetailed.slice(0, 8) : [],
        // Backward compat: flat features list
        features: [],
        useCases: Array.isArray(parsed.useCases) ? parsed.useCases.slice(0, 5) : [],
        explanation: parsed.eli5 || parsed.explanation || '',
        difficulty: parsed.difficulty || null,
        practicalValue: parsed.practicalValue || null,
        alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 4) : [],
        quickStart: parsed.quickStart || ''
      };

      // Build flat features from detailed
      if (result.featuresDetailed.length > 0) {
        result.features = result.featuresDetailed.map(f => f.name_vi || f.name_en || f);
      } else if (Array.isArray(parsed.features)) {
        result.features = parsed.features.slice(0, 8);
      }

      return result;
    } catch {
      console.warn('Failed to parse AI response, using fallback');
      return this.fallbackAnalysis(repoInfo);
    }
  }

  /**
   * Fallback analysis when AI is unavailable — Rich Vietnamese version
   */
  fallbackAnalysis(repoInfo) {
    const lang = repoInfo.language || 'nhiều ngôn ngữ';
    const starsText = this.formatNumber(repoInfo.stars);

    return {
      summary: repoInfo.description || `${repoInfo.name} — một dự án ${lang} mã nguồn mở trên GitHub.`,
      eli5: `Hãy tưởng tượng ${repoInfo.name} giống như một bộ đồ chơi LEGO 🧱 mà ai đó đã xây sẵn rồi chia sẻ cho mọi người. Bạn có thể lấy về chơi, học cách nó được xây, hoặc thêm miếng ghép mới vào! Hiện đã có ${starsText} người thích bộ LEGO này rồi đó! ⭐`,
      problemSolved: repoInfo.description || `Cung cấp giải pháp mã nguồn mở cho cộng đồng.`,
      featuresDetailed: [
        {
          name_en: 'Open Source',
          name_vi: 'Mã nguồn mở',
          icon: '🔓',
          explanation: 'Ai cũng có thể xem, tải về và sử dụng miễn phí.'
        },
        {
          name_en: `Built with ${lang}`,
          name_vi: `Viết bằng ${lang}`,
          icon: '💻',
          explanation: `Dự án được phát triển bằng ngôn ngữ ${lang}.`
        },
        {
          name_en: 'Community Driven',
          name_vi: 'Cộng đồng đóng góp',
          icon: '👥',
          explanation: `Đã có ${starsText} người yêu thích và ${this.formatNumber(repoInfo.forks)} người fork để phát triển thêm.`
        },
        ...(repoInfo.license !== 'N/A' ? [{
          name_en: `${repoInfo.license}`,
          name_vi: `Giấy phép ${repoInfo.license}`,
          icon: '📜',
          explanation: 'Bạn được phép sử dụng theo điều khoản của giấy phép này.'
        }] : [])
      ],
      features: [
        'Mã nguồn mở',
        `Viết bằng ${lang}`,
        'Cộng đồng đóng góp',
        ...(repoInfo.license !== 'N/A' ? [`Giấy phép: ${repoInfo.license}`] : [])
      ],
      useCases: [
        { title: 'Học hỏi từ mã nguồn', icon: '📖', description: 'Đọc code để học cách các developer giỏi viết phần mềm.' },
        { title: 'Tích hợp vào dự án', icon: '🔧', description: 'Sử dụng như thư viện hoặc công cụ trong dự án của bạn.' },
        { title: 'Đóng góp cộng đồng', icon: '🤝', description: 'Tham gia sửa lỗi, thêm tính năng, giúp dự án phát triển.' }
      ],
      explanation: `${repoInfo.name} là một dự án mã nguồn mở trên GitHub, được viết bằng ${lang} và đã nhận được ${starsText} stars từ cộng đồng.`,
      difficulty: {
        level: 'Trung bình',
        description: `Cần có kiến thức cơ bản về ${lang} để sử dụng.`
      },
      practicalValue: {
        score: Math.min(10, Math.round(Math.log10(repoInfo.stars + 1) * 2.5)),
        reason: `Dự án có ${starsText} stars, cho thấy mức độ được cộng đồng đón nhận.`
      },
      alternatives: [],
      quickStart: `Truy cập GitHub repo và đọc README để bắt đầu.`
    };
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
