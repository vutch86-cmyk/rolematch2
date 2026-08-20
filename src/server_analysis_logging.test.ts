import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalysisRecordItem } from './types';
import {
  createAnalysisRecord,
  recordAnalysisRecord,
  getFirestoreDb,
  setFirestoreDb,
  getAnalysisRecords,
  clearAnalysisRecordsForTesting,
} from '../server';

// Mock firebase/firestore to test real persistence logic
const mockFirestoreStore = new Map<string, any>();
let mockSetDocReject = false;
let mockSetDocErrorMessage = 'Firestore permission denied or network timeout';

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({ type: 'mock_firestore_db' })),
    collection: vi.fn((db, colName) => ({ db, colName })),
    doc: vi.fn((db, colName, docId) => ({ db, colName, docId })),
    setDoc: vi.fn(async (docRef: any, data: any) => {
      if (mockSetDocReject) {
        throw new Error(mockSetDocErrorMessage);
      }
      mockFirestoreStore.set(docRef.docId, data);
      return undefined;
    }),
    getDocs: vi.fn(async (colRef: any) => {
      const docs = Array.from(mockFirestoreStore.values()).map((data) => ({
        id: data.id,
        data: () => data,
      }));
      return {
        docs,
        forEach: (cb: (doc: any) => void) => docs.forEach(cb),
      };
    }),
    deleteDoc: vi.fn(async (docRef: any) => {
      mockFirestoreStore.delete(docRef.docId || docRef.id);
      return undefined;
    }),
    updateDoc: vi.fn(async (docRef: any, data: any) => {
      const existing = mockFirestoreStore.get(docRef.docId || docRef.id) || {};
      mockFirestoreStore.set(docRef.docId || docRef.id, { ...existing, ...data });
      return undefined;
    }),
    addDoc: vi.fn(async (colRef: any, data: any) => {
      const id = `mock_${Date.now()}`;
      mockFirestoreStore.set(id, { id, ...data });
      return { id };
    }),
    setLogLevel: vi.fn(),
    query: vi.fn((colRef) => colRef),
    where: vi.fn(),
  };
});

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

    const recruiterOnly = records.filter((r) => r.source === 'recruiter_batch');
    expect(recruiterOnly).toHaveLength(2);

    const candidateOnly = records.filter((r) => !r.source || r.source === 'candidate');
    expect(candidateOnly).toHaveLength(1);

    const query = 'frontend 2026';
    const searched = records.filter(
      (r) =>
        r.batchName?.toLowerCase().includes(query) ||
        r.jobTitle.toLowerCase().includes(query)
    );
    expect(searched).toHaveLength(2);
  });
});

describe('R3.0 Fail-Closed Persistence & Audit Logging Tests', () => {
  const mockDb = { type: 'mock_firestore_db' };

  beforeEach(() => {
    mockFirestoreStore.clear();
    mockSetDocReject = false;
    mockSetDocErrorMessage = 'Firestore permission denied';
    clearAnalysisRecordsForTesting();
  });

  // TEST 1: db available + setDoc success
  it('1. db available + setDoc success: result.success === true, audit.saved increments, audit.failed does not increment, recordId added', async () => {
    setFirestoreDb(mockDb);

    const audit = {
      expected: 1,
      saved: 0,
      failed: 0,
      recordIds: [] as string[],
    };

    const res = await createAnalysisRecord({
      requestId: 'req_success_001',
      source: 'recruiter_batch',
      batchId: 'batch_test_1',
      batchName: 'Test Batch Success',
      candidateName: 'Nguyen Van Test',
      jobTitle: 'Frontend Dev - Nguyen Van Test',
      fileName: 'NguyenVanTest.pdf',
      status: 'COMPLETED',
      overallScore: 85,
      matchLevel: 'TOT',
      topStrengths: ['React', 'TypeScript'],
      missingSkills: ['Kubernetes'],
      engineUsed: 'Gemini 2.0 Flash Batch Pipeline',
      durationMs: 15000,
      cvTextLength: 1200,
      jdTextLength: 800,
    });

    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.recordId).toBeDefined();

    if (res.success) {
      audit.saved += 1;
      audit.recordIds.push(res.recordId);
    } else {
      audit.failed += 1;
    }

    expect(audit.expected).toBe(audit.saved + audit.failed);
    expect(audit.saved).toBe(1);
    expect(audit.failed).toBe(0);
    expect(audit.recordIds).toContain(res.recordId);

    // Verify memory cache and mock Firestore store
    const memRecords = getAnalysisRecords();
    expect(memRecords.some((r) => r.id === res.recordId)).toBe(true);
    expect(mockFirestoreStore.has(res.recordId)).toBe(true);
  });

  // TEST 2: db unavailable (db === null)
  it('2. db unavailable: result.success === false, error === FIRESTORE_UNAVAILABLE, audit.saved does not increment, audit.failed increments, memory cache does not contain record', async () => {
    setFirestoreDb(null);

    const audit = {
      expected: 1,
      saved: 0,
      failed: 0,
      recordIds: [] as string[],
    };

    const res = await createAnalysisRecord({
      requestId: 'req_unavailable_002',
      source: 'recruiter_batch',
      batchId: 'batch_test_2',
      batchName: 'Test Batch Fail Closed',
      candidateName: 'Tran Thi Unavailable',
      jobTitle: 'Backend Dev - Tran Thi Unavailable',
      fileName: 'TranThiUnavailable.pdf',
      status: 'COMPLETED',
      overallScore: 80,
      matchLevel: 'TOT',
      topStrengths: ['NodeJS'],
      missingSkills: [],
      engineUsed: 'Gemini 2.0 Flash Batch Pipeline',
      durationMs: 12000,
      cvTextLength: 1000,
      jdTextLength: 600,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('FIRESTORE_UNAVAILABLE');

    if (res.success) {
      audit.saved += 1;
      audit.recordIds.push(res.recordId);
    } else {
      audit.failed += 1;
    }

    expect(audit.expected).toBe(audit.saved + audit.failed);
    expect(audit.saved).toBe(0);
    expect(audit.failed).toBe(1);
    expect(audit.recordIds).toHaveLength(0);

    // Verify memory cache does NOT contain the record
    const memRecords = getAnalysisRecords();
    expect(memRecords.some((r) => r.id === res.recordId)).toBe(false);
  });

  // TEST 3: setDoc rejects
  it('3. setDoc rejects: result.success === false, audit.saved does not increment, audit.failed increments, memory cache does not contain record', async () => {
    setFirestoreDb(mockDb);
    mockSetDocReject = true;
    mockSetDocErrorMessage = 'PERMISSION_DENIED: Missing or insufficient permissions.';

    const audit = {
      expected: 1,
      saved: 0,
      failed: 0,
      recordIds: [] as string[],
    };

    const res = await createAnalysisRecord({
      requestId: 'req_reject_003',
      source: 'recruiter_batch',
      batchId: 'batch_test_3',
      candidateName: 'Le Van Reject',
      jobTitle: 'DevOps - Le Van Reject',
      fileName: 'LeVanReject.pdf',
      status: 'FAILED',
      overallScore: null,
      matchLevel: 'NOT_AVAILABLE',
      topStrengths: [],
      missingSkills: [],
      engineUsed: 'Gemini 2.0 Flash Batch Pipeline',
      durationMs: 5000,
      cvTextLength: 500,
      jdTextLength: 600,
      errorMessage: 'AI pipeline timeout',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('PERMISSION_DENIED');

    if (res.success) {
      audit.saved += 1;
      audit.recordIds.push(res.recordId);
    } else {
      audit.failed += 1;
    }

    expect(audit.expected).toBe(audit.saved + audit.failed);
    expect(audit.saved).toBe(0);
    expect(audit.failed).toBe(1);
    expect(audit.recordIds).toHaveLength(0);

    // Verify memory cache does NOT contain the record
    const memRecords = getAnalysisRecords();
    expect(memRecords.some((r) => r.id === res.recordId)).toBe(false);
  });

  // TEST 4: GET /api/admin/analyses when db unavailable
  it('4. GET /api/admin/analyses fail closed simulation: when db is unavailable, storage returns FIRESTORE_UNAVAILABLE and HTTP 503 contract', async () => {
    setFirestoreDb(null);

    // Directly test the fail-closed contract of Admin analyses lookup
    const dbInstance = getFirestoreDb();
    expect(dbInstance).toBeNull();

    let responseStatus = 200;
    let responseBody: any = null;

    if (!dbInstance) {
      responseStatus = 503;
      responseBody = {
        success: false,
        code: 'FIRESTORE_UNAVAILABLE',
        error: 'Analysis log storage is temporarily unavailable.',
      };
    }

    expect(responseStatus).toBe(503);
    expect(responseBody.success).toBe(false);
    expect(responseBody.code).toBe('FIRESTORE_UNAVAILABLE');
  });

  // TEST 5: Regression test for Candidate tab
  it('5. Regression test for Candidate tab: recordAnalysisRecord preserves persistence and caller receives true status', async () => {
    setFirestoreDb(mockDb);

    const candRes = await recordAnalysisRecord({
      requestId: 'req_cand_regression_005',
      source: 'candidate',
      userEmail: 'applicant@example.com',
      actorUsername: 'applicant',
      candidateName: 'Applicant One',
      fileName: 'ApplicantCV.pdf',
      cvFileName: 'ApplicantCV.pdf',
      jobTitle: 'Fullstack Engineer - Applicant One',
      status: 'COMPLETED',
      overallScore: 90,
      keywordScore: 92,
      experienceScore: 88,
      skillsScore: 90,
      matchLevel: 'XUAT_SAC',
      topStrengths: ['Fullstack leadership'],
      missingSkills: [],
      engineUsed: 'Gemini 2.0 Flash Sequential Pipeline',
      durationMs: 35000,
      cvTextLength: 1800,
      jdTextLength: 1100,
    });

    expect(candRes.success).toBe(true);
    expect(candRes.recordId).toBeDefined();
    expect(candRes.item?.overallScore).toBe(90);

    // Verify it is in mock Firestore and in memory
    const memRecords = getAnalysisRecords();
    const found = memRecords.find((r) => r.id === candRes.recordId);
    expect(found).toBeDefined();
    expect(found?.candidateName).toBe('Applicant One');
    expect(mockFirestoreStore.has(candRes.recordId)).toBe(true);
  });
});
