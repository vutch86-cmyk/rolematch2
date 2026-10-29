import type {
  JDKeyword,
  ComparisonRow,
  CompatibilityScores,
  ImportanceLevel,
} from '../types';

export type LanguageCode = 'vi' | 'en';

export interface MustHaveStats {
  totalMustHave: number;
  matchedMustHave: number;
  needsWorkMustHave: number;
  missingMustHave: number;
  totalNiceToHave: number;
  matchedNiceToHave: number;
  mustHavePassRate: number;
}

/**
 * Determines whether a keyword or comparison row is a Must-Have (Knock-out) requirement.
 * Falls back to inferring from importance level for legacy history records.
 */
export function resolveIsMustHave(
  explicitIsMustHave?: boolean,
  importance?: ImportanceLevel | string
): boolean {
  if (typeof explicitIsMustHave === 'boolean') {
    return explicitIsMustHave;
  }
  const normalized = (importance || '').trim().toLowerCase();
  return (
    normalized === 'rất quan trọng' ||
    normalized === 'high priority' ||
    normalized === 'very important' ||
    normalized === 'must-have' ||
    normalized === 'must have' ||
    normalized === 'bắt buộc'
  );
}

/**
 * Computes a realistic projected overall score after CV optimization if not explicitly provided by AI.
 */
export function resolveProjectedOverallScore(
  scores: CompatibilityScores,
  comparisonTable: ComparisonRow[] = []
): number {
  const currentOverall = Math.max(0, Math.min(100, Math.round(scores?.overallRoleScore || 0)));

  if (
    typeof scores?.projectedOverallScore === 'number' &&
    Number.isFinite(scores.projectedOverallScore) &&
    scores.projectedOverallScore >= currentOverall
  ) {
    return Math.min(98, Math.max(currentOverall, Math.round(scores.projectedOverallScore)));
  }

  // Fallback calculation for legacy records:
  // Needs-work items are easiest to recover through phrasing; missing items recover partially if candidate has latent experience
  const needsWorkCount = comparisonTable.filter((r) => r.matchStatus === 'can_bo_sung').length;
  const missingCount = comparisonTable.filter((r) => r.matchStatus === 'thieu').length;
  const totalRows = Math.max(1, comparisonTable.length);

  const recoverableRatio = (needsWorkCount * 0.85 + missingCount * 0.45) / totalRows;
  const rawGain = Math.round((100 - currentOverall) * Math.min(0.65, Math.max(0.25, recoverableRatio)));
  const boundedGain = currentOverall >= 92 ? Math.min(4, 98 - currentOverall) : Math.max(6, Math.min(22, rawGain));

  return Math.min(98, currentOverall + boundedGain);
}

/**
 * Enriches CompatibilityScores with clear, human-readable rationales and projected score,
 * ensuring 100% backward compatibility for saved history items.
 */
export function enrichCompatibilityScores(
  scores: CompatibilityScores,
  comparisonTable: ComparisonRow[] = [],
  lang: LanguageCode = 'vi'
): Required<CompatibilityScores> {
  const kwScore = Math.round(scores?.keywordMatchScore || 0);
  const skScore = Math.round(scores?.skillMatchScore || 0);
  const expScore = Math.round(scores?.experienceOutcomeScore || 0);
  const overallScore = Math.round(scores?.overallRoleScore || 0);
  const projectedOverallScore = resolveProjectedOverallScore(scores, comparisonTable);

  const matchedCount = comparisonTable.filter((r) => r.matchStatus === 'khop').length;
  const needsWorkCount = comparisonTable.filter((r) => r.matchStatus === 'can_bo_sung').length;
  const missingCount = comparisonTable.filter((r) => r.matchStatus === 'thieu').length;

  const isVi = lang === 'vi';

  const defaultKeywordRationale = isVi
    ? comparisonTable.length > 0
      ? `CV đã khớp rõ ${matchedCount}/${comparisonTable.length} cụm từ khóa cốt lõi từ JD, còn ${needsWorkCount} cụm cần làm rõ ngữ cảnh và ${missingCount} cụm từ khóa quan trọng chưa xuất hiện.`
      : `Mức độ bao phủ thuật ngữ chuyên môn đạt ${kwScore}%; cần lồng ghép thêm từ khóa chuẩn ATS từ JD.`
    : comparisonTable.length > 0
      ? `CV clearly matches ${matchedCount}/${comparisonTable.length} core JD terms, with ${needsWorkCount} terms needing stronger context and ${missingCount} key terms missing.`
      : `Keyword coverage is at ${kwScore}%; integrate exact ATS terms from the JD to improve screening pass rate.`;

  const defaultSkillRationale = isVi
    ? skScore >= 80
      ? `Bộ kỹ năng chuyên môn và công cụ trong CV đáp ứng tốt yêu cầu cốt lõi (${skScore}%), chỉ cần bổ sung dẫn chứng thực thi ở các công cụ nâng cao.`
      : `Đạt ${skScore}% do một số kỹ năng/công cụ trọng tâm trong JD mới chỉ liệt kê tên hoặc chưa thể hiện rõ trong phần dự án thực tế.`
    : skScore >= 80
      ? `Core technical skills and tools align strongly with JD expectations (${skScore}%); minor tool context additions will further strengthen fit.`
      : `Scored ${skScore}% because several key skills/tools in the JD are either only listed without project proof or missing.`;

  const defaultExperienceRationale = isVi
    ? expScore >= 80
      ? `Kinh nghiệm thực chiến và kết quả đầu ra sát với kỳ vọng vai trò (${expScore}%); có thể tối ưu thêm bằng các chỉ số định lượng (%, KPI, SLA, quy mô).`
      : `Đạt ${expScore}% chủ yếu do các dòng mô tả kinh nghiệm còn thiên về liệt kê nhiệm vụ, thiếu số liệu đo lường kết quả (KPI, %, quy mô hệ thống/dự án).`
    : expScore >= 80
      ? `Hands-on experience and deliverables align well (${expScore}%); adding sharper KPI/ROI metrics will maximize impact.`
      : `Scored ${expScore}% mainly because work history bullets describe duties rather than quantified outcomes (%, KPI, project scale).`;

  const gain = Math.max(0, projectedOverallScore - overallScore);
  const defaultOverallRationale = isVi
    ? `Điểm tổng thể hiện tại đạt ${overallScore}%. Nếu bổ sung dẫn chứng cho ${needsWorkCount + missingCount} tiêu chí đang thiếu/mơ hồ và chuẩn hóa số liệu kết quả, điểm phù hợp có thể tăng lên ~${projectedOverallScore}% (+${gain}%).`
    : `Current overall fit is ${overallScore}%. By addressing the ${needsWorkCount + missingCount} partial/missing requirements and quantifying project outcomes, your score can reach ~${projectedOverallScore}% (+${gain}%).`;

  return {
    keywordMatchScore: kwScore,
    skillMatchScore: skScore,
    experienceOutcomeScore: expScore,
    overallRoleScore: overallScore,
    projectedOverallScore,
    keywordRationale: scores?.keywordRationale?.trim() || defaultKeywordRationale,
    skillRationale: scores?.skillRationale?.trim() || defaultSkillRationale,
    experienceRationale: scores?.experienceRationale?.trim() || defaultExperienceRationale,
    overallRationale: scores?.overallRationale?.trim() || defaultOverallRationale,
  };
}

/**
 * Infers a practical target CV section for inserting a missing or partial JD requirement.
 */
export function inferTargetSection(
  row: ComparisonRow,
  jdKeywords: JDKeyword[] = [],
  lang: LanguageCode = 'vi'
): string {
  if (row.targetSection && row.targetSection.trim()) {
    return row.targetSection.trim();
  }

  const matchedKw = jdKeywords.find(
    (k) => (k.keyword || '').trim().toLowerCase() === (row.jdTerm || '').trim().toLowerCase()
  );
  const category = (matchedKw?.category || '').toLowerCase();
  const term = (row.jdTerm || '').toLowerCase();
  const isVi = lang === 'vi';

  if (
    category.includes('công cụ') ||
    category.includes('tool') ||
    category.includes('kỹ năng') ||
    category.includes('skill')
  ) {
    return isVi
      ? 'Mục Kỹ năng chuyên môn & Kinh nghiệm dự án gần nhất'
      : 'Technical Skills & Recent Work Experience';
  }

  if (
    category.includes('kết quả') ||
    category.includes('outcome') ||
    category.includes('kinh nghiệm') ||
    category.includes('experience')
  ) {
    return isVi
      ? 'Mục Kinh nghiệm làm việc (2 công ty gần nhất)'
      : 'Work Experience (Top 2 Recent Roles)';
  }

  if (category.includes('phẩm chất') || category.includes('style') || term.includes('leader')) {
    return isVi
      ? 'Mục Tóm tắt mở đầu (Executive Summary) & Kinh nghiệm quản lý'
      : 'Executive Summary & Leadership Experience';
  }

  return isVi
    ? 'Mục Tóm tắt mở đầu & Kinh nghiệm làm việc liên quan'
    : 'Executive Summary & Relevant Work Experience';
}

/**
 * Generates a contextual suggested CV snippet when AI did not explicitly populate suggestedPhrasing
 * (e.g. for legacy history records).
 */
export function inferSuggestedPhrasing(
  row: ComparisonRow,
  lang: LanguageCode = 'vi'
): string {
  if (row.suggestedPhrasing && row.suggestedPhrasing.trim()) {
    return row.suggestedPhrasing.trim();
  }

  if (row.matchStatus === 'khop') {
    return '';
  }

  const term = row.jdTerm || (lang === 'vi' ? 'kỹ năng này' : 'this competency');
  if (lang === 'vi') {
    if (row.matchStatus === 'can_bo_sung') {
      return `Trực tiếp triển khai và tối ưu hóa ${term} trong vận hành dự án thực tế, giúp nâng cao [X]% hiệu suất và đảm bảo tuân thủ SLA/KPI đề ra.`;
    }
    return `Ứng dụng ${term} kết hợp cùng quy trình chuẩn để giải quyết bài toán [Tên dự án/nghiệp vụ], đạt kết quả [Số liệu/KPI cụ thể].`;
  }

  if (row.matchStatus === 'can_bo_sung') {
    return `Spearheaded the implementation and optimization of ${term} across key projects, improving operational efficiency by [X]% and meeting strict SLA/KPI targets.`;
  }
  return `Applied ${term} within [Project/Team Context] to streamline workflows and deliver [Quantifiable Metric / Outcome].`;
}

/**
 * Normalizes JDKeywords and ComparisonRows so every item has `isMustHave`, `targetSection`, and `suggestedPhrasing`.
 */
export function normalizeFeature1Data(
  jdKeywords: JDKeyword[] = [],
  comparisonTable: ComparisonRow[] = [],
  scores: CompatibilityScores,
  lang: LanguageCode = 'vi'
): {
  normalizedKeywords: JDKeyword[];
  normalizedComparisonTable: ComparisonRow[];
  enrichedScores: Required<CompatibilityScores>;
  mustHaveStats: MustHaveStats;
} {
  const normalizedKeywords: JDKeyword[] = (jdKeywords || []).map((kw) => ({
    ...kw,
    isMustHave: resolveIsMustHave(kw.isMustHave, kw.importance),
  }));

  const normalizedComparisonTable: ComparisonRow[] = (comparisonTable || []).map((row) => {
    const matchedKw = normalizedKeywords.find(
      (k) => (k.keyword || '').trim().toLowerCase() === (row.jdTerm || '').trim().toLowerCase()
    );
    const isMustHave = resolveIsMustHave(
      row.isMustHave ?? matchedKw?.isMustHave,
      row.importance
    );
    return {
      ...row,
      isMustHave,
      targetSection: inferTargetSection(row, normalizedKeywords, lang),
      suggestedPhrasing: inferSuggestedPhrasing(row, lang),
    };
  });

  const enrichedScores = enrichCompatibilityScores(scores, normalizedComparisonTable, lang);

  const mustHaveRows = normalizedComparisonTable.filter((r) => r.isMustHave);
  const niceToHaveRows = normalizedComparisonTable.filter((r) => !r.isMustHave);

  const totalMustHave = mustHaveRows.length;
  const matchedMustHave = mustHaveRows.filter((r) => r.matchStatus === 'khop').length;
  const needsWorkMustHave = mustHaveRows.filter((r) => r.matchStatus === 'can_bo_sung').length;
  const missingMustHave = mustHaveRows.filter((r) => r.matchStatus === 'thieu').length;

  const totalNiceToHave = niceToHaveRows.length;
  const matchedNiceToHave = niceToHaveRows.filter((r) => r.matchStatus === 'khop').length;

  const mustHavePassRate =
    totalMustHave > 0 ? Math.round((matchedMustHave / totalMustHave) * 100) : 100;

  return {
    normalizedKeywords,
    normalizedComparisonTable,
    enrichedScores,
    mustHaveStats: {
      totalMustHave,
      matchedMustHave,
      needsWorkMustHave,
      missingMustHave,
      totalNiceToHave,
      matchedNiceToHave,
      mustHavePassRate,
    },
  };
}
