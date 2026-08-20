import { doc, getDoc, setDoc, runTransaction, collection, DocumentReference } from 'firebase/firestore';

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
  // Use Asia/Ho_Chi_Minh timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

export function getResetAt(): string {
  const date = new Date();
  // Get next day at 00:00:00 in Asia/Ho_Chi_Minh
  const nextDay = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);
  return nextDay.toISOString();
}

export async function reserveAiQuota(db: any, { user, units, source, requestId }: { user: any, units: number, source: 'candidate' | 'recruiter_batch', requestId: string }): Promise<QuotaReservationResult> {
  if (!db) {
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
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
  const usageRef = doc(db, 'ai_usage', `${user.id}_${dateKey}`);
  const settingsRef = doc(db, 'system_settings', 'ai_quota');

  try {
    return await runTransaction(db, async (transaction) => {
      const settingsDoc = await transaction.get(settingsRef);
      const usageDoc = await transaction.get(usageRef);

      const settings = settingsDoc.exists() ? settingsDoc.data() : { limitEnabled: false, dailyLimit: 10 };
      if (!settings.limitEnabled) {
        return {
          allowed: true,
          dateKey,
          dailyLimit: settings.dailyLimit,
          usedBefore: 0,
          usedAfter: 0,
          requested: units,
          remaining: settings.dailyLimit,
          resetAt: getResetAt()
        };
      }

      const usage = usageDoc.exists() ? usageDoc.data() : { 
          userId: user.id, 
          username: user.username,
          dateKey,
          timezone: 'Asia/Ho_Chi_Minh',
          candidateUnits: 0,
          recruiterUnits: 0,
          totalUnits: 0,
          updatedAt: new Date().toISOString()
      };

      if (usage.totalUnits + units > settings.dailyLimit) {
        return {
          allowed: false,
          dateKey,
          dailyLimit: settings.dailyLimit,
          usedBefore: usage.totalUnits,
          usedAfter: usage.totalUnits,
          requested: units,
          remaining: Math.max(0, settings.dailyLimit - usage.totalUnits),
          resetAt: getResetAt(),
          code: 'DAILY_AI_LIMIT_EXCEEDED'
        };
      }

      // Update usage
      const updatedUsage = {
        ...usage,
        [`${source}Units`]: (usage[`${source}Units`] || 0) + units,
        totalUnits: usage.totalUnits + units,
        updatedAt: new Date().toISOString()
      };

      transaction.set(usageRef, updatedUsage);

      return {
        allowed: true,
        dateKey,
        dailyLimit: settings.dailyLimit,
        usedBefore: usage.totalUnits,
        usedAfter: updatedUsage.totalUnits,
        requested: units,
        remaining: settings.dailyLimit - updatedUsage.totalUnits,
        resetAt: getResetAt()
      };
    });
  } catch (err) {
    console.error('Error in reserveAiQuota transaction:', err);
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
}
