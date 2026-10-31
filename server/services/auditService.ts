import path from 'path';
import fs from 'fs';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getFirestoreDb } from '../config/firebase';
import {
  LogItem,
  AuditLogItem,
  UploadedDocumentItem,
  AnalysisRecordItem,
  CreateAnalysisRecordParams,
  CandidateAuditMetadata,
} from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');

export const appLogs: LogItem[] = [];
export const MAX_LOGS = 200;

export function recordLog(log: Omit<LogItem, 'id' | 'timestamp'>): LogItem {
  const item: LogItem = {
    id: Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    ...log,
  };
  appLogs.unshift(item);
  if (appLogs.length > MAX_LOGS) {
    appLogs.pop();
  }
  return item;
}

export const auditLogs: AuditLogItem[] = [];
export const MAX_AUDIT_LOGS = 500;

export function recordAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'>): AuditLogItem {
  const item: AuditLogItem = {
    id: 'adt_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    ...log,
  };
  auditLogs.unshift(item);
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.pop();
  }
  return item;
}

export const uploadedDocuments: UploadedDocumentItem[] = [];
export const analysisRecords: AnalysisRecordItem[] = [];
export const MAX_ANALYSIS_RECORDS = 200;

export function buildCandidateAuditMetadata(
  logResult: { success: boolean; recordId?: string; error?: string } | undefined | null,
  requestId: string
): CandidateAuditMetadata {
  if (logResult && logResult.success) {
    return {
      requestId,
      saved: true,
      recordId: logResult.recordId,
    };
  }

  let errorCode: 'FIRESTORE_UNAVAILABLE' | 'PERSISTENCE_FAILED' = 'PERSISTENCE_FAILED';
  if (logResult?.error === 'FIRESTORE_UNAVAILABLE') {
    errorCode = 'FIRESTORE_UNAVAILABLE';
  }

  return {
    requestId,
    saved: false,
    errorCode,
  };
}

export function __getAnalysisRecordsForTesting(): AnalysisRecordItem[] {
  return analysisRecords;
}

export function __clearAnalysisRecordsForTesting() {
  analysisRecords.length = 0;
}

// Deeply remove undefined properties from objects/arrays before Firestore writes
export function removeUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return undefined as unknown as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      result[key] = removeUndefinedDeep(val);
    }
  }
  return result as T;
}

export async function createAnalysisRecord(
  params: CreateAnalysisRecordParams
): Promise<{ success: boolean; recordId: string; error?: string; item?: AnalysisRecordItem }> {
  const recordId =
    params.recordId || params.id || `anl_${params.requestId}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const actor = (
    params.actorUsername ||
    params.createdBy ||
    (params.userEmail ? params.userEmail.split('@')[0] : 'user_guest')
  ).trim();
  const emailField = (params.userEmail || (actor.includes('@') ? actor : `${actor}@system.local`)).trim();
  const cvFile = params.fileName || params.cvFileName || 'CV_Document.pdf';

  const item: AnalysisRecordItem = {
    id: recordId,
    recordId,
    requestId: params.requestId,
    source: params.source,
    batchId: params.batchId,
    batchName: params.batchName,
    candidateId: params.candidateId,
    candidateName: params.candidateName || actor,
    fileName: cvFile,
    cvFileName: cvFile,
    jobTitle: params.jobTitle,
    actorUsername: actor,
    createdBy: params.createdBy || actor,
    userEmail: emailField,
    status: params.status,
    overallScore: params.overallScore,
    keywordScore: params.keywordScore !== undefined ? params.keywordScore : null,
    experienceScore: params.experienceScore !== undefined ? params.experienceScore : null,
    skillsScore: params.skillsScore !== undefined ? params.skillsScore : null,
    matchLevel: params.matchLevel,
    topStrengths: Array.isArray(params.topStrengths) ? params.topStrengths : [],
    missingSkills: Array.isArray(params.missingSkills) ? params.missingSkills : [],
    recommendation: params.recommendation,
    recruiterDecision: params.recruiterDecision,
    engineUsed: params.engineUsed || 'Gemini 2.0 Flash',
    durationMs: Math.max(0, params.durationMs || 0),
    cvTextLength: params.cvTextLength || 0,
    jdTextLength: params.jdTextLength || 0,
    fullAnalysis: params.fullAnalysis,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    analyzedAt: timestamp,
  };

  const db = getFirestoreDb();

  // 1. Fail closed when Firestore is unavailable
  if (!db) {
    console.error(
      `[Analysis Log Error] Failed to persist analysis record: requestId=${params.requestId}, file=${cvFile}, error=FIRESTORE_UNAVAILABLE`
    );
    return {
      success: false,
      recordId,
      error: 'FIRESTORE_UNAVAILABLE',
      item,
    };
  }

  try {
    // 2. Primary Firestore persistence (AWAITED and SANITIZED)
    const sanitizedDoc = removeUndefinedDeep(item);
    await setDoc(doc(db, 'analysis_records', recordId), sanitizedDoc);

    // 3. Only after setDoc succeeds: update in-memory cache and local file cache
    const existingIndex = analysisRecords.findIndex((r) => r.id === recordId);
    if (existingIndex >= 0) {
      analysisRecords[existingIndex] = item;
    } else {
      analysisRecords.unshift(item);
    }

    if (analysisRecords.length > MAX_ANALYSIS_RECORDS) {
      const deleted = analysisRecords.pop();
      if (deleted && db) {
        try {
          await deleteDoc(doc(db, 'analysis_records', deleted.id));
        } catch (err) {
          console.error('[Analysis Log] Error purging old analysis record from Firestore:', err);
        }
      }
    }

    try {
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(ANALYSES_FILE, JSON.stringify(analysisRecords, null, 2), 'utf-8');
      }
    } catch (fsErr) {
      console.error('[Analysis Log] Error writing analyses to file:', fsErr);
    }

    return { success: true, recordId, item };
  } catch (err: any) {
    const rawErrMsg = err?.message || String(err);
    const sanitizedErrMsg = rawErrMsg.replace(/(api[_-]?key|token|password|secret)=[^&\s]+/gi, '$1=***');
    console.error(
      `[Analysis Log Error] Failed to persist analysis record: requestId=${params.requestId}, file=${cvFile}, error=${sanitizedErrMsg}`
    );
    // Ensure memory cache does not retain the failed record
    const failedIndex = analysisRecords.findIndex((r) => r.id === recordId);
    if (failedIndex >= 0) {
      analysisRecords.splice(failedIndex, 1);
    }
    return { success: false, recordId, error: sanitizedErrMsg, item };
  }
}

export async function recordAnalysisRecord(
  rec: Omit<AnalysisRecordItem, 'id' | 'analyzedAt'> & { id?: string; analyzedAt?: string }
): Promise<{ success: boolean; recordId: string; error?: string; item?: AnalysisRecordItem }> {
  const requestId = rec.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status =
    rec.status ||
    (typeof rec.overallScore === 'number' && Number.isFinite(rec.overallScore)
      ? 'COMPLETED'
      : rec.errorMessage
      ? 'FAILED'
      : 'NO_SCORE');
  return await createAnalysisRecord({
    ...rec,
    source: rec.source || 'candidate',
    status,
    requestId,
    candidateName: rec.candidateName || rec.actorUsername || 'Candidate',
    jobTitle: rec.jobTitle || 'Vị trí tuyển dụng',
    topStrengths: Array.isArray(rec.topStrengths) ? rec.topStrengths : [],
    missingSkills: Array.isArray(rec.missingSkills) ? rec.missingSkills : [],
    engineUsed: rec.engineUsed || 'Gemini 2.0 Flash',
    durationMs: rec.durationMs || 0,
    cvTextLength: rec.cvTextLength || 0,
    jdTextLength: rec.jdTextLength || 0,
  });
}
