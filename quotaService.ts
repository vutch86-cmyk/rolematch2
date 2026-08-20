import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import crypto from 'crypto';

export interface QuotaReservationResult {
  allowed: boolean;
  unlimited?: boolean;
  dateKey: string;
  dailyLimit: number;
  usedBefore: number;
  usedAfter: number;
  requested: number;
  remaining: number;
  resetAt: string;
  code?: 'DAILY_AI_LIMIT_EXCEEDED' | 'QUOTA_SERVICE_UNAVAILABLE';
}

export function getDateKey(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

export function getResetAt(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
  
  // Next day 00:00:00 in Asia/Ho_Chi_Minh (UTC+7)
  const nextDayVnUtc = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
  return nextDayVnUtc.toISOString();
}

export function normalizeUserId(userId: any): string {
  if (userId === null || userId === undefined) {
    throw new Error('AUTH_REQUIRED');
  }
  const str = String(userId).trim();
  if (!str) {
    throw new Error('AUTH_REQUIRED');
  }
  return str.replace(/[\/\s]/g, '_');
}

export function getUsageDocId(userId: string, dateKey: string): string {
  const cleanId = normalizeUserId(userId);
  return `${cleanId}_${dateKey}`;
}

export function hashRequestId(userId: string, dateKey: string, requestId: string): string {
  const raw = `${userId}__${dateKey}__${requestId.trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function getQuotaHealth(usage: any): 'HEALTHY' | 'NORMALIZED' | 'ERROR' {
  if (!usage || typeof usage !== 'object') return 'ERROR';
  const c = usage.candidateUnits;
  const r = usage.recruiterUnits;
  const t = usage.totalUnits;

  const isFiniteNum = (val: any) => typeof val === 'number' && Number.isFinite(val) && val >= 0;

  if (isFiniteNum(c) && isFiniteNum(r) && isFiniteNum(t) && t === (c + r)) {
    return 'HEALTHY';
  }
  return 'NORMALIZED';
}

export async function getAiQuotaSettings(db: any): Promise<{ limitEnabled: boolean; dailyLimit: number; timezone: string }> {
  if (!db) {
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
  try {
    const settingsRef = doc(db, 'system_settings', 'ai_quota');
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        limitEnabled: typeof data?.limitEnabled === 'boolean' ? data.limitEnabled : true,
        dailyLimit: typeof data?.dailyLimit === 'number' && data.dailyLimit >= 1 ? Math.floor(data.dailyLimit) : 10,
        timezone: data?.timezone || 'Asia/Ho_Chi_Minh'
      };
    }
  } catch (err: any) {
    console.error('Error fetching ai quota settings from system_settings:', err);
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }

  // Default settings if document doesn't exist yet: fail-closed default with limitEnabled = true
  const defaultSettings = {
    limitEnabled: true,
    dailyLimit: 10,
    timezone: 'Asia/Ho_Chi_Minh'
  };

  try {
    const settingsRef = doc(db, 'system_settings', 'ai_quota');
    await setDoc(settingsRef, {
      ...defaultSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    });
    return defaultSettings;
  } catch (err: any) {
    console.error('Failed to create default ai quota settings in system_settings:', err);
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
}

export async function updateAiQuotaSettings(db: any, { limitEnabled, dailyLimit, userEmail }: { limitEnabled?: boolean; dailyLimit?: number; userEmail?: string }) {
  if (!db) throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  const current = await getAiQuotaSettings(db);
  const updated = {
    ...current,
    ...(typeof limitEnabled === 'boolean' ? { limitEnabled } : {}),
    ...(typeof dailyLimit === 'number' && dailyLimit >= 1 ? { dailyLimit: Math.floor(dailyLimit) } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || 'admin'
  };

  try {
    const settingsRef = doc(db, 'system_settings', 'ai_quota');
    await setDoc(settingsRef, updated);
  } catch (err: any) {
    console.error('Error updating ai quota settings in system_settings:', err);
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }

  return updated;
}

export async function reserveAiQuota(
  db: any,
  { user, units, source, requestId }: { user: any; units: number; source: 'candidate' | 'recruiter_batch'; requestId: string }
): Promise<QuotaReservationResult> {
  if (!db) {
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }

  if (!user || user.id === undefined || user.id === null) {
    throw new Error('AUTH_REQUIRED');
  }

  const userId = normalizeUserId(user.id);

  if (!Number.isInteger(units) || units < 1) {
    throw new Error('INVALID_UNITS');
  }

  if (source !== 'candidate' && source !== 'recruiter_batch') {
    throw new Error('INVALID_SOURCE');
  }

  if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
    throw new Error('INVALID_REQUEST_ID');
  }

  if (user.role === 'admin') {
    return {
      allowed: true,
      unlimited: true,
      dateKey: getDateKey(),
      dailyLimit: 0,
      usedBefore: 0,
      usedAfter: 0,
      requested: units,
      remaining: 0,
      resetAt: getResetAt()
    };
  }

  const dateKey = getDateKey();
  const usageDocId = getUsageDocId(userId, dateKey);
  const requestIdHash = hashRequestId(userId, dateKey, requestId);

  const settingsRef = doc(db, 'system_settings', 'ai_quota');
  const usageRef = doc(db, 'ai_usage', usageDocId);
  const reservationRef = doc(db, 'ai_reservations', requestIdHash);

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST (MANDATORY ORDER)
      const reservationDoc = await transaction.get(reservationRef);
      const settingsDoc = await transaction.get(settingsRef);
      const usageDoc = await transaction.get(usageRef);

      // 2. CHECK EXISTING RESERVATION (Idempotency)
      if (reservationDoc.exists()) {
        const resData = reservationDoc.data();
        if (resData && resData.result && typeof resData.result === 'object' && typeof resData.result.allowed === 'boolean') {
          return resData.result as QuotaReservationResult;
        }
      }

      // 3. NORMALIZE SETTINGS
      let settings: any;
      let needWriteSettings = false;
      if (!settingsDoc.exists()) {
        settings = {
          limitEnabled: true,
          dailyLimit: 10,
          timezone: 'Asia/Ho_Chi_Minh',
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        };
        needWriteSettings = true;
      } else {
        settings = settingsDoc.data();
      }

      const limitEnabled = settings.limitEnabled !== undefined ? !!settings.limitEnabled : true;
      const dailyLimit = typeof settings.dailyLimit === 'number' && Number.isFinite(settings.dailyLimit) && settings.dailyLimit >= 1
        ? Math.floor(settings.dailyLimit)
        : 10;

      // 4. NORMALIZE USAGE DATA
      let candidateUnitsBefore = 0;
      let recruiterUnitsBefore = 0;
      let username = user.username || user.email || userId;

      if (usageDoc.exists()) {
        const u = usageDoc.data() || {};
        candidateUnitsBefore = Number.isFinite(Number(u.candidateUnits)) && Number(u.candidateUnits) >= 0 ? Math.floor(Number(u.candidateUnits)) : 0;
        recruiterUnitsBefore = Number.isFinite(Number(u.recruiterUnits)) && Number(u.recruiterUnits) >= 0 ? Math.floor(Number(u.recruiterUnits)) : 0;
        if (u.username) username = String(u.username);
      }

      const usedBefore = candidateUnitsBefore + recruiterUnitsBefore;

      // 5. EVALUATE QUOTA LIMIT
      if (limitEnabled && usedBefore + units > dailyLimit) {
        const failResult: QuotaReservationResult = {
          allowed: false,
          dateKey,
          dailyLimit,
          usedBefore,
          usedAfter: usedBefore,
          requested: units,
          remaining: Math.max(0, dailyLimit - usedBefore),
          resetAt: getResetAt(),
          code: 'DAILY_AI_LIMIT_EXCEEDED'
        };

        // ALL WRITES AT THE END
        if (needWriteSettings) {
          transaction.set(settingsRef, settings);
        }
        transaction.set(reservationRef, {
          userId,
          dateKey,
          requestIdHash,
          source,
          units,
          result: failResult,
          createdAt: new Date().toISOString()
        });

        return failResult;
      }

      // 6. CALCULATE UPDATED USAGE
      const candidateInc = source === 'candidate' ? units : 0;
      const recruiterInc = source === 'recruiter_batch' ? units : 0;
      const newCandidateUnits = candidateUnitsBefore + candidateInc;
      const newRecruiterUnits = recruiterUnitsBefore + recruiterInc;
      const newTotalUnits = newCandidateUnits + newRecruiterUnits;

      const updatedUsage = {
        userId,
        username,
        dateKey,
        timezone: 'Asia/Ho_Chi_Minh',
        candidateUnits: newCandidateUnits,
        recruiterUnits: newRecruiterUnits,
        totalUnits: newTotalUnits,
        updatedAt: new Date().toISOString()
      };

      const successResult: QuotaReservationResult = {
        allowed: true,
        dateKey,
        dailyLimit,
        usedBefore,
        usedAfter: newTotalUnits,
        requested: units,
        remaining: limitEnabled ? Math.max(0, dailyLimit - newTotalUnits) : dailyLimit,
        resetAt: getResetAt()
      };

      // 7. ALL WRITES AT THE END (NO GETS AFTER THIS POINT)
      if (needWriteSettings) {
        transaction.set(settingsRef, settings);
      }
      transaction.set(usageRef, updatedUsage);
      transaction.set(reservationRef, {
        userId,
        dateKey,
        requestIdHash,
        source,
        units,
        result: successResult,
        createdAt: new Date().toISOString()
      });

      return successResult;
    });
  } catch (err: any) {
    console.error('Error in reserveAiQuota transaction:', err);
    if (err?.message === 'AUTH_REQUIRED' || err?.message === 'INVALID_UNITS' || err?.message === 'INVALID_SOURCE' || err?.message === 'INVALID_REQUEST_ID') {
      throw err;
    }
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
}

export async function resetUserQuotaForDate(db: any, userId: string, dateKey?: string): Promise<boolean> {
  if (!db) throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  const cleanId = normalizeUserId(userId);
  const dk = dateKey || getDateKey();
  const usageDocId = getUsageDocId(cleanId, dk);

  const resetData = {
    userId: cleanId,
    dateKey: dk,
    candidateUnits: 0,
    recruiterUnits: 0,
    totalUnits: 0,
    updatedAt: new Date().toISOString()
  };

  const primaryUsageRef = doc(db, 'ai_usage', usageDocId);
  await setDoc(primaryUsageRef, resetData, { merge: true });

  return true;
}
