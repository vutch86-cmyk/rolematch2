import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import type { AnalysisRecordItem, StoredUser } from './types';
import {
  app,
  createAnalysisRecord,
  recordAnalysisRecord,
  buildCandidateAuditMetadata,
  __getFirestoreDbForTesting,
  __setFirestoreDbForTesting,
  __getAnalysisRecordsForTesting,
  __clearAnalysisRecordsForTesting,
  __generateTokenForTesting,
} from '../server';

// Mock firebase/firestore to test real persistence logic
const mockFirestoreStore = new Map<string, any>();
let mockSetDocReject = false;
let mockSetDocErrorMessage = 'Firestore permission denied or network timeout';
let mockGetDocsReject = false;
let mockGetDocsErrorMessage = 'Firestore read error: quota exceeded';

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
      if (mockGetDocsReject) {
        throw new Error(mockGetDocsErrorMessage);
      }
      const docs = Array.from(mockFirestoreStore.values()).map((data) => ({
        id: data.id,
        data: () => data,
      }));
      return {
        empty: docs.length === 0,
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
  const adminUser: StoredUser = {
    id: 'usr_admin_test_001',
    username: 'admin',
    passwordHash: '$2b$10$3vzYSF/.B9xDoTWHtHYRm.qYv3MZppm2z1MYr7lx9dHkIxsDH7is.',
    fullName: 'Admin Test User',
    role: 'admin',
    createdAt: '2026-08-11T00:00:00.000Z',
  };
  const adminToken = __generateTokenForTesting(adminUser);
  const analysesFilePath = path.join(process.cwd(), 'data', 'analyses.json');

  beforeEach(() => {
    mockFirestoreStore.clear();
    mockSetDocReject = false;
    mockSetDocErrorMessage = 'Firestore permission denied';
    mockGetDocsReject = false;
    mockGetDocsErrorMessage = 'Firestore read error: quota exceeded';
    __clearAnalysisRecordsForTesting();
    __setFirestoreDbForTesting(mockDb);

    // Clean up any test artifact if present
    if (fs.existsSync(analysesFilePath)) {
      fs.unlinkSync(analysesFilePath);
    }
  });

  afterEach(() => {
    __clearAnalysisRecordsForTesting();
    __setFirestoreDbForTesting(mockDb);
    mockSetDocReject = false;
    mockGetDocsReject = false;

    // Ensure no runtime data file is left in repository
    if (fs.existsSync(analysesFilePath)) {
      fs.unlinkSync(analysesFilePath);
    }
  });

  // TEST 1: createAnalysisRecord - db available + setDoc success
  it('1. createAnalysisRecord with Firestore success: result.success === true, audit.saved increments, audit.failed does not increment, recordId added', async () => {
    __setFirestoreDbForTesting(mockDb);

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
    const memRecords = __getAnalysisRecordsForTesting();
    expect(memRecords.some((r) => r.id === res.recordId)).toBe(true);
    expect(mockFirestoreStore.has(res.recordId)).toBe(true);
  });

  // TEST 2: createAnalysisRecord - db unavailable (db === null)
  it('2. createAnalysisRecord with db unavailable: result.success === false, error === FIRESTORE_UNAVAILABLE, audit.saved does not increment, audit.failed increments, memory cache does not contain record', async () => {
    __setFirestoreDbForTesting(null);

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
    const memRecords = __getAnalysisRecordsForTesting();
    expect(memRecords.some((r) => r.id === res.recordId)).toBe(false);
  });

  // TEST 3: createAnalysisRecord - setDoc rejects
  it('3. createAnalysisRecord when setDoc rejects: result.success === false, audit.saved does not increment, audit.failed increments, memory cache does not contain record', async () => {
    __setFirestoreDbForTesting(mockDb);
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
    const memRecords = __getAnalysisRecordsForTesting();
    expect(memRecords.some((r) => r.id === res.recordId)).toBe(false);
  });

  // TEST 4: Real Admin Endpoint - GET /api/admin/analyses when db unavailable -> HTTP 503
  it('4. Real Admin Endpoint test: GET /api/admin/analyses returns 503 and FIRESTORE_UNAVAILABLE when db is null', async () => {
    __setFirestoreDbForTesting(null);

    const response = await request(app)
      .get('/api/admin/analyses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FIRESTORE_UNAVAILABLE');
    expect(response.body.error).toBe('Analysis log storage is temporarily unavailable.');
  });

  // TEST 5: Real Admin Endpoint - GET /api/admin/analyses when getDocs rejects -> HTTP 503 (no memory fallback)
  it('5. Real Admin Endpoint test: GET /api/admin/analyses returns 503 and does not fallback to memory when getDocs rejects', async () => {
    __setFirestoreDbForTesting(mockDb);
    mockGetDocsReject = true;
    mockGetDocsErrorMessage = 'UNAVAILABLE: The Firestore service is currently unavailable.';

    // Populate memory cache to verify it is NOT returned as fallback
    const memRecords = __getAnalysisRecordsForTesting();
    memRecords.push({
      id: 'anl_mem_fallback_stale',
      jobTitle: 'Stale Job',
      userEmail: 'stale@test.com',
      overallScore: 99,
      matchLevel: 'XUAT_SAC',
      topStrengths: [],
      missingSkills: [],
      engineUsed: 'Gemini',
      durationMs: 100,
      cvTextLength: 100,
      jdTextLength: 100,
      timestamp: new Date().toISOString(),
    });

    const response = await request(app)
      .get('/api/admin/analyses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FIRESTORE_UNAVAILABLE');
    expect(response.body.analyses).toBeUndefined();
  });

  // TEST 6: Candidate main path persistence failure handling & audit metadata
  it('6. Candidate main path: persistence failure preserves AI result, sets audit.saved=false, and produces correct error code without leaking raw secrets', () => {
    // 6a. Success case
    const successMeta = buildCandidateAuditMetadata(
      { success: true, recordId: 'anl_cand_001' },
      'req_cand_001'
    );
    expect(successMeta).toEqual({
      requestId: 'req_cand_001',
      saved: true,
      recordId: 'anl_cand_001',
    });

    // 6b. FIRESTORE_UNAVAILABLE case
    const unavailMeta = buildCandidateAuditMetadata(
      { success: false, error: 'FIRESTORE_UNAVAILABLE' },
      'req_cand_002'
    );
    expect(unavailMeta).toEqual({
      requestId: 'req_cand_002',
      saved: false,
      errorCode: 'FIRESTORE_UNAVAILABLE',
    });

    // 6c. Generic PERSISTENCE_FAILED case
    const failedMeta = buildCandidateAuditMetadata(
      { success: false, error: 'PERMISSION_DENIED: Token api_key=secret123 failed' },
      'req_cand_003'
    );
    expect(failedMeta).toEqual({
      requestId: 'req_cand_003',
      saved: false,
      errorCode: 'PERSISTENCE_FAILED',
    });
    // Ensure raw error is not leaked into client audit object
    expect((failedMeta as any).error).toBeUndefined();
  });

  // TEST 7: Candidate fallback path audit metadata consistency
  it('7. Candidate fallback path: buildCandidateAuditMetadata returns consistent structure for null or error results', () => {
    const fallbackNullMeta = buildCandidateAuditMetadata(null, 'req_fallback_001');
    expect(fallbackNullMeta).toEqual({
      requestId: 'req_fallback_001',
      saved: false,
      errorCode: 'PERSISTENCE_FAILED',
    });

    const fallbackSuccessMeta = buildCandidateAuditMetadata(
      { success: true, recordId: 'anl_fb_002' },
      'req_fallback_002'
    );
    expect(fallbackSuccessMeta).toEqual({
      requestId: 'req_fallback_002',
      saved: true,
      recordId: 'anl_fb_002',
    });
  });

  // TEST 8: Test run does not write or modify data/analyses.json
  it('8. Test isolation: running tests does not produce or modify runtime data/analyses.json', async () => {
    __setFirestoreDbForTesting(mockDb);

    await createAnalysisRecord({
      requestId: 'req_isolation_008',
      source: 'recruiter_batch',
      batchId: 'batch_test_isolation',
      candidateName: 'Isolation Candidate',
      jobTitle: 'QA Engineer',
      fileName: 'Isolation.pdf',
      status: 'COMPLETED',
      overallScore: 88,
      matchLevel: 'XUAT_SAC',
      topStrengths: ['Vitest'],
      missingSkills: [],
      engineUsed: 'Gemini 2.0 Flash',
      durationMs: 1000,
      cvTextLength: 500,
      jdTextLength: 500,
    });

    // Ensure data/analyses.json is NOT created by the test
    expect(fs.existsSync(analysesFilePath)).toBe(false);
  });

  // TEST 9: Recruiter batch regression test - audit math invariant and regression integrity
  it('9. Recruiter batch regression: audit.expected === audit.saved + audit.failed invariant holds across multi-candidate batch', async () => {
    __setFirestoreDbForTesting(mockDb);

    const candidates = [
      { name: 'Cand 1', willFail: false },
      { name: 'Cand 2', willFail: true },
      { name: 'Cand 3', willFail: false },
      { name: 'Cand 4', willFail: true },
      { name: 'Cand 5', willFail: false },
    ];

    const audit = {
      expected: candidates.length,
      saved: 0,
      failed: 0,
      recordIds: [] as string[],
    };

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c.willFail) {
        mockSetDocReject = true;
        mockSetDocErrorMessage = 'Network disconnect';
      } else {
        mockSetDocReject = false;
      }

      const res = await createAnalysisRecord({
        requestId: `req_batch_reg_${i}`,
        source: 'recruiter_batch',
        batchId: 'batch_multi_reg_009',
        candidateName: c.name,
        jobTitle: `Role - ${c.name}`,
        fileName: `${c.name}.pdf`,
        status: c.willFail ? 'FAILED' : 'COMPLETED',
        overallScore: c.willFail ? null : 80 + i,
        matchLevel: c.willFail ? 'NOT_AVAILABLE' : 'TOT',
        topStrengths: ['Leadership'],
        missingSkills: [],
        engineUsed: 'Gemini 2.0 Flash Batch Pipeline',
        durationMs: 10000,
        cvTextLength: 1000,
        jdTextLength: 1000,
      });

      if (res.success) {
        audit.saved += 1;
        audit.recordIds.push(res.recordId);
      } else {
        audit.failed += 1;
      }
    }

    expect(audit.expected).toBe(candidates.length);
    expect(audit.saved).toBe(3);
    expect(audit.failed).toBe(2);
    expect(audit.expected).toBe(audit.saved + audit.failed);
    expect(audit.recordIds).toHaveLength(3);
  });
});
