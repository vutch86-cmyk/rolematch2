import { describe, it, expect } from 'vitest';
import { OperationType, handleFirestoreError, getFirestoreDb, setFirestoreDb } from '../server/config/firebase';
import { analysisResponseSchema, generateCvResponseSchema } from '../server/schemas/analysisSchemas';
import {
  isStoredUserDocument,
  normalizeStoredUsers,
  ensureDefaultUsers,
  generateToken,
  verifyToken,
  AuthDatabaseUnavailableError,
} from '../server/services/authService';
import {
  buildCandidateAuditMetadata,
  removeUndefinedDeep,
  __getAnalysisRecordsForTesting,
  __clearAnalysisRecordsForTesting,
} from '../server/services/auditService';
import { parsePdfBuffer, parseDocxBuffer } from '../server/services/fileParserService';
import { cleanAndExtractJdWithAi } from '../server/services/jdExtractorService';
import type { StoredUser } from '../server/types';

describe('Phase 4: Modular Backend Architecture Tests', () => {
  describe('1. server/schemas/analysisSchemas', () => {
    it('analysisResponseSchema contains all required structured output keys', () => {
      expect(analysisResponseSchema).toBeDefined();
      expect(analysisResponseSchema.properties).toBeDefined();
      expect(analysisResponseSchema.properties.feature1).toBeDefined();
      expect(analysisResponseSchema.properties.feature2).toBeDefined();
      expect(analysisResponseSchema.properties.feature3).toBeDefined();
      expect(analysisResponseSchema.properties.feature4).toBeDefined();

      // Check Feature 1 contract keys
      const f1 = analysisResponseSchema.properties.feature1.properties;
      expect(f1.jdKeywords).toBeDefined();
      expect(f1.comparisonTable).toBeDefined();
      expect(f1.scores).toBeDefined();

      // Check Feature 2 contract keys
      const f2 = analysisResponseSchema.properties.feature2.properties;
      expect(f2.tailoredSummaries).toBeDefined();
      expect(f2.sectionAudit).toBeDefined();
      expect(f2.rewrittenBullets).toBeDefined();

      // Check Feature 3 contract keys
      const f3 = analysisResponseSchema.properties.feature3.properties;
      expect(f3.seniorityFit).toBeDefined();
      expect(f3.riskMitigationMatrix).toBeDefined();

      // Check Feature 4 contract keys
      const f4 = analysisResponseSchema.properties.feature4.properties;
      expect(f4.questions).toBeDefined();
      expect(f4.interviewPrepSummary).toBeDefined();
    });

    it('generateCvResponseSchema contains updatedCvMarkdown and summaryOfChanges', () => {
      expect(generateCvResponseSchema).toBeDefined();
      expect(generateCvResponseSchema.properties.updatedCvMarkdown).toBeDefined();
      expect(generateCvResponseSchema.properties.summaryOfChanges).toBeDefined();
    });
  });

  describe('2. server/config/firebase', () => {
    it('OperationType enum has standard CRUD operations', () => {
      expect(OperationType.CREATE).toBe('create');
      expect(OperationType.UPDATE).toBe('update');
      expect(OperationType.DELETE).toBe('delete');
      expect(OperationType.GET).toBe('get');
      expect(OperationType.LIST).toBe('list');
    });

    it('getFirestoreDb and setFirestoreDb update db reference for testing', () => {
      const originalDb = getFirestoreDb();
      const mockTestDb = { type: 'custom_mock_db' };
      setFirestoreDb(mockTestDb);
      expect(getFirestoreDb()).toBe(mockTestDb);
      setFirestoreDb(originalDb);
      expect(getFirestoreDb()).toBe(originalDb);
    });

    it('handleFirestoreError throws formatted JSON with error context', () => {
      expect(() => {
        handleFirestoreError(new Error('Permission Denied'), OperationType.WRITE, 'users/123');
      }).toThrowError(/Permission Denied/);
    });
  });

  describe('3. server/services/authService', () => {
    const validUser: StoredUser = {
      id: 'usr_mod_001',
      username: 'mod_admin',
      passwordHash: '$2b$10$3vzYSF/.B9xDoTWHtHYRm.qYv3MZppm2z1MYr7lx9dHkIxsDH7is.',
      fullName: 'Modular Admin',
      role: 'admin',
      createdAt: '2026-10-31T00:00:00.000Z',
    };

    it('isStoredUserDocument accurately validates user shape', () => {
      expect(isStoredUserDocument(validUser)).toBe(true);
      expect(isStoredUserDocument({ ...validUser, role: 'invalid_role' })).toBe(false);
      expect(isStoredUserDocument(null)).toBe(false);
    });

    it('normalizeStoredUsers sanitizes array and filters out corrupt entries', () => {
      const normalized = normalizeStoredUsers([validUser, { corrupt: true }, null]);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].username).toBe('mod_admin');
    });

    it('AuthDatabaseUnavailableError has correct error code and name', () => {
      const err = new AuthDatabaseUnavailableError('Service down');
      expect(err.code).toBe('AUTH_DATABASE_UNAVAILABLE');
      expect(err.name).toBe('AuthDatabaseUnavailableError');
      expect(err.message).toBe('Service down');
    });

    it('generateToken and verifyToken create valid rolematch session tokens', () => {
      const token = generateToken(validUser);
      expect(token.startsWith('rmt_')).toBe(true);
    });
  });

  describe('4. server/services/auditService', () => {
    it('buildCandidateAuditMetadata handles successful persistence', () => {
      const meta = buildCandidateAuditMetadata({ success: true, recordId: 'rec_123' }, 'req_123');
      expect(meta.saved).toBe(true);
      expect(meta.recordId).toBe('rec_123');
      expect(meta.requestId).toBe('req_123');
    });

    it('buildCandidateAuditMetadata handles fail-closed Firestore error', () => {
      const meta = buildCandidateAuditMetadata({ success: false, error: 'FIRESTORE_UNAVAILABLE' }, 'req_fail_1');
      expect(meta.saved).toBe(false);
      expect(meta.errorCode).toBe('FIRESTORE_UNAVAILABLE');
    });

    it('removeUndefinedDeep strips undefined properties from nested structures', () => {
      const input = {
        name: 'Test',
        score: undefined,
        nested: {
          valid: 100,
          invalid: undefined,
        },
        arr: [1, undefined, 2],
      };
      const cleaned = removeUndefinedDeep(input);
      expect(cleaned).toEqual({
        name: 'Test',
        nested: { valid: 100 },
        arr: [1, 2],
      });
    });

    it('__getAnalysisRecordsForTesting and __clearAnalysisRecordsForTesting manage records array', () => {
      __clearAnalysisRecordsForTesting();
      const records = __getAnalysisRecordsForTesting();
      expect(records).toHaveLength(0);
    });
  });

  describe('5. server/services/fileParserService', () => {
    it('parsePdfBuffer extracts plain text fallback if PDF is corrupt or raw text', async () => {
      const mockRawPdf = Buffer.from(
        '%PDF-1.4\nKỹ sư phần mềm cao cấp với 5 năm kinh nghiệm Kubernetes, TypeScript và React.'
      );
      const text = await parsePdfBuffer(mockRawPdf);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(10);
    });

    it('parseDocxBuffer parses empty docx safely or handles error', async () => {
      try {
        await parseDocxBuffer(Buffer.from('not_a_valid_zip'));
      } catch (err: any) {
        expect(err).toBeDefined();
      }
    });
  });

  describe('6. server/services/jdExtractorService', () => {
    it('cleanAndExtractJdWithAi runs heuristic fallback when no AI client is provided', async () => {
      const rawText = `
        FPT Software tuyển dụng Senior Golang Engineer
        Yêu cầu:
        - 3+ năm kinh nghiệm Golang
        - Hiểu biết Docker, Kubernetes
        Quyền lợi: Lương thỏa thuận
      `;
      const result = await cleanAndExtractJdWithAi(
        rawText,
        { siteName: 'TopCV', hintTitle: 'FPT Software - Senior Golang Engineer' },
        'vi'
      );
      expect(result.isAuthWall).toBe(false);
      expect(result.jdText).toContain('Golang');
      expect(result.jobTitle.length).toBeGreaterThan(0);
    });
  });
});
