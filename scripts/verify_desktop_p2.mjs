import { spawn, execSync } from 'child_process';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\c7c1dc0f-bbda-42f8-9a2b-c968be2ec0c4';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\User\\AppData\\Local\\Temp\\chrome_cdp_p2_strict';
const BASE_URL = 'http://localhost:3000';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.msgId++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`CDP Eval Exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`[Screenshot Saved] -> ${fullPath}`);
    return fullPath;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function ensureServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/`);
    if (res.ok) {
      return { proc: null, spawnedByUs: false };
    }
  } catch {}

  console.log('[Setup] Khởi động server dist/server.cjs (production mode) trên cổng 3000...');
  const proc = spawn(process.execPath, ['dist/server.cjs'], {
    env: { ...process.env, PORT: '3000', NODE_ENV: 'production' },
    stdio: 'ignore',
  });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.ok) {
        return { proc, spawnedByUs: true };
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error('Server trên cổng 3000 không phản hồi sau 10 giây.');
}

async function startChrome() {
  if (fs.existsSync(USER_DATA_DIR)) {
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch {}
  }
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--window-size=1280,850',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:9222/json/version');
      if (res.ok) {
        const versionInfo = await res.json();
        return { proc, versionInfo };
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error('Chrome remote debugging không phản hồi trên cổng 9222.');
}

async function waitForScrollStable(client, timeoutMs = 2500) {
  const start = Date.now();
  let lastY = await client.eval('window.scrollY');
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 90));
    const currentY = await client.eval('window.scrollY');
    if (Math.abs(currentY - lastY) < 0.5) {
      stableCount++;
      if (stableCount >= 3) return currentY;
    } else {
      stableCount = 0;
      lastY = currentY;
    }
  }
  return lastY;
}

async function main() {
  const commitShort = execSync('git rev-parse --short HEAD').toString().trim();
  const commitFull = execSync('git rev-parse HEAD').toString().trim();

  const report = {
    suite: 'Phase 2 Desktop Browser Verification (Strict CDP Assertions)',
    timestamp: new Date().toISOString(),
    commitSha: commitShort,
    commitFullSha: commitFull,
    chromeVersion: null,
    userAgent: null,
    viewport: null,
    status: 'PENDING',
    totalAssertions: 0,
    passedAssertions: 0,
    screenshots: {},
    checkpoints: {},
    assertions: [],
  };

  function recordAssertion(checkpoint, name, actual, expected, condition, message = '') {
    report.totalAssertions++;
    if (!condition) {
      const failItem = {
        index: report.totalAssertions,
        checkpoint,
        name,
        status: 'FAIL',
        actual,
        expected,
        message,
      };
      report.assertions.push(failItem);
      console.error(`[ASSERT FAIL] [${checkpoint}] ${name}:`, { actual, expected, message });
      assert.ok(false, `[${checkpoint}] ${name} failed. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}. ${message}`);
    }
    report.passedAssertions++;
    report.assertions.push({
      index: report.totalAssertions,
      checkpoint,
      name,
      status: 'PASS',
      actual,
      expected,
    });
    console.log(`  ✓ [${checkpoint}] ${name}`);
  }

  const serverHandle = await ensureServerRunning();
  let chromeProc = null;
  let client = null;

  try {
    const chromeData = await startChrome();
    chromeProc = chromeData.proc;
    report.chromeVersion = chromeData.versionInfo.Browser;
    report.userAgent = chromeData.versionInfo['User-Agent'];

    const listRes = await fetch('http://localhost:9222/json');
    const tabs = await listRes.json();
    const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
    client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 850,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Đăng ký tài khoản kiểm thử
    const authUsername = 'strict_qa_' + Date.now().toString(36);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: authUsername,
        password: 'Password123!',
        fullName: 'Strict Desktop QA',
      }),
    });
    const authData = await regRes.json();
    recordAssertion('SETUP', 'Register test user & obtain auth token', Boolean(authData.token), true, Boolean(authData.token));

    // Chuẩn bị dữ liệu phân tích Item A & Item B
    const mockAnalysisA = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'TypeScript', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'Kubernetes', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'GraphQL', category: 'Kỹ năng chuyên môn', importance: 'Quan trọng', isMustHave: false },
          { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: undefined },
          { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: undefined },
          { keyword: 'Docker', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Quan trọng', isMustHave: false },
          { keyword: 'Microservices', category: 'Kinh nghiệm mong muốn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'CI/CD Pipeline', category: 'Kết quả đầu ra hoặc kỳ vọng công việc', importance: 'Quan trọng', isMustHave: false },
          { keyword: 'Agile Scrum', category: 'Phẩm chất hoặc cách làm việc', importance: 'Quan trọng', isMustHave: false },
          { keyword: 'Terraform', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          {
            jdTerm: 'React',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: '5 năm phát triển ứng dụng React, Next.js quy mô lớn',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
          {
            jdTerm: 'TypeScript',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: '',
            gapOrClarification: 'Chưa thấy kinh nghiệm TypeScript rõ ràng trong CV',
            matchStatus: 'thieu',
          },
          {
            jdTerm: 'Kubernetes',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: 'Đã từng triển khai pod cơ bản trên môi trường staging',
            gapOrClarification: 'Cần làm rõ mức độ vận hành Kubernetes trong môi trường thực tế',
            matchStatus: 'can_bo_sung',
          },
          {
            jdTerm: 'GraphQL',
            importance: 'Quan trọng',
            isMustHave: false,
            cvEvidence: '',
            gapOrClarification: 'Chưa đề cập kinh nghiệm làm việc với GraphQL schema/apollo',
            matchStatus: 'thieu',
          },
          {
            jdTerm: 'AWS',
            importance: 'Rất quan trọng',
            isMustHave: undefined,
            cvEvidence: 'Sử dụng EC2 và S3 trong dự án nội bộ',
            gapOrClarification: 'Trạng thái lỗi cần chuẩn hóa sang unknown',
            matchStatus: 'invalid_status_xyz',
          },
          {
            jdTerm: 'Docker',
            importance: 'Quan trọng',
            isMustHave: false,
            cvEvidence: 'Sử dụng Docker & docker-compose hàng ngày',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
          {
            jdTerm: 'Microservices',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: 'Thiết kế kiến trúc Microservices cho hệ thống thanh toán',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
          {
            jdTerm: 'CI/CD Pipeline',
            importance: 'Quan trọng',
            isMustHave: false,
            cvEvidence: 'Thiết lập GitHub Actions tự động hóa build/test',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
          {
            jdTerm: 'Agile Scrum',
            importance: 'Quan trọng',
            isMustHave: false,
            cvEvidence: 'Làm việc theo mô hình Agile Scrum 2 tuần/sprint',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
        ],
        scores: {
          keywordMatchScore: 82,
          skillMatchScore: 78,
          experienceOutcomeScore: 75,
          overallRoleScore: 80,
          overallRationale: 'Ứng viên có thế mạnh React vững chắc, cần bổ sung kinh nghiệm TypeScript và Kubernetes.',
        },
        summary: {
          biggestStrength: 'React Frontend Architecture',
          missingKeywordsSkills: ['TypeScript', 'GraphQL'],
          weakOrVagueSections: [],
          immediateActions: [
            'Bổ sung kinh nghiệm TypeScript thực tế vào dự án gần nhất',
            'Làm rõ mức độ vận hành Kubernetes trong môi trường thực tế',
            'Bổ sung thêm hiểu biết về GraphQL cho hệ thống API',
          ],
        },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'MAYBE',
        decisionReason: 'Cần kiểm tra thêm kỹ năng TypeScript và vận hành hệ thống.',
        top3MustFix: [
          'Bổ sung kinh nghiệm TypeScript thực tế vào dự án gần nhất',
          'Làm rõ mức độ vận hành Kubernetes trong môi trường thực tế',
          'Bổ sung thêm hiểu biết về GraphQL cho hệ thống API',
        ],
      },
    };

    // Mock Analysis B: Có Must-Have Gap duy nhất nằm ở nhóm 'experience' ('Kinh nghiệm mong muốn')
    // Do đó initialOpenGroupId của B bắt buộc là 'experience' (khác với 'tech' của A)
    const mockAnalysisB = {
      feature1: {
        jdKeywords: [
          { keyword: 'Python', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'Distributed Systems', category: 'Kinh nghiệm mong muốn', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          {
            jdTerm: 'Python',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: '4 năm phát triển Backend Python với FastAPI và Django',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
          {
            jdTerm: 'Distributed Systems',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: '',
            gapOrClarification: 'Chưa nêu rõ kinh nghiệm thiết kế hệ thống phân tán chịu tải cao',
            matchStatus: 'thieu',
          },
        ],
        scores: {
          keywordMatchScore: 90,
          skillMatchScore: 88,
          experienceOutcomeScore: 85,
          overallRoleScore: 89,
          overallRationale: 'Hồ sơ phù hợp tốt với vị trí Backend Python Engineer.',
        },
        summary: {
          biggestStrength: 'Python & FastAPI',
          missingKeywordsSkills: ['Distributed Systems'],
          weakOrVagueSections: [],
          immediateActions: ['Làm rõ kinh nghiệm Distributed Systems'],
        },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'YES',
        decisionReason: 'Nền tảng Python vững vàng.',
        top3MustFix: ['Làm rõ kinh nghiệm Distributed Systems'],
      },
    };

    const historyPayload = [
      {
        id: 'hist-item-a',
        isCustomTitle: true,
        title: 'Senior Frontend Engineer - TechCorp',
        jobTitle: 'Senior Frontend Engineer',
        companyName: 'TechCorp',
        timestamp: Date.now() - 20000,
        score: 80,
        cvText: '5 years React development experience with microservices and docker.',
        jdText: 'Senior Frontend Engineer requiring React, TypeScript, Kubernetes, AWS, Terraform.',
        analysis: mockAnalysisA,
      },
      {
        id: 'hist-item-b',
        isCustomTitle: true,
        title: 'Backend Python Engineer - DataAI',
        jobTitle: 'Backend Python Engineer',
        companyName: 'DataAI',
        timestamp: Date.now() - 5000,
        score: 89,
        cvText: '4 years Python backend development experience with FastAPI and Django.',
        jdText: 'Backend Python Engineer requiring Python and Distributed Systems.',
        analysis: mockAnalysisB,
      },
    ];

    await client.send('Page.navigate', { url: BASE_URL });
    await new Promise((r) => setTimeout(r, 1200));

    const historyJsonStr = JSON.stringify(historyPayload);
    await client.eval(`
      (() => {
        localStorage.setItem('auth_token', '${authData.token}');
        localStorage.setItem('role_match_last_activity', Date.now().toString());
        localStorage.setItem('cv_matcher_history', ${JSON.stringify(historyJsonStr)});
      })()
    `);

    await client.send('Page.reload');
    await new Promise((r) => setTimeout(r, 1800));

    // Đo viewport thực tế trên trình duyệt
    const viewportMetrics = await client.eval(`
      ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      })
    `);
    report.viewport = viewportMetrics;
    recordAssertion('SETUP', 'Desktop viewport width === 1280 and height === 850', viewportMetrics, { innerWidth: 1280, innerHeight: 850, devicePixelRatio: 1 }, viewportMetrics.innerWidth === 1280 && viewportMetrics.innerHeight === 850);

    // Mở HistorySidebar và chọn Item A
    const openHistoryDrawerA = await client.eval(`
      (() => {
        const histBtn = document.querySelector('button[title*="Lịch sử"], button[title*="History"]') ||
          Array.from(document.querySelectorAll('header button')).find(b => b.textContent?.includes('2'));
        if (!histBtn) return false;
        histBtn.click();
        return true;
      })()
    `);
    recordAssertion('SETUP', 'Click History drawer button for Item A', openHistoryDrawerA, true, openHistoryDrawerA === true);
    await new Promise((r) => setTimeout(r, 800));

    const selectItemA = await client.eval(`
      (() => {
        const headings = Array.from(document.querySelectorAll('aside h4, .fixed h4, [role="dialog"] h4'));
        const target = headings.find(el => el.textContent && el.textContent.includes('Senior Frontend Engineer'));
        if (!target) return false;
        const card = target.closest('[class*="cursor-pointer"]') || target;
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      })()
    `);
    recordAssertion('SETUP', 'Select Senior Frontend Engineer (Item A) from History drawer', selectItemA, true, selectItemA === true);
    await new Promise((r) => setTimeout(r, 1200));

    // Cài đặt helper lấy state trên trang để các checkpoint tái sử dụng
    await client.eval(`
      window.__p2Helpers = {
        getActiveTab() {
          const tabBtns = Array.from(document.querySelectorAll('button'));
          const f3 = tabBtns.find(b => b.textContent && (b.textContent.includes('Góc Nhìn HR') || b.textContent.includes('Recruiter')));
          const f1 = tabBtns.find(b => b.textContent && (b.textContent.includes('Bản Đồ Bằng Chứng') || b.textContent.includes('Bằng Chứng') || b.textContent.includes('Evidence')));
          const f2 = tabBtns.find(b => b.textContent && (b.textContent.includes('Cập nhật CV') || b.textContent.includes('Update CV') || b.textContent.includes('Bullet')));
          if (f1?.className.includes('bg-indigo-600')) return 'feature1';
          if (f2?.className.includes('bg-indigo-600')) return 'feature2';
          if (f3?.className.includes('bg-indigo-600')) return 'feature3';
          return 'unknown';
        },
        getActiveFilter() {
          const group = document.querySelector('[data-testid="evidence-map-tab"] [role="group"]');
          if (!group) return null;
          const btns = Array.from(group.querySelectorAll('button'));
          if (btns[0]?.className.includes('bg-slate-900')) return 'all';
          if (btns[1]?.className.includes('bg-indigo-600')) return 'must_have';
          if (btns[2]?.className.includes('bg-rose-600')) return 'gap';
          return 'unknown';
        },
        getExpandedGroupIds() {
          return Array.from(document.querySelectorAll('[data-testid="evidence-map-tab"] button[aria-controls^="group-content-"]'))
            .filter(btn => btn.getAttribute('aria-expanded') === 'true')
            .map(btn => btn.getAttribute('aria-controls').replace('group-content-', ''));
        },
        toggleGroup(groupId) {
          const btn = document.querySelector('[data-testid="evidence-map-tab"] button[aria-controls="group-content-' + groupId + '"]');
          if (!btn) return false;
          btn.click();
          return true;
        },
        setFilter(filterType) {
          const group = document.querySelector('[data-testid="evidence-map-tab"] [role="group"]');
          if (!group) return false;
          const btns = Array.from(group.querySelectorAll('button'));
          const map = { all: 0, must_have: 1, gap: 2 };
          const targetBtn = btns[map[filterType]];
          if (!targetBtn) return false;
          targetBtn.click();
          return true;
        },
        clickTab(tabKey) {
          const tabBtns = Array.from(document.querySelectorAll('button'));
          let btn = null;
          if (tabKey === 'feature3') {
            btn = tabBtns.find(b => b.textContent && (b.textContent.includes('1. Góc Nhìn HR') || b.textContent.includes('1. Recruiter') || b.textContent.includes('Góc Nhìn Nhà Tuyển Dụng') || b.textContent.includes('Recruiter Scan')));
          } else if (tabKey === 'feature1') {
            btn = tabBtns.find(b => b.textContent && (b.textContent.includes('2. Bản Đồ Bằng Chứng') || b.textContent.includes('2. Bằng Chứng') || b.textContent.includes('2. Evidence')));
          } else if (tabKey === 'feature2') {
            btn = tabBtns.find(b => b.textContent && (b.textContent.includes('3. Cập nhật CV') || b.textContent.includes('3. Update CV') || b.textContent.includes('Tối Ưu Bullet') || b.textContent.includes('Bullet')));
          }
          if (!btn) return false;
          btn.click();
          return true;
        },
        clickQuickWinBySubstring(substr) {
          const paragraphs = Array.from(document.querySelectorAll('section p.text-slate-800'));
          const targetP = paragraphs.find(p => p.textContent && p.textContent.includes(substr));
          if (!targetP) return { clicked: false, reason: 'Not found: ' + substr };
          const card = targetP.parentElement?.parentElement;
          const btn = card ? card.querySelector('button') : null;
          if (!btn) return { clicked: false, reason: 'No button in card for: ' + substr };
          btn.click();
          return { clicked: true, title: targetP.textContent.trim(), actionLabel: btn.textContent.trim() };
        },
        getHighlightedDesktopItemIds() {
          return Array.from(document.querySelectorAll('tr[data-device-target="desktop"].ring-amber-400'))
            .map(tr => tr.getAttribute('data-criterion-id'));
        }
      };
    `);

    // =========================================================================
    // CHECKPOINT 1: EXECUTIVE HERO CARD & DATA CONTRACT ASSERTIONS
    // =========================================================================
    console.log('\n--- CHECKPOINT 1: EXECUTIVE HERO CARD ---');
    const cp1 = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const verdictH2 = document.querySelector('section h2.font-bold')?.textContent?.trim() || '';
        const qwButtons = Array.from(document.querySelectorAll('section button')).filter(b =>
          b.textContent && (b.textContent.includes('Xem vị trí đối chiếu') || b.textContent.includes('Jump to criterion'))
        );
        return {
          hasHeroSection: bodyText.includes('ĐIỂM ĐÁNH GIÁ CV GỐC') && bodyText.includes('YÊU CẦU BẮT BUỘC (MUST-HAVE)'),
          verdictStatement: verdictH2,
          hasPassedLabel: bodyText.includes('● 2 Đủ bằng chứng'),
          hasPartialLabel: bodyText.includes('● 1 Một phần'),
          hasGapLabel: bodyText.includes('● 1 Cần bổ sung'),
          hasUnknownLabel: bodyText.includes('? 1 Chưa xác định'),
          hasUncomparedLabel: bodyText.includes('○ 1 Chưa đối chiếu'),
          neverOverclaimsFullMet: !verdictH2.includes('đáp ứng đầy đủ tất cả các yêu cầu cốt lõi'),
          linkedQuickWinsCount: qwButtons.length,
        };
      })()
    `);
    report.checkpoints.cp1 = cp1;

    const expectedVerdict = 'CV đã thể hiện rõ 2/6 yêu cầu được xác định là bắt buộc; 1 yêu cầu có bằng chứng một phần, 1 yêu cầu chưa thấy bằng chứng, 1 yêu cầu chưa xác định được trạng thái, 1 yêu cầu bắt buộc chưa được đối chiếu.';
    recordAssertion('CP1', 'Hero card section and metric headers rendered', cp1.hasHeroSection, true, cp1.hasHeroSection === true);
    recordAssertion('CP1', 'Verdict statement reflects exact 2/6 Must-Have breakdown including partial, gap, unknown, uncompared', cp1.verdictStatement, expectedVerdict, cp1.verdictStatement === expectedVerdict);
    recordAssertion('CP1', 'Hero displays Passed, Partial, Gap, Unknown, and Uncompared counters', {
      passed: cp1.hasPassedLabel,
      partial: cp1.hasPartialLabel,
      gap: cp1.hasGapLabel,
      unknown: cp1.hasUnknownLabel,
      uncompared: cp1.hasUncomparedLabel,
    }, { passed: true, partial: true, gap: true, unknown: true, uncompared: true }, cp1.hasPassedLabel && cp1.hasPartialLabel && cp1.hasGapLabel && cp1.hasUnknownLabel && cp1.hasUncomparedLabel);
    recordAssertion('CP1', 'Hero never overclaims full Must-Have completion when gaps/unknown/uncompared exist', cp1.neverOverclaimsFullMet, true, cp1.neverOverclaimsFullMet === true);
    recordAssertion('CP1', 'All 3 linked Quick Wins render navigation buttons', cp1.linkedQuickWinsCount, 3, cp1.linkedQuickWinsCount === 3);

    report.screenshots.cp1 = await client.captureScreenshot('desktop_1_hero_overview.png');

    // =========================================================================
    // CHECKPOINT 2: TAB SWITCHING & LANGUAGE TOGGLE STATE PRESERVATION
    // =========================================================================
    console.log('\n--- CHECKPOINT 2: TAB & LANGUAGE STATE PRESERVATION ---');
    // Chuyển sang tab Evidence Map (feature1)
    const switchedToEm = await client.eval('window.__p2Helpers.clickTab("feature1")');
    recordAssertion('CP2', 'Switch to Evidence Map tab (feature1)', switchedToEm, true, switchedToEm === true);
    await new Promise((r) => setTimeout(r, 400));

    // Kiểm tra trạng thái khởi tạo mặc định ban đầu của Item A: filter='all', expanded=['tech']
    const initialEmState = await client.eval(`
      ({
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
      })
    `);
    recordAssertion('CP2', 'Initial Evidence Map state is filter="all" and expandedGroups=["tech"]', initialEmState, { filter: 'all', expandedGroups: ['tech'] }, initialEmState.filter === 'all' && JSON.stringify(initialEmState.expandedGroups) === JSON.stringify(['tech']));

    // Chủ động thay đổi nhóm mở và bộ lọc:
    // Đóng 'tech', mở 'tools' và 'experience', đổi filter sang 'must_have'
    await client.eval(`
      window.__p2Helpers.toggleGroup('tech');
      window.__p2Helpers.toggleGroup('tools');
      window.__p2Helpers.toggleGroup('experience');
      window.__p2Helpers.setFilter('must_have');
    `);
    await new Promise((r) => setTimeout(r, 300));

    const stateBeforeTabSwitch = await client.eval(`
      ({
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
      })
    `);
    recordAssertion('CP2', 'Custom state applied before tab switch (filter="must_have", expanded=["tools","experience"])', stateBeforeTabSwitch, { filter: 'must_have', expandedGroups: ['tools', 'experience'] }, stateBeforeTabSwitch.filter === 'must_have' && JSON.stringify(stateBeforeTabSwitch.expandedGroups) === JSON.stringify(['tools', 'experience']));

    // Chuyển sang tab 1 (Recruiter View - feature3) và tab 3 (Update CV - feature2)
    await client.eval('window.__p2Helpers.clickTab("feature3")');
    await new Promise((r) => setTimeout(r, 350));
    const emUnmountedOnF3 = await client.eval('document.querySelector("[data-testid=\\"evidence-map-tab\\"]") === null');
    recordAssertion('CP2', 'EvidenceMapTab unmounts when switching to Recruiter View tab', emUnmountedOnF3, true, emUnmountedOnF3 === true);

    await client.eval('window.__p2Helpers.clickTab("feature2")');
    await new Promise((r) => setTimeout(r, 350));

    // Quay lại tab 2 (Evidence Map - feature1) và so sánh state trước/sau
    await client.eval('window.__p2Helpers.clickTab("feature1")');
    await new Promise((r) => setTimeout(r, 400));

    const stateAfterTabSwitch = await client.eval(`
      ({
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
      })
    `);
    recordAssertion('CP2', 'Filter state preserved after switching across tabs and returning', stateAfterTabSwitch.filter, stateBeforeTabSwitch.filter, stateAfterTabSwitch.filter === stateBeforeTabSwitch.filter);
    recordAssertion('CP2', 'Expanded competency groups preserved after switching across tabs and returning', stateAfterTabSwitch.expandedGroups, stateBeforeTabSwitch.expandedGroups, JSON.stringify(stateAfterTabSwitch.expandedGroups) === JSON.stringify(stateBeforeTabSwitch.expandedGroups));

    // Đổi ngôn ngữ VI -> EN và kiểm tra bảo toàn state
    const clickedLangToEn = await client.eval(`
      (() => {
        const langBtn = document.querySelector('header button[title*="Switch to English"], header button[title*="Chuyển sang Tiếng Việt"]');
        if (!langBtn) return false;
        langBtn.click();
        return true;
      })()
    `);
    recordAssertion('CP2', 'Click language switcher (VI -> EN)', clickedLangToEn, true, clickedLangToEn === true);
    await new Promise((r) => setTimeout(r, 400));

    const stateAfterLangEn = await client.eval(`
      ({
        headingText: document.querySelector('[data-testid="evidence-map-tab"] h3')?.textContent?.trim(),
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
      })
    `);
    recordAssertion('CP2', 'UI switched to English ("Competency Evidence Map")', stateAfterLangEn.headingText, 'Competency Evidence Map', stateAfterLangEn.headingText === 'Competency Evidence Map');
    recordAssertion('CP2', 'Filter and expanded groups preserved after switching VI -> EN', { filter: stateAfterLangEn.filter, expandedGroups: stateAfterLangEn.expandedGroups }, stateBeforeTabSwitch, stateAfterLangEn.filter === stateBeforeTabSwitch.filter && JSON.stringify(stateAfterLangEn.expandedGroups) === JSON.stringify(stateBeforeTabSwitch.expandedGroups));

    // Đổi ngôn ngữ ngược lại EN -> VI
    await client.eval(`
      (() => {
        const langBtn = document.querySelector('header button[title*="Switch to English"], header button[title*="Chuyển sang Tiếng Việt"]');
        if (langBtn) langBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    const stateAfterLangVi = await client.eval(`
      ({
        headingText: document.querySelector('[data-testid="evidence-map-tab"] h3')?.textContent?.trim(),
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
      })
    `);
    recordAssertion('CP2', 'Filter and expanded groups preserved after switching EN -> VI', { filter: stateAfterLangVi.filter, expandedGroups: stateAfterLangVi.expandedGroups }, stateBeforeTabSwitch, stateAfterLangVi.filter === stateBeforeTabSwitch.filter && JSON.stringify(stateAfterLangVi.expandedGroups) === JSON.stringify(stateBeforeTabSwitch.expandedGroups));

    report.checkpoints.cp2 = {
      initialEmState,
      stateBeforeTabSwitch,
      stateAfterTabSwitch,
      stateAfterLangEn,
      stateAfterLangVi,
    };
    report.screenshots.cp2 = await client.captureScreenshot('desktop_2_tab_preservation.png');

    // =========================================================================
    // CHECKPOINT 3: TWO DISTINCT QUICK WIN FILTER CASES (KEEP vs UNHIDE)
    // =========================================================================
    console.log('\n--- CHECKPOINT 3: QUICK WIN CONDITIONAL FILTER HANDLING (2 CASES) ---');

    // --- CASE 3A: Filter='must_have' + Target='TypeScript' (isMustHave=true) -> PHẢI GIỮ NGUYÊN 'must_have' ---
    // Đảm bảo nhóm 'tech' đang đóng và filter đang là 'must_have', chuyển sang tab 'feature3' để test điều hướng liên tab
    await client.eval(`
      (() => {
        const expanded = window.__p2Helpers.getExpandedGroupIds();
        if (expanded.includes('tech')) window.__p2Helpers.toggleGroup('tech');
        window.__p2Helpers.setFilter('must_have');
        window.__p2Helpers.clickTab('feature3');
      })()
    `);
    await new Promise((r) => setTimeout(r, 350));

    const qwCase3AClick = await client.eval('window.__p2Helpers.clickQuickWinBySubstring("TypeScript")');
    recordAssertion('CP3-CaseA', 'Click Quick Win targeting Must-Have item "TypeScript"', qwCase3AClick.clicked, true, qwCase3AClick.clicked === true);
    await waitForScrollStable(client);

    const cp3CaseAResult = await client.eval(`
      (() => {
        const targetEl = document.getElementById('criterion-desktop-item-typescript-1');
        return {
          activeTab: window.__p2Helpers.getActiveTab(),
          activeFilter: window.__p2Helpers.getActiveFilter(),
          expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
          highlightedIds: window.__p2Helpers.getHighlightedDesktopItemIds(),
          targetExistsAndVisible: Boolean(targetEl && targetEl.offsetParent !== null),
          activeElementId: document.activeElement?.id || null,
        };
      })()
    `);

    recordAssertion('CP3-CaseA', 'Navigated to Evidence Map tab (feature1)', cp3CaseAResult.activeTab, 'feature1', cp3CaseAResult.activeTab === 'feature1');
    recordAssertion('CP3-CaseA', 'Filter "must_have" is KEPT (not reset to "all") because TypeScript is Must-Have', cp3CaseAResult.activeFilter, 'must_have', cp3CaseAResult.activeFilter === 'must_have');
    recordAssertion('CP3-CaseA', 'Target competency group "tech" automatically expanded', cp3CaseAResult.expandedGroups.includes('tech'), true, cp3CaseAResult.expandedGroups.includes('tech'));
    recordAssertion('CP3-CaseA', 'Target criterion ID "item-typescript-1" is highlighted and focused', {
      highlightedIds: cp3CaseAResult.highlightedIds,
      activeElementId: cp3CaseAResult.activeElementId,
    }, {
      highlightedIds: ['item-typescript-1'],
      activeElementId: 'criterion-desktop-item-typescript-1',
    }, cp3CaseAResult.highlightedIds.includes('item-typescript-1') && cp3CaseAResult.activeElementId === 'criterion-desktop-item-typescript-1');

    // --- CASE 3B-1: Filter='gap' + Target='Kubernetes' (matchStatus='can_bo_sung' partial) -> PHẢI GỠ FILTER VỀ 'all' ---
    // Đóng nhóm 'tools' và bật bộ lọc 'gap' (chỉ hiện 'thieu', ẩn 'can_bo_sung' của Kubernetes)
    await client.eval(`
      (() => {
        const expanded = window.__p2Helpers.getExpandedGroupIds();
        if (expanded.includes('tools')) window.__p2Helpers.toggleGroup('tools');
        window.__p2Helpers.setFilter('gap');
      })()
    `);
    await new Promise((r) => setTimeout(r, 300));

    const stateBeforeCase3B1 = await client.eval(`
      ({
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
        k8sDomBefore: document.getElementById('criterion-desktop-item-kubernetes-2'),
      })
    `);
    recordAssertion('CP3-CaseB1', 'Before click: filter is "gap", group "tools" is collapsed, and Kubernetes row is hidden', {
      filter: stateBeforeCase3B1.filter,
      toolsExpanded: stateBeforeCase3B1.expandedGroups.includes('tools'),
      k8sVisible: Boolean(stateBeforeCase3B1.k8sDomBefore),
    }, { filter: 'gap', toolsExpanded: false, k8sVisible: false }, stateBeforeCase3B1.filter === 'gap' && !stateBeforeCase3B1.expandedGroups.includes('tools') && !stateBeforeCase3B1.k8sDomBefore);

    const qwCase3B1Click = await client.eval('window.__p2Helpers.clickQuickWinBySubstring("Kubernetes")');
    recordAssertion('CP3-CaseB1', 'Click Quick Win targeting partial item "Kubernetes" hidden by "gap" filter', qwCase3B1Click.clicked, true, qwCase3B1Click.clicked === true);
    await waitForScrollStable(client);

    const cp3CaseB1Result = await client.eval(`
      (() => {
        const targetEl = document.getElementById('criterion-desktop-item-kubernetes-2');
        return {
          activeFilter: window.__p2Helpers.getActiveFilter(),
          expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
          highlightedIds: window.__p2Helpers.getHighlightedDesktopItemIds(),
          targetExistsAndVisible: Boolean(targetEl && targetEl.offsetParent !== null),
          activeElementId: document.activeElement?.id || null,
        };
      })()
    `);
    recordAssertion('CP3-CaseB1', 'Filter automatically unhidden from "gap" to "all" for partial target Kubernetes', cp3CaseB1Result.activeFilter, 'all', cp3CaseB1Result.activeFilter === 'all');
    recordAssertion('CP3-CaseB1', 'Target group "tools" expanded', cp3CaseB1Result.expandedGroups.includes('tools'), true, cp3CaseB1Result.expandedGroups.includes('tools'));
    recordAssertion('CP3-CaseB1', 'Target ID "criterion-desktop-item-kubernetes-2" is visible, highlighted, and focused', {
      visible: cp3CaseB1Result.targetExistsAndVisible,
      highlighted: cp3CaseB1Result.highlightedIds,
      activeElementId: cp3CaseB1Result.activeElementId,
    }, {
      visible: true,
      highlighted: ['item-kubernetes-2'],
      activeElementId: 'criterion-desktop-item-kubernetes-2',
    }, cp3CaseB1Result.targetExistsAndVisible && cp3CaseB1Result.highlightedIds.includes('item-kubernetes-2') && cp3CaseB1Result.activeElementId === 'criterion-desktop-item-kubernetes-2');

    // --- CASE 3B-2: Filter='must_have' + Target='GraphQL' (isMustHave=false Nice-to-Have) -> PHẢI GỠ FILTER VỀ 'all' ---
    await client.eval(`
      (() => {
        const expanded = window.__p2Helpers.getExpandedGroupIds();
        if (expanded.includes('tech')) window.__p2Helpers.toggleGroup('tech');
        window.__p2Helpers.setFilter('must_have');
      })()
    `);
    await new Promise((r) => setTimeout(r, 300));

    const qwCase3B2Click = await client.eval('window.__p2Helpers.clickQuickWinBySubstring("GraphQL")');
    recordAssertion('CP3-CaseB2', 'Click Quick Win targeting Nice-to-Have item "GraphQL" hidden by "must_have" filter', qwCase3B2Click.clicked, true, qwCase3B2Click.clicked === true);
    await waitForScrollStable(client);

    const cp3CaseB2Result = await client.eval(`
      (() => {
        const targetEl = document.getElementById('criterion-desktop-item-graphql-3');
        return {
          activeFilter: window.__p2Helpers.getActiveFilter(),
          expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
          highlightedIds: window.__p2Helpers.getHighlightedDesktopItemIds(),
          targetExistsAndVisible: Boolean(targetEl && targetEl.offsetParent !== null),
          activeElementId: document.activeElement?.id || null,
        };
      })()
    `);
    recordAssertion('CP3-CaseB2', 'Filter automatically unhidden from "must_have" to "all" for Nice-to-Have target GraphQL', cp3CaseB2Result.activeFilter, 'all', cp3CaseB2Result.activeFilter === 'all');
    recordAssertion('CP3-CaseB2', 'Target group "tech" expanded and "criterion-desktop-item-graphql-3" focused', {
      techExpanded: cp3CaseB2Result.expandedGroups.includes('tech'),
      activeElementId: cp3CaseB2Result.activeElementId,
    }, {
      techExpanded: true,
      activeElementId: 'criterion-desktop-item-graphql-3',
    }, cp3CaseB2Result.expandedGroups.includes('tech') && cp3CaseB2Result.activeElementId === 'criterion-desktop-item-graphql-3');

    report.checkpoints.cp3 = {
      caseA_keepMustHaveFilter: cp3CaseAResult,
      caseB1_unhideGapFilterForPartial: cp3CaseB1Result,
      caseB2_unhideMustHaveFilterForNiceToHave: cp3CaseB2Result,
    };

    // =========================================================================
    // CHECKPOINT 4: EXACT FOCUS & NON-OCCLUSION BY HEADER AND STICKY TABS BAR
    // =========================================================================
    console.log('\n--- CHECKPOINT 4: SCROLL STABILIZATION, EXACT FOCUS & STICKY OCCLUSION ---');
    // Mở tất cả các nhóm bên dưới để trang đủ dài, sau đó cuộn lên đầu trang và kích hoạt Quick Win "TypeScript"
    await client.eval(`
      (() => {
        const expanded = window.__p2Helpers.getExpandedGroupIds();
        for (const gId of ['tech', 'tools', 'experience', 'outcomes', 'culture']) {
          if (!expanded.includes(gId)) window.__p2Helpers.toggleGroup(gId);
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
      })()
    `);
    await new Promise((r) => setTimeout(r, 300));

    await client.eval('window.__p2Helpers.clickQuickWinBySubstring("TypeScript")');
    const finalScrollY = await waitForScrollStable(client);

    const cp4Geometry = await client.eval(`
      (() => {
        const targetEl = document.getElementById('criterion-desktop-item-typescript-1');
        const headerEl = document.querySelector('header');
        const contextBarEl = document.querySelector('[data-testid="compact-context-bar"]');

        // Tìm chính xác thanh sticky chứa các nút Tab (1. Góc Nhìn HR / 2. Bản Đồ Bằng Chứng)
        const emTabBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent && (b.textContent.includes('2. Bản Đồ Bằng Chứng') || b.textContent.includes('2. Bằng Chứng'))
        );
        const stickyTabsEl = emTabBtn ? emTabBtn.closest('.sticky') : null;

        const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
        const contextBarRect = contextBarEl ? contextBarEl.getBoundingClientRect() : null;
        const stickyTabsRect = stickyTabsEl ? stickyTabsEl.getBoundingClientRect() : null;
        const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;

        const maxStickyBottom = Math.max(
          headerRect ? headerRect.bottom : 0,
          contextBarRect ? contextBarRect.bottom : 0,
          stickyTabsRect ? stickyTabsRect.bottom : 0
        );

        return {
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          headerFound: Boolean(headerEl),
          stickyTabsFound: Boolean(stickyTabsEl),
          headerAndTabsAreDistinct: Boolean(headerEl && stickyTabsEl && headerEl !== stickyTabsEl),
          headerRect: headerRect ? { top: headerRect.top, bottom: headerRect.bottom, height: headerRect.height } : null,
          contextBarRect: contextBarRect ? { top: contextBarRect.top, bottom: contextBarRect.bottom, height: contextBarRect.height } : null,
          stickyTabsRect: stickyTabsRect ? { top: stickyTabsRect.top, bottom: stickyTabsRect.bottom, height: stickyTabsRect.height } : null,
          maxStickyBottom,
          targetId: targetEl?.id || null,
          activeElementId: document.activeElement?.id || null,
          isExactFocusMatch: Boolean(targetEl && document.activeElement === targetEl),
          targetRect: targetRect ? { top: targetRect.top, bottom: targetRect.bottom, height: targetRect.height } : null,
          clearancePx: targetRect ? +(targetRect.top - maxStickyBottom).toFixed(2) : null,
          isBelowAllStickyBars: Boolean(targetRect && targetRect.top >= maxStickyBottom),
          isWithinViewport: Boolean(targetRect && targetRect.top >= maxStickyBottom && targetRect.bottom <= window.innerHeight),
        };
      })()
    `);
    report.checkpoints.cp4 = cp4Geometry;

    recordAssertion('CP4', 'Distinct Header and Sticky Tabs Bar elements identified', cp4Geometry.headerAndTabsAreDistinct, true, cp4Geometry.headerAndTabsAreDistinct === true);
    recordAssertion('CP4', 'document.activeElement is strictly the target criterion row (#criterion-desktop-item-typescript-1)', cp4Geometry.activeElementId, 'criterion-desktop-item-typescript-1', cp4Geometry.isExactFocusMatch === true);
    recordAssertion('CP4', 'Target row top edge is strictly below Header and Sticky Tabs Bar bottom edge (no occlusion)', {
      targetTop: cp4Geometry.targetRect?.top,
      maxStickyBottom: cp4Geometry.maxStickyBottom,
      clearancePx: cp4Geometry.clearancePx,
    }, 'targetTop >= maxStickyBottom', cp4Geometry.isBelowAllStickyBars === true);
    recordAssertion('CP4', 'Target row is fully visible within the desktop viewport', {
      targetTop: cp4Geometry.targetRect?.top,
      targetBottom: cp4Geometry.targetRect?.bottom,
      viewportHeight: cp4Geometry.viewportHeight,
    }, 'targetBottom <= viewportHeight', cp4Geometry.isWithinViewport === true);

    report.screenshots.cp3_cp4 = await client.captureScreenshot('desktop_3_quick_win_scroll_focus.png');

    // =========================================================================
    // CHECKPOINT 5: STATE RESET ON RESULT SWITCH BEFORE 2.5S HIGHLIGHT TIMER EXPIRES
    // =========================================================================
    console.log('\n--- CHECKPOINT 5: IMMEDIATE STATE & HIGHLIGHT RESET ON RESULT SWITCH (< 2.5s) ---');
    // Thiết lập trạng thái khác mặc định trên Item A:
    // - Mở nhiều nhóm ('tech', 'tools', 'experience')
    // - Kích hoạt Quick Win "TypeScript" (bắt đầu bộ đếm 2500ms cho highlight)
    // - Đổi filter sang 'must_have'
    await client.eval(`
      (() => {
        window.__p2Helpers.clickQuickWinBySubstring('TypeScript');
        window.__p2Helpers.setFilter('must_have');
        const expanded = window.__p2Helpers.getExpandedGroupIds();
        if (!expanded.includes('tools')) window.__p2Helpers.toggleGroup('tools');
        if (!expanded.includes('experience')) window.__p2Helpers.toggleGroup('experience');
      })()
    `);
    const tHighlightStarted = Date.now();
    await new Promise((r) => setTimeout(r, 120));

    const preSwitchState = await client.eval(`
      ({
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
        highlightedIds: window.__p2Helpers.getHighlightedDesktopItemIds(),
      })
    `);
    recordAssertion('CP5', 'Pre-switch state has active highlight on item-typescript-1, filter="must_have", and 3 expanded groups', preSwitchState, {
      filter: 'must_have',
      expandedGroups: ['tech', 'tools', 'experience'],
      highlightedIds: ['item-typescript-1'],
    }, preSwitchState.filter === 'must_have' && preSwitchState.highlightedIds.includes('item-typescript-1') && preSwitchState.expandedGroups.length >= 3);

    // Chuyển ngay sang kết quả B (Backend Python Engineer) TRƯỚC KHI hết 2.5 giây!
    await client.eval(`
      (() => {
        const histBtn = document.querySelector('button[title*="Lịch sử"], button[title*="History"]') ||
          Array.from(document.querySelectorAll('header button')).find(b => b.textContent?.includes('2'));
        if (histBtn) histBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 250));

    const switchedToB = await client.eval(`
      (() => {
        const headings = Array.from(document.querySelectorAll('aside h4, .fixed h4, [role="dialog"] h4'));
        const itemEl = headings.find(el => el.textContent && el.textContent.includes('Backend Python Engineer'));
        if (!itemEl) return false;
        const card = itemEl.closest('[class*="cursor-pointer"]') || itemEl;
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      })()
    `);
    recordAssertion('CP5', 'Select second analysis result (Backend Python Engineer)', switchedToB, true, switchedToB === true);
    await new Promise((r) => setTimeout(r, 200));

    // Chuyển qua tab Evidence Map của kết quả B ngay lập tức và đo thời gian đã trôi qua
    await client.eval('window.__p2Helpers.clickTab("feature1")');
    await new Promise((r) => setTimeout(r, 150));
    const elapsedSinceHighlightMs = Date.now() - tHighlightStarted;

    const postSwitchState = await client.eval(`
      ({
        verdictText: document.querySelector('section h2.font-bold')?.textContent?.trim() || '',
        filter: window.__p2Helpers.getActiveFilter(),
        expandedGroups: window.__p2Helpers.getExpandedGroupIds(),
        highlightedIds: window.__p2Helpers.getHighlightedDesktopItemIds(),
        hasDistributedSystemsRow: Boolean(document.getElementById('criterion-desktop-item-distributed-systems-1')),
      })
    `);

    report.checkpoints.cp5 = {
      elapsedSinceHighlightMs,
      timerLimitMs: 2500,
      preSwitchState,
      postSwitchState,
    };

    recordAssertion('CP5', 'Verification measured strictly BEFORE 2500ms highlight timer expired', `${elapsedSinceHighlightMs}ms < 2000ms`, '< 2000ms', elapsedSinceHighlightMs < 2000);
    recordAssertion('CP5', 'Previous highlight was immediately cleared by analysis switch (not by timer expiration)', postSwitchState.highlightedIds, [], postSwitchState.highlightedIds.length === 0);
    recordAssertion('CP5', 'Filter reset from "must_have" back to default "all" for new result', postSwitchState.filter, 'all', postSwitchState.filter === 'all');
    recordAssertion('CP5', 'Expanded groups re-initialized to new result initialOpenGroupId (["experience"])', postSwitchState.expandedGroups, ['experience'], JSON.stringify(postSwitchState.expandedGroups) === JSON.stringify(['experience']));
    recordAssertion('CP5', 'New result criteria ("Distributed Systems") rendered inside expanded "experience" group', postSwitchState.hasDistributedSystemsRow, true, postSwitchState.hasDistributedSystemsRow === true);

    report.screenshots.cp5 = await client.captureScreenshot('desktop_4_result_switch_reset.png');

    report.status = 'PASS';
    const reportPath = path.join(ARTIFACT_DIR, 'desktop_p2_cdp_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n=== TẤT CẢ ${report.passedAssertions}/${report.totalAssertions} ASSERTIONS ĐẠT 100% (STATUS: PASS) ===`);
    console.log(`[JSON Report Saved] -> ${reportPath}`);
  } finally {
    if (client) client.close();
    if (chromeProc) {
      try { chromeProc.kill(); } catch {}
    }
    if (serverHandle.spawnedByUs && serverHandle.proc) {
      try { serverHandle.proc.kill(); } catch {}
    }
    // Khôi phục các file data json nếu bị ghi trong quá trình đăng ký user test
    try {
      execSync('git restore data/', { stdio: 'ignore' });
    } catch {}
  }
}

main().catch((err) => {
  console.error('\n[VERIFICATION FAILED]:', err.message || err);
  process.exit(1);
});
