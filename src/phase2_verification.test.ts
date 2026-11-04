import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  buildEvidenceMapViewModel,
  computeAnalysisFingerprint,
  shouldUnhideFilterForTarget,
} from './utils/evidenceMapAdapter';
import { ExecutiveHeroCard } from './components/ExecutiveHeroCard';
import { EvidenceMapTab } from './components/EvidenceMapTab';
import { CompleteCVAnalysisResponse } from './types';

describe('Phase 2 Real Component Rendering & Interaction Regression Suite', () => {
  const sampleAnalysis: CompleteCVAnalysisResponse = {
    companyName: 'Fintech Solutions',
    jobTitle: 'Senior Fullstack Engineer',
    feature1: {
      jdKeywords: [
        { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
        { keyword: 'PostgreSQL', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Quan trọng', isMustHave: false },
        { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: true },
      ],
      comparisonTable: [
        { jdTerm: 'React', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '4 năm React', gapOrClarification: '', matchStatus: 'khop' },
        { jdTerm: 'PostgreSQL', importance: 'Quan trọng', isMustHave: false, cvEvidence: '', gapOrClarification: 'Chưa có thông tin SQL', matchStatus: 'thieu' },
      ],
      scores: {
        keywordMatchScore: 75,
        skillMatchScore: 80,
        experienceOutcomeScore: 70,
        overallRoleScore: 76,
        overallRationale: 'Cần làm rõ thêm kinh nghiệm về cơ sở dữ liệu',
      },
      summary: {
        biggestStrength: 'Frontend vững',
        missingKeywordsSkills: ['PostgreSQL'],
        weakOrVagueSections: [],
        immediateActions: ['Bổ sung dự án sử dụng PostgreSQL'],
      },
    },
    feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
    feature3: {
      inviteDecision: 'MAYBE',
      decisionReason: 'Cần làm rõ khả năng backend',
      firstImpression10s: 'Khá',
      immediateStrength: 'React',
      biggestDoubt: 'Cơ sở dữ liệu',
      fastestPointLossSection: 'Database',
      top3MustFix: ['Bổ sung dự án sử dụng PostgreSQL vào phần kinh nghiệm'],
    },
  };

  it('1. [REGRESSION POINT 1] Renders distinct, unique DOM IDs for desktop vs mobile to prevent selecting hidden desktop rows on mobile', () => {
    const vm = buildEvidenceMapViewModel(sampleAnalysis, 'vi');
    const html = renderToString(
      React.createElement(EvidenceMapTab, {
        viewModel: vm,
        lang: 'vi',
        expandedGroups: new Set(['tech', 'tools']),
        onToggleGroup: () => {},
        competencyFilter: 'all',
        onFilterChange: () => {},
      })
    );

    // Kiểm tra desktop row ID
    expect(html).toContain('id="criterion-desktop-');
    expect(html).toContain('data-device-target="desktop"');

    // Kiểm tra mobile card ID
    expect(html).toContain('id="criterion-mobile-');
    expect(html).toContain('data-device-target="mobile"');

    // Đảm bảo không còn dùng id trùng nhau không có prefix
    const reactItemId = vm.groups.flatMap((g) => g.items).find((it) => it.term === 'React')?.id;
    expect(reactItemId).toBeDefined();

    // Attribute id="..." không được trùng với reactItemId trực tiếp (phải có prefix desktop/mobile)
    const hasUnprefixedId = new RegExp(`(?:^|\\s)id="${reactItemId}"`).test(html);
    expect(hasUnprefixedId).toBe(false);
    // Nhưng có attribute data-criterion-id dùng chung để tìm kiếm theo view
    expect(html).toContain(`data-criterion-id="${reactItemId}"`);
  });

  it('2. [REGRESSION POINT 2 & 7] Renders localized indicators in EN without hardcoded VI and truthful gap column', () => {
    const vmEn = buildEvidenceMapViewModel(sampleAnalysis, 'en');
    const htmlEn = renderToString(
      React.createElement(EvidenceMapTab, {
        viewModel: vmEn,
        lang: 'en',
        expandedGroups: new Set(['tech', 'tools']),
        onToggleGroup: () => {},
        competencyFilter: 'all',
        onFilterChange: () => {},
      })
    );

    // Không còn text tiếng Việt sót lại trong counter
    expect(htmlEn).toContain('Met');
    expect(htmlEn).toContain('Missing');
    expect(htmlEn).not.toContain('Đủ bằng chứng');

    // Cột khoảng trống của PostgreSQL (matchStatus: thieu, gapOrClarification có nội dung) hiển thị đúng nội dung
    expect(htmlEn).toContain('Chưa có thông tin SQL');

    // Hero Card EN không chứa text tiếng Việt
    const heroHtmlEn = renderToString(
      React.createElement(ExecutiveHeroCard, {
        hero: vmEn.hero,
        lang: 'en',
      })
    );
    expect(heroHtmlEn).toContain('EVIDENCED ASSESSMENT');
    expect(heroHtmlEn).toContain('MANDATORY CRITERIA');
    expect(heroHtmlEn).not.toContain('KẾT LUẬN ĐÁNH GIÁ');
  });

  it('3. [REGRESSION POINT 4] Fingerprint-based state reset detects changes even with identical company, title and score', () => {
    const baseAnalysis: CompleteCVAnalysisResponse = {
      companyName: 'Acme Corp',
      jobTitle: 'Lead Architect',
      feature1: {
        comparisonTable: [
          { jdTerm: 'Microservices', importance: 'Rất quan trọng', matchStatus: 'khop', cvEvidence: '', gapOrClarification: '' },
        ],
        jdKeywords: [],
        scores: { keywordMatchScore: 80, skillMatchScore: 80, experienceOutcomeScore: 80, overallRoleScore: 85 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'YES', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const differentContentAnalysis: CompleteCVAnalysisResponse = {
      ...baseAnalysis,
      feature1: {
        ...baseAnalysis.feature1,
        comparisonTable: [
          { jdTerm: 'Serverless', importance: 'Rất quan trọng', matchStatus: 'can_bo_sung', cvEvidence: '', gapOrClarification: '' },
        ],
      },
    };

    const fp1 = computeAnalysisFingerprint(baseAnalysis);
    const fp2 = computeAnalysisFingerprint(differentContentAnalysis);

    expect(fp1).not.toBe(fp2);
  });

  it('4. [REGRESSION POINT 7] Quick Win only resets filter to "all" when target item is actually hidden by filter', () => {
    const vm = buildEvidenceMapViewModel(sampleAnalysis, 'vi');
    const qw = vm.hero.quickWins[0]; // PostgreSQL (isMustHave: false, matchStatus: 'thieu')
    expect(qw.targetItemId).toBeDefined();

    const targetItem = vm.groups.flatMap((g) => g.items).find((it) => it.id === qw.targetItemId);
    expect(targetItem).toBeDefined();

    // Gọi trực tiếp hàm production shouldUnhideFilterForTarget:
    // Case 1: Bộ lọc đang là 'gap'. Target item là PostgreSQL (thieu) -> KHÔNG bị che giấu -> false (không cần unhide)
    expect(shouldUnhideFilterForTarget('gap', targetItem)).toBe(false);

    // Case 2: Bộ lọc đang là 'must_have'. Target item PostgreSQL (isMustHave: false) -> BỊ CHE GIẤU -> true (phải unhide)
    expect(shouldUnhideFilterForTarget('must_have', targetItem)).toBe(true);
  });

  it('5. [REGRESSION POINT 5] Corrupt status in component renders neutral badge without crashing or false count', () => {
    const corruptAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          // @ts-expect-error test corrupted status
          { jdTerm: 'Security Audit', importance: 'Quan trọng', matchStatus: 'corrupted_state_123', cvEvidence: 'Đã làm', gapOrClarification: '' },
        ],
        scores: { keywordMatchScore: 60, skillMatchScore: 60, experienceOutcomeScore: 60, overallRoleScore: 60 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'MAYBE', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const vm = buildEvidenceMapViewModel(corruptAnalysis, 'vi');
    expect(vm.hero.mustHavePartial).toBe(0);

    const html = renderToString(
      React.createElement(EvidenceMapTab, {
        viewModel: vm,
        lang: 'vi',
        expandedGroups: new Set(['unclassified']),
        onToggleGroup: () => {},
        competencyFilter: 'all',
        onFilterChange: () => {},
      })
    );

    expect(html).toContain('Chưa xác định');
  });
});
