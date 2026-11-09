import { describe, it, expect } from 'vitest';
import {
  buildEvidenceMapViewModel,
  computeAnalysisFingerprint,
  isExactWordOrPhraseMatch,
  deduplicateKeywords,
  mergeIsMustHave,
  shouldUnhideFilterForTarget,
  EvidenceItem,
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
    expect(vm.hero.mustHaveUnknown).toBe(0);
    expect(vm.hero.mustHaveUncompared).toBe(0);

    // Bất biến số học
    expect(
      vm.hero.mustHavePassed +
        vm.hero.mustHavePartial +
        vm.hero.mustHaveGap +
        vm.hero.mustHaveUnknown +
        vm.hero.mustHaveUncompared
    ).toBe(vm.hero.mustHaveTotal);

    let groupMustHaveGap = 0;
    for (const g of vm.groups) {
      groupMustHaveGap += g.mustHaveGapCount;
    }
    expect(groupMustHaveGap).toBe(vm.hero.mustHaveGap);
    expect(vm.totalCriteriaCount).toBe(3);
    expect(vm.hero.overallScore).toBe(78);
  });

  it('2. [REGRESSION POINT 1] MUST-HAVE WITH UNKNOWN STATUS IS KEPT IN TOTAL, NEVER CONCLUDES FULL MET', () => {
    // Exact reproduction case:
    // React: bắt buộc, khop
    // AWS: bắt buộc, invalid status -> unknown
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [
          { keyword: 'React', category: 'Kỹ năng chuyên môn', importance: 'Rất quan trọng', isMustHave: true },
          { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: true },
        ],
        comparisonTable: [
          { jdTerm: 'React', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '3 năm React', gapOrClarification: '', matchStatus: 'khop' },
          // @ts-expect-error test corrupted status
          { jdTerm: 'AWS', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: '', matchStatus: 'corrupted_state_error' },
        ],
        scores: { keywordMatchScore: 70, skillMatchScore: 70, experienceOutcomeScore: 70, overallRoleScore: 70 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'MAYBE', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');

    // Phải nhận diện ĐỦ 2 Must-Have trong total!
    expect(vm.hero.explicitMustHaveCount).toBe(2);
    expect(vm.hero.mustHaveTotal).toBe(2);
    expect(vm.hero.mustHavePassed).toBe(1);
    expect(vm.hero.mustHaveUnknown).toBe(1);
    expect(vm.hero.mustHavePartial).toBe(0);
    expect(vm.hero.mustHaveGap).toBe(0);
    expect(vm.hero.mustHaveUncompared).toBe(0);

    // Bất biến số học: passed + partial + gap + unknown + uncompared === mustHaveTotal
    expect(
      vm.hero.mustHavePassed +
        vm.hero.mustHavePartial +
        vm.hero.mustHaveGap +
        vm.hero.mustHaveUnknown +
        vm.hero.mustHaveUncompared
    ).toBe(vm.hero.mustHaveTotal);

    // KHÔNG ĐƯỢC kết luận "đáp ứng đầy đủ tất cả các yêu cầu cốt lõi"
    expect(vm.hero.verdictStatement).not.toContain('đáp ứng đầy đủ tất cả các yêu cầu cốt lõi');
    expect(vm.hero.verdictStatement).toContain('1/2 yêu cầu được xác định là bắt buộc');
    expect(vm.hero.verdictStatement).toContain('1 yêu cầu chưa xác định được trạng thái');
  });

  it('2b. [REGRESSION POINT 1] When all Must-Haves have unknown status, hasMustHaveData is still true with full count', () => {
    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: [],
        comparisonTable: [
          // @ts-expect-error test corrupted status
          { jdTerm: 'Security', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: '', matchStatus: 'corrupted_1' },
          // @ts-expect-error test corrupted status
          { jdTerm: 'Compliance', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '', gapOrClarification: '', matchStatus: 'corrupted_2' },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 50 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'NO', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    expect(vm.hero.hasMustHaveData).toBe(true);
    expect(vm.hero.mustHaveTotal).toBe(2);
    expect(vm.hero.mustHaveUnknown).toBe(2);
    expect(vm.hero.mustHavePassed).toBe(0);
  });

  it('3. [REGRESSION POINT 2] DEDUPLICATES UNCOMPARED KEYWORDS (AWS vs aws) PRESERVING MUST-HAVE FLAG', () => {
    // Exact reproduction case:
    // Keywords: React, AWS, aws (all marked mandatory)
    // comparisonTable: React (khop)
    const rawKeywords = [
      { keyword: 'React', category: 'Kỹ năng chuyên môn' as const, importance: 'Rất quan trọng' as const, isMustHave: true },
      { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp' as const, importance: 'Rất quan trọng' as const, isMustHave: true },
      { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp' as const, importance: 'Rất quan trọng' as const, isMustHave: true },
    ];

    // Kiểm tra trực tiếp hàm deduplicateKeywords
    const deduped = deduplicateKeywords(rawKeywords);
    expect(deduped.length).toBe(2);
    expect(deduped.some((k) => k.keyword.toLowerCase() === 'react')).toBe(true);
    expect(deduped.some((k) => k.keyword.toLowerCase() === 'aws')).toBe(true);

    const mockAnalysis: CompleteCVAnalysisResponse = {
      feature1: {
        jdKeywords: rawKeywords,
        comparisonTable: [
          { jdTerm: 'React', importance: 'Rất quan trọng', isMustHave: true, cvEvidence: '3y React', gapOrClarification: '', matchStatus: 'khop' },
        ],
        scores: { keywordMatchScore: 80, skillMatchScore: 80, experienceOutcomeScore: 80, overallRoleScore: 80 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'YES', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const vm = buildEvidenceMapViewModel(mockAnalysis, 'vi');
    // Tổng Must-Have phải là 2 (1 React + 1 AWS), KHÔNG ĐƯỢC bị đếm trùng thành 3!
    expect(vm.hero.mustHaveTotal).toBe(2);
    expect(vm.hero.mustHavePassed).toBe(1);
    expect(vm.hero.mustHaveUncompared).toBe(1);
    expect(vm.uncomparedKeywords.length).toBe(1);
    expect(vm.uncomparedKeywords[0].keyword.toLowerCase()).toBe('aws');
  });

  it('4. [REGRESSION POINT 3] FINGERPRINT CHANGES WHEN cvEvidence, category OR importance CHANGE', () => {
    const baseAnalysis: CompleteCVAnalysisResponse = {
      companyName: 'TechCorp',
      jobTitle: 'Senior Dev',
      feature1: {
        comparisonTable: [
          { jdTerm: 'NodeJS', importance: 'Quan trọng', matchStatus: 'khop', cvEvidence: '2 năm NodeJS', gapOrClarification: '' },
        ],
        jdKeywords: [
          { keyword: 'NodeJS', category: 'Kỹ năng chuyên môn', importance: 'Quan trọng' },
        ],
        scores: { keywordMatchScore: 80, skillMatchScore: 80, experienceOutcomeScore: 80, overallRoleScore: 80 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
      feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
      feature3: { inviteDecision: 'YES', decisionReason: '', firstImpression10s: '', immediateStrength: '', biggestDoubt: '', fastestPointLossSection: '', top3MustFix: [] },
    };

    const fpBase = computeAnalysisFingerprint(baseAnalysis);

    // Thay đổi cvEvidence
    const changedEvidence: CompleteCVAnalysisResponse = {
      ...baseAnalysis,
      feature1: {
        ...baseAnalysis.feature1,
        comparisonTable: [
          { ...baseAnalysis.feature1.comparisonTable[0], cvEvidence: '5 năm làm Tech Lead NodeJS kiến trúc Microservices' },
        ],
      },
    };
    expect(computeAnalysisFingerprint(changedEvidence)).not.toBe(fpBase);

    // Thay đổi importance
    const changedImportance: CompleteCVAnalysisResponse = {
      ...baseAnalysis,
      feature1: {
        ...baseAnalysis.feature1,
        comparisonTable: [
          { ...baseAnalysis.feature1.comparisonTable[0], importance: 'Rất quan trọng' },
        ],
      },
    };
    expect(computeAnalysisFingerprint(changedImportance)).not.toBe(fpBase);

    // Thay đổi category của keyword
    const changedCategory: CompleteCVAnalysisResponse = {
      ...baseAnalysis,
      feature1: {
        ...baseAnalysis.feature1,
        jdKeywords: [
          { keyword: 'NodeJS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Quan trọng' },
        ],
      },
    };
    expect(computeAnalysisFingerprint(changedCategory)).not.toBe(fpBase);
  });

  it('5. [REGRESSION POINT 4] shouldUnhideFilterForTarget only unhides filter when target is actually hidden', () => {
    const mustHaveItem: EvidenceItem = {
      id: 'item-1',
      term: 'React',
      category: 'Kỹ năng chuyên môn',
      importance: 'Rất quan trọng',
      isMustHave: true,
      mustHaveSource: 'explicit',
      cvEvidence: '',
      gapOrClarification: '',
      matchStatus: 'thieu',
    };

    const niceToHaveItem: EvidenceItem = {
      ...mustHaveItem,
      id: 'item-2',
      isMustHave: false,
      matchStatus: 'khop',
    };

    // Filter 'all' -> không cần unhide
    expect(shouldUnhideFilterForTarget('all', mustHaveItem)).toBe(false);

    // Filter 'must_have' và target item là Must-Have -> KHÔNG BỊ ẨN -> false
    expect(shouldUnhideFilterForTarget('must_have', mustHaveItem)).toBe(false);

    // Filter 'must_have' nhưng target item là Nice-to-Have -> BỊ ẨN -> true
    expect(shouldUnhideFilterForTarget('must_have', niceToHaveItem)).toBe(true);

    // Filter 'gap' và target item có matchStatus 'thieu' -> KHÔNG BỊ ẨN -> false
    expect(shouldUnhideFilterForTarget('gap', mustHaveItem)).toBe(false);

    // Filter 'gap' nhưng target item có matchStatus 'khop' -> BỊ ẨN -> true
    expect(shouldUnhideFilterForTarget('gap', niceToHaveItem)).toBe(true);
  });

  it('6. Word boundary matching prevents substring collisions (Java vs JavaScript, C vs C++)', () => {
    expect(isExactWordOrPhraseMatch('Java', 'Bổ sung kinh nghiệm JavaScript')).toBe(false);
    expect(isExactWordOrPhraseMatch('JavaScript', 'Bổ sung kinh nghiệm JavaScript')).toBe(true);
    expect(isExactWordOrPhraseMatch('Java', 'Cần làm rõ kỹ năng Java')).toBe(true);
    expect(isExactWordOrPhraseMatch('C', 'Thành thạo lập trình C++')).toBe(false);
    expect(isExactWordOrPhraseMatch('C++', 'Thành thạo lập trình C++')).toBe(true);
  });

  it('7. [REGRESSION TRI-STATE] mergeIsMustHave handles complete truth table and preserves symmetry', () => {
    // true với bất kỳ giá trị nào đều ra true
    expect(mergeIsMustHave(true, true)).toBe(true);
    expect(mergeIsMustHave(true, false)).toBe(true);
    expect(mergeIsMustHave(false, true)).toBe(true);
    expect(mergeIsMustHave(true, undefined)).toBe(true);
    expect(mergeIsMustHave(undefined, true)).toBe(true);

    // false kết hợp undefined -> false (explicit false được ưu tiên hơn undefined)
    expect(mergeIsMustHave(false, false)).toBe(false);
    expect(mergeIsMustHave(false, undefined)).toBe(false);
    expect(mergeIsMustHave(undefined, false)).toBe(false);

    // Cả hai đều undefined -> undefined (để adapter tiếp tục suy luận từ importance)
    expect(mergeIsMustHave(undefined, undefined)).toBe(undefined);
  });

  it('8. [REGRESSION TRI-STATE] deduplicateKeywords preserves undefined when both duplicates lack isMustHave', () => {
    // Tái hiện đúng ca: AWS và aws đều importance='Rất quan trọng', không có isMustHave
    const deduped = deduplicateKeywords([
      { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng' },
      { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng' },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].keyword).toBe('AWS');
    // KHÔNG được biến thành false, phải giữ undefined!
    expect(deduped[0].isMustHave).toBeUndefined();

    // Khi đưa vào buildEvidenceMapViewModel, AWS chưa đối chiếu phải suy luận ra Must-Have = true
    const vm = buildEvidenceMapViewModel({
      feature1: {
        jdKeywords: [
          { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng' },
          { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng' },
        ],
        comparisonTable: [],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 50 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
    } as unknown as CompleteCVAnalysisResponse);

    expect(vm.hero.mustHaveTotal).toBe(1);
    expect(vm.hero.mustHaveUncompared).toBe(1);
    expect(vm.uncomparedKeywords[0].isMustHave).toBe(true);
    expect(vm.uncomparedKeywords[0].mustHaveSource).toBe('inferred_importance');
  });

  it('9. [REGRESSION TRI-STATE] deduplicateKeywords preserves explicit false over undefined, and works with comparisonTable without explicit flag', () => {
    // 1. Explicit false + undefined -> false (bảo toàn explicit false, không suy luận importance)
    const dedupedFalse = deduplicateKeywords([
      { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: false },
      { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: undefined },
    ]);
    expect(dedupedFalse[0].isMustHave).toBe(false);

    // Đảo thứ tự: undefined + explicit false -> false
    const dedupedFalseRev = deduplicateKeywords([
      { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: undefined },
      { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng', isMustHave: false },
    ]);
    expect(dedupedFalseRev[0].isMustHave).toBe(false);

    // 2. Keyword có comparison row nhưng row không có cờ explicit:
    // row.isMustHave = undefined, jdKeywords có AWS và aws với isMustHave = undefined và importance = 'Rất quan trọng'
    const vmRow = buildEvidenceMapViewModel({
      feature1: {
        jdKeywords: [
          { keyword: 'AWS', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng' },
          { keyword: 'aws', category: 'Công cụ, phần mềm hoặc phương pháp', importance: 'Rất quan trọng' },
        ],
        comparisonTable: [
          {
            jdTerm: 'AWS',
            importance: 'Rất quan trọng',
            cvEvidence: '2 năm AWS EC2 S3',
            gapOrClarification: '',
            matchStatus: 'khop',
          },
        ],
        scores: { keywordMatchScore: 50, skillMatchScore: 50, experienceOutcomeScore: 50, overallRoleScore: 50 },
        summary: { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] },
      },
    } as unknown as CompleteCVAnalysisResponse);

    const items = vmRow.groups.flatMap((g) => g.items);
    expect(items).toHaveLength(1);
    const awsItem = items[0];
    expect(awsItem.isMustHave).toBe(true);
    expect(awsItem.mustHaveSource).toBe('inferred_importance');
    expect(vmRow.hero.mustHaveTotal).toBe(1);
    expect(vmRow.hero.mustHavePassed).toBe(1);
    expect(vmRow.hero.mustHaveUncompared).toBe(0);
  });
});
