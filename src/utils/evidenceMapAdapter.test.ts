import { describe, it, expect } from 'vitest';
import {
  buildEvidenceMapViewModel,
  computeAnalysisFingerprint,
  isExactWordOrPhraseMatch,
} from './evidenceMapAdapter';
import { CompleteCVAnalysisResponse } from '../types';

describe('Phase 2 Data Contract & Regression Suite: evidenceMapAdapter', () => {
  it('1. Shares identical Must-Have counts and criteria totals between Hero and Evidence Groups (Single Source of Truth)', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'TypeScript', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'Docker', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Quan trọng', isMustHave: false },
        ],
        comparisonTable: [
          { jdTerm: 'React', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '3 năm React', gapOrClarification: '', matchStatus: 'khop' },
          { jdTerm: 'TypeScript', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: 'Chưa thấy trong CV', matchStatus: 'thieu' },
          { jdTerm: 'Docker', importance: 'Quan trọng', isMustHave: false, cvEvidence: 'Dùng compose', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: {
          keywordMatchScore: 80,
          skillMatchScore: 75,
          experienceOutcomeScore: 70,
          overallRoleScore: 78,
        },
        summary: {
          biggestStrength: 'React vững',
          missingKeywordsSkills: ['TypeScript'],
          weakOrVagueSections: [],
          immediateActions: ['Học TypeScript'],
        },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'YES',
        decisionReason: 'Nền tảng tốt',
        firstImpression10s: 'Khá tốt',
        immediateStrength: 'React',
        biggestDoubt: 'TypeScript',
        fastestPointLossSection: 'Skills',
        top3MustFix: ['Bổ sung TypeScript vào mục Kỹ năng'],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');

    expect(vm.hero.mustHaveTotal).toBe(2);
    expect(vm.hero.mustHavePassed).toBe(1);
    expect(vm.hero.mustHaveGap).toBe(1);
    expect(vm.hero.mustHavePartial).toBe(0);
    expect(vm.hero.mustHaveUncompared).toBe(0);

    let groupMustHaveGap = 0;
    for (const g of vm.groups) {
      groupMustHaveGap += g.mustHaveGapCount;
    }
    expect(groupMustHaveGap).toBe(vm.hero.mustHaveGap);
    expect(vm.totalCriteriaCount).toBe(3);
    expect(vm.hero.overallScore).toBe(78);
  });

  it('2. [REGRESSION POINT 2] NEVER concludes "đáp ứng đầy đủ tất cả các yêu cầu cốt lõi" when there are uncompared Must-Haves', () => {
    // Exact reproduction case:
    // JD has React (isMustHave) and AWS (isMustHave).
    // comparisonTable only has React (khop).
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          { jdTerm: 'React', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '3 năm React', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 90, skillMatchScore: 90, experienceOutcomeScore: 90, overallRoleScore: 90 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'YES',
        decisionReason: 'Nền tảng tốt',
        firstImpression10s: '',
        immediateStrength: '',
        biggestDoubt: '',
        fastestPointLossSection: '',
        top3MustFix: [],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');

    // Phải nhận diện ĐỦ 2 Must-Have (1 đã đối chiếu + 1 chưa đối chiếu)
    expect(vm.hero.mustHaveTotal).toBe(2);
    expect(vm.hero.mustHavePassed).toBe(1);
    expect(vm.hero.mustHaveUncompared).toBe(1);
    expect(vm.uncomparedKeywords.length).toBe(1);
    expect(vm.uncomparedKeywords[0].keyword).toBe('AWS');
    expect(vm.uncomparedKeywords[0].isMustHave).toBe(true);

    // Verdict KHÔNG ĐƯỢC khẳng định "đáp ứng đầy đủ tất cả các yêu cầu cốt lõi"
    expect(vm.hero.verdictStatement).not.toContain('đáp ứng đầy đủ tất cả các yêu cầu cốt lõi');
    expect(vm.hero.verdictStatement).toContain('1/2 yêu cầu được xác định là bắt buộc');
    expect(vm.hero.verdictStatement).toContain('1 yêu cầu bắt buộc chưa được đối chiếu');
  });

  it('3. [REGRESSION POINT 3] Word boundary matching prevents substring collisions (Java vs JavaScript, C vs C++)', () => {
    expect(isExactWordOrPhraseMatch('Java', 'Bổ sung kinh nghiệm JavaScript')).toBe(false);
    expect(isExactWordOrPhraseMatch('JavaScript', 'Bổ sung kinh nghiệm JavaScript')).toBe(true);
    expect(isExactWordOrPhraseMatch('Java', 'Cần làm rõ kỹ năng Java')).toBe(true);
    expect(isExactWordOrPhraseMatch('C', 'Thành thạo lập trình C++')).toBe(false);
    expect(isExactWordOrPhraseMatch('C++', 'Thành thạo lập trình C++')).toBe(true);

    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          { jdTerm: 'Java', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: 'Thiếu Java', matchStatus: 'thieu' },
          { jdTerm: 'JavaScript', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: 'Thiếu JS', matchStatus: 'thieu' },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 50 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'MAYBE',
        decisionReason: '',
        firstImpression10s: '',
        immediateStrength: '',
        biggestDoubt: '',
        fastestPointLossSection: '',
        top3MustFix: ['Bổ sung kinh nghiệm JavaScript vào dự án gần nhất'],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    // Quick Win phải liên kết đúng JavaScript, KHÔNG ĐƯỢC nhầm sang Java!
    const targetItem = vm.groups.flatMap((g) => g.items).find((it) => it.id === vm.hero.quickWins[0].targetItemId);
    expect(targetItem?.term).toBe('JavaScript');
  });

  it('3b. [REGRESSION POINT 3] Ambiguous action mentioning multiple criteria remains general guidance without speculative link', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          { jdTerm: 'Docker', importance: 'Quan trọng', isMustHave: false, cvEvidence: '', gapOrClarification: 'Thiếu Docker', matchStatus: 'thieu' },
          { jdTerm: 'Kubernetes', importance: 'Quan trọng', isMustHave: false, cvEvidence: '', gapOrClarification: 'Thiếu K8s', matchStatus: 'thieu' },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 50 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'MAYBE',
        decisionReason: '',
        firstImpression10s: '',
        immediateStrength: '',
        biggestDoubt: '',
        fastestPointLossSection: '',
        top3MustFix: ['Cần làm rõ kinh nghiệm về cả Docker và Kubernetes trong môi trường cloud'],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    // Hành động nhắc cả 2 tiêu chí -> không suy đoán liên kết bừa
    const qw = vm.hero.quickWins.find((q) => q.title.includes('Docker và Kubernetes'));
    expect(qw?.targetItemId).toBeUndefined();
  });

  it('4. [REGRESSION POINT 4] computeAnalysisFingerprint distinguishes analyses even with identical company, title, score and table length', () => {
    const analysis1: CompleteCVAnalysisResponse = {
      companyName: 'SameCompany',
      jobTitle: 'Engineer',
      feature1: {
        scores: { keywordMatchScore: 70, skillMatchScore: 70, experienceOutcomeScore: 70, overallRoleScore: 75 },
        comparisonTable: [
          { jdTerm: 'Python', importance: 'Quan trọng', matchStatus: 'khop', cvEvidence: '', gapOrClarification: '' },
        ],
        jdKeywords: [],
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'YES', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const analysis2: CompleteCVAnalysisResponse = {
      companyName: 'SameCompany',
      jobTitle: 'Engineer',
      feature1: {
        scores: { keywordMatchScore: 70, skillMatchScore: 70, experienceOutcomeScore: 70, overallRoleScore: 75 },
        comparisonTable: [
          { jdTerm: 'Golang', importance: 'Quan trọng', matchStatus: 'thieu', cvEvidence: '', gapOrClarification: '' },
        ],
        jdKeywords: [],
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'YES', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const fp1 = computeAnalysisFingerprint(analysis1);
    const fp2 = computeAnalysisFingerprint(analysis2);

    expect(fp1).not.toBe(fp2);
  });

  it('5. [REGRESSION POINT 5] Invalid or corrupt matchStatus is NOT changed to partial (mustHavePartial is not inflated)', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          // @ts-expect-error testing corrupted/invalid status
          { jdTerm: 'Rust', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: '', matchStatus: 'invalid_status_xyz' },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 50 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'MAYBE', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    // Tuyệt đối không được tăng mustHavePartial!
    expect(vm.hero.mustHavePartial).toBe(0);
    expect(vm.hero.mustHavePassed).toBe(0);
    expect(vm.hero.mustHaveGap).toBe(0);
    const rustItem = vm.groups.flatMap((g) => g.items).find((it) => it.term === 'Rust');
    expect(rustItem?.matchStatus).toBe('unknown');
  });

  it('6. Mixed sources of Must-Have is reported as mixed (with counts of explicit vs inferred)', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Quan trọng', isMustHave: true }, // explicit
          { keyword: 'TypeScript', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng' }, // inferred from importance
        ],
        comparisonTable: [
          { jdTerm: 'React', importance: 'Quan trọng', isMustHave: true, cvEvidence: 'React 3y', gapOrClarification: '', matchStatus: 'khop' },
          { jdTerm: 'TypeScript', importance: 'Rất quan trọng', cvEvidence: 'TS 2y', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 80, skillMatchScore: 80, experienceOutcomeScore: 80, overallRoleScore: 80 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'YES', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    expect(vm.hero.mustHaveSource).toBe('mixed');
    expect(vm.hero.explicitMustHaveCount).toBe(1);
    expect(vm.hero.inferredMustHaveCount).toBe(1);
  });
});
