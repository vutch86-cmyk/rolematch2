import { PipelineStage } from '../types';

export interface PipelineStageConfig {
  stage: PipelineStage;
  labelVi: string;
  labelEn: string;
  colorClass: string;
  bgLightClass: string;
  badgeClass: string;
  borderClass: string;
}

export const PIPELINE_STAGES: Record<PipelineStageConfig['stage'], PipelineStageConfig> = {
  INBOX: {
    stage: 'INBOX',
    labelVi: 'Mới nạp',
    labelEn: 'Inbox',
    colorClass: 'text-slate-700',
    bgLightClass: 'bg-slate-50',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    borderClass: 'border-slate-300'
  },
  SHORTLIST: {
    stage: 'SHORTLIST',
    labelVi: 'Duyệt vòng sơ tuyển',
    labelEn: 'Shortlisted',
    colorClass: 'text-blue-700',
    bgLightClass: 'bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300',
    borderClass: 'border-blue-400'
  },
  INTERVIEW: {
    stage: 'INTERVIEW',
    labelVi: 'Mời phỏng vấn',
    labelEn: 'Interviewing',
    colorClass: 'text-amber-700',
    bgLightClass: 'bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    borderClass: 'border-amber-400'
  },
  OFFER: {
    stage: 'OFFER',
    labelVi: 'Đề nghị tuyển dụng (Offer)',
    labelEn: 'Offer Extended',
    colorClass: 'text-emerald-700',
    bgLightClass: 'bg-emerald-50',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    borderClass: 'border-emerald-500'
  },
  REJECTED: {
    stage: 'REJECTED',
    labelVi: 'Không phù hợp (Từ chối)',
    labelEn: 'Rejected',
    colorClass: 'text-rose-700',
    bgLightClass: 'bg-rose-50',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    borderClass: 'border-rose-300'
  }
};

export const ORDERED_PIPELINE_STAGES: PipelineStage[] = [
  'INBOX',
  'SHORTLIST',
  'INTERVIEW',
  'OFFER',
  'REJECTED'
];

export const PRESET_CANDIDATE_TAGS = [
  'Top Candidate',
  'Culture Fit',
  'Tech Lead',
  'High Salary Expectation',
  'Urgent Hire',
  'Need Tech Test'
];

export interface PipelineStageCounts {
  ALL: number;
  INBOX: number;
  SHORTLIST: number;
  INTERVIEW: number;
  OFFER: number;
  REJECTED: number;
}

/**
 * Aggregates count of candidates in each stage.
 * Default stage for candidates without an explicit stage is INBOX.
 */
export const getPipelineStageStats = <T extends { pipelineStage?: PipelineStage; }>(
  candidates: T[]
): PipelineStageCounts => {
  const counts: PipelineStageCounts = {
    ALL: candidates.length,
    INBOX: 0,
    SHORTLIST: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0
  };

  candidates.forEach((cand) => {
    const stage = cand.pipelineStage || 'INBOX';
    if (stage in counts) {
      counts[stage]++;
    } else {
      counts.INBOX++;
    }
  });

  return counts;
};

/**
 * Filters candidates by stage. If stage is 'ALL', returns all candidates.
 */
export const filterCandidatesByStage = <T extends { pipelineStage?: PipelineStage; }>(
  candidates: T[],
  stage: PipelineStage | 'ALL'
): T[] => {
  if (stage === 'ALL') return candidates;
  return candidates.filter((cand) => (cand.pipelineStage || 'INBOX') === stage);
};

/**
 * Updates a candidate's pipeline stage immutably.
 */
export const updateCandidateStage = <T extends { id?: string; filename: string; pipelineStage?: PipelineStage; }>(
  candidates: T[],
  idOrFilename: string,
  newStage: PipelineStage
): T[] => {
  return candidates.map((cand) => {
    if (cand.id === idOrFilename || cand.filename === idOrFilename) {
      return {
        ...cand,
        pipelineStage: newStage
      } as T;
    }
    return cand;
  });
};

/**
 * Updates a candidate's internal recruiter notes immutably.
 */
export const updateCandidateNotes = <T extends { id?: string; filename: string; notes?: string; }>(
  candidates: T[],
  idOrFilename: string,
  notes: string
): T[] => {
  return candidates.map((cand) => {
    if (cand.id === idOrFilename || cand.filename === idOrFilename) {
      return {
        ...cand,
        notes
      } as T;
    }
    return cand;
  });
};

/**
 * Updates a candidate's recruiter rating (1 to 5 stars) immutably.
 */
export const updateCandidateRating = <T extends { id?: string; filename: string; rating?: number; }>(
  candidates: T[],
  idOrFilename: string,
  rating: number
): T[] => {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return candidates.map((cand) => {
    if (cand.id === idOrFilename || cand.filename === idOrFilename) {
      return {
        ...cand,
        rating: clamped
      } as T;
    }
    return cand;
  });
};

/**
 * Toggles a candidate tag immutably.
 */
export const toggleCandidateTag = <T extends { id?: string; filename: string; tags?: string[]; }>(
  candidates: T[],
  idOrFilename: string,
  tag: string
): T[] => {
  const cleanTag = tag.trim();
  if (!cleanTag) return candidates;

  return candidates.map((cand) => {
    if (cand.id === idOrFilename || cand.filename === idOrFilename) {
      const currentTags = Array.isArray(cand.tags) ? cand.tags : [];
      const hasTag = currentTags.includes(cleanTag);
      const newTags = hasTag
        ? currentTags.filter((t) => t !== cleanTag)
        : [...currentTags, cleanTag];

      return {
        ...cand,
        tags: newTags
      } as T;
    }
    return cand;
  });
};
