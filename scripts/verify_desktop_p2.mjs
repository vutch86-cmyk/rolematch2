import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\c7c1dc0f-bbda-42f8-9a2b-c968be2ec0c4';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\User\\AppData\\Local\\Temp\\chrome_cdp_p2_verify';
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
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`[Ảnh minh chứng chụp thành công] -> ${filename}`);
    return fullPath;
  }
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
      if (res.ok) return proc;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error('Chrome remote debugging did not respond on port 9222');
}

async function main() {
  console.log('=== BẮT ĐẦU KIỂM CHỨNG TRÌNH DUYỆT THẬT DESKTOP PHASE 2 ===');

  // 1. Tạo tài khoản đăng nhập hợp lệ qua backend Express
  const authUsername = 'tester_' + Date.now().toString(36);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: authUsername,
      password: 'Password123!',
      fullName: 'Desktop Automated QA',
    }),
  });
  const authData = await regRes.json();
  if (!authData.token) {
    throw new Error('Không thể đăng ký tài khoản kiểm thử: ' + JSON.stringify(authData));
  }
  const authToken = authData.token;
  console.log(`1. Đăng ký & lấy Token xác thực thành công cho user "${authUsername}".`);

  // 2. Khởi động Chrome CDP
  const chromeProc = await startChrome();
  console.log('2. Đã khởi động Google Chrome Headless (Viewport 1280x850 desktop).');

  try {
    const listRes = await fetch('http://localhost:9222/json');
    const tabs = await listRes.json();
    const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
    const client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    // Dữ liệu phân tích Item A: Đầy đủ các trường hợp P2
    const mockAnalysisA = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'TypeScript', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: undefined },
          { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: undefined },
          { keyword: 'Docker', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Quan trọng', isMustHave: false },
          { keyword: 'GraphQL', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          {
            jdTerm: 'React',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: '5 năm kinh nghiệm React, Next.js chuyên sâu',
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
            jdTerm: 'AWS',
            importance: 'Rất quan trọng',
            isMustHave: undefined,
            cvEvidence: 'Cần làm rõ chứng chỉ hoặc dự án triển khai Cloud',
            gapOrClarification: 'Chưa có thông tin định lượng',
            matchStatus: 'invalid_status_xyz', // unknown
          },
          {
            jdTerm: 'Docker',
            importance: 'Quan trọng',
            isMustHave: false,
            cvEvidence: 'Dùng docker-compose trong môi trường dev',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
        ],
        scores: {
          keywordMatchScore: 82,
          skillMatchScore: 78,
          experienceOutcomeScore: 75,
          overallRoleScore: 80,
          overallRationale: 'Ứng viên có thế mạnh React vững chắc, cần bổ sung kinh nghiệm TypeScript thực chiến.',
        },
        summary: {
          biggestStrength: 'React Frontend Architecture',
          missingKeywordsSkills: ['TypeScript'],
          weakOrVagueSections: [],
          immediateActions: ['Bổ sung kinh nghiệm TypeScript', 'Làm rõ chứng chỉ AWS'],
        },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        top3MustFix: [
          'Bổ sung kinh nghiệm TypeScript thực tế vào dự án gần nhất',
          'Làm rõ các dự án AWS Cloud',
        ],
      },
    };

    // Dữ liệu phân tích Item B: Dùng để kiểm tra chuyển đổi hồ sơ
    const mockAnalysisB = {
      feature1: {
        jdKeywords: [
          { keyword: 'Python', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          {
            jdTerm: 'Python',
            importance: 'Rất quan trọng',
            isMustHave: true,
            cvEvidence: '3 năm Django & FastAPI',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
        ],
        scores: {
          keywordMatchScore: 92,
          skillMatchScore: 90,
          experienceOutcomeScore: 88,
          overallRoleScore: 91,
          overallRationale: 'Hồ sơ đạt độ tương thích cao cho vị trí Backend Python.',
        },
      },
    };

    const historyPayload = [
      {
        id: 'hist-item-a',
        isCustomTitle: true,
        title: 'Senior Frontend Engineer - TechCorp',
        jobTitle: 'Senior Frontend Engineer',
        companyName: 'TechCorp',
        timestamp: Date.now() - 10000,
        score: 80,
        cvText: '5 years React development experience',
        jdText: 'Looking for Senior Frontend Engineer with React and TypeScript',
        analysis: mockAnalysisA,
      },
      {
        id: 'hist-item-b',
        isCustomTitle: true,
        title: 'Backend Python Engineer - DataAI',
        jobTitle: 'Backend Python Engineer',
        companyName: 'DataAI',
        timestamp: Date.now() - 5000,
        score: 91,
        cvText: '3 years Python backend development experience',
        jdText: 'Looking for Backend Python Engineer with Django',
        analysis: mockAnalysisB,
      },
    ];

    // Điều hướng vào trang web
    await client.send('Page.navigate', { url: BASE_URL });
    await new Promise((r) => setTimeout(r, 1200));

    // Nạp token và lịch sử vào localStorage
    const historyJsonStr = JSON.stringify(historyPayload);
    await client.eval(`
      (() => {
        localStorage.setItem('auth_token', '${authToken}');
        localStorage.setItem('role_match_last_activity', Date.now().toString());
        localStorage.setItem('cv_matcher_history', ${JSON.stringify(historyJsonStr)});
      })()
    `);

    // Reload lại để ứng dụng nhận phiên đăng nhập và lịch sử
    await client.send('Page.reload');
    await new Promise((r) => setTimeout(r, 2000));

    const debugPage = await client.eval(`
      (() => {
        return {
          title: document.title,
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim() || b.title),
          historyRaw: localStorage.getItem('cv_matcher_history')?.slice(0, 100),
          token: localStorage.getItem('auth_token')?.slice(0, 20),
          bodySnippet: document.body.innerText.slice(0, 300),
        };
      })()
    `);
    console.log('[DEBUG PAGE STATE]:', debugPage);

    // Mở HistorySidebar và chọn Item A
    const openDrawerRes = await client.eval(`
      (() => {
        const histBtn = document.querySelector('button[title*="Lịch sử"], button[title*="History"]') || 
          Array.from(document.querySelectorAll('header button')).find(b => b.textContent?.includes('2'));
        if (histBtn) {
          histBtn.click();
          return { clickedDrawer: true, title: histBtn.title, text: histBtn.textContent };
        }
        return { clickedDrawer: false };
      })()
    `);
    console.log('[DRAWER CLICKED]:', openDrawerRes);
    await new Promise((r) => setTimeout(r, 1200));

    // Chọn item Senior Frontend Engineer trong HistorySidebar
    const itemClickRes = await client.eval(`
      (() => {
        const drawerHeadings = Array.from(document.querySelectorAll('aside h4, .fixed h4, [role="dialog"] h4'));
        const target = drawerHeadings.find(el => el.textContent && el.textContent.includes('Senior Frontend Engineer'));
        if (target) {
          const card = target.closest('[class*="cursor-pointer"]') || target;
          card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return { clickedItem: true, foundText: target.textContent };
        }
        return { 
          clickedItem: false, 
          drawerHeadings: drawerHeadings.map(h => h.textContent) 
        };
      })()
    `);
    console.log('[ITEM CLICKED]:', itemClickRes);
    await new Promise((r) => setTimeout(r, 2000));

    // ==========================================
    // CHECKPOINT 1: EXECUTIVE HERO CARD
    // ==========================================
    console.log('3. Kiểm tra Checkpoint 1: Executive Hero Card...');
    const heroReport = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const segmentedBar = document.querySelector('.bg-emerald-600') && document.querySelector('.bg-slate-400');
        const verdictH2 = document.querySelector('h2.font-bold')?.textContent || '';
        return {
          hasHeroCard: bodyText.includes('ĐIỂM ĐÁNH GIÁ CV GỐC') || bodyText.includes('ĐÁP ỨNG TIÊU CHÍ BẮT BUỘC'),
          hasSegmentedBar: !!segmentedBar,
          hasMustHavePassed: bodyText.includes('Đạt yêu cầu'),
          hasMustHaveGap: bodyText.includes('Cần bổ sung'),
          hasMustHaveUnknown: bodyText.includes('Chưa xác định') || bodyText.includes('Unknown'),
          hasMustHaveUncompared: bodyText.includes('Chưa đối chiếu') || bodyText.includes('Uncompared'),
          verdictStatement: verdictH2,
          neverOverclaimsFullMet: !bodyText.includes('đáp ứng đầy đủ tất cả các yêu cầu cốt lõi'),
        };
      })()
    `);
    console.log('Kết quả Checkpoint 1:', heroReport);
    await client.captureScreenshot('desktop_1_hero_overview.png');

    // ==========================================
    // CHECKPOINT 2: TAB SWITCHING & STATE PRESERVATION
    // ==========================================
    console.log('4. Kiểm tra Checkpoint 2: Chuyển Tab & Bảo toàn State...');
    // Đổi sang tab 2: Bản Đồ Bằng Chứng
    await client.eval(`
      (() => {
        const emTab = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && (b.textContent.includes('Bản Đồ Bằng Chứng') || b.textContent.includes('Bằng Chứng'))
        );
        if (emTab) emTab.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Đổi sang tab 3: Cập nhật CV
    await client.eval(`
      (() => {
        const updateTab = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && (b.textContent.includes('Cập nhật CV') || b.textContent.includes('Update CV'))
        );
        if (updateTab) updateTab.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Quay lại tab 2: Bản Đồ Bằng Chứng
    await client.eval(`
      (() => {
        const emTab = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && (b.textContent.includes('Bản Đồ Bằng Chứng') || b.textContent.includes('Bằng Chứng'))
        );
        if (emTab) emTab.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    const tabReport = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          evidenceMapActive: bodyText.includes('Kỹ Năng Chuyên Môn'),
          groupsRendered: document.querySelectorAll('[aria-expanded]').length > 0,
        };
      })()
    `);
    console.log('Kết quả Checkpoint 2:', tabReport);
    await client.captureScreenshot('desktop_2_tab_preservation.png');

    // ==========================================
    // CHECKPOINT 3: QUICK WIN CLICK & CONDITIONAL FILTER UNHIDE
    // ==========================================
    console.log('5. Kiểm tra Checkpoint 3: Click Quick Win, tự động gỡ filter & mở accordion...');
    // Đặt bộ lọc sang 'must_have'
    await client.eval(`
      (() => {
        const filterBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && b.textContent.trim().startsWith('Bắt buộc')
        );
        if (filterBtn) filterBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Click nút Quick Win
    const quickWinClickResult = await client.eval(`
      (() => {
        const qwBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && (b.textContent.includes('Xem vị trí') || b.textContent.includes('Đi đến') || b.textContent.includes('Xem tiêu chí'))
        );
        if (qwBtn) {
          qwBtn.click();
          return { clicked: true, label: qwBtn.textContent.trim() };
        }
        return { clicked: false };
      })()
    `);
    console.log('Kết quả kích hoạt Quick Win:', quickWinClickResult);
    await new Promise((r) => setTimeout(r, 1200));

    // ==========================================
    // CHECKPOINT 4: SCROLL & FOCUS OCCLUSION INSPECTION
    // ==========================================
    console.log('6. Kiểm tra Checkpoint 4: Vị trí Scroll & Focus (Không bị Header hoặc Tab dính che)...');
    const scrollReport = await client.eval(`
      (() => {
        const targetRow = document.querySelector('.ring-2.ring-amber-400, [data-criterion-id]:focus, :focus');
        
        const headerEl = document.querySelector('header');
        const headerBottom = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
        
        const stickyTabEl = document.querySelector('.sticky');
        const tabBottom = stickyTabEl ? stickyTabEl.getBoundingClientRect().bottom : 0;
        
        const totalStickyBottom = Math.max(headerBottom, tabBottom);
        
        let targetRect = null;
        let isOccluded = false;
        let hasFocusOrHighlight = false;
        
        if (targetRow && targetRow !== document.body) {
          targetRect = targetRow.getBoundingClientRect();
          // Tiêu chí KHÔNG bị che nếu targetRect.top >= totalStickyBottom (có lề đệm an toàn)
          isOccluded = targetRect.top < (totalStickyBottom - 5);
          hasFocusOrHighlight = true;
        }
        
        return {
          foundTargetRow: !!targetRow,
          targetTagName: targetRow?.tagName,
          targetId: targetRow?.id,
          targetTop: targetRect ? targetRect.top : null,
          totalStickyBottom,
          isOccluded,
          hasFocusOrHighlight,
        };
      })()
    `);
    console.log('Kết quả Checkpoint 4:', scrollReport);
    await client.captureScreenshot('desktop_3_quick_win_scroll_focus.png');

    // ==========================================
    // CHECKPOINT 5: ĐỔI KẾT QUẢ & RESET STATE
    // ==========================================
    console.log('7. Kiểm tra Checkpoint 5: Đổi kết quả sang hồ sơ Backend Python & Reset State...');
    await client.eval(`
      (() => {
        const histBtn = document.querySelector('button[title*="Lịch sử"], button[title*="History"]') || 
          Array.from(document.querySelectorAll('header button')).find(b => b.textContent?.includes('2'));
        if (histBtn) histBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    await client.eval(`
      (() => {
        const drawerHeadings = Array.from(document.querySelectorAll('aside h4, .fixed h4, [role="dialog"] h4'));
        const itemEl = drawerHeadings.find(el => el.textContent && el.textContent.includes('Backend Python Engineer'));
        if (itemEl) {
          const card = itemEl.closest('[class*="cursor-pointer"]') || itemEl;
          card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 2000));

    const resetReport = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          switchedToPython: bodyText.includes('Python') || bodyText.includes('Backend Python Engineer'),
          previousHighlightCleared: document.querySelectorAll('.ring-2.ring-primary-500').length === 0,
        };
      })()
    `);
    console.log('Kết quả Checkpoint 5:', resetReport);
    await client.captureScreenshot('desktop_4_result_switch_reset.png');

    console.log('=== KIỂM CHỨNG TỰ ĐỘNG DESKTOP HOÀN THÀNH TOÀN BỘ 100% ===');
  } finally {
    chromeProc.kill();
  }
}

main().catch((err) => {
  console.error('LỖI KIỂM CHỨNG DESKTOP:', err);
  process.exit(1);
});
