import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isStoredUserDocument,
  normalizeStoredUsers,
  ensureDefaultUsers,
  AuthDatabaseUnavailableError,
  StoredUser
} from '../server';
import { getAiQuotaSettings, updateAiQuotaSettings, reserveAiQuota } from '../quotaService';

describe('Strict StoredUser Schema Type Guard', () => {
  const validAdmin: StoredUser = {
    id: 'usr_admin_001',
    username: 'admin',
    passwordHash: '$2b$10$3vzYSF/.B9xDoTWHtHYRm.qYv3MZppm2z1MYr7lx9dHkIxsDH7is.',
    fullName: 'Quản trị viên (Admin)',
    role: 'admin',
    createdAt: '2026-08-11T00:00:00.000Z',
  };

  const validNormalUser: StoredUser = {
    id: 'usr_user_002',
    username: 'phat',
    passwordHash: '$2b$10$RYHUpeOFVL5IS9dD7hSc3uGH7P6q4Th/n9ephhTmXwecD1tQX/HCW',
    fullName: 'Phat Developer',
    role: 'normal',
    createdAt: '2026-08-15T12:00:00.000Z',
    isLocked: false,
    failedLoginAttempts: 0,
    dailyAnalysisCount: { '2026-08-20': 2 }
  };

  it('validates a correct admin user document', () => {
    expect(isStoredUserDocument(validAdmin)).toBe(true);
  });

  it('validates a correct normal user document with optional fields', () => {
    expect(isStoredUserDocument(validNormalUser)).toBe(true);
  });

  it('rejects null, non-objects, and arrays', () => {
    expect(isStoredUserDocument(null)).toBe(false);
    expect(isStoredUserDocument(undefined)).toBe(false);
    expect(isStoredUserDocument('string')).toBe(false);
    expect(isStoredUserDocument(123)).toBe(false);
    expect(isStoredUserDocument([validAdmin])).toBe(false);
  });

  it('rejects documents with missing or invalid required fields', () => {
    // Missing id
    expect(isStoredUserDocument({ ...validAdmin, id: '' })).toBe(false);
    // Missing username
    expect(isStoredUserDocument({ ...validAdmin, username: '' })).toBe(false);
    // Missing passwordHash
    expect(isStoredUserDocument({ ...validAdmin, passwordHash: '' })).toBe(false);
    // Invalid passwordHash format (not bcrypt)
    expect(isStoredUserDocument({ ...validAdmin, passwordHash: 'plain_password' })).toBe(false);
    expect(isStoredUserDocument({ ...validAdmin, passwordHash: '123456' })).toBe(false);
    // Invalid role
    expect(isStoredUserDocument({ ...validAdmin, role: 'superadmin' })).toBe(false);
    expect(isStoredUserDocument({ ...validAdmin, role: 'guest' })).toBe(false);
    // Invalid createdAt
    expect(isStoredUserDocument({ ...validAdmin, createdAt: 'not-a-date' })).toBe(false);
    // Missing fullName
    expect(isStoredUserDocument({ ...validAdmin, fullName: '' })).toBe(false);
  });

  it('rejects legacy quota/settings documents mistakenly placed in users collection', () => {
    const quotaDoc = {
      id: 'system_settings_ai_quota',
      limitEnabled: true,
      dailyLimit: 10,
      timezone: 'Asia/Ho_Chi_Minh'
    };
    expect(isStoredUserDocument(quotaDoc)).toBe(false);

    const reservationDoc = {
      id: 'reservation_usr_123_req_456',
      allowed: true,
      units: 1
    };
    expect(isStoredUserDocument(reservationDoc)).toBe(false);
  });

  it('rejects documents with invalid optional field types', () => {
    expect(isStoredUserDocument({ ...validAdmin, isLocked: 'yes' as any })).toBe(false);
    expect(isStoredUserDocument({ ...validAdmin, failedLoginAttempts: -1 })).toBe(false);
    expect(isStoredUserDocument({ ...validAdmin, failedLoginAttempts: '3' as any })).toBe(false);
    expect(isStoredUserDocument({ ...validAdmin, lockedAt: 'invalid-date' })).toBe(false);
    expect(isStoredUserDocument({ ...validAdmin, dailyAnalysisCount: 'invalid' as any })).toBe(false);
    expect(isStoredUserDocument({ ...validAdmin, dailyAnalysisCount: { '2026-08-20': -5 } })).toBe(false);
  });
});

describe('Normalization Pipeline (normalizeStoredUsers)', () => {
  const validAdmin: StoredUser = {
    id: 'usr_admin_001',
    username: 'admin',
    passwordHash: '$2b$10$3vzYSF/.B9xDoTWHtHYRm.qYv3MZppm2z1MYr7lx9dHkIxsDH7is.',
    fullName: 'Quản trị viên (Admin)',
    role: 'admin',
    createdAt: '2026-08-11T00:00:00.000Z',
  };

  const validNormal: StoredUser = {
    id: 'usr_user_002',
    username: 'phat',
    passwordHash: '$2b$10$RYHUpeOFVL5IS9dD7hSc3uGH7P6q4Th/n9ephhTmXwecD1tQX/HCW',
    fullName: 'Phat Developer',
    role: 'normal',
    createdAt: '2026-08-15T12:00:00.000Z',
  };

  it('filters out malformed objects and quota documents from user arrays', () => {
    const mixedData = [
      validAdmin,
      { id: 'ai_quota', limitEnabled: true, dailyLimit: 10 },
      null,
      undefined,
      'malformed_entry',
      { id: 'user_corrupt', username: 'corrupt', role: 'invalid' },
      validNormal,
      { id: 'reservation_123', units: 5 }
    ];

    const result = normalizeStoredUsers(mixedData);
    expect(result).toHaveLength(2);
    expect(result[0].username).toBe('admin');
    expect(result[1].username).toBe('phat');
  });

  it('deduplicates case-insensitive usernames', () => {
    const duplicateUser = {
      ...validNormal,
      id: 'usr_user_003',
      username: 'PHAT',
      fullName: 'Phat Duplicate'
    };

    const result = normalizeStoredUsers([validAdmin, validNormal, duplicateUser]);
    expect(result).toHaveLength(2);
    expect(result.map(u => u.username)).toEqual(['admin', 'phat']);
  });

  it('does not mutate input objects and preserves password hashes exactly', () => {
    const originalHash = validNormal.passwordHash;
    const input = [{ ...validNormal }];
    const result = normalizeStoredUsers(input);

    expect(result[0].passwordHash).toBe(originalHash);
    expect(input[0].passwordHash).toBe(originalHash);
  });
});

describe('ensureDefaultUsers Seeding Guard', () => {
  const existingUsers: StoredUser[] = [
    {
      id: 'usr_custom_001',
      username: 'customuser',
      passwordHash: '$2b$10$3vzYSF/.B9xDoTWHtHYRm.qYv3MZppm2z1MYr7lx9dHkIxsDH7is.',
      fullName: 'Custom User',
      role: 'normal',
      createdAt: '2026-08-18T00:00:00.000Z',
    }
  ];

  const originalEnv = process.env.ENABLE_TEST_USER_SEED;

  afterEach(() => {
    process.env.ENABLE_TEST_USER_SEED = originalEnv;
  });

  it('does NOT inject default users when ENABLE_TEST_USER_SEED is false or unset', () => {
    delete process.env.ENABLE_TEST_USER_SEED;
    const result = ensureDefaultUsers(existingUsers);
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('customuser');
  });

  it('injects default admin/user1 when ENABLE_TEST_USER_SEED is "true"', () => {
    process.env.ENABLE_TEST_USER_SEED = 'true';
    const result = ensureDefaultUsers(existingUsers);
    expect(result).toHaveLength(3);
    expect(result.some(u => u.username === 'admin')).toBe(true);
    expect(result.some(u => u.username === 'user1')).toBe(true);
    expect(result.some(u => u.username === 'customuser')).toBe(true);
  });

  it('preserves existing password hashes without re-hashing', () => {
    process.env.ENABLE_TEST_USER_SEED = 'true';
    const customAdmin: StoredUser = {
      id: 'usr_admin_custom',
      username: 'admin',
      passwordHash: '$2b$10$RYHUpeOFVL5IS9dD7hSc3uGH7P6q4Th/n9ephhTmXwecD1tQX/HCW',
      fullName: 'My Admin',
      role: 'admin',
      createdAt: '2026-08-10T00:00:00.000Z',
    };

    const result = ensureDefaultUsers([customAdmin]);
    const adminUser = result.find(u => u.username === 'admin');
    expect(adminUser?.passwordHash).toBe(customAdmin.passwordHash);
  });
});

describe('Quota Isolation & Fail-Closed Behavior', () => {
  it('throws QUOTA_SERVICE_UNAVAILABLE if database reference is missing', async () => {
    await expect(getAiQuotaSettings(null)).rejects.toThrow('QUOTA_SERVICE_UNAVAILABLE');
  });

  it('updateAiQuotaSettings throws QUOTA_SERVICE_UNAVAILABLE when db is null', async () => {
    await expect(updateAiQuotaSettings(null, { limitEnabled: true })).rejects.toThrow('QUOTA_SERVICE_UNAVAILABLE');
  });
});

describe('Database Error Handling & Fallback Policy', () => {
  it('instantiates AuthDatabaseUnavailableError with code AUTH_DATABASE_UNAVAILABLE', () => {
    const err = new AuthDatabaseUnavailableError('Service down');
    expect(err.code).toBe('AUTH_DATABASE_UNAVAILABLE');
    expect(err.message).toBe('Service down');
    expect(err.name).toBe('AuthDatabaseUnavailableError');
  });
});
