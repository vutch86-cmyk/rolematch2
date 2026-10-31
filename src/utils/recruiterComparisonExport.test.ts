import { describe, it, expect } from 'vitest';
import { generateRecruiterComparisonMarkdown } from './recruiterComparisonExport';

describe('Recruiter Comparison Export', () => {
  const sampleCandidates = [
    {
      candidateName: 'Candidate Alpha',
      filename: 'Alpha.pdf',
      overallScore: 85,
      weightedScore: 88,
      matchLevel: 'Very High',
      pipelineStage: 'INTERVIEW',
      rating: 5,
      notes: 'Excellent team lead background',
      topStrengths: ['System Design'],
      keyGaps: ['Kubernetes']
    },
    {
      candidateName: 'Candidate Beta',
      filename: 'Beta.pdf',
      overallScore: 70,
      weightedScore: 68,
      matchLevel: 'Medium',
      isKnockedOut: true,
      knockoutReason: 'Skill score below 75',
      pipelineStage: 'REJECTED',
      rating: 2,
      topStrengths: ['Communication'],
      keyGaps: ['Cloud Architecture']
    }
  ];

  it('generates markdown report with tables, deep-dive sections and interview kit in Vietnamese', () => {
    const md = generateRecruiterComparisonMarkdown(sampleCandidates, 'Senior Backend Engineer', 'vi');
    expect(md).toContain('BÁO CÁO SO SÁNH CHUYÊN SÂU ỨNG VIÊN');
    expect(md).toContain('Senior Backend Engineer');
    expect(md).toContain('Candidate Alpha');
    expect(md).toContain('Candidate Beta');
    expect(md).toContain('Điểm Trọng Số');
    expect(md).toContain('Cảnh báo Loại sàn');
    expect(md).toContain('Đối Chiếu Trực Diện Từng Chiều Sâu');
  });

  it('generates english report when lang is en', () => {
    const md = generateRecruiterComparisonMarkdown(sampleCandidates, 'Senior Backend Engineer', 'en');
    expect(md).toContain('DEEP-DIVE CANDIDATE COMPARISON REPORT');
    expect(md).toContain('Executive Score & Fit Summary');
    expect(md).toContain('Disqualified');
  });
});
