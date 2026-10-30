import { describe, it, expect } from 'vitest';
import {
  getPipelineStageStats,
  filterCandidatesByStage,
  updateCandidateStage,
  updateCandidateNotes,
  updateCandidateRating,
  toggleCandidateTag,
  PIPELINE_STAGES
} from './recruiterPipelineHelpers';
import { PipelineStage } from '../types';

describe('Recruiter Pipeline Helpers', () => {
  const sampleCandidates = [
    {
      id: 'c1',
      filename: 'cand1.pdf',
      candidateName: 'Candidate One',
      pipelineStage: 'INBOX' as PipelineStage,
      notes: '',
      rating: 0,
      tags: ['Culture Fit']
    },
    {
      id: 'c2',
      filename: 'cand2.pdf',
      candidateName: 'Candidate Two',
      pipelineStage: 'SHORTLIST' as PipelineStage,
      notes: 'Strong backend skills',
      rating: 4,
      tags: ['Top Candidate']
    },
    {
      id: 'c3',
      filename: 'cand3.pdf',
      candidateName: 'Candidate Three',
      pipelineStage: 'INTERVIEW' as PipelineStage,
      notes: 'Scheduled for Friday',
      rating: 5,
      tags: ['Tech Lead']
    },
    {
      id: 'c4',
      filename: 'cand4.pdf',
      candidateName: 'Candidate Four',
      // No pipelineStage set -> defaults to INBOX
      notes: '',
      rating: 0,
      tags: []
    }
  ];

  it('calculates pipeline stage stats correctly', () => {
    const stats = getPipelineStageStats(sampleCandidates);
    expect(stats.ALL).toBe(4);
    expect(stats.INBOX).toBe(2); // c1 + c4
    expect(stats.SHORTLIST).toBe(1); // c2
    expect(stats.INTERVIEW).toBe(1); // c3
    expect(stats.OFFER).toBe(0);
    expect(stats.REJECTED).toBe(0);
  });

  it('filters candidates by stage correctly', () => {
    const inboxList = filterCandidatesByStage(sampleCandidates, 'INBOX');
    expect(inboxList.length).toBe(2);
    expect(inboxList.map(c => c.id)).toEqual(['c1', 'c4']);

    const shortlistList = filterCandidatesByStage(sampleCandidates, 'SHORTLIST');
    expect(shortlistList.length).toBe(1);
    expect(shortlistList[0].id).toBe('c2');

    const allList = filterCandidatesByStage(sampleCandidates, 'ALL');
    expect(allList.length).toBe(4);
  });

  it('updates candidate stage immutably', () => {
    const updated = updateCandidateStage(sampleCandidates, 'c1', 'INTERVIEW');
    expect(updated[0].pipelineStage).toBe('INTERVIEW');
    expect(sampleCandidates[0].pipelineStage).toBe('INBOX'); // Original unaffected
  });

  it('updates candidate notes and rating immutably', () => {
    const withNotes = updateCandidateNotes(sampleCandidates, 'c4', 'Called candidate, good attitude');
    expect(withNotes[3].notes).toBe('Called candidate, good attitude');

    const withRating = updateCandidateRating(sampleCandidates, 'c1', 5);
    expect(withRating[0].rating).toBe(5);

    // Clamps to max 5
    const clampedRating = updateCandidateRating(sampleCandidates, 'c1', 99);
    expect(clampedRating[0].rating).toBe(5);
  });

  it('toggles candidate tags correctly', () => {
    // Add new tag
    const added = toggleCandidateTag(sampleCandidates, 'c1', 'Urgent Hire');
    expect(added[0].tags).toContain('Urgent Hire');
    expect(added[0].tags).toContain('Culture Fit');

    // Remove existing tag
    const removed = toggleCandidateTag(added, 'c1', 'Culture Fit');
    expect(removed[0].tags).not.toContain('Culture Fit');
    expect(removed[0].tags).toContain('Urgent Hire');
  });

  it('verifies configuration metadata for all pipeline stages', () => {
    expect(PIPELINE_STAGES.INBOX.labelVi).toBe('Mới nạp');
    expect(PIPELINE_STAGES.SHORTLIST.labelEn).toBe('Shortlisted');
    expect(PIPELINE_STAGES.INTERVIEW.badgeClass).toContain('amber');
    expect(PIPELINE_STAGES.OFFER.badgeClass).toContain('emerald');
    expect(PIPELINE_STAGES.REJECTED.badgeClass).toContain('rose');
  });
});
