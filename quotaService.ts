import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

function getLocalUsageFile(): string {
  const DATA_DIR = process.env.TEST_DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(DATA_DIR, 'ai_usage.json');
}

function getLocalSettingsFile(): string {
  const DATA_DIR = process.env.TEST_DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(DATA_DIR, 'app_settings.json');
}

function ensureDataDir(dataDir?: string): void {
  try {
    const dir = dataDir || process.env.TEST_DATA_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // ignore
  }
}

function getLocalSettings(): { limitEnabled: boolean; dailyLimit: number; timezone: string } {
  try {
    const file = getLocalSettingsFile();
    ensureDataDir(path.dirname(file));
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      return {
        limitEnabled: typeof data?.limitEnabled === 'boolean' ? data.limitEnabled : true,
        dailyLimit: typeof data?.dailyLimit === 'number' && data.dailyLimit >= 1 ? Math.floor(data.dailyLimit) : 5,
        timezone: data?.timezone || 'Asia/Ho_Chi_Minh'
      };
    }
  } catch (e) {
    console.warn('Error reading local app settings:', e);
  }
  return {
    limitEnabled: true,
    dailyLimit: 5,
    timezone: 'Asia/Ho_Chi_Minh'
  };
}

function saveLocalSettings(settings: { limitEnabled: boolean; dailyLimit: number; timezone?: string }): void {
  try {
    const file = getLocalSettingsFile();
    ensureDataDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify({
      limitEnabled: settings.limitEnabled,
      dailyLimit: settings.dailyLimit,
      timezone: settings.timezone || 'Asia/Ho_Chi_Minh',
      updatedAt: new Date().toISOString()
    }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error saving local app settings:', e);
  }
}

function getLocalUsageMap(): Record<string, any> {
  try {
    const file = getLocalUsageFile();
    ensureDataDir(path.dirname(file));
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw) || {};
    }
  } catch (e) {
    console.warn('Error reading local ai usage file:', e);
  }
  return {};
}

function saveLocalUsageRecord(usageDocId: string, usageData: any): void {
  const file = getLocalUsageFile();
  ensureDataDir(path.dirname(file));
  const map = getLocalUsageMap();
  map[usageDocId] = usageData;
  fs.writeFileSync(file, JSON.stringify(map, null, 2), 'utf-8');
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
      const res = {
        limitEnabled: typeof data?.limitEnabled === 'boolean' ? data.limitEnabled : true,
        dailyLimit: typeof data?.dailyLimit === 'number' && data.dailyLimit >= 1 ? Math.floor(data.dailyLimit) : 10,
        timezone: data?.timezone || 'Asia/Ho_Chi_Minh'
      };
      saveLocalSettings(res);
      return res;
    }
  } catch (err: any) {
    console.warn('Firestore settings fetch not available, falling back to local settings file:', err?.message);
  }

  return getLocalSettings();
}

export async function updateAiQuotaSettings(
  db: any,
  { limitEnabled, dailyLimit, userEmail }: { limitEnabled?: boolean; dailyLimit?: number; userEmail?: string }
): Promise<{ limitEnabled: boolean; dailyLimit: number; timezone: string }> {
  if (!db) {
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }
  const current = await getAiQuotaSettings(db);
  const updated = {
    ...current,
    ...(typeof limitEnabled === 'boolean' ? { limitEnabled } : {}),
    ...(typeof dailyLimit === 'number' && dailyLimit >= 1 ? { dailyLimit: Math.floor(dailyLimit) } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || 'admin'
  };

  saveLocalSettings(updated);

  if (db) {
    try {
      const settingsRef = doc(db, 'system_settings', 'ai_quota');
      await setDoc(settingsRef, updated);
    } catch (err: any) {
      console.warn('Unable to sync updated quota settings to Firestore:', err?.message);
    }
  }

  return updated;
}

export async function reserveAiQuota(
  db: any,
  { user, units, source, requestId }: { user: any; units: number; source: 'candidate' | 'recruiter_batch'; requestId: string }
): Promise<QuotaReservationResult> {
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

  if (!db) {
    throw new Error('QUOTA_SERVICE_UNAVAILABLE');
  }

  // Try Firestore transaction if db is available
  if (db) {
    try {
      const settingsRef = doc(db, 'system_settings', 'ai_quota');
      const usageRef = doc(db, 'ai_usage', usageDocId);
      const reservationRef = doc(db, 'ai_reservations', requestIdHash);

      return await runTransaction(db, async (transaction) => {
        const reservationDoc = await transaction.get(reservationRef);
        const settingsDoc = await transaction.get(settingsRef);
        const usageDoc = await transaction.get(usageRef);

        if (reservationDoc.exists()) {
          const resData = reservationDoc.data();
          if (resData && resData.result && typeof resData.result === 'object' && typeof resData.result.allowed === 'boolean') {
            return resData.result as QuotaReservationResult;
          }
        }

        let settings: any;
        let needWriteSettings = false;
        if (!settingsDoc.exists()) {
          settings = getLocalSettings();
          needWriteSettings = true;
        } else {
          settings = settingsDoc.data();
        }

        const limitEnabled = settings.limitEnabled !== undefined ? !!settings.limitEnabled : true;
        const dailyLimit = typeof settings.dailyLimit === 'number' && Number.isFinite(settings.dailyLimit) && settings.dailyLimit >= 1
          ? Math.floor(settings.dailyLimit)
          : 10;

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

        saveLocalUsageRecord(usageDocId, updatedUsage);
        return successResult;
      });
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED' || err?.message === 'INVALID_UNITS' || err?.message === 'INVALID_SOURCE' || err?.message === 'INVALID_REQUEST_ID') {
        throw err;
      }
      console.warn('Firestore transaction failed, switching to local quota engine fallback:', err?.message);
    }
  }

  // Local fallback engine
  const settings = getLocalSettings();
  const limitEnabled = settings.limitEnabled !== undefined ? !!settings.limitEnabled : true;
  const dailyLimit = typeof settings.dailyLimit === 'number' && Number.isFinite(settings.dailyLimit) && settings.dailyLimit >= 1
    ? Math.floor(settings.dailyLimit)
    : 10;

  const usageMap = getLocalUsageMap();
  const currentUsage = usageMap[usageDocId] || { candidateUnits: 0, recruiterUnits: 0, totalUnits: 0 };
  const candidateUnitsBefore = Number.isFinite(Number(currentUsage.candidateUnits)) ? Math.floor(Number(currentUsage.candidateUnits)) : 0;
  const recruiterUnitsBefore = Number.isFinite(Number(currentUsage.recruiterUnits)) ? Math.floor(Number(currentUsage.recruiterUnits)) : 0;
  const usedBefore = candidateUnitsBefore + recruiterUnitsBefore;

  if (limitEnabled && usedBefore + units > dailyLimit) {
    return {
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
  }

  const candidateInc = source === 'candidate' ? units : 0;
  const recruiterInc = source === 'recruiter_batch' ? units : 0;
  const newCandidateUnits = candidateUnitsBefore + candidateInc;
  const newRecruiterUnits = recruiterUnitsBefore + recruiterInc;
  const newTotalUnits = newCandidateUnits + newRecruiterUnits;

  const updatedUsage = {
    userId,
    username: user.username || user.email || userId,
    dateKey,
    timezone: 'Asia/Ho_Chi_Minh',
    candidateUnits: newCandidateUnits,
    recruiterUnits: newRecruiterUnits,
    totalUnits: newTotalUnits,
    updatedAt: new Date().toISOString()
  };

  saveLocalUsageRecord(usageDocId, updatedUsage);

  return {
    allowed: true,
    dateKey,
    dailyLimit,
    usedBefore,
    usedAfter: newTotalUnits,
    requested: units,
    remaining: limitEnabled ? Math.max(0, dailyLimit - newTotalUnits) : dailyLimit,
    resetAt: getResetAt()
  };
}

export interface QuotaResetResult {
  success: boolean;
  dateKey: string;
  userId: string;
  local: {
    attempted: boolean;
    success: boolean;
    error?: string;
  };
  firestore: {
    attempted: boolean;
    success: boolean;
    error?: string;
  };
  storageSource: 'firestore' | 'local_fallback' | 'partial' | 'unavailable';
  quotaHealth: 'HEALTHY' | 'DEGRADED' | 'NORMALIZED' | 'ERROR';
}

export async function resetUserQuotaForDate(db: any, userId: string, dateKey?: string): Promise<QuotaResetResult> {
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

  const result: QuotaResetResult = {
    success: false,
    dateKey: dk,
    userId: cleanId,
    local: { attempted: true, success: false },
    firestore: { attempted: false, success: false },
    storageSource: 'unavailable',
    quotaHealth: 'ERROR'
  };

  // Reset Local
  try {
    saveLocalUsageRecord(usageDocId, resetData);
    // Verify
    const map = getLocalUsageMap();
    if (map[usageDocId] && map[usageDocId].totalUnits === 0) {
      result.local.success = true;
    } else {
      result.local.error = 'Verification failed: Local data not reset';
    }
  } catch (err: any) {
    result.local.error = err?.message;
  }

  // Reset Firestore
  if (db) {
    result.firestore.attempted = true;
    try {
      const primaryUsageRef = doc(db, 'ai_usage', usageDocId);
      await setDoc(primaryUsageRef, resetData, { merge: true });
      // Verify
      const snap = await getDoc(primaryUsageRef);
      if (snap.exists() && snap.data()?.totalUnits === 0) {
        result.firestore.success = true;
      } else {
        result.firestore.error = 'Verification failed: Firestore data not reset';
      }
    } catch (err: any) {
      result.firestore.error = err?.message;
    }
  }

  // Determine Final Success
  const firestoreRequired = !!db;
  
  if (firestoreRequired) {
    if (result.firestore.success && result.local.success) {
      result.success = true;
      result.storageSource = 'firestore';
      result.quotaHealth = 'HEALTHY';
    } else if (result.firestore.success) {
      result.storageSource = 'partial';
      result.quotaHealth = 'NORMALIZED';
    } else if (result.local.success) {
      // Local succeeded, but Firestore failed, still partial
      result.storageSource = 'partial';
      result.quotaHealth = 'DEGRADED';
    }
  } else {
    // Only local attempted
    if (result.local.success) {
      result.success = true;
      result.storageSource = 'local_fallback';
      result.quotaHealth = 'DEGRADED';
    }
  }

  return result;
}

export interface UserQuotaUsageResult {
  candidateUnits: number;
  recruiterUnits: number;
  totalUnits: number;
  dailyLimit: number;
  remainingUnits: number;
  limitEnabled: boolean;
  storageSource: 'firestore' | 'local_fallback';
  quotaHealth: 'HEALTHY' | 'DEGRADED' | 'NORMALIZED' | 'ERROR';
}

export async function getUserQuotaUsage(
  db: any,
  userId: string,
  dateKey?: string,
  preloadedSettings?: { limitEnabled: boolean; dailyLimit: number; timezone: string }
): Promise<UserQuotaUsageResult> {
  const dk = dateKey || getDateKey();
  const cleanId = normalizeUserId(userId);
  const usageDocId = getUsageDocId(cleanId, dk);

  // Get quota settings
  let settings = preloadedSettings;
  if (!settings) {
    try {
      settings = await getAiQuotaSettings(db);
    } catch (err) {
      settings = getLocalSettings();
    }
  }

  const limitEnabled = settings.limitEnabled;
  const dailyLimit = settings.dailyLimit;

  let uFirestore: any = null;
  let firestoreExists = false;
  let firestoreError = false;

  // 1. Try reading from Firestore if db is available
  if (db) {
    try {
      const usageRef = doc(db, 'ai_usage', usageDocId);
      const usageSnap = await getDoc(usageRef);
      if (usageSnap.exists()) {
        uFirestore = usageSnap.data();
        firestoreExists = true;
      }
    } catch (err: any) {
      firestoreError = true;
      console.warn(`Firestore read failed for user quota of ${cleanId}:`, err?.message);
    }
  } else {
    firestoreError = true;
  }

  // 2. Try reading from Local Fallback
  let uLocal: any = null;
  let localExists = false;
  try {
    const usageMap = getLocalUsageMap();
    if (usageMap && usageMap[usageDocId]) {
      uLocal = usageMap[usageDocId];
      localExists = true;
    }
  } catch (err: any) {
    console.warn(`Local fallback read failed for user quota of ${cleanId}:`, err?.message);
  }

  // 3. Reconcile Firestore vs. Local Fallback
  let finalUsage: any = null;
  let source: 'firestore' | 'local_fallback' = 'firestore';
  let health: 'HEALTHY' | 'DEGRADED' | 'NORMALIZED' | 'ERROR' = 'HEALTHY';

  if (firestoreExists && localExists) {
    // Both exist, determine which is newer or should be preferred
    const fsUpdatedAt = uFirestore.updatedAt;
    const localUpdatedAt = uLocal.updatedAt;

    const fsTime = fsUpdatedAt ? Date.parse(fsUpdatedAt) : NaN;
    const localTime = localUpdatedAt ? Date.parse(localUpdatedAt) : NaN;

    const fsCandidateUnits = Number.isFinite(Number(uFirestore.candidateUnits)) && Number(uFirestore.candidateUnits) >= 0 ? Math.floor(Number(uFirestore.candidateUnits)) : 0;
    const fsRecruiterUnits = Number.isFinite(Number(uFirestore.recruiterUnits)) && Number(uFirestore.recruiterUnits) >= 0 ? Math.floor(Number(uFirestore.recruiterUnits)) : 0;
    const fsTotal = Number.isFinite(Number(uFirestore.totalUnits)) && Number(uFirestore.totalUnits) >= 0 ? Math.floor(Number(uFirestore.totalUnits)) : (fsCandidateUnits + fsRecruiterUnits);

    const localCandidateUnits = Number.isFinite(Number(uLocal.candidateUnits)) && Number(uLocal.candidateUnits) >= 0 ? Math.floor(Number(uLocal.candidateUnits)) : 0;
    const localRecruiterUnits = Number.isFinite(Number(uLocal.recruiterUnits)) && Number(uLocal.recruiterUnits) >= 0 ? Math.floor(Number(uLocal.recruiterUnits)) : 0;
    const localTotal = Number.isFinite(Number(uLocal.totalUnits)) && Number(uLocal.totalUnits) >= 0 ? Math.floor(Number(uLocal.totalUnits)) : (localCandidateUnits + localRecruiterUnits);

    if (!isNaN(fsTime) && !isNaN(localTime)) {
      if (localTime > fsTime) {
        // Local fallback is newer
        finalUsage = uLocal;
        source = 'local_fallback';
        health = 'DEGRADED';
      } else {
        // Firestore is newer or equal
        finalUsage = uFirestore;
        source = 'firestore';
        const rawHealth = getQuotaHealth(uFirestore);
        health = rawHealth === 'HEALTHY' ? 'HEALTHY' : 'NORMALIZED';
      }
    } else {
      // Missing/invalid timestamp: apply safety and consistency rule - use whichever reports higher total usage
      if (localTotal > fsTotal) {
        finalUsage = uLocal;
        source = 'local_fallback';
        health = 'DEGRADED';
      } else {
        finalUsage = uFirestore;
        source = 'firestore';
        const rawHealth = getQuotaHealth(uFirestore);
        health = rawHealth === 'HEALTHY' ? 'HEALTHY' : 'NORMALIZED';
      }
    }
  } else if (firestoreExists) {
    // Only Firestore exists
    finalUsage = uFirestore;
    source = 'firestore';
    const rawHealth = getQuotaHealth(uFirestore);
    health = rawHealth === 'HEALTHY' ? 'HEALTHY' : 'NORMALIZED';
  } else if (localExists) {
    // Only local exists (Firestore is missing/failed or did not exist yet)
    finalUsage = uLocal;
    source = 'local_fallback';
    health = 'DEGRADED';
  } else {
    // Neither exists: user new or no usage
    finalUsage = null;
    source = firestoreError ? 'local_fallback' : 'firestore';
    health = firestoreError ? 'DEGRADED' : 'HEALTHY';
  }

  // Parse fields from finalUsage
  let candidateUnits = 0;
  let recruiterUnits = 0;
  let totalUnits = 0;

  if (finalUsage) {
    candidateUnits = Number.isFinite(Number(finalUsage.candidateUnits)) && Number(finalUsage.candidateUnits) >= 0 ? Math.floor(Number(finalUsage.candidateUnits)) : 0;
    recruiterUnits = Number.isFinite(Number(finalUsage.recruiterUnits)) && Number(finalUsage.recruiterUnits) >= 0 ? Math.floor(Number(finalUsage.recruiterUnits)) : 0;
    totalUnits = Number.isFinite(Number(finalUsage.totalUnits)) && Number(finalUsage.totalUnits) >= 0 ? Math.floor(Number(finalUsage.totalUnits)) : (candidateUnits + recruiterUnits);
  }

  return {
    candidateUnits,
    recruiterUnits,
    totalUnits,
    dailyLimit,
    remainingUnits: limitEnabled ? Math.max(0, dailyLimit - totalUnits) : dailyLimit,
    limitEnabled,
    storageSource: source,
    quotaHealth: health
  };
}
