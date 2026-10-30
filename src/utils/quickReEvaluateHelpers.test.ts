import { describe, it, expect } from 'vitest';
import {
  calculateScoresDelta,
  detectResolvedRedFlags,
  buildReEvaluationComparison,
} from './quickReEvaluateHelpers';
import { CompleteCVAnalysisResponse } from '../types';

describe('quickReEvaluateHelpers', () => {
  const mockBeforeAnalysis: CompleteCVAnalysisResponse = {
    feature1: {
      scores: {
        overallRoleScore: 65,
        keywordMatchScore: 60,
        skillMatchScore: 70,
        experienceOutcomeScore: 65,
      },
      summary: {
        biggestStrength: 'Nền tảng kỹ thuật tốt',
        missingKeywordsSkills: ['Kubernetes', 'CI/CD Pipeline'],
        weakOrVagueSections: [],
        immediateActions: [],
      },
      comparisonTable: [
        {
          jdTerm: 'CI/CD',
          importance: 'Rất quan trọng',
          matchStatus: 'thieu',
          cvEvidence: 'Chưa có',
          gapOrClarification: 'Bổ sung kinh nghiệm deploy',
        },
      ],
      jdKeywords: [],
    },
    feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
    feature3: {
      inviteDecision: 'MAYBE',
      decisionReason: 'Cần kiểm chứng thêm kinh nghiệm Cloud',
      firstImpression10s: 'Hơi thiếu số liệu định lượng',
      immediateStrength: 'Có kinh nghiệm làm React',
      biggestDoubt: 'Thiếu kinh nghiệm thực chiến với Kubernetes',
      fastestPointLossSection: 'Kinh nghiệm dự án gần nhất',
      top3MustFix: ['Bổ sung số liệu định lượng', 'Nêu rõ vai trò kiến trúc hệ thống'],
    },
  };

  const mockAfterAnalysis: CompleteCVAnalysisResponse = {
    feature1: {
      scores: {
        overallRoleScore: 82,
        keywordMatchScore: 80,
        skillMatchScore: 85,
        experienceOutcomeScore: 81,
      },
      summary: {
        biggestStrength: 'Nền tảng kỹ thuật tốt và có kinh nghiệm triển khai Cloud CI/CD xuất sắc',
        missingKeywordsSkills: [], // Resolved both Kubernetes and CI/CD!
        weakOrVagueSections: [],
        immediateActions: [],
      },
      comparisonTable: [
        {
          jdTerm: 'CI/CD',
          importance: 'Rất quan trọng',
          matchStatus: 'khop',
          cvEvidence: 'Thiết lập GitHub Actions CI/CD pipeline tự động hóa kiểm thử',
          gapOrClarification: 'Đạt chuẩn',
        },
      ],
      jdKeywords: [],
    },
    feature2: { clarifyingQuestions: [], rewrittenBullets: [] },
    feature3: {
      inviteDecision: 'YES',
      decisionReason: 'Hồ sơ nổi bật, số liệu rõ ràng và khớp JD',
      firstImpression10s: 'Ấn tượng tốt, định lượng rõ ràng',
      immediateStrength: 'Có kinh nghiệm Cloud và kiến trúc tốt',
      biggestDoubt: '',
      fastestPointLossSection: '',
      top3MustFix: [],
    },
  };

  it('1. calculateScoresDelta computes accurate deltas for all 4 scores', () => {
    const delta = calculateScoresDelta(mockBeforeAnalysis, mockAfterAnalysis);

    expect(delta.overallScore).toEqual({ before: 65, after: 82, delta: 17 });
    expect(delta.keywordScore).toEqual({ before: 60, after: 80, delta: 20 });
    expect(delta.skillScore).toEqual({ before: 70, after: 85, delta: 15 });
    expect(delta.experienceScore).toEqual({ before: 65, after: 81, delta: 16 });
  });

  it('2. detectResolvedRedFlags finds resolved flags and newly met JD criteria', () => {
    const { resolvedRedFlags, newStrengths } = detectResolvedRedFlags(
      mockBeforeAnalysis,
      mockAfterAnalysis
    );

    expect(resolvedRedFlags.length).toBeGreaterThan(0);
    // Kubernetes & CI/CD were filled
    expect(resolvedRedFlags.some((f) => f.includes('Kubernetes'))).toBe(true);
    expect(resolvedRedFlags.some((f) => f.includes('CI/CD'))).toBe(true);

    // New strength for CI/CD matching
    expect(newStrengths.some((s) => s.includes('CI/CD'))).toBe(true);
  });

  it('3. buildReEvaluationComparison constructs full comparison with scoreIncreased=true', () => {
    const comparison = buildReEvaluationComparison(mockBeforeAnalysis, mockAfterAnalysis);

    expect(comparison.scoreIncreased).toBe(true);
    expect(comparison.overallImprovementPct).toBe(17);
    expect(comparison.scoresDelta.overallScore.after).toBe(82);
    expect(comparison.resolvedRedFlags.length).toBeGreaterThan(0);
  });

  it('4. Handles undefined or missing properties without throw', () => {
    const emptyAnalysis: any = {};
    const delta = calculateScoresDelta(emptyAnalysis, emptyAnalysis);
    expect(delta.overallScore).toEqual({ before: 0, after: 0, delta: 0 });

    const comparison = buildReEvaluationComparison(emptyAnalysis, emptyAnalysis);
    expect(comparison.scoreIncreased).toBe(false);
    expect(comparison.overallImprovementPct).toBe(0);
  });
});
