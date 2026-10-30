import {
  CompleteCVAnalysisResponse,
  ReEvaluationComparison,
  ReEvaluationScoreDelta,
  ScoreDeltaItem,
} from '../types';

/**
 * Safely extracts a numeric score from analysis or default to 0
 */
function safeScore(val: any): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.round(Math.max(0, Math.min(100, val)));
  }
  return 0;
}

/**
 * Calculates delta between before and after score
 */
function makeDeltaItem(before: any, after: any): ScoreDeltaItem {
  const b = safeScore(before);
  const a = safeScore(after);
  return {
    before: b,
    after: a,
    delta: a - b,
  };
}

/**
 * Calculates all 4 scores delta for Re-evaluation
 */
export function calculateScoresDelta(
  beforeAnalysis: CompleteCVAnalysisResponse,
  afterAnalysis: CompleteCVAnalysisResponse
): ReEvaluationScoreDelta {
  const bScores = beforeAnalysis?.feature1?.scores;
  const aScores = afterAnalysis?.feature1?.scores;

  return {
    overallScore: makeDeltaItem(bScores?.overallRoleScore, aScores?.overallRoleScore),
    keywordScore: makeDeltaItem(bScores?.keywordMatchScore, aScores?.keywordMatchScore),
    skillScore: makeDeltaItem(bScores?.skillMatchScore, aScores?.skillMatchScore),
    experienceScore: makeDeltaItem(bScores?.experienceOutcomeScore, aScores?.experienceOutcomeScore),
  };
}

/**
 * Detects resolved red flags, remaining red flags, and new strengths between Before & After
 */
export function detectResolvedRedFlags(
  beforeAnalysis: CompleteCVAnalysisResponse,
  afterAnalysis: CompleteCVAnalysisResponse
): {
  resolvedRedFlags: string[];
  remainingRedFlags: string[];
  newStrengths: string[];
} {
  const beforeRedFlags: string[] = [];
  const afterRedFlags: string[] = [];

  // 1. Gather Before red flags / must fixes
  if (Array.isArray(beforeAnalysis?.feature3?.top3MustFix)) {
    beforeRedFlags.push(...beforeAnalysis.feature3.top3MustFix.filter(Boolean));
  }
  if (beforeAnalysis?.feature3?.biggestDoubt?.trim()) {
    beforeRedFlags.push(beforeAnalysis.feature3.biggestDoubt.trim());
  }

  // 2. Gather After red flags / must fixes
  if (Array.isArray(afterAnalysis?.feature3?.top3MustFix)) {
    afterRedFlags.push(...afterAnalysis.feature3.top3MustFix.filter(Boolean));
  }
  if (afterAnalysis?.feature3?.biggestDoubt?.trim()) {
    afterRedFlags.push(afterAnalysis.feature3.biggestDoubt.trim());
  }

  // 3. Gather Missing keywords that were filled
  const rawBeforeMissing = (beforeAnalysis?.feature1?.summary?.missingKeywordsSkills || []).filter(Boolean);
  const afterMissingLower = (afterAnalysis?.feature1?.summary?.missingKeywordsSkills || []).map((k) =>
    k.toLowerCase().trim()
  );

  const filledKeywords = rawBeforeMissing.filter(
    (k) => !afterMissingLower.includes(k.toLowerCase().trim())
  );

  // Determine resolved items
  const resolvedRedFlags: string[] = [];
  for (const bFlag of beforeRedFlags) {
    const isStillPresent = afterRedFlags.some(
      (aFlag) =>
        aFlag.toLowerCase().includes(bFlag.toLowerCase()) ||
        bFlag.toLowerCase().includes(aFlag.toLowerCase())
    );
    if (!isStillPresent) {
      resolvedRedFlags.push(bFlag);
    }
  }

  for (const filled of filledKeywords) {
    if (filled) {
      resolvedRedFlags.push(`Đã bổ sung từ khóa / kỹ năng: "${filled}"`);
    }
  }

  // Deduplicate
  const uniqueResolved = Array.from(new Set(resolvedRedFlags));
  const uniqueRemaining = Array.from(new Set(afterRedFlags));

  // 4. Identify new strengths gained
  const beforeStrengths = (beforeAnalysis?.feature1?.summary?.biggestStrength || '').toLowerCase();
  const afterStrengths = (afterAnalysis?.feature1?.summary?.biggestStrength || '').trim();
  const newStrengths: string[] = [];

  if (afterStrengths && !beforeStrengths.includes(afterStrengths.toLowerCase())) {
    newStrengths.push(afterStrengths);
  }

  // Also check if any comparisonTable item went from thieu/can_bo_sung to khop
  const beforeTable = beforeAnalysis?.feature1?.comparisonTable || [];
  const afterTable = afterAnalysis?.feature1?.comparisonTable || [];

  for (const aRow of afterTable) {
    if (aRow.matchStatus === 'khop') {
      const bRow = beforeTable.find(
        (r) => r.jdTerm?.toLowerCase() === aRow.jdTerm?.toLowerCase()
      );
      if (bRow && (bRow.matchStatus === 'thieu' || bRow.matchStatus === 'can_bo_sung')) {
        newStrengths.push(`Đáp ứng tiêu chí JD: "${aRow.jdTerm}" (${aRow.cvEvidence || 'Đã thể hiện'})`);
      }
    }
  }

  return {
    resolvedRedFlags: uniqueResolved,
    remainingRedFlags: uniqueRemaining,
    newStrengths: Array.from(new Set(newStrengths)),
  };
}

/**
 * Builds the comprehensive ReEvaluationComparison object
 */
export function buildReEvaluationComparison(
  beforeAnalysis: CompleteCVAnalysisResponse,
  afterAnalysis: CompleteCVAnalysisResponse
): ReEvaluationComparison {
  const scoresDelta = calculateScoresDelta(beforeAnalysis, afterAnalysis);
  const { resolvedRedFlags, remainingRedFlags, newStrengths } = detectResolvedRedFlags(
    beforeAnalysis,
    afterAnalysis
  );

  const delta = scoresDelta.overallScore.delta;
  const scoreIncreased = delta > 0;

  return {
    beforeAnalysis,
    afterAnalysis,
    scoresDelta,
    resolvedRedFlags,
    remainingRedFlags,
    newStrengths,
    scoreIncreased,
    overallImprovementPct: delta,
  };
}
