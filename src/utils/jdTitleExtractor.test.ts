import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractJobMetaFromJdText,
  formatCandidateHistoryTitle,
  isLegacyKeywordHistoryTitle,
  enrichAndMigrateHistoryItem,
} from './jdTitleExtractor.ts';
import type { HistoryItem } from '../types.ts';

test('1. extractJobMetaFromJdText extracts companyName and jobTitle from labeled Vietnamese & English JDs', () => {
  const vnJd = `
    Công ty: Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)
    Vị trí ứng tuyển: Trưởng phòng Quản trị & Vận hành CNTT (IT Operations & Governance)
    Địa điểm: Hà Nội
    Mô tả công việc:
    - Xây dựng lộ trình IT (IT roadmap) và quản lý ngân sách OPEX/CAPEX.
  `;
  const meta1 = extractJobMetaFromJdText(vnJd);
  assert.equal(meta1.companyName, 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)');
  assert.equal(meta1.jobTitle, 'Trưởng phòng Quản trị & Vận hành CNTT (IT Operations & Governance)');

  const urlExtractedMarkdownJd = `
    # Senior System Architect & Cloud Lead
    **Công ty / Company:** FPT Software
    **Địa điểm / Location:** Ho Chi Minh City

    ## Job Description
    - Lead cloud architecture and regional IT system implementation.
  `;
  const meta2 = extractJobMetaFromJdText(urlExtractedMarkdownJd);
  assert.equal(meta2.companyName, 'FPT Software');
  assert.equal(meta2.jobTitle, 'Senior System Architect & Cloud Lead');
});

test('2. extractJobMetaFromJdText extracts metadata from LinkedIn subheaders, prose, and sourceLabel (file/URL)', () => {
  const linkedInStyleJd = `
    Head of IT Infrastructure & Security
    VNG Corporation · Ho Chi Minh City, Vietnam (Hybrid)
    Mô tả công việc:
    - Quản lý hạ tầng mạng, máy chủ & Cloud.
    - Đảm bảo an toàn thông tin theo tiêu chuẩn ISO 27001, Zero Trust.
  `;
  const metaLinkedIn = extractJobMetaFromJdText(linkedInStyleJd);
  assert.equal(metaLinkedIn.companyName, 'VNG Corporation');
  assert.equal(metaLinkedIn.jobTitle, 'Head of IT Infrastructure & Security');

  // From URL extractor sourceLabel ("ITviec: Senior Backend Engineer at Momo")
  const minimalJd = `
    Mô tả công việc:
    - Thiết kế hệ thống thanh toán chịu tải cao.
  `;
  const metaFromUrlLabel = extractJobMetaFromJdText(
    minimalJd,
    'ITviec: Senior Backend Engineer at MoMo (M_Service)'
  );
  assert.equal(metaFromUrlLabel.companyName, 'MoMo (M_Service)');
  assert.equal(metaFromUrlLabel.jobTitle, 'Senior Backend Engineer');

  // From uploaded filename ("JD_Viettel_Digital - IT Governance Manager.pdf")
  const metaFromFile = extractJobMetaFromJdText(
    minimalJd,
    'JD_Viettel_Digital - IT Governance Manager.pdf'
  );
  assert.equal(metaFromFile.companyName, 'Viettel Digital');
  assert.equal(metaFromFile.jobTitle, 'IT Governance Manager');
});

test('3. formatCandidateHistoryTitle formats "[Company Name] - [Job Title]" and strips legacy "- username"', () => {
  assert.equal(
    formatCandidateHistoryTitle({
      companyName: 'Techcombank',
      jobTitle: 'IT Operations & Governance Manager',
      currentUsername: 'vuta',
    }),
    'Techcombank - IT Operations & Governance Manager'
  );

  // When companyName is not available in JD, shows clean jobTitle without "- vuta"
  assert.equal(
    formatCandidateHistoryTitle({
      companyName: '',
      jobTitle: 'Head of IT Infrastructure - vuta',
      currentUsername: 'vuta',
    }),
    'Head of IT Infrastructure'
  );

  // Avoids duplicating company name if jobTitle already starts with company name
  assert.equal(
    formatCandidateHistoryTitle({
      companyName: 'FPT Software',
      jobTitle: 'FPT Software - Senior AI Engineer',
    }),
    'FPT Software - Senior AI Engineer'
  );
});

test('4. enrichAndMigrateHistoryItem automatically upgrades legacy "Vị trí <keyword> - vuta" history items', () => {
  const legacyItem: HistoryItem = {
    id: '1730000001',
    title: 'Vị trí IT roadmap - vuta',
    timestamp: Date.now(),
    cvText: 'Sample CV',
    jdText: `
      Công ty: Tập đoàn Masan (Masan Group)
      Vị trí: IT Director / Head of IT Strategy
      Yêu cầu:
      - Xây dựng IT roadmap và quản lý ngân sách CNTT (OPEX/CAPEX).
    `,
    score: 85,
    analysis: {
      feature1: {
        jdKeywords: [
          { keyword: 'IT roadmap', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng' },
          { keyword: 'IT budgeting (OPEX/CAPEX)', category: 'Kỹ năng chuyên môn', importance: 'Quan trọng' },
        ],
        comparisonTable: [],
        scores: {
          keywordMatchScore: 85,
          skillMatchScore: 85,
          experienceOutcomeScore: 85,
          overallRoleScore: 85,
        },
        summary: {
          biggestStrength: '',
          missingKeywordsSkills: [],
          weakOrVagueSections: [],
          immediateActions: [],
        },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'YES',
        decisionReason: '',
        firstImpression10s: '',
        immediateStrength: '',
        biggestDoubt: '',
        fastestPointLossSection: '',
        top3MustFix: [],
      },
    },
  };

  assert.equal(
    isLegacyKeywordHistoryTitle(legacyItem.title, legacyItem.analysis.feature1.jdKeywords),
    true
  );

  const migrated = enrichAndMigrateHistoryItem(legacyItem, 'vi', 'vuta');
  assert.equal(migrated.companyName, 'Tập đoàn Masan (Masan Group)');
  assert.equal(migrated.jobTitle, 'IT Director / Head of IT Strategy');
  assert.equal(migrated.title, 'Tập đoàn Masan (Masan Group) - IT Director / Head of IT Strategy');

  // Verify user custom rename (isCustomTitle: true) is preserved
  const customRenamed: HistoryItem = {
    ...migrated,
    title: 'Masan Group - IT Director (Ưu tiên số 1)',
    isCustomTitle: true,
  };
  const rechecked = enrichAndMigrateHistoryItem(customRenamed, 'vi', 'vuta');
  assert.equal(rechecked.title, 'Masan Group - IT Director (Ưu tiên số 1)');

  // Verify polluted cross-analysis legacy title (e.g., "Vị trí IT Roadmap & Strategy - vuta" stuck on a Kubernetes/DevOps JD) is repaired
  const stuckCrossAnalysisItem: HistoryItem = {
    ...legacyItem,
    id: '1730000002',
    title: 'Vị trí IT Roadmap & Strategy - vu.ta',
    jobTitle: 'Vị trí IT Roadmap & Strategy - vu.ta',
    jdText: `
      # Senior DevOps & Cloud Infrastructure Engineer
      **Công ty / Company:** Shopee Vietnam
      Requirements:
      - Kubernetes & Containerization
      - Terraform & Infrastructure as Code (IaC)
    `,
    analysis: {
      ...legacyItem.analysis,
      companyName: 'Shopee Vietnam',
      jobTitle: 'Senior DevOps & Cloud Infrastructure Engineer',
      feature1: {
        ...legacyItem.analysis.feature1,
        jdKeywords: [
          { keyword: 'Kubernetes & Containerization', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng' },
        ],
      },
    },
  };
  const repaired = enrichAndMigrateHistoryItem(stuckCrossAnalysisItem, 'vi', 'vu.ta');
  assert.equal(repaired.companyName, 'Shopee Vietnam');
  assert.equal(repaired.jobTitle, 'Senior DevOps & Cloud Infrastructure Engineer');
  assert.equal(repaired.title, 'Shopee Vietnam - Senior DevOps & Cloud Infrastructure Engineer');
});

test('5. UI contract check across App.tsx and HistorySidebar.tsx for Company + Role display & Always-Visible Inline Rename', () => {
  const rootDir = process.cwd();
  const appCode = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8').replace(/\r\n/g, '\n');
  const sidebarCode = fs.readFileSync(path.join(rootDir, 'src/components/HistorySidebar.tsx'), 'utf-8');

  assert.ok(appCode.includes('enrichAndMigrateHistoryItem'));
  assert.ok(appCode.includes('formatCandidateHistoryTitle'));
  assert.ok(appCode.includes('handleRenameHistoryItem'));
  assert.ok(appCode.includes("if (val !== jdText) {\n              setCurrentRoleTitle('');\n            }"));

  assert.ok(sidebarCode.includes('onRenameHistoryItem'));
  assert.ok(sidebarCode.includes('Building2'));
  assert.ok(sidebarCode.includes('Briefcase'));
  assert.ok(sidebarCode.includes('editCompanyName'));
  assert.ok(sidebarCode.includes('editJobTitle'));
  assert.ok(sidebarCode.includes("lang === 'vi' ? 'Sửa tên' : 'Rename'"));
  assert.equal(sidebarCode.includes('right-18'), false);
});
