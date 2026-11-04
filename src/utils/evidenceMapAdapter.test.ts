import { describe, it, expect } from 'vitest';
import { buildEvidenceMapViewModel } from './evidenceMapAdapter';
import { CompleteCVAnalysisResponse } from '../types';

describe('Phase 2 Data Contract: evidenceMapAdapter', () => {
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

    // Hero và Groups phải khớp nhau từng số
    expect(vm.hero.mustHaveTotal).toBe(2);
    expect(vm.hero.mustHavePassed).toBe(1);
    expect(vm.hero.mustHaveGap).toBe(1);
    expect(vm.hero.mustHavePartial).toBe(0);

    // Tổng số lượng must-have trong groups phải bằng đúng 2
    let groupMustHaveGap = 0;
    for (const g of vm.groups) {
      groupMustHaveGap += g.mustHaveGapCount;
    }
    expect(groupMustHaveGap).toBe(vm.hero.mustHaveGap);
    expect(vm.totalCriteriaCount).toBe(3);
    expect(vm.hero.overallScore).toBe(78);
  });

  it('2. Prioritizes explicit isMustHave over inferred importance, and records inference source', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          // Explicitly false dù importance là Rất quan trọng
          { jdTerm: 'GraphQL', importance: 'Rất quan trọng', isMustHave: false, cvEvidence: '', gapOrClarification: '', matchStatus: 'thieu' },
          // Không có isMustHave nhưng importance là Rất quan trọng -> inferred
          { jdTerm: 'NodeJS', importance: 'Rất quan trọng', cvEvidence: 'Có NodeJS', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 60 },
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
        top3MustFix: [],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    expect(vm.hero.mustHaveTotal).toBe(1); // Chỉ có NodeJS được coi là Must-Have (inferred)
    expect(vm.hero.mustHavePassed).toBe(1);
    expect(vm.hero.mustHaveSource).toBe('inferred_importance');
  });

  it('3. When no Must-Have is identified (mustHaveTotal === 0), it does NOT assume 100% pass', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          { jdTerm: 'Figma', importance: 'Có lợi thế', isMustHave: false, cvEvidence: '', gapOrClarification: 'Không có', matchStatus: 'thieu' },
          { jdTerm: 'Canva', importance: 'Có lợi thế', isMustHave: false, cvEvidence: 'Dùng Canva cơ bản', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 55 },
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
        top3MustFix: [],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    expect(vm.hero.hasMustHaveData).toBe(false);
    expect(vm.hero.mustHaveTotal).toBe(0);
    expect(vm.hero.mustHavePassed).toBe(0);
    expect(vm.hero.verdictStatement).toContain('chưa xác định yêu cầu bắt buộc cụ thể trong JD');
    expect(vm.hero.verdictStatement).not.toContain('100%');
  });

  it('4. Classifies keywords without comparison rows as "Chưa được đối chiếu" (uncompared), never as missing evidence', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng' },
          { keyword: 'Kubernetes', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Quan trọng' },
        ],
        comparisonTable: [
          { jdTerm: 'React', importance: 'Rất quan trọng', cvEvidence: 'React expert', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 80, skillMatchScore: 80, experienceOutcomeScore: 80, overallRoleScore: 80 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
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
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    expect(vm.uncomparedKeywords.length).toBe(1);
    expect(vm.uncomparedKeywords[0].keyword).toBe('Kubernetes');
    // Tổng số gap trong bảng đối chiếu không bị tính oan Kubernetes
    expect(vm.totalGapCount).toBe(0);
  });

  it('5. Puts unmapped or unrecognized categories into "Chưa phân loại" (unclassified group)', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          // @ts-expect-error Testing exotic category
          { keyword: 'Blockchain Web3', category: 'Danh mục đặc thù khác', importance: 'Quan trọng' },
        ],
        comparisonTable: [
          { jdTerm: 'Blockchain Web3', importance: 'Quan trọng', cvEvidence: 'Solidity', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 70, skillMatchScore: 70, experienceOutcomeScore: 70, overallRoleScore: 70 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
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
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    const unclassGroup = vm.groups.find((g) => g.id === 'unclassified');
    expect(unclassGroup).toBeDefined();
    expect(unclassGroup?.total).toBe(1);
    expect(unclassGroup?.items[0].term).toBe('Blockchain Web3');
  });

  it('6. Deduplicates rows with identical terms (case-insensitive) keeping best evidence', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          { jdTerm: 'react', importance: 'Quan trọng', cvEvidence: '', gapOrClarification: 'chưa rõ', matchStatus: 'can_bo_sung' },
          { jdTerm: 'React', importance: 'Quan trọng', cvEvidence: 'Có 3 năm xây dựng SPA bằng React', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 80, skillMatchScore: 80, experienceOutcomeScore: 80, overallRoleScore: 80 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
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
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    expect(vm.totalCriteriaCount).toBe(1);
    const item = vm.groups.flatMap((g) => g.items).find((it) => it.term.toLowerCase() === 'react');
    expect(item?.cvEvidence).toBe('Có 3 năm xây dựng SPA bằng React');
  });

  it('7. Initial Open Group Priority selects group with highest Must-Have Gaps first', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          // tech: 1 match
          { jdTerm: 'React', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '3 năm', gapOrClarification: '', matchStatus: 'khop' },
          // tools: 1 gap (Must-Have missing)
          { jdTerm: 'AWS', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: 'Thiếu AWS', matchStatus: 'thieu' },
        ],
        scores: { keywordMatchScore: 60, skillMatchScore: 60, experienceOutcomeScore: 60, overallRoleScore: 65 },
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
        top3MustFix: [],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    // Group "tools" có 1 mustHaveGap, trong khi "tech" có 0 mustHaveGap
    expect(vm.initialOpenGroupId).toBe('tools');
  });

  it('8. Quick Win only contains targetItemId when there is a deterministic match', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          { keyword: 'GraphQL', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          { jdTerm: 'GraphQL', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: 'Thiếu', matchStatus: 'thieu' },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 50 },
        summary: {
          biggestStrength: '',
          missingKeywordsSkills: [],
          weakOrVagueSections: [],
          immediateActions: [],
        },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: {
        inviteDecision: 'MAYBE',
        decisionReason: '',
        firstImpression10s: '',
        immediateStrength: '',
        biggestDoubt: '',
        fastestPointLossSection: '',
        top3MustFix: [
          'Bổ sung kinh nghiệm làm việc với GraphQL', // Có chữ GraphQL -> map được
          'Cần viết hoa các danh từ riêng ở phần sở thích', // Chuỗi tự do không có term nào -> không có targetItemId
        ],
      },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    expect(vm.hero.quickWins.length).toBe(2);
    // Quick win 1 map được sang GraphQL
    expect(vm.hero.quickWins[0].targetItemId).toBeDefined();
    expect(vm.hero.quickWins[0].targetGroupId).toBe('tech');

    // Quick win 2 là text tự do -> targetItemId không được suy đoán bừa
    expect(vm.hero.quickWins[1].targetItemId).toBeUndefined();
  });
});
