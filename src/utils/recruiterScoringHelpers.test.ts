import { describe, it, expect } from 'vitest';
import {
  calculateWeightedScore,
  checkKnockout,
  recalculateLeaderboard,
  SCORING_PRESETS,
  DEFAULT_SCORING_WEIGHTS
} from './recruiterScoringHelpers';

describe('Recruiter Scoring & Knockout Helpers', () => {
  const sampleCandidateA = {
    candidateName: 'Nguyen Van A',
    filename: 'NguyenVanA.pdf',
    keywordScore: 90,
    skillScore: 80,
    experienceScore: 70,
    overallScore: 80,
    success: true,
    fullAnalysis: {
      feature1: {
        comparisonTable: [
          { skillOrRequirement: 'React', type: 'Must-Have', matchStatus: 'KHOP' },
          { skillOrRequirement: 'Node.js', type: 'Must-Have', matchStatus: 'KHOP' }
        ]
      }
    }
  };

  const sampleCandidateB = {
    candidateName: 'Tran Thi B',
    filename: 'TranThiB.pdf',
    keywordScore: 60,
    skillScore: 95,
    experienceScore: 90,
    overallScore: 82,
    success: true,
    fullAnalysis: {
      feature1: {
        comparisonTable: [
          { skillOrRequirement: 'AWS Architecture', type: 'Must-Have', matchStatus: 'THIEU' }
        ]
      }
    }
  };

  const sampleCandidateC = {
    candidateName: 'Le Van C',
    filename: 'LeVanC.pdf',
    keywordScore: 40,
    skillScore: 45,
    experienceScore: 40,
    overallScore: 42,
    success: true
  };

  describe('calculateWeightedScore', () => {
    it('calculates balanced score correctly (33/34/33)', () => {
      const score = calculateWeightedScore(sampleCandidateA, DEFAULT_SCORING_WEIGHTS);
      // (90 * 33 + 80 * 34 + 70 * 33) / 100 = (2970 + 2720 + 2310) / 100 = 8000 / 100 = 80
      expect(score).toBe(80);
    });

    it('calculates experience-heavy score correctly (20/30/50)', () => {
      const expWeights = SCORING_PRESETS.experience.weights;
      // Candidate A: (90*20 + 80*30 + 70*50) / 100 = (1800 + 2400 + 3500) / 100 = 77
      const scoreA = calculateWeightedScore(sampleCandidateA, expWeights);
      expect(scoreA).toBe(77);

      // Candidate B: (60*20 + 95*30 + 90*50) / 100 = (1200 + 2850 + 4500) / 100 = 85.5 -> 86 (or 85 depending on rounding)
      const scoreB = calculateWeightedScore(sampleCandidateB, expWeights);
      expect(scoreB).toBe(86);
    });

    it('handles missing or invalid scores gracefully by fallback', () => {
      const incomplete = {
        keywordScore: null,
        skillScore: null,
        experienceScore: null,
        overallScore: 75
      };
      expect(calculateWeightedScore(incomplete)).toBe(75);

      const empty = {
        keywordScore: null,
        skillScore: null,
        experienceScore: null,
        overallScore: null
      };
      expect(calculateWeightedScore(empty)).toBeNull();
    });
  });

  describe('checkKnockout', () => {
    it('detects candidate below minSkillScore', () => {
      const res = checkKnockout(sampleCandidateC, { minSkillScore: 50 }, 'vi');
      expect(res.isKnockedOut).toBe(true);
      expect(res.reason).toContain('Điểm kỹ năng (45)');
    });

    it('passes candidate meeting minSkillScore', () => {
      const res = checkKnockout(sampleCandidateA, { minSkillScore: 75 });
      expect(res.isKnockedOut).toBe(false);
    });

    it('detects candidate failing Must-Have requirements', () => {
      const res = checkKnockout(sampleCandidateB, { requireMustHaveSkills: true }, 'vi');
      expect(res.isKnockedOut).toBe(true);
      expect(res.reason).toContain('AWS Architecture');
    });

    it('detects candidate below minOverallScore threshold', () => {
      const res = checkKnockout(sampleCandidateC, { minOverallScore: 60 }, 'en');
      expect(res.isKnockedOut).toBe(true);
      expect(res.reason).toContain('Overall score');
    });
  });

  describe('recalculateLeaderboard', () => {
    it('re-ranks candidates dynamically and deprioritizes knocked-out candidates', () => {
      const list = [sampleCandidateA, sampleCandidateB, sampleCandidateC];
      // Require AWS must-have so B is knocked out, and minSkill 50 so C is knocked out
      const ranked = recalculateLeaderboard(
        list,
        SCORING_PRESETS.balanced.weights,
        { requireMustHaveSkills: true, minSkillScore: 50 },
        'vi'
      );

      expect(ranked[0].candidateName).toBe('Nguyen Van A');
      expect(ranked[0].isKnockedOut).toBe(false);
      expect(ranked[0].dynamicRank).toBe(1);

      // B and C are knocked out
      const knockedOut = ranked.filter(c => c.isKnockedOut);
      expect(knockedOut.length).toBe(2);
      expect(knockedOut.map(c => c.candidateName)).toContain('Tran Thi B');
      expect(knockedOut.map(c => c.candidateName)).toContain('Le Van C');
    });

    it('re-ranks candidate B to #1 when experience weights are prioritized', () => {
      const list = [sampleCandidateA, sampleCandidateB];
      // No knockout
      const ranked = recalculateLeaderboard(
        list,
        SCORING_PRESETS.experience.weights,
        {},
        'vi'
      );

      // Candidate B has higher experience (90 vs 70), so weightedScore is 86 vs 77
      expect(ranked[0].candidateName).toBe('Tran Thi B');
      expect(ranked[0].dynamicRank).toBe(1);
      expect(ranked[1].candidateName).toBe('Nguyen Van A');
      expect(ranked[1].dynamicRank).toBe(2);
    });
  });
});
