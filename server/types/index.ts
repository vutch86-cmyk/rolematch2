import { HistoryItem } from '../../src/types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: 'admin' | 'normal';
  createdAt: string;
  email?: string;
  isLocked?: boolean;
  failedLoginAttempts?: number;
  password?: string;
  lockedAt?: string;
  dailyAnalysisCount?: { [dateStr: string]: number };
}

export interface LogItem {
  id: string;
  timestamp: string;
  source: 'client' | 'server' | 'upload' | 'gemini' | 'network';
  level: 'error' | 'warn' | 'info';
  message: string;
  details?: string;
  endpoint?: string;
  userAgent?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: 'admin' | 'normal' | 'guest';
  action: string;
  category: 'AUTH' | 'USER_MGMT' | 'AI_SERVICE' | 'SYSTEM' | 'SECURITY';
  status: 'success' | 'warning' | 'error';
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UploadedDocumentItem {
  id: string;
  filename: string;
  fileType: 'CV' | 'JD';
  mimeType: string;
  fileSizeKB: number;
  characterCount: number;
  uploadedBy: string;
  uploadedAt: string;
  extractedTextPreview: string;
  fullText: string;
  format: 'PDF' | 'DOCX' | 'TXT' | 'IMAGE' | 'TEXT_INPUT';
}

export interface AnalysisRecordItem {
  id: string;
  recordId?: string;
  requestId?: string;
  source?: 'candidate' | 'recruiter_batch';
  batchId?: string;
  batchName?: string;
  candidateId?: string;
  candidateName?: string;
  fileName?: string;
  cvFileName?: string;
  jobTitle: string;
  actorUsername?: string;
  createdBy?: string;
  userEmail: string;
  analyzedAt?: string;
  timestamp?: string;
  createdAt?: string;
  status: 'COMPLETED' | 'NO_SCORE' | 'FAILED';
  overallScore: number | null;
  keywordScore?: number | null;
  experienceScore?: number | null;
  skillsScore?: number | null;
  matchLevel: 'XUAT_SAC' | 'TOT' | 'TRUNG_BINH' | 'CAN_CAI_THIEN' | 'NOT_AVAILABLE';
  topStrengths: string[];
  missingSkills: string[];
  recommendation?: string;
  recruiterDecision?: 'YES' | 'NO' | 'MAYBE';
  engineUsed: string;
  durationMs: number;
  cvTextLength: number;
  jdTextLength: number;
  fullAnalysis?: any;
  errorCode?: string;
  errorMessage?: string;
}

export interface CreateAnalysisRecordParams {
  id?: string;
  recordId?: string;
  requestId: string;
  source: 'candidate' | 'recruiter_batch';
  batchId?: string;
  batchName?: string;
  candidateId?: string;
  candidateName: string;
  fileName?: string;
  cvFileName?: string;
  jobTitle: string;
  actorUsername?: string;
  createdBy?: string;
  userEmail?: string;
  status: 'COMPLETED' | 'NO_SCORE' | 'FAILED';
  overallScore: number | null;
  keywordScore?: number | null;
  experienceScore?: number | null;
  skillsScore?: number | null;
  matchLevel: 'XUAT_SAC' | 'TOT' | 'TRUNG_BINH' | 'CAN_CAI_THIEN' | 'NOT_AVAILABLE';
  topStrengths: string[];
  missingSkills: string[];
  recommendation?: string;
  recruiterDecision?: 'YES' | 'NO' | 'MAYBE';
  engineUsed: string;
  durationMs: number;
  cvTextLength: number;
  jdTextLength: number;
  fullAnalysis?: any;
  errorCode?: string;
  errorMessage?: string;
}

export interface CandidateAuditMetadata {
  requestId: string;
  saved: boolean;
  recordId?: string;
  errorCode?: 'FIRESTORE_UNAVAILABLE' | 'PERSISTENCE_FAILED';
}

export interface StoredCandidateHistoryItem extends HistoryItem {
  userId: string;
  username: string;
}
