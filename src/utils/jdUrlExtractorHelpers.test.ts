import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validatePublicJobUrl,
  detectJobSiteName,
  extractLinkedInJobId,
  decodeHtmlEntities,
  stripHtmlToFormattedText,
  extractJsonLdJobPosting,
  extractMetaAndBodyText,
  isLikelyAuthOrBotWall,
  cleanPortalTitleSuffix,
  cleanJdTextHeuristically,
} from './jdUrlExtractorHelpers.ts';

test('1. validatePublicJobUrl validates public URLs, auto-prefixes https, and blocks SSRF/invalid hosts', () => {
  // Valid URLs
  const li = validatePublicJobUrl('https://www.linkedin.com/jobs/view/4123456789/');
  assert.equal(li.valid, true);
  assert.equal(li.parsed?.hostname, 'www.linkedin.com');

  // Auto-prefix https:// when omitted
  const itviec = validatePublicJobUrl('itviec.com/it-jobs/senior-react-developer-fpt-1234');
  assert.equal(itviec.valid, true);
  assert.equal(itviec.parsed?.protocol, 'https:');
  assert.equal(itviec.parsed?.hostname, 'itviec.com');

  // Reject empty or whitespace
  assert.equal(validatePublicJobUrl('').valid, false);
  assert.equal(validatePublicJobUrl('   ').valid, false);

  // Reject single word / missing TLD
  assert.equal(validatePublicJobUrl('not-a-valid-domain').valid, false);
  assert.equal(validatePublicJobUrl('https://intranet').valid, false);

  // Reject dangerous protocols
  assert.equal(validatePublicJobUrl('javascript:alert(1)').valid, false);
  assert.equal(validatePublicJobUrl('file:///C:/Windows/System32').valid, false);
  assert.equal(validatePublicJobUrl('ftp://files.company.com/jd.pdf').valid, false);

  // Block SSRF / private / loopback networks
  assert.equal(validatePublicJobUrl('http://localhost:3000/api/health').valid, false);
  assert.equal(validatePublicJobUrl('http://127.0.0.1:8080/admin').valid, false);
  assert.equal(validatePublicJobUrl('http://10.0.0.15/job').valid, false);
  assert.equal(validatePublicJobUrl('http://192.168.1.100/job').valid, false);
  assert.equal(validatePublicJobUrl('http://172.16.5.4/job').valid, false);
  assert.equal(validatePublicJobUrl('http://169.254.169.254/latest/meta-data/').valid, false);
  assert.equal(validatePublicJobUrl('https://hr.corp.internal/jobs/1').valid, false);
});

test('2. detectJobSiteName and extractLinkedInJobId accurately identify portals and LinkedIn job IDs', () => {
  assert.equal(detectJobSiteName(new URL('https://www.linkedin.com/jobs/view/12345678')), 'LinkedIn');
  assert.equal(detectJobSiteName(new URL('https://itviec.com/it-jobs/senior-nodejs')), 'ITviec');
  assert.equal(detectJobSiteName(new URL('https://www.topcv.vn/viec-lam/product-manager')), 'TopCV');
  assert.equal(detectJobSiteName(new URL('https://www.vietnamworks.com/ai-engineer-kv')), 'VietnamWorks');
  assert.equal(detectJobSiteName(new URL('https://careerviet.vn/vi/tim-viec-lam')), 'CareerViet');
  assert.equal(detectJobSiteName(new URL('https://glints.com/vn/opportunities/jobs')), 'Glints');

  // LinkedIn Job ID formats
  assert.equal(
    extractLinkedInJobId(new URL('https://www.linkedin.com/jobs/view/senior-fullstack-engineer-at-techcorp-4123456789/')),
    '4123456789'
  );
  assert.equal(
    extractLinkedInJobId(new URL('https://www.linkedin.com/jobs/view/3987654321?trk=public_jobs_topcard-title')),
    '3987654321'
  );
  assert.equal(
    extractLinkedInJobId(new URL('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4011223344')),
    '4011223344'
  );
  assert.equal(
    extractLinkedInJobId(new URL('https://itviec.com/it-jobs/backend-dev-4011223344')),
    null
  );
});

test('3. extractJsonLdJobPosting parses structured schema.org JobPosting JSON-LD accurately', () => {
  const sampleHtml = `
    <html>
      <head>
        <title>Senior AI Engineer - TechCorp | ITviec</title>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior AI &amp; LLM Engineer",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "TechCorp Vietnam"
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "addressLocality": "Ho Chi Minh City",
                "addressCountry": "VN"
              }
            },
            "description": "<p>We are looking for a Senior AI Engineer to build enterprise RAG pipelines.</p><h3>Key Responsibilities</h3><ul><li>Design and optimize LLM agents and vector databases.</li><li>Collaborate with product and backend engineering teams.</li></ul>",
            "qualifications": "<ul><li>3+ years of experience in Python, PyTorch, and LangChain.</li><li>Strong knowledge of prompt engineering and evaluation.</li></ul>"
          }
        </script>
      </head>
      <body><div>SPA Root</div></body>
    </html>
  `;

  const extracted = extractJsonLdJobPosting(sampleHtml);
  assert.ok(extracted);
  assert.equal(extracted.title, 'Senior AI & LLM Engineer');
  assert.equal(extracted.company, 'TechCorp Vietnam');
  assert.equal(extracted.location, 'Ho Chi Minh City, VN');
  assert.ok(extracted.descriptionText?.includes('# Senior AI & LLM Engineer'));
  assert.ok(extracted.descriptionText?.includes('- Design and optimize LLM agents and vector databases.'));
  assert.ok(extracted.descriptionText?.includes('## Qualifications'));
});

test('4. isLikelyAuthOrBotWall detects LinkedIn 999, Cloudflare 403, login redirects, and allows valid public JD pages', () => {
  // Case A: LinkedIn HTTP 999 or authwall redirect
  assert.equal(
    isLikelyAuthOrBotWall({
      status: 999,
      finalUrl: 'https://www.linkedin.com/jobs/view/4123456789',
      rawHtml: '<html><body>Request denied</body></html>',
      pageTitle: 'LinkedIn',
      extractedText: 'Request denied',
    }),
    true
  );

  assert.equal(
    isLikelyAuthOrBotWall({
      status: 200,
      finalUrl: 'https://www.linkedin.com/authwall?trk=bf&original_referer=...',
      rawHtml: '<html><title>Sign Up | LinkedIn</title><body>Join LinkedIn to view</body></html>',
      pageTitle: 'Sign Up | LinkedIn',
      extractedText: 'Join LinkedIn to view this job posting.',
    }),
    true
  );

  // Case B: ITviec / Cloudflare challenge wall
  assert.equal(
    isLikelyAuthOrBotWall({
      status: 403,
      finalUrl: 'https://itviec.com/it-jobs/senior-java-developer',
      rawHtml: '<html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue cf_chl_opt</body></html>',
      pageTitle: 'Just a moment...',
      extractedText: 'Enable JavaScript and cookies to continue',
    }),
    true
  );

  // Case C: Valid public job posting page (e.g. TopCV / VietnamWorks / LinkedIn Guest API)
  const validJdText = `
    # Senior Product Manager - FinTech
    Mô tả công việc:
    - Xây dựng lộ trình sản phẩm (Product Roadmap) cho nền tảng thanh toán số với 2 triệu người dùng.
    - Phối hợp cùng đội ngũ Engineering, UI/UX và Business để phân tích yêu cầu và viết PRD.
    Yêu cầu ứng viên:
    - Tối thiểu 4 năm kinh nghiệm ở vị trí Product Manager hoặc Product Owner trong lĩnh vực FinTech/Banking.
    - Thành thạo phân tích dữ liệu (SQL, Mixpanel, Amplitude) và phương pháp Agile/Scrum.
    Quyền lợi:
    - Mức lương cạnh tranh tới $3,500 + thưởng hiệu quả kinh doanh.
  `;
  assert.equal(
    isLikelyAuthOrBotWall({
      status: 200,
      finalUrl: 'https://www.topcv.vn/viec-lam/senior-product-manager/12345.html',
      rawHtml: `<html><head><title>Senior Product Manager</title></head><body>${validJdText}</body></html>`,
      pageTitle: 'Senior Product Manager',
      extractedText: validJdText,
    }),
    false
  );
});

test('5. cleanJdTextHeuristically cleans messy Ctrl+A/Ctrl+C popup clipboard text and removes navigation/similar-jobs noise', () => {
  const messyCopiedFromPopup = `
    Skip to main content
    LinkedIn
    Jobs
    Messaging
    Notifications
    Senior Backend Engineer (Golang / Microservices) - LinkedIn
    FPT Software · Ho Chi Minh City, Vietnam (Hybrid)
    Apply Now
    Save

    About the job
    We are seeking a talented Senior Backend Engineer to join our Core FinTech Platform squad.

    Responsibilities:
    • Architect and build high-throughput microservices using Golang and gRPC.
    • Optimize PostgreSQL queries, Redis caching, and Kafka event streaming.
    • Conduct code reviews and mentor junior backend engineers.

    Your Skills and Experience:
    • 4+ years of production experience in Backend Development (Go, Java, or Node.js).
    • Hands-on experience with Docker, Kubernetes, and AWS/GCP cloud infrastructure.
    • Strong understanding of distributed systems and CI/CD pipelines.

    Why You'll Love Working Here:
    • 13th-month salary + performance bonus up to 3 months.
    • Premium healthcare insurance for you and your family.

    Similar jobs
    Junior PHP Developer
    Company ABC
     DevOps Engineer
    Company XYZ
    LinkedIn Corporation © 2026
  `;

  const result = cleanJdTextHeuristically(
    messyCopiedFromPopup,
    { url: 'https://www.linkedin.com/jobs/view/4123456789', siteName: 'LinkedIn' },
    'vi'
  );

  assert.equal(result.isAuthWall, false);
  assert.equal(result.jobTitle, 'Senior Backend Engineer (Golang / Microservices)');
  assert.ok(result.jdText.includes('## About the job'));
  assert.ok(result.jdText.includes('## Responsibilities'));
  assert.ok(result.jdText.includes('- Architect and build high-throughput microservices using Golang and gRPC.'));
  assert.ok(result.jdText.includes('## Your Skills and Experience'));
  assert.ok(result.jdText.includes("## Why You'll Love Working Here"));
  // Verify navigation chrome and trailing "Similar jobs" were stripped
  assert.equal(result.jdText.includes('Skip to main content'), false);
  assert.equal(result.jdText.includes('Junior PHP Developer'), false);

  // Verify copying a login screen before signing in is flagged as isAuthWall: true
  const copiedLoginScreen = `
    Sign in to LinkedIn
    Stay updated on your professional world
    Email or Phone
    Password
    Forgot password?
    Join LinkedIn
  `;
  const loginCheck = cleanJdTextHeuristically(copiedLoginScreen, { siteName: 'LinkedIn' }, 'vi');
  assert.equal(loginCheck.isAuthWall, true);
});

test('6. UI & Server integration contract check across JdUrlExtractor, BatchProcessingTab, InputSection, and server.ts', () => {
  const rootDir = process.cwd();
  const extractorCode = fs.readFileSync(path.join(rootDir, 'src/components/JdUrlExtractor.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  const recruiterCode = fs.readFileSync(path.join(rootDir, 'src/components/BatchProcessingTab.tsx'), 'utf-8');
  const candidateCode = fs.readFileSync(path.join(rootDir, 'src/components/InputSection.tsx'), 'utf-8');
  const serverCode = fs.readFileSync(path.join(rootDir, 'server.ts'), 'utf-8');

  // Verify JdUrlExtractor calls both endpoints and opens browser login popup window
  assert.ok(extractorCode.includes('/api/extract-jd-from-url'));
  assert.ok(extractorCode.includes('/api/clean-pasted-jd'));
  assert.ok(extractorCode.includes("window.open(\n        targetUrl,\n        'rolematch_jd_login_popup'"));
  assert.ok(extractorCode.includes('navigator.clipboard.readText()'));

  // Verify Recruiter UI (BatchProcessingTab.tsx) integrates JdUrlTriggerButton & JdUrlExtractor alongside file upload, drag-drop, error handling, and Markdown preview
  assert.ok(recruiterCode.includes('JdUrlTriggerButton'));
  assert.ok(recruiterCode.includes('JdUrlExtractor'));
  assert.ok(recruiterCode.includes('isJdUrlBarOpen'));
  assert.ok(recruiterCode.includes('onError={(msg) => setJdExtractError(msg)}'));
  assert.ok(recruiterCode.includes('handleJdDrop'));
  assert.ok(recruiterCode.includes('jdViewMode'));
  assert.ok(recruiterCode.includes('<Markdown>{jdText}</Markdown>'));

  // Verify Candidate UI (InputSection.tsx) integrates JdUrlTriggerButton & JdUrlExtractor alongside file upload, error handling, and Markdown preview
  assert.ok(candidateCode.includes('JdUrlTriggerButton'));
  assert.ok(candidateCode.includes('JdUrlExtractor'));
  assert.ok(candidateCode.includes('isJdUrlBarOpen'));
  assert.ok(candidateCode.includes('onError={(msg) => setExtractError(msg)}'));
  assert.ok(candidateCode.includes('jdViewMode'));
  assert.ok(candidateCode.includes('<Markdown>{jdText}</Markdown>'));

  // Verify server.ts registers both POST routes
  assert.ok(serverCode.includes("app.post('/api/extract-jd-from-url'"));
  assert.ok(serverCode.includes("app.post('/api/clean-pasted-jd'"));
});
