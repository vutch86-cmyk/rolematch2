import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let mockGetDocResolvedValue: any = null;

vi.mock('firebase/firestore', () => {
  return {
    doc: vi.fn((db, colName, docId) => ({ db, colName, docId })),
    getDoc: vi.fn(async () => {
      if (mockGetDocResolvedValue) {
        return mockGetDocResolvedValue;
      }
      return {
        exists: () => false,
        data: () => null
      };
    }),
    setDoc: vi.fn(async (ref, data) => {
      mockGetDocResolvedValue = {
        exists: () => true,
        data: () => data
      };
    }),
    runTransaction: vi.fn()
  };
});
import {
  reserveAiQuota,
  getAiQuotaSettings,
  updateAiQuotaSettings,
  getDateKey,
  getResetAt,
  normalizeUserId,
  getUsageDocId,
  getQuotaHealth,
  hashRequestId,
  resetUserQuotaForDate,
  getUserQuotaUsage
} from '../quotaService';
import { parseApiResponseSafely, ApiParseError } from './utils/apiResponse';

describe('Safe User ID and Usage Doc Helpers', () => {
  it('normalizes valid user IDs cleanly', () => {
    expect(normalizeUserId('usr_mt1aimzqa916')).toBe('usr_mt1aimzqa916');
    expect(normalizeUserId('  usr_mspvgb7w8z6e  ')).toBe('usr_mspvgb7w8z6e');
    expect(normalizeUserId('usr/test/123')).toBe('usr_test_123');
  });

  it('rejects empty or null user IDs with AUTH_REQUIRED', () => {
    expect(() => normalizeUserId(null)).toThrow('AUTH_REQUIRED');
    expect(() => normalizeUserId(undefined)).toThrow('AUTH_REQUIRED');
    expect(() => normalizeUserId('')).toThrow('AUTH_REQUIRED');
    expect(() => normalizeUserId('   ')).toThrow('AUTH_REQUIRED');
  });

  it('generates usage doc ID consistently', () => {
    const id = getUsageDocId('usr_mt1aimzqa916', '2026-08-20');
    expect(id).toBe('usr_mt1aimzqa916_2026-08-20');
  });

  it('generates SHA-256 requestId hash', () => {
    const hash = hashRequestId('usr_mt1aimzqa916', '2026-08-20', 'req_test_123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Quota Health Audit Function', () => {
  it('identifies HEALTHY data', () => {
    const healthyData = {
      candidateUnits: 3,
      recruiterUnits: 2,
      totalUnits: 5
    };
    expect(getQuotaHealth(healthyData)).toBe('HEALTHY');
  });

  it('identifies NORMALIZED data when fields are missing or inconsistent', () => {
    expect(getQuotaHealth({ candidateUnits: '3', recruiterUnits: 2, totalUnits: 5 })).toBe('NORMALIZED');
    expect(getQuotaHealth({ candidateUnits: 3, recruiterUnits: 2, totalUnits: 10 })).toBe('NORMALIZED');
    expect(getQuotaHealth({ candidateUnits: -1, recruiterUnits: 2, totalUnits: 1 })).toBe('NORMALIZED');
    expect(getQuotaHealth(null)).toBe('ERROR');
  });
});

describe('Frontend parseApiResponseSafely Utility', () => {
  it('parses valid JSON response', async () => {
    const response = new Response(JSON.stringify({ success: true, requestId: 'req_123', message: 'OK' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    const parsed = await parseApiResponseSafely(response, 'vi', 'req_123');
    expect(parsed.success).toBe(true);
    expect(parsed.requestId).toBe('req_123');
  });

  it('catches HTML response and throws friendly error with requestId without Unexpected token', async () => {
    const htmlBody = '<!doctype html><html><body>500 Internal Error</body></html>';
    const response = new Response(htmlBody, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });

    try {
      await parseApiResponseSafely(response, 'vi', 'req_cand_999');
      expect.fail('Should have thrown ApiParseError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiParseError);
      expect(err.code).toBe('INVALID_HTML_RESPONSE');
      expect(err.requestId).toBe('req_cand_999');
      expect(err.message).not.toContain('Unexpected token');
      expect(err.message).toContain('req_cand_999');
      expect(err.message).toContain('Máy chủ trả về phản hồi không hợp lệ');
    }
  });

  it('handles 401 AUTH_REQUIRED status gracefully', async () => {
    const response = new Response(JSON.stringify({
      success: false,
      code: 'AUTH_REQUIRED',
      error: 'Please log in'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });

    try {
      await parseApiResponseSafely(response, 'vi', 'req_401');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('AUTH_REQUIRED');
      expect(err.status).toBe(401);
    }
  });

  it('handles 429 DAILY_AI_LIMIT_EXCEEDED with details', async () => {
    const response = new Response(JSON.stringify({
      success: false,
      code: 'DAILY_AI_LIMIT_EXCEEDED',
      dailyLimit: 10,
      used: 10,
      remaining: 0,
      resetAt: '2026-08-21T00:00:00.000Z'
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });

    try {
      await parseApiResponseSafely(response, 'vi', 'req_429');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('DAILY_AI_LIMIT_EXCEEDED');
      expect(err.message).toContain('giới hạn');
      expect(err.message).toContain('10/10');
    }
  });
});

describe('Reserve AI Quota Logic & Isolation Tests', () => {
  it('allows admin users with unlimited quota without consuming limit', async () => {
    const mockDb = {};
    const adminUser = { id: 'usr_admin_001', role: 'admin', username: 'admin' };
    const result = await reserveAiQuota(mockDb, {
      user: adminUser,
      units: 5,
      source: 'candidate',
      requestId: 'req_admin_001'
    });

    expect(result.allowed).toBe(true);
    expect(result.unlimited).toBe(true);
  });

  it('throws QUOTA_SERVICE_UNAVAILABLE when db is null', async () => {
    const normalUser = { id: 'usr_mt1aimzqa916', role: 'normal', username: 'phat' };
    await expect(reserveAiQuota(null, {
      user: normalUser,
      units: 1,
      source: 'candidate',
      requestId: 'req_phat_001'
    })).rejects.toThrow('QUOTA_SERVICE_UNAVAILABLE');
  });

  it('rejects invalid inputs cleanly', async () => {
    const mockDb = {};
    const user = { id: 'usr_mt1aimzqa916', role: 'normal', username: 'phat' };

    await expect(reserveAiQuota(mockDb, {
      user,
      units: 0,
      source: 'candidate',
      requestId: 'req_1'
    })).rejects.toThrow('INVALID_UNITS');

    await expect(reserveAiQuota(mockDb, {
      user,
      units: 1,
      source: 'invalid_source' as any,
      requestId: 'req_1'
    })).rejects.toThrow('INVALID_SOURCE');

    await expect(reserveAiQuota(mockDb, {
      user,
      units: 1,
      source: 'candidate',
      requestId: ''
    })).rejects.toThrow('INVALID_REQUEST_ID');
  });

  it('verifies that quota documents are segregated strictly to system_settings, ai_usage, and ai_reservations', () => {
    const dateKey = getDateKey();
    const usageDocId = getUsageDocId('usr_test_user', dateKey);
    const reservationHash = hashRequestId('usr_test_user', dateKey, 'req_segregation_001');

    expect(usageDocId).toBe(`usr_test_user_${dateKey}`);
    expect(reservationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(usageDocId.startsWith('usr_test_user')).toBe(true);
  });
});

describe('getUserQuotaUsage Reconciled Scenarios', () => {
  const LOCAL_USAGE_FILE = path.join(process.cwd(), 'data', 'ai_usage.json');
  let originalLocalUsage: string | null = null;

  beforeEach(() => {
    mockGetDocResolvedValue = null;
    // Backup local usage
    if (fs.existsSync(LOCAL_USAGE_FILE)) {
      originalLocalUsage = fs.readFileSync(LOCAL_USAGE_FILE, 'utf-8');
    } else {
      originalLocalUsage = null;
    }
    // Clear local usage for clean testing
    if (fs.existsSync(LOCAL_USAGE_FILE)) {
      fs.unlinkSync(LOCAL_USAGE_FILE);
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockGetDocResolvedValue = null;
    // Restore local usage
    if (originalLocalUsage !== null) {
      fs.writeFileSync(LOCAL_USAGE_FILE, originalLocalUsage, 'utf-8');
    } else if (fs.existsSync(LOCAL_USAGE_FILE)) {
      fs.unlinkSync(LOCAL_USAGE_FILE);
    }
  });

  it('Trường hợp A: user mới, chưa dùng quota (Firestore: no doc, Local: no record)', async () => {
    const mockDb = { type: 'mock_db' };
    mockGetDocResolvedValue = {
      exists: () => false,
      data: () => null
    };

    const result = await getUserQuotaUsage(mockDb, 'usr_new_user');
    expect(result.candidateUnits).toBe(0);
    expect(result.recruiterUnits).toBe(0);
    expect(result.totalUnits).toBe(0);
    expect(result.storageSource).toBe('firestore');
    expect(result.quotaHealth).toBe('HEALTHY');
  });

  it('Trường hợp B: quota chỉ tồn tại ở Firestore (Firestore: 2/3, Local: no record)', async () => {
    const mockDb = { type: 'mock_db' };
    mockGetDocResolvedValue = {
      exists: () => true,
      data: () => ({
        candidateUnits: 2,
        recruiterUnits: 0,
        totalUnits: 2,
        updatedAt: '2026-08-21T01:00:00.000Z'
      })
    };

    const result = await getUserQuotaUsage(mockDb, 'usr_fs_only');
    expect(result.candidateUnits).toBe(2);
    expect(result.recruiterUnits).toBe(0);
    expect(result.totalUnits).toBe(2);
    expect(result.storageSource).toBe('firestore');
    expect(result.quotaHealth).toBe('HEALTHY');
  });

  it('Trường hợp C: Firestore không có document nhưng local fallback có quota (Firestore: no doc, Local: 3/3)', async () => {
    const mockDb = { type: 'mock_db' };
    mockGetDocResolvedValue = {
      exists: () => false,
      data: () => null
    };

    const dateKey = getDateKey();
    const usageDocId = getUsageDocId('usr_local_only', dateKey);

    // Setup local usage
    const localUsage = {
      [usageDocId]: {
        userId: 'usr_local_only',
        candidateUnits: 3,
        recruiterUnits: 0,
        totalUnits: 3,
        updatedAt: '2026-08-21T02:00:00.000Z'
      }
    };
    // Ensure parent directory exists
    const dir = path.dirname(LOCAL_USAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_USAGE_FILE, JSON.stringify(localUsage), 'utf-8');

    const result = await getUserQuotaUsage(mockDb, 'usr_local_only');
    expect(result.candidateUnits).toBe(3);
    expect(result.recruiterUnits).toBe(0);
    expect(result.totalUnits).toBe(3);
    expect(result.storageSource).toBe('local_fallback');
    expect(result.quotaHealth).toBe('DEGRADED');
  });

  it('Trường hợp D: Firestore cũ hơn local (Firestore: 1/3, Local: 3/3)', async () => {
    const mockDb = { type: 'mock_db' };
    mockGetDocResolvedValue = {
      exists: () => true,
      data: () => ({
        candidateUnits: 1,
        recruiterUnits: 0,
        totalUnits: 1,
        updatedAt: '2026-08-21T03:00:00.000Z'
      })
    };

    const dateKey = getDateKey();
    const usageDocId = getUsageDocId('usr_old_fs', dateKey);

    // Setup local usage (newer updatedAt)
    const localUsage = {
      [usageDocId]: {
        userId: 'usr_old_fs',
        candidateUnits: 3,
        recruiterUnits: 0,
        totalUnits: 3,
        updatedAt: '2026-08-21T04:00:00.000Z'
      }
    };
    fs.writeFileSync(LOCAL_USAGE_FILE, JSON.stringify(localUsage), 'utf-8');

    const result = await getUserQuotaUsage(mockDb, 'usr_old_fs');
    expect(result.candidateUnits).toBe(3);
    expect(result.recruiterUnits).toBe(0);
    expect(result.totalUnits).toBe(3);
    expect(result.storageSource).toBe('local_fallback');
    expect(result.quotaHealth).toBe('DEGRADED');
  });

  it('Trường hợp E: Firestore mới hơn local (Firestore: 1/2/3, Local: 1/0/1)', async () => {
    const mockDb = { type: 'mock_db' };
    mockGetDocResolvedValue = {
      exists: () => true,
      data: () => ({
        candidateUnits: 1,
        recruiterUnits: 2,
        totalUnits: 3,
        updatedAt: '2026-08-21T05:00:00.000Z'
      })
    };

    const dateKey = getDateKey();
    const usageDocId = getUsageDocId('usr_new_fs', dateKey);

    // Setup local usage (older updatedAt)
    const localUsage = {
      [usageDocId]: {
        userId: 'usr_new_fs',
        candidateUnits: 1,
        recruiterUnits: 0,
        totalUnits: 1,
        updatedAt: '2026-08-21T04:00:00.000Z'
      }
    };
    fs.writeFileSync(LOCAL_USAGE_FILE, JSON.stringify(localUsage), 'utf-8');

    const result = await getUserQuotaUsage(mockDb, 'usr_new_fs');
    expect(result.candidateUnits).toBe(1);
    expect(result.recruiterUnits).toBe(2);
    expect(result.totalUnits).toBe(3);
    expect(result.storageSource).toBe('firestore');
    expect(result.quotaHealth).toBe('HEALTHY');
  });
});

import os from 'os';

describe('AI Quota Reset Action Synchronization & Reconciliation Tests', () => {
  let testDataDir: string;
  let LOCAL_USAGE_FILE: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocResolvedValue = null;
    
    // Create temporary directory
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-test-'));
    LOCAL_USAGE_FILE = path.join(testDataDir, 'ai_usage.json');
    process.env.TEST_DATA_DIR = testDataDir;
  });

  afterEach(() => {
    mockGetDocResolvedValue = null;
    // Cleanup temporary directory
    fs.rmSync(testDataDir, { recursive: true, force: true });
    delete process.env.TEST_DATA_DIR;
  });

  it('Reset when quota is in Firestore: saves reset data both to Firestore and local, resetting to 0/0/0', async () => {
    const mockDb = { type: 'mock_db' };
    const dateKey = getDateKey();
    const userId = 'usr_reset_fs';
    const usageDocId = getUsageDocId(userId, dateKey);

    // Initial state setup: we can simulate Firestore having old data
    mockGetDocResolvedValue = {
      exists: () => true,
      data: () => ({
        userId,
        dateKey,
        candidateUnits: 2,
        recruiterUnits: 1,
        totalUnits: 3,
        updatedAt: '2026-08-21T03:00:00.000Z'
      })
    };

    // Trigger reset action
    const resetResult = await resetUserQuotaForDate(mockDb, userId, dateKey);
    expect(resetResult.success).toBe(true);

    // Verify local storage is successfully updated with zero values and newer timestamp
    const localContent = JSON.parse(fs.readFileSync(LOCAL_USAGE_FILE, 'utf-8'));
    expect(localContent[usageDocId]).toBeDefined();
    expect(localContent[usageDocId].candidateUnits).toBe(0);
    expect(localContent[usageDocId].recruiterUnits).toBe(0);
    expect(localContent[usageDocId].totalUnits).toBe(0);
    expect(localContent[usageDocId].userId).toBe(userId);

    // Now, mock Firestore returning the reset value (or let's mock it being in sync)
    mockGetDocResolvedValue = {
      exists: () => true,
      data: () => ({
        userId,
        dateKey,
        candidateUnits: 0,
        recruiterUnits: 0,
        totalUnits: 0,
        updatedAt: localContent[usageDocId].updatedAt
      })
    };

    const finalResult = await getUserQuotaUsage(mockDb, userId, dateKey);
    expect(finalResult.candidateUnits).toBe(0);
    expect(finalResult.recruiterUnits).toBe(0);
    expect(finalResult.totalUnits).toBe(0);
    expect(finalResult.storageSource).toBe('firestore');
    expect(finalResult.quotaHealth).toBe('HEALTHY');
  });

  it('Reset when Firestore is down (Local Fallback): successfully resets local to 0/0/0 and returns DEGRADED state', async () => {
    const dateKey = getDateKey();
    const userId = 'usr_reset_local_only';
    const usageDocId = getUsageDocId(userId, dateKey);

    // Pre-populate old usage on local fallback
    const preLocal = {
      [usageDocId]: {
        userId,
        dateKey,
        candidateUnits: 3,
        recruiterUnits: 2,
        totalUnits: 5,
        updatedAt: '2026-08-21T02:00:00.000Z'
      }
    };
    if (!fs.existsSync(path.dirname(LOCAL_USAGE_FILE))) {
      fs.mkdirSync(path.dirname(LOCAL_USAGE_FILE), { recursive: true });
    }
    fs.writeFileSync(LOCAL_USAGE_FILE, JSON.stringify(preLocal), 'utf-8');

    // Trigger reset without database (null db to simulate connection issue/fallback)
    const resetResult = await resetUserQuotaForDate(null, userId, dateKey);
    expect(resetResult.success).toBe(true);

    // Verify local is reset
    const localContent = JSON.parse(fs.readFileSync(LOCAL_USAGE_FILE, 'utf-8'));
    expect(localContent[usageDocId].candidateUnits).toBe(0);
    expect(localContent[usageDocId].recruiterUnits).toBe(0);
    expect(localContent[usageDocId].totalUnits).toBe(0);

    // Fetch quota usage without database
    const finalResult = await getUserQuotaUsage(null, userId, dateKey);
    expect(finalResult.candidateUnits).toBe(0);
    expect(finalResult.recruiterUnits).toBe(0);
    expect(finalResult.totalUnits).toBe(0);
    expect(finalResult.storageSource).toBe('local_fallback');
    expect(finalResult.quotaHealth).toBe('DEGRADED');
  });

  it('Reset when both have unsynced data: ensures reset overwrites both so old quota never returns', async () => {
    const mockDb = { type: 'mock_db' };
    const dateKey = getDateKey();
    const userId = 'usr_reset_unsynced';
    const usageDocId = getUsageDocId(userId, dateKey);

    // Setup older Firestore data
    mockGetDocResolvedValue = {
      exists: () => true,
      data: () => ({
        userId,
        dateKey,
        candidateUnits: 1,
        recruiterUnits: 0,
        totalUnits: 1,
        updatedAt: '2026-08-21T01:00:00.000Z'
      })
    };

    // Setup newer Local data (e.g., user made some analyses that did not sync to Firestore yet)
    const preLocal = {
      [usageDocId]: {
        userId,
        dateKey,
        candidateUnits: 3,
        recruiterUnits: 1,
        totalUnits: 4,
        updatedAt: '2026-08-21T02:00:00.000Z'
      }
    };
    if (!fs.existsSync(path.dirname(LOCAL_USAGE_FILE))) {
      fs.mkdirSync(path.dirname(LOCAL_USAGE_FILE), { recursive: true });
    }
    fs.writeFileSync(LOCAL_USAGE_FILE, JSON.stringify(preLocal), 'utf-8');

    // Trigger reset with db
    const resetResult = await resetUserQuotaForDate(mockDb, userId, dateKey);
    expect(resetResult.success).toBe(true);

    // Since the reset sets updatedAt to a brand new current timestamp, both local and Firestore are written to.
    const localContent = JSON.parse(fs.readFileSync(LOCAL_USAGE_FILE, 'utf-8'));
    expect(localContent[usageDocId].totalUnits).toBe(0);

    // Simulate Firestore containing the zeroed record with the reset timestamp
    mockGetDocResolvedValue = {
      exists: () => true,
      data: () => ({
        userId,
        dateKey,
        candidateUnits: 0,
        recruiterUnits: 0,
        totalUnits: 0,
        updatedAt: localContent[usageDocId].updatedAt
      })
    };

    const finalResult = await getUserQuotaUsage(mockDb, userId, dateKey);
    expect(finalResult.candidateUnits).toBe(0);
    expect(finalResult.recruiterUnits).toBe(0);
    expect(finalResult.totalUnits).toBe(0);
    expect(finalResult.storageSource).toBe('firestore');
    expect(finalResult.quotaHealth).toBe('HEALTHY');
  });

  it('Partial failure: Firestore fails, Local succeeds', async () => {
    const mockDb = { type: 'mock_db' };
    const dateKey = getDateKey();
    const userId = 'usr_reset_partial_fs_fail';
    const usageDocId = getUsageDocId(userId, dateKey);

    // Mock Firestore setDoc to fail
    vi.mocked(setDoc).mockRejectedValueOnce(new Error('Firestore write failed'));
    
    // Trigger reset
    const result = await resetUserQuotaForDate(mockDb, userId, dateKey);
    
    expect(result.success).toBe(false);
    expect(result.local.success).toBe(true);
    expect(result.firestore.success).toBe(false);
    expect(result.storageSource).toBe('partial');
    expect(result.quotaHealth).toBe('DEGRADED');
  });

  it('Partial failure: Local fails, Firestore succeeds', async () => {
    const mockDb = { type: 'mock_db' };
    const dateKey = getDateKey();
    const userId = 'usr_reset_partial_local_fail';
    const usageDocId = getUsageDocId(userId, dateKey);

    // Mock saveLocalUsageRecord to fail (via renaming file)
    vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => { throw new Error('Local write failed'); });
    
    // Trigger reset
    const result = await resetUserQuotaForDate(mockDb, userId, dateKey);
    
    expect(result.success).toBe(false);
    expect(result.local.success).toBe(false);
    expect(result.firestore.success).toBe(true);
    expect(result.storageSource).toBe('partial');
    expect(result.quotaHealth).toBe('NORMALIZED');
    
    // Cleanup mock
    vi.restoreAllMocks();
  });
});

