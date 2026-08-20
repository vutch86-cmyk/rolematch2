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

export async function getAiQuotaSettings(db: any): Promise<{ limitEnabled: boolean; dailyLimit: number; timezone: string }> {
  if (!db) {
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
  const settingsRef = doc(db, 'system_settings', 'ai_quota');
  try {
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        limitEnabled: !!data.limitEnabled,
        dailyLimit: typeof data.dailyLimit === 'number' && data.dailyLimit >= 1 ? data.dailyLimit : 10,
        timezone: data.timezone || 'Asia/Ho_Chi_Minh'
      };
    } else {
      const defaultSettings = {
        limitEnabled: false,
        dailyLimit: 10,
        timezone: 'Asia/Ho_Chi_Minh',
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      };
      await setDoc(settingsRef, defaultSettings);
      return defaultSettings;
    }
  } catch (err) {
    console.error('Error fetching ai quota settings:', err);
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
}

export async function updateAiQuotaSettings(db: any, { limitEnabled, dailyLimit, userEmail }: { limitEnabled?: boolean; dailyLimit?: number; userEmail?: string }) {
  if (!db) throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  const settingsRef = doc(db, 'system_settings', 'ai_quota');
  try {
    const current = await getAiQuotaSettings(db);
    const updated = {
      ...current,
      ...(typeof limitEnabled === 'boolean' ? { limitEnabled } : {}),
      ...(typeof dailyLimit === 'number' && dailyLimit >= 1 ? { dailyLimit } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || 'admin'
    };
    await setDoc(settingsRef, updated);
    return updated;
  } catch (err) {
    console.error('Error updating ai quota settings:', err);
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
}

function hashRequestId(userId: string, dateKey: string, requestId: string): string {
  const raw = `${userId}__${dateKey}__${requestId.trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function reserveAiQuota(
  db: any,
  { user, units, source, requestId }: { user: any; units: number; source: 'candidate' | 'recruiter_batch'; requestId: string }
): Promise<QuotaReservationResult> {
  if (!db) {
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }

  if (!user || !user.id) {
    throw new Error('AUTH_REQUIRED');
  }

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
  const userId = String(user.id);
  const usageRef = doc(db, 'ai_usage', `${userId}_${dateKey}`);
  const settingsRef = doc(db, 'system_settings', 'ai_quota');
  const requestIdHash = hashRequestId(userId, dateKey, requestId);
  const reservationRef = doc(db, 'ai_reservations', requestIdHash);

  try {
    return await runTransaction(db, async (transaction) => {
      const reservationDoc = await transaction.get(reservationRef);
      if (reservationDoc.exists()) {
        const resData = reservationDoc.data();
        if (resData && resData.result) {
          return resData.result as QuotaReservationResult;
        }
      }

      const settingsDoc = await transaction.get(settingsRef);
      let settings: any;
      if (!settingsDoc.exists()) {
        settings = {
          limitEnabled: false,
          dailyLimit: 10,
          timezone: 'Asia/Ho_Chi_Minh',
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        };
        transaction.set(settingsRef, settings);
      } else {
        settings = settingsDoc.data();
      }

      const limitEnabled = !!settings.limitEnabled;
      const dailyLimit = typeof settings.dailyLimit === 'number' && settings.dailyLimit >= 1 ? settings.dailyLimit : 10;

      const usageDoc = await transaction.get(usageRef);
      const usage = usageDoc.exists() ? usageDoc.data() : {
        userId,
        username: user.username || user.email || userId,
        dateKey,
        timezone: 'Asia/Ho_Chi_Minh',
        candidateUnits: 0,
        recruiterUnits: 0,
        totalUnits: 0,
        updatedAt: new Date().toISOString()
      };

      const candidateUnitsBefore = Number(usage.candidateUnits) || 0;
      const recruiterUnitsBefore = Number(usage.recruiterUnits) || 0;
      const usedBefore = Number(usage.totalUnits) || (candidateUnitsBefore + recruiterUnitsBefore);

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

      const candidateInc = source === 'candidate' ? units : 0;
      const recruiterInc = source === 'recruiter_batch' ? units : 0;
      const newCandidateUnits = candidateUnitsBefore + candidateInc;
      const newRecruiterUnits = recruiterUnitsBefore + recruiterInc;
      const newTotalUnits = usedBefore + units;

      const updatedUsage = {
        userId,
        username: user.username || user.email || usage.username || userId,
        dateKey,
        timezone: 'Asia/Ho_Chi_Minh',
        candidateUnits: newCandidateUnits,
        recruiterUnits: newRecruiterUnits,
        totalUnits: newTotalUnits,
        updatedAt: new Date().toISOString()
      };

      transaction.set(usageRef, updatedUsage);

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
