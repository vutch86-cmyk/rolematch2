import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  resetUserQuotaForDate
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
});
