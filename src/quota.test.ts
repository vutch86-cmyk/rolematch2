import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reserveAiQuota, getAiQuotaSettings, updateAiQuotaSettings, getDateKey } from '../quotaService';

describe('AI Quota Service Unit Tests', () => {
  it('getDateKey returns correct format YYYY-MM-DD', () => {
    const key = getDateKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reserveAiQuota throws QUOTA_SERVICE_UNAVAILABLE when db is null', async () => {
    const adminUser = { id: 'admin_1', role: 'admin', username: 'admin' };
    await expect(reserveAiQuota(null, {
      user: adminUser,
      units: 5,
      source: 'candidate',
      requestId: 'req_admin_1'
    })).rejects.toThrow('QUOTA_SERVICE_UNAVAILABLE');
  });
});
