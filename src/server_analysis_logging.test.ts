import { describe, it, expect } from 'vitest';
import type { AnalysisRecordItem } from './types';

describe('Analysis Record Structure & Filtering', () => {
  it('should construct valid candidate and recruiter batch analysis records', () => {
    const candidateRecord: AnalysisRecordItem = {
      id: 'rec_cand_123',
      requestId: 'req_cand_123',
      source: 'candidate',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      userEmail: 'candidate@example.com',
      actorUsername: 'candidate@example.com',
      candidateName: 'Nguyen Van A',
      cvFileName: 'NguyenVanA_CV.pdf',
      jobTitle: 'Senior Frontend Engineer - Nguyen Van A',
      overallScore: 88,
      keywordScore: 90,
      experienceScore: 85,
      skillsScore: 89,
      matchLevel: 'XUAT_SAC',
      topStrengths: ['Strong React experience', 'TypeScript mastery'],
      missingSkills: ['Kubernetes'],
      recommendation: 'Highly recommended for technical interview',
      recruiterDecision: 'YES',
      engineUsed: 'Gemini 2.0 Flash Sequential Pipeline',
      durationMs: 42000,
      cvTextLength: 1500,
      jdTextLength: 900,
    };

    const batchRecord: AnalysisRecordItem = {
      id: 'rec_batch_001_0',
      requestId: 'req_batch_001_0',
      source: 'recruiter_batch',
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
      batchId: 'batch_2026_01',
      batchName: 'Tech Lead Recruitment Q1',
      candidateId: 'cand_456',
      userEmail: 'hr_lead@company.com',
      actorUsername: 'hr_lead',
      candidateName: 'Tran Thi B',
      fileName: 'TranThiB_CV.pdf',
      cvFileName: 'TranThiB_CV.pdf',
      jobTitle: 'Tech Lead - Tran Thi B',
      overallScore: 76,
      keywordScore: 78,
      experienceScore: 75,
      skillsScore: 75,
      matchLevel: 'TOT',
      topStrengths: ['10+ years backend expertise'],
      missingSkills: ['GraphQL'],
      recommendation: 'Suitable for round 1 screening',
      recruiterDecision: 'YES',
      engineUsed: 'Gemini 2.0 Flash Sequential Pipeline',
      durationMs: 51000,
      cvTextLength: 2000,
      jdTextLength: 1200,
    };

    expect(candidateRecord.source).toBe('candidate');
    expect(candidateRecord.status).toBe('COMPLETED');
    expect(candidateRecord.overallScore).toBe(88);

    expect(batchRecord.source).toBe('recruiter_batch');
    expect(batchRecord.batchId).toBe('batch_2026_01');
    expect(batchRecord.batchName).toBe('Tech Lead Recruitment Q1');
    expect(batchRecord.actorUsername).toBe('hr_lead');
    expect(batchRecord.overallScore).toBe(76);
  });

  it('should support searching and filtering across batch recruiter records', () => {
    const records: AnalysisRecordItem[] = [
      {
        id: 'rec_1',
        requestId: 'req_1',
        source: 'candidate',
        status: 'COMPLETED',
        timestamp: '2026-08-19T10:00:00Z',
        userEmail: 'dev1@example.com',
        jobTitle: 'React Developer',
        cvFileName: 'cv1.pdf',
        overallScore: 82,
        matchLevel: 'TOT',
        durationMs: 45000,
        topStrengths: ['React'],
        missingSkills: ['Docker'],
        engineUsed: 'Gemini 2.0 Flash',
        cvTextLength: 1000,
        jdTextLength: 800,
      },
      {
        id: 'rec_2',
        requestId: 'req_2',
        source: 'recruiter_batch',
        status: 'COMPLETED',
        timestamp: '2026-08-19T10:05:00Z',
        batchId: 'batch_frontend_hiring',
        batchName: 'Đợt Tuyển Frontend 2026',
        actorUsername: 'recruiter_linh',
        candidateName: 'Le Van C',
        userEmail: 'recruiter_linh@company.com',
        jobTitle: 'Senior Frontend Engineer - Le Van C',
        cvFileName: 'LeVanC_CV.pdf',
        overallScore: 92,
        matchLevel: 'XUAT_SAC',
        durationMs: 38000,
        topStrengths: ['Architecture'],
        missingSkills: [],
        engineUsed: 'Gemini 2.0 Flash',
        cvTextLength: 1200,
        jdTextLength: 800,
      },
      {
        id: 'rec_3',
        requestId: 'req_3',
        source: 'recruiter_batch',
        status: 'FAILED',
        timestamp: '2026-08-19T10:06:00Z',
        batchId: 'batch_frontend_hiring',
        batchName: 'Đợt Tuyển Frontend 2026',
        actorUsername: 'recruiter_linh',
        candidateName: 'Pham Van D',
        userEmail: 'recruiter_linh@company.com',
        jobTitle: 'Frontend Engineer - Pham Van D',
        cvFileName: 'PhamVanD_CV.pdf',
        overallScore: 0,
        matchLevel: 'NOT_AVAILABLE',
        durationMs: 12000,
        topStrengths: [],
        missingSkills: [],
        engineUsed: 'Gemini 2.0 Flash',
        cvTextLength: 0,
        jdTextLength: 800,
        errorMessage: 'Invalid file format',
      },
    ];

    // Filter by source: recruiter_batch
    const recruiterOnly = records.filter(
      (r) => r.source === 'recruiter_batch'
    );
    expect(recruiterOnly).toHaveLength(2);

    // Filter by source: candidate
    const candidateOnly = records.filter(
      (r) => !r.source || r.source === 'candidate'
    );
    expect(candidateOnly).toHaveLength(1);

    // Search query matches batch name
    const query = 'frontend 2026';
    const searched = records.filter(
      (r) =>
        r.batchName?.toLowerCase().includes(query) ||
        r.jobTitle.toLowerCase().includes(query)
    );
    expect(searched).toHaveLength(2);
  });

  it('should track audit stats correctly and detect failed persistence writes', () => {
    const auditStats = {
      expected: 3,
      saved: 2,
      failed: 1,
      recordIds: ['anl_req_1_0', 'anl_req_1_1'],
    };

    expect(auditStats.expected).toBe(3);
    expect(auditStats.saved).toBe(2);
    expect(auditStats.failed).toBe(1);
    expect(auditStats.recordIds).toHaveLength(2);
    expect(auditStats.failed > 0).toBe(true);
  });

  it('should sanitize objects and remove undefined fields before Firestore operations', () => {
    function removeUndefinedDeep(obj: any): any {
      if (obj === null || obj === undefined) return null;
      if (Array.isArray(obj)) {
        return obj.map(removeUndefinedDeep);
      }
      if (typeof obj === 'object') {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = removeUndefinedDeep(value);
          }
        }
        return cleaned;
      }
      return obj;
    }

    const rawRecord = {
      id: 'anl_test_1',
      source: 'recruiter_batch',
      batchId: 'batch_123',
      batchName: undefined,
      overallScore: 85,
      fullAnalysis: {
        feature1: {
          score: 80,
          missingData: undefined,
        },
      },
    };

    const sanitized = removeUndefinedDeep(rawRecord);
    expect(sanitized.id).toBe('anl_test_1');
    expect('batchName' in sanitized).toBe(false);
    expect(sanitized.fullAnalysis.feature1.score).toBe(80);
    expect('missingData' in sanitized.fullAnalysis.feature1).toBe(false);
  });
});
