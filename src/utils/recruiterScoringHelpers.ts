import { ScoringWeights, KnockoutCriteria } from '../types';

export type ScoringPresetKey = 'balanced' | 'experience' | 'skills' | 'custom';

export interface ScoringPreset {
  key: ScoringPresetKey;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  weights: ScoringWeights;
}

export const SCORING_PRESETS: Record<ScoringPresetKey, ScoringPreset> = {
  balanced: {
    key: 'balanced',
    nameVi: 'Cân bằng chuẩn (33/34/33)',
    nameEn: 'Balanced Standard (33/34/33)',
    descriptionVi: 'Phân bổ đều giữa Từ khóa, Kỹ năng và Kinh nghiệm thực chiến.',
    descriptionEn: 'Evenly distributes weights across Keywords, Skills, and Experience.',
    weights: { keywordWeight: 33, skillWeight: 34, experienceWeight: 33 }
  },
  experience: {
    key: 'experience',
    nameVi: 'Ưu tiên Kinh nghiệm & Tác động (20/30/50)',
    nameEn: 'Experience & Impact Focused (20/30/50)',
    descriptionVi: 'Đặc biệt coi trọng thâm niên, quy mô dự án và kết quả thực tế.',
    descriptionEn: 'Heavily emphasizes proven track record, scope, and business outcomes.',
    weights: { keywordWeight: 20, skillWeight: 30, experienceWeight: 50 }
  },
  skills: {
    key: 'skills',
    nameVi: 'Ưu tiên Năng lực Kỹ thuật (20/50/30)',
    nameEn: 'Deep Technical Skills Focused (20/50/30)',
    descriptionVi: 'Đánh giá cao chuyên môn sâu, công nghệ chuyên biệt và kiến thức nền tảng.',
    descriptionEn: 'Prioritizes hard tech skills, deep stacks, and specialized expertise.',
    weights: { keywordWeight: 20, skillWeight: 50, experienceWeight: 30 }
  },
  custom: {
    key: 'custom',
    nameVi: 'Tùy chỉnh linh hoạt',
    nameEn: 'Custom Allocation',
    descriptionVi: 'Tự do phân bổ tỷ trọng phần trăm theo đặc thù từng vị trí.',
    descriptionEn: 'Freely adjust percentage weights to match specific role needs.',
    weights: { keywordWeight: 33, skillWeight: 34, experienceWeight: 33 }
  }
};

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = SCORING_PRESETS.balanced.weights;

export const DEFAULT_KNOCKOUT_CRITERIA: KnockoutCriteria = {
  minSkillScore: null,
  minExperienceScore: null,
  minOverallScore: null,
  requireMustHaveSkills: false
};

/**
 * Calculates weighted score from keyword, skill, and experience scores.
 * Falls back to overallScore or arithmetic average if one or more sub-scores are missing.
 */
export const calculateWeightedScore = (
  candidate: {
    keywordScore: number | null;
    skillScore: number | null;
    experienceScore: number | null;
    overallScore?: number | null;
  },
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number | null => {
  const kw = candidate.keywordScore;
  const sk = candidate.skillScore;
  const exp = candidate.experienceScore;

  const validKw = typeof kw === 'number' && Number.isFinite(kw);
  const validSk = typeof sk === 'number' && Number.isFinite(sk);
  const validExp = typeof exp === 'number' && Number.isFinite(exp);

  if (!validKw && !validSk && !validExp) {
    if (typeof candidate.overallScore === 'number' && Number.isFinite(candidate.overallScore)) {
      return Math.round(candidate.overallScore);
    }
    return null;
  }

  const wKw = Math.max(0, weights.keywordWeight || 0);
  const wSk = Math.max(0, weights.skillWeight || 0);
  const wExp = Math.max(0, weights.experienceWeight || 0);

  let totalWeight = 0;
  let weightedSum = 0;

  if (validKw) {
    weightedSum += (kw as number) * wKw;
    totalWeight += wKw;
  }
  if (validSk) {
    weightedSum += (sk as number) * wSk;
    totalWeight += wSk;
  }
  if (validExp) {
    weightedSum += (exp as number) * wExp;
    totalWeight += wExp;
  }

  if (totalWeight <= 0) {
    if (typeof candidate.overallScore === 'number' && Number.isFinite(candidate.overallScore)) {
      return Math.round(candidate.overallScore);
    }
    return null;
  }

  const rawScore = weightedSum / totalWeight;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
};

/**
 * Evaluates knockout criteria against a candidate.
 * Returns whether candidate is disqualified and the primary violation reason.
 */
export const checkKnockout = (
  candidate: {
    keywordScore: number | null;
    skillScore: number | null;
    experienceScore: number | null;
    overallScore: number | null;
    weightedScore?: number | null;
    keyGaps?: string[];
    fullAnalysis?: any;
  },
  criteria: KnockoutCriteria = DEFAULT_KNOCKOUT_CRITERIA,
  lang: 'vi' | 'en' = 'vi'
): { isKnockedOut: boolean; reason?: string } => {
  const isEn = lang === 'en';

  // 1. Min Overall Score Threshold
  if (typeof criteria.minOverallScore === 'number' && criteria.minOverallScore > 0) {
    const scoreToCheck = candidate.weightedScore ?? candidate.overallScore;
    if (typeof scoreToCheck === 'number' && scoreToCheck < criteria.minOverallScore) {
      return {
        isKnockedOut: true,
        reason: isEn
          ? `Overall score (${scoreToCheck}) is below required minimum threshold (${criteria.minOverallScore})`
          : `Điểm tổng thể (${scoreToCheck}) dưới ngưỡng tối thiểu yêu cầu (${criteria.minOverallScore})`
      };
    }
  }

  // 2. Min Skill Score Threshold
  if (typeof criteria.minSkillScore === 'number' && criteria.minSkillScore > 0) {
    if (typeof candidate.skillScore === 'number' && candidate.skillScore < criteria.minSkillScore) {
      return {
        isKnockedOut: true,
        reason: isEn
          ? `Skill score (${candidate.skillScore}) is below minimum threshold (${criteria.minSkillScore})`
          : `Điểm kỹ năng (${candidate.skillScore}) dưới ngưỡng tối thiểu (${criteria.minSkillScore})`
      };
    }
  }

  // 3. Min Experience Score Threshold
  if (typeof criteria.minExperienceScore === 'number' && criteria.minExperienceScore > 0) {
    if (typeof candidate.experienceScore === 'number' && candidate.experienceScore < criteria.minExperienceScore) {
      return {
        isKnockedOut: true,
        reason: isEn
          ? `Experience score (${candidate.experienceScore}) is below minimum threshold (${criteria.minExperienceScore})`
          : `Điểm kinh nghiệm (${candidate.experienceScore}) dưới ngưỡng tối thiểu (${criteria.minExperienceScore})`
      };
    }
  }

  // 4. Require Must-Have Skills
  if (criteria.requireMustHaveSkills) {
    const comparisonTable = candidate.fullAnalysis?.feature1?.comparisonTable;
    if (Array.isArray(comparisonTable)) {
      const missingMustHaves = comparisonTable.filter(
        (row: any) => (row.type === 'Must-Have' || row.isMustHave === true) && (row.matchStatus === 'THIEU' || row.matchStatus === 'CAN_BO_SUNG')
      );
      if (missingMustHaves.length > 0) {
        const missingSkillNames = missingMustHaves.map((m: any) => m.skillOrRequirement).slice(0, 2).join(', ');
        return {
          isKnockedOut: true,
          reason: isEn
            ? `Missing core must-have requirement(s): ${missingSkillNames}`
            : `Thiếu tiêu chí bắt buộc cốt lõi (Must-Have): ${missingSkillNames}`
        };
      }
    }
  }

  return { isKnockedOut: false };
};

/**
 * Re-ranks candidates dynamically based on custom scoring weights and knockout criteria.
 * Knocked-out candidates are placed after qualified candidates, with clear reasons.
 */
export const recalculateLeaderboard = <T extends {
  candidateName: string;
  filename: string;
  overallScore: number | null;
  keywordScore: number | null;
  skillScore: number | null;
  experienceScore: number | null;
  success?: boolean;
  keyGaps?: string[];
  fullAnalysis?: any;
  [key: string]: any;
}>(
  candidates: T[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  criteria: KnockoutCriteria = DEFAULT_KNOCKOUT_CRITERIA,
  lang: 'vi' | 'en' = 'vi'
): (T & {
  weightedScore: number | null;
  isKnockedOut: boolean;
  knockoutReason?: string;
  dynamicRank: number | null;
})[] => {
  const evaluated = candidates.map((cand) => {
    const weightedScore = calculateWeightedScore(cand, weights);
    const koResult = checkKnockout(
      {
        ...cand,
        weightedScore
      },
      criteria,
      lang
    );

    return {
      ...cand,
      weightedScore,
      isKnockedOut: koResult.isKnockedOut,
      knockoutReason: koResult.reason,
      dynamicRank: null as number | null
    };
  });

  // Sort logic:
  // 1. Qualified (non-knockout) with scores, sorted by weightedScore DESC
  // 2. Knocked-out with scores, sorted by weightedScore DESC
  // 3. Failed or no-score candidates
  evaluated.sort((a, b) => {
    const aValid = a.success !== false && typeof a.weightedScore === 'number';
    const bValid = b.success !== false && typeof b.weightedScore === 'number';

    if (aValid && bValid) {
      // Prioritize non-knockout over knockout
      if (!a.isKnockedOut && b.isKnockedOut) return -1;
      if (a.isKnockedOut && !b.isKnockedOut) return 1;

      // Score diff
      const scoreDiff = (b.weightedScore as number) - (a.weightedScore as number);
      if (scoreDiff !== 0) return scoreDiff;

      // Fallback: compare name then filename
      const nameDiff = (a.candidateName || '').localeCompare(b.candidateName || '');
      if (nameDiff !== 0) return nameDiff;
      return (a.filename || '').localeCompare(b.filename || '');
    }

    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;
    return 0;
  });

  // Assign ranks: non-knockout candidates get ranks 1..N, knocked out can also have secondary rank or null
  let rankCounter = 1;
  evaluated.forEach((item) => {
    if (item.success !== false && typeof item.weightedScore === 'number' && !item.isKnockedOut) {
      item.dynamicRank = rankCounter++;
    } else if (item.isKnockedOut && typeof item.weightedScore === 'number') {
      item.dynamicRank = null; // KO candidates do not occupy top leaderboard ranks
    } else {
      item.dynamicRank = null;
    }
  });

  return evaluated;
};
