import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import multer from 'multer';
import mammoth from 'mammoth';
import * as pdfParseModule from 'pdf-parse';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import {
  RecruiterBatchStatus,
  CandidateProcessingStatus,
  RecruiterBatchOwner,
  RecruiterBatchSummary,
  SavedBatchCandidate,
  RecruiterBatchDetail,
  HistoryItem
} from './src/types';
import { reserveAiQuota, getAiQuotaSettings, updateAiQuotaSettings, getDateKey, getResetAt, normalizeUserId, getUsageDocId, getQuotaHealth, resetUserQuotaForDate, getUserQuotaUsage } from './quotaService';

dotenv.config();

// Firebase Firestore Integration
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc, addDoc, setLogLevel, query, where } from 'firebase/firestore';

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

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    operationType,
    path,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

setLogLevel('error');

let configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  configPath = path.join(__dirname, '..', 'firebase-applet-config.json');
}
if (!fs.existsSync(configPath)) {
  configPath = path.join(__dirname, 'firebase-applet-config.json');
}

let db: any = null;
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });
    db = getFirestore(firebaseApp, config.firestoreDatabaseId || '(default)');
    console.log('Firebase Firestore initialized successfully with database:', config.firestoreDatabaseId || '(default)');
  } catch (err) {
    console.error('Error initializing Firebase Firestore:', err);
  }
} else {
  console.log('No firebase-applet-config.json found at paths searched. Continuing without Firebase.');
}

// User Database Interfaces & Storage
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

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'app_settings.json');
const RECRUITER_BATCHES_FILE = path.join(DATA_DIR, 'recruiter-batches.json');
const CANDIDATE_HISTORY_FILE = path.join(DATA_DIR, 'candidate_history.json');

let analysesFileWriter: (records: AnalysisRecordItem[]) => void = (records: AnalysisRecordItem[]) => {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ANALYSES_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Analysis Log] Error writing analyses to file:', err);
  }
};

// Legacy appSettings removed in favor of Firestore-backed getAiQuotaSettings / updateAiQuotaSettings

export class AuthDatabaseUnavailableError extends Error {
  code = 'AUTH_DATABASE_UNAVAILABLE';
  constructor(message = 'Authentication service is temporarily unavailable.') {
    super(message);
    this.name = 'AuthDatabaseUnavailableError';
  }
}

// Bcrypt hash validation: starts with $2a$, $2b$, $2x$, or $2y$, followed by 2 digits cost, followed by $, followed by 53 base64 characters (. and / allowed)
const BCRYPT_HASH_REGEX = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isValidIsoDate(str: any): boolean {
  if (typeof str !== 'string' || !str.trim()) return false;
  const time = Date.parse(str);
  return !Number.isNaN(time);
}

export function isStoredUserDocument(value: unknown): value is StoredUser {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, any>;

  // Required fields
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return false;
  }
  if (typeof candidate.username !== 'string' || !candidate.username.trim()) {
    return false;
  }
  if (typeof candidate.passwordHash !== 'string' || !BCRYPT_HASH_REGEX.test(candidate.passwordHash)) {
    return false;
  }
  if (typeof candidate.fullName !== 'string' || !candidate.fullName.trim()) {
    return false;
  }
  if (candidate.role !== 'admin' && candidate.role !== 'normal') {
    return false;
  }
  if (!isValidIsoDate(candidate.createdAt)) {
    return false;
  }

  // Optional fields
  if (candidate.isLocked !== undefined && typeof candidate.isLocked !== 'boolean') {
    return false;
  }
  if (
    candidate.failedLoginAttempts !== undefined &&
    !(typeof candidate.failedLoginAttempts === 'number' && Number.isInteger(candidate.failedLoginAttempts) && candidate.failedLoginAttempts >= 0)
  ) {
    return false;
  }
  if (candidate.lockedAt !== undefined && !isValidIsoDate(candidate.lockedAt)) {
    return false;
  }
  if (candidate.email !== undefined && typeof candidate.email !== 'string') {
    return false;
  }
  if (candidate.dailyAnalysisCount !== undefined) {
    if (!candidate.dailyAnalysisCount || typeof candidate.dailyAnalysisCount !== 'object' || Array.isArray(candidate.dailyAnalysisCount)) {
      return false;
    }
    for (const key of Object.keys(candidate.dailyAnalysisCount)) {
      const val = candidate.dailyAnalysisCount[key];
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
        return false;
      }
    }
  }

  return true;
}

export function normalizeStoredUsers(values: unknown[]): StoredUser[] {
  if (!Array.isArray(values)) {
    console.warn('[normalizeStoredUsers] Input is not an array:', { type: typeof values });
    return [];
  }

  const validUsers: StoredUser[] = [];
  const seenUsernames = new Set<string>();

  for (const raw of values) {
    if (!raw || typeof raw !== 'object') {
      console.warn('[normalizeStoredUsers] Filtered out non-object entry:', { type: typeof raw });
      continue;
    }

    const candidate: Record<string, any> = {
      ...(raw as Record<string, any>),
      id: (raw as any).id || (raw as any)._id || ''
    };

    if (!isStoredUserDocument(candidate)) {
      const safeLog: Record<string, any> = {
        id: typeof candidate.id === 'string' ? candidate.id : undefined,
        username: typeof candidate.username === 'string' ? candidate.username : undefined,
        role: candidate.role,
        hasPasswordHash: typeof candidate.passwordHash === 'string' && candidate.passwordHash.length > 0,
        reason: 'Document failed strict StoredUser schema validation'
      };
      console.warn('[normalizeStoredUsers] Filtered out invalid user doc:', safeLog);
      continue;
    }

    const lowerUsername = candidate.username.toLowerCase().trim();
    if (seenUsernames.has(lowerUsername)) {
      console.warn('[normalizeStoredUsers] Filtered out duplicate username:', { username: candidate.username, id: candidate.id });
      continue;
    }

    seenUsernames.add(lowerUsername);
    validUsers.push({
      id: candidate.id,
      username: candidate.username,
      passwordHash: candidate.passwordHash,
      fullName: candidate.fullName,
      role: candidate.role,
      createdAt: candidate.createdAt,
      ...(candidate.isLocked !== undefined ? { isLocked: candidate.isLocked } : {}),
      ...(candidate.failedLoginAttempts !== undefined ? { failedLoginAttempts: candidate.failedLoginAttempts } : {}),
      ...(candidate.lockedAt !== undefined ? { lockedAt: candidate.lockedAt } : {}),
      ...(candidate.email !== undefined ? { email: candidate.email } : {}),
      ...(candidate.dailyAnalysisCount !== undefined ? { dailyAnalysisCount: { ...candidate.dailyAnalysisCount } } : {})
    });
  }

  return validUsers;
}

const SEED_ADMIN_HASH = '$2b$10$3vzYSF/.B9xDoTWHtHYRm.qYv3MZppm2z1MYr7lx9dHkIxsDH7is.';
const SEED_USER1_HASH = '$2b$10$P3vSKlhjQy/6C/C18cvT7.PR2ttn/v7zjKyzRqfZOF6nnJNwExenG';

export function ensureDefaultUsers(users: StoredUser[]): StoredUser[] {
  const normalized = normalizeStoredUsers(users);

  // Default test users are ONLY seeded when ENABLE_TEST_USER_SEED === 'true'
  if (process.env.ENABLE_TEST_USER_SEED !== 'true') {
    return normalized;
  }

  const defaults: StoredUser[] = [
    {
      id: 'usr_admin_001',
      username: 'admin',
      passwordHash: SEED_ADMIN_HASH,
      fullName: 'Quản trị viên (Admin)',
      role: 'admin',
      createdAt: '2026-08-11T00:00:00.000Z',
    },
    {
      id: 'usr_normal_001',
      username: 'user1',
      passwordHash: SEED_USER1_HASH,
      fullName: 'Người dùng Nguyễn Văn A',
      role: 'normal',
      createdAt: '2026-08-11T00:00:00.000Z',
    },
  ];

  const result = [...normalized];
  for (const def of defaults) {
    const exists = result.some(u =>
      typeof u.username === 'string' &&
      u.username.toLowerCase().trim() === def.username.toLowerCase().trim()
    ) || result.some(u => u.id === def.id);

    if (!exists) {
      result.push(def);
    }
  }
  return result;
}

export function loadUsers(): StoredUser[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      if (process.env.ENABLE_TEST_USER_SEED === 'true') {
        const defaultUsers: StoredUser[] = [
          {
            id: 'usr_admin_001',
            username: 'admin',
            passwordHash: SEED_ADMIN_HASH,
            fullName: 'Quản trị viên (Admin)',
            role: 'admin',
            createdAt: '2026-08-11T00:00:00.000Z',
          },
          {
            id: 'usr_normal_001',
            username: 'user1',
            passwordHash: SEED_USER1_HASH,
            fullName: 'Người dùng Nguyễn Văn A',
            role: 'normal',
            createdAt: '2026-08-11T00:00:00.000Z',
          },
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8');
        return defaultUsers;
      }
      return [];
    }
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const valid = normalizeStoredUsers(Array.isArray(parsed) ? parsed : []);
    return ensureDefaultUsers(valid);
  } catch (err) {
    console.error('Error loading users database from file:', err);
    return [];
  }
}

export function saveUsers(users: StoredUser[]): void {
  const validUsers = normalizeStoredUsers(users);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(validUsers, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users database:', err);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'rolematch-secure-jwt-secret-key-2026';

function generateToken(user: StoredUser): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    createdAt: user.createdAt,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

function verifyToken(token: string): StoredUser | null {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadStr, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('base64url');
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) return null;
    
    return {
      id: payload.id,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      passwordHash: '',
      createdAt: payload.createdAt || new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

export async function loadUsersAsync(): Promise<StoredUser[]> {
  if (db) {
    try {
      const usersCol = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCol);
      if (!usersSnapshot.empty) {
        const rawUsers = usersSnapshot.docs.map(docSnap => ({
          ...docSnap.data(),
          id: docSnap.data()?.id || docSnap.id
        }));
        const validUsers = normalizeStoredUsers(rawUsers);
        const finalUsers = ensureDefaultUsers(validUsers);
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(USERS_FILE, JSON.stringify(finalUsers, null, 2), 'utf-8');
        } catch (e) {
          // ignore cache write error
        }
        return finalUsers;
      }
    } catch (err: any) {
      console.warn('Firestore user fetch unavailable or denied, falling back to local users database:', err?.message);
    }
  }

  // Fallback to local users.json
  const localUsers = loadUsers();
  return ensureDefaultUsers(localUsers);
}

export async function saveUsersAsync(users: StoredUser[]): Promise<void> {
  const validUsers = normalizeStoredUsers(users);
  const finalUsers = ensureDefaultUsers(validUsers);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(finalUsers, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving local users file:', e);
  }

  if (db) {
    try {
      for (const u of finalUsers) {
        await setDoc(doc(db, 'users', u.id), u);
      }
    } catch (err: any) {
      console.warn('Unable to sync users to Firestore:', err?.message);
    }
  }
}

function loadAllDataFromFiles() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Load Documents
    if (fs.existsSync(DOCUMENTS_FILE)) {
      const raw = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        uploadedDocuments.length = 0;
        uploadedDocuments.push(...loaded);
      }
    } else {
      fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(uploadedDocuments, null, 2), 'utf-8');
    }

    // Load Analyses
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      if (fs.existsSync(ANALYSES_FILE)) {
        const raw = fs.readFileSync(ANALYSES_FILE, 'utf-8');
        const loaded = JSON.parse(raw);
        if (Array.isArray(loaded)) {
          analysisRecords.length = 0;
          analysisRecords.push(...loaded);
        }
      } else {
        analysesFileWriter(analysisRecords);
      }
    }

    // Load Audit Logs
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const raw = fs.readFileSync(AUDIT_LOGS_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        auditLogs.length = 0;
        auditLogs.push(...loaded);
      }
    } else {
      fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(auditLogs, null, 2), 'utf-8');
    }

    // Load Recruiter Batches
    if (fs.existsSync(RECRUITER_BATCHES_FILE)) {
      const raw = fs.readFileSync(RECRUITER_BATCHES_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        recruiterBatches.length = 0;
        for (const b of loaded) {
          if (Array.isArray(b.candidates)) {
            for (const c of b.candidates) {
              c.rank = hasValidRank(c.rank) ? c.rank : null;
            }
            sortBatchCandidates(b.candidates);
          }
          recruiterBatches.push(b);
        }
      }
    } else {
      fs.writeFileSync(RECRUITER_BATCHES_FILE, JSON.stringify(recruiterBatches, null, 2), 'utf-8');
    }

    // Load Candidate Histories (Phase 2 Cloud Sync)
    if (fs.existsSync(CANDIDATE_HISTORY_FILE)) {
      const raw = fs.readFileSync(CANDIDATE_HISTORY_FILE, 'utf-8');
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        candidateHistories.length = 0;
        candidateHistories.push(...loaded);
      }
    } else {
      fs.writeFileSync(CANDIDATE_HISTORY_FILE, JSON.stringify(candidateHistories, null, 2), 'utf-8');
    }
    console.log('Successfully loaded baseline data from local files.');
  } catch (err) {
    console.error('Error loading data from files:', err);
  }
}

async function syncFromFirestore() {
  if (!db) return;
  try {
    console.log('Synchronizing data from Firestore...');
    
    // 1. Sync Users
    const usersCol = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCol);
    if (usersSnapshot.empty && process.env.ENABLE_TEST_USER_SEED === 'true') {
      const defaultUsers: StoredUser[] = [
        {
          id: 'usr_admin_001',
          username: 'admin',
          passwordHash: '$2b$10$3vzYSF/.B9xDoTWHtHYRm.qYv3MZppm2z1MYr7lx9dHkIxsDH7is.',
          fullName: 'Quản trị viên (Admin)',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr_normal_001',
          username: 'user1',
          passwordHash: '$2b$10$P3vSKlhjQy/6C/C18cvT7.PR2ttn/v7zjKyzRqfZOF6nnJNwExenG',
          fullName: 'Người dùng Nguyễn Văn A',
          role: 'normal',
          createdAt: new Date().toISOString(),
        },
      ];
      for (const u of defaultUsers) {
        await setDoc(doc(db, 'users', u.id), u);
      }
      console.log('Seeded default users to Firestore.');
    }
    
    // 2. Sync Analysis Records
    const analysisCol = collection(db, 'analysis_records');
    const analysisSnapshot = await getDocs(analysisCol);
    if (analysisSnapshot.empty) {
      const defaultRecords = [
        {
          id: 'anl_seed_01',
          timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
          userEmail: 'nguyenvana@gmail.com',
          jobTitle: 'Senior React Frontend Lead - nguyenvana@gmail.com',
          overallScore: 88,
          matchLevel: 'XUAT_SAC',
          cvFileName: 'CV_NguyenVanA_SeniorFrontend.pdf',
          jdTitle: 'Senior React Frontend Lead',
          topStrengths: ['Thành thạo React 18, TypeScript, Tailwind', 'Kinh nghiệm tối ưu Web Vitals', 'Xây dựng Design System quy mô lớn'],
          missingSkills: ['Kinh nghiệm với Micro-frontends', 'Viết E2E Test với Playwright'],
          recruiterDecision: 'YES',
          engineUsed: 'Gemini 2.0 Flash Engine',
          durationMs: 1420,
          cvTextLength: 3820,
          jdTextLength: 2950,
        },
        {
          id: 'anl_seed_02',
          timestamp: new Date(Date.now() - 3600000 * 1.4).toISOString(),
          userEmail: 'tranthib@gmail.com',
          jobTitle: 'Senior Product Manager - tranthib@gmail.com',
          overallScore: 74,
          matchLevel: 'TOT',
          cvFileName: 'CV_TranThiB_ProductManager.pdf',
          jdTitle: 'Product Owner / Lead PM',
          topStrengths: ['Xây dựng Roadmap sản phẩm SaaS', 'Sử dụng thuần thục Mixpanel / Amplitude'],
          missingSkills: ['Chứng chỉ PMP hoặc PSM II', 'Kinh nghiệm xử lý SQL queries trực tiếp'],
          recruiterDecision: 'MAYBE',
          engineUsed: 'Gemini 2.0 Flash Engine',
          durationMs: 1650,
          cvTextLength: 4210,
          jdTextLength: 2200,
        },
        {
          id: 'anl_seed_03',
          timestamp: new Date(Date.now() - 3600000 * 0.6).toISOString(),
          userEmail: 'levanc@outlook.com',
          jobTitle: 'AI & Machine Learning Engineer - levanc@outlook.com',
          overallScore: 52,
          matchLevel: 'CAN_CAI_THIEN',
          cvFileName: 'CV_LeVanC_AI_Intern.pdf',
          jdTitle: 'AI Prompt Engineer & LLM Architect',
          topStrengths: ['Hiểu biết cơ bản về Python và PyTorch', 'Có làm project sinh viên với OpenAI API'],
          missingSkills: ['Thiếu kiến trúc RAG nâng cao', 'Chưa từng triển khai VectorDB', 'Chưa có kinh nghiệm LLM Fine-Tuning'],
          recruiterDecision: 'NO',
          engineUsed: 'OpenRouter Gateway (DeepSeek-R1)',
          durationMs: 2100,
          cvTextLength: 1800,
          jdTextLength: 3100,
        },
      ];
      for (const r of defaultRecords) {
        await setDoc(doc(db, 'analysis_records', r.id), r);
      }
      console.log('Seeded default analysis records to Firestore.');
    }
    
    // 3. Sync Audit Logs
    const auditCol = collection(db, 'audit_logs');
    const auditSnapshot = await getDocs(auditCol);
    if (auditSnapshot.empty) {
      const defaultAudit = [
        {
          id: 'aud_seed_01',
          timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
          userEmail: 'system@cvoptimizer.internal',
          userRole: 'admin',
          action: 'SYSTEM_BOOT',
          category: 'SYSTEM',
          status: 'success',
          details: 'Hệ thống AI CV Optimizer đã khởi chạy thành công. Sẵn sàng nhận yêu cầu.',
          ipAddress: '127.0.0.1',
          userAgent: 'Node.js/Cloud Run App Instance',
        }
      ];
      for (const a of defaultAudit) {
        await setDoc(doc(db, 'audit_logs', a.id), a);
      }
      console.log('Seeded default audit logs to Firestore.');
    }

    // Now read from Firestore to populate our local variables!
    const updatedUsersSnapshot = await getDocs(usersCol);
    const rawUsers = updatedUsersSnapshot.docs.map(docSnap => ({
      ...docSnap.data(),
      id: docSnap.data()?.id || docSnap.id
    }));
    const loadedUsers = normalizeStoredUsers(rawUsers);
    const validatedLoadedUsers = ensureDefaultUsers(loadedUsers);
    fs.writeFileSync(USERS_FILE, JSON.stringify(validatedLoadedUsers, null, 2), 'utf-8');

    const updatedAnalysisSnapshot = await getDocs(analysisCol);
    const loadedAnalysis = updatedAnalysisSnapshot.docs.map(doc => doc.data() as AnalysisRecordItem);
    loadedAnalysis.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    analysisRecords.length = 0;
    analysisRecords.push(...loadedAnalysis);

    const updatedAuditSnapshot = await getDocs(auditCol);
    const loadedAudit = updatedAuditSnapshot.docs.map(doc => doc.data() as AuditLogItem);
    loadedAudit.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    auditLogs.length = 0;
    auditLogs.push(...loadedAudit);

    const docsCol = collection(db, 'uploaded_documents');
    const docsSnapshot = await getDocs(docsCol);
    const loadedDocs = docsSnapshot.docs.map(doc => doc.data() as UploadedDocumentItem);
    loadedDocs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    uploadedDocuments.length = 0;
    uploadedDocuments.push(...loadedDocs);

    // Sync Recruiter Batches & their candidates subcollections from Firestore
    try {
      const batchesCol = collection(db, 'recruiter_batches');
      let batchesSnapshot;
      try {
        batchesSnapshot = await getDocs(batchesCol);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'recruiter_batches');
      }

      if (!batchesSnapshot.empty) {
        const loadedBatches: RecruiterBatchDetail[] = [];
        for (const batchDoc of batchesSnapshot.docs) {
          const batchSummary = batchDoc.data() as RecruiterBatchSummary;
          const candidatesCol = collection(db, 'recruiter_batches', batchSummary.id, 'candidates');
          let candidatesSnapshot;
          try {
            candidatesSnapshot = await getDocs(candidatesCol);
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, `recruiter_batches/${batchSummary.id}/candidates`);
          }

          const candidates: SavedBatchCandidate[] = candidatesSnapshot.docs.map(cDoc => {
            const c = cDoc.data() as SavedBatchCandidate;
            c.rank = hasValidRank(c.rank) ? c.rank : null;
            return c;
          });

          // Order candidates: ranked completed first (1, 2, 3...), then NO_SCORE, then FAILED, then alphabetical
          sortBatchCandidates(candidates);

          loadedBatches.push({
            ...batchSummary,
            candidates
          });
        }

        loadedBatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        recruiterBatches.length = 0;
        recruiterBatches.push(...loadedBatches);
        saveRecruiterBatchesToFile();
      }
    } catch (batchSyncErr) {
      console.error('Error syncing recruiter batches from Firestore:', batchSyncErr);
      throw batchSyncErr;
    }

    try {
      const candidateHistoryCol = collection(db, 'candidate_history');
      const candidateHistorySnapshot = await getDocs(candidateHistoryCol);
      if (!candidateHistorySnapshot.empty) {
        const loadedHistories: StoredCandidateHistoryItem[] = [];
        candidateHistorySnapshot.forEach((docSnap) => {
          loadedHistories.push(docSnap.data() as StoredCandidateHistoryItem);
        });
        loadedHistories.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        candidateHistories.length = 0;
        candidateHistories.push(...loadedHistories);
        saveCandidateHistoriesToFile();
      }
    } catch (candHistorySyncErr) {
      console.warn('Warning: Could not sync candidate_history from Firestore:', candHistorySyncErr);
    }

    console.log(`Firestore Sync Complete: Loaded ${loadedUsers.length} users, ${analysisRecords.length} analysis records, ${auditLogs.length} audit logs, ${uploadedDocuments.length} documents, ${recruiterBatches.length} recruiter batches, ${candidateHistories.length} candidate histories.`);
  } catch (err) {
    console.error('Error synchronizing data from Firestore:', err);
  }
}

interface ActiveSessionData {
  user: StoredUser;
  username: string;
  loginTime: string;
  lastActive: number;
  ip: string;
  userAgent: string;
}

const activeSessions = new Map<string, ActiveSessionData>();
const SESSION_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes inactivity timeout

function getActiveSessionForUsername(username: string): { token: string; session: ActiveSessionData } | null {
  const cleanUser = String(username || '').toLowerCase().trim();
  if (!cleanUser) return null;
  const now = Date.now();

  for (const [token, session] of activeSessions.entries()) {
    if (session.username.toLowerCase() === cleanUser) {
      const userFromToken = verifyToken(token);
      if (!userFromToken || (now - session.lastActive) > SESSION_INACTIVITY_TIMEOUT_MS) {
        activeSessions.delete(token);
      } else {
        return { token, session };
      }
    }
  }
  return null;
}

// Bounded In-Memory Cache (LRU) to prevent memory exhaustion (DoS attacks)
class BoundedCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const analyzeCache = new BoundedCache<string, any>(100);
const updatedCvCache = new BoundedCache<string, any>(100);
const formatCache = new BoundedCache<string, any>(100);

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

const appLogs: LogItem[] = [];
const MAX_LOGS = 200;

function recordLog(log: Omit<LogItem, 'id' | 'timestamp'>): LogItem {
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
  status?: 'COMPLETED' | 'NO_SCORE' | 'FAILED';
  overallScore: number | null;
  keywordScore?: number | null;
  experienceScore?: number | null;
  skillsScore?: number | null;
  matchLevel: 'XUAT_SAC' | 'TOT' | 'TRUNG_BINH' | 'CAN_CAI_THIEN' | 'NOT_AVAILABLE';
  jdTitle?: string;
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
  timestamp: string;
  createdAt?: string;
}

const auditLogs: AuditLogItem[] = [
  {
    id: 'aud_seed_01',
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    userEmail: 'system@cvoptimizer.internal',
    userRole: 'admin',
    action: 'SYSTEM_BOOT',
    category: 'SYSTEM',
    status: 'success',
    details: 'Hệ thống AI CV Optimizer đã khởi chạy thành công. Sẵn sàng nhận yêu cầu.',
    ipAddress: '127.0.0.1',
    userAgent: 'Node.js/Cloud Run App Instance',
  },
  {
    id: 'aud_seed_02',
    timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    userEmail: 'admin@cvoptimizer.com',
    userRole: 'admin',
    action: 'USER_LOGIN',
    category: 'AUTH',
    status: 'success',
    details: 'Đăng nhập Quản Trị Viên (Admin) thành công',
    ipAddress: '113.161.42.10',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
  {
    id: 'aud_seed_02b',
    timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    userEmail: 'guest_user@invalid.com',
    userRole: 'guest',
    action: 'USER_LOGIN',
    category: 'AUTH',
    status: 'error',
    details: 'Đăng nhập thất bại: Mật khẩu không chính xác hoặc sai tên đăng nhập',
    ipAddress: '113.161.42.10',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
  {
    id: 'aud_seed_03',
    timestamp: new Date(Date.now() - 3600000 * 0.8).toISOString(),
    userEmail: 'admin@cvoptimizer.com',
    userRole: 'admin',
    action: 'AI_PING_TEST',
    category: 'AI_SERVICE',
    status: 'success',
    details: 'Kiểm tra Ping Realtime các AI Models (Gemini 2.0 Flash Online, OpenRouter Gateway Online)',
    ipAddress: '113.161.42.10',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
];

const MAX_AUDIT_LOGS = 300;

function recordAuditLog(log: Omit<AuditLogItem, 'id' | 'timestamp'>): AuditLogItem {
  const item: AuditLogItem = {
    id: 'aud_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    ...log,
  };
  auditLogs.unshift(item);
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    const deleted = auditLogs.pop();
    if (deleted && db) {
      deleteDoc(doc(db, 'audit_logs', deleted.id)).catch(err => console.error('Error purging old audit log:', err));
    }
  }
  
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(auditLogs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing audit logs to file:', err);
  }

  if (db) {
    setDoc(doc(db, 'audit_logs', item.id), item).catch(err => console.error('Error saving audit log to Firestore:', err));
  }
  return item;
}

// --- UPLOADED DOCUMENTS REPOSITORY ---
const uploadedDocuments: UploadedDocumentItem[] = [
  {
    id: 'doc_seed_01',
    filename: 'CV_NguyenVanA_SeniorFrontend.pdf',
    fileType: 'CV',
    mimeType: 'application/pdf',
    fileSizeKB: 245,
    characterCount: 3820,
    uploadedBy: 'nguyenvana@gmail.com',
    uploadedAt: new Date(Date.now() - 3600000 * 3.2).toISOString(),
    extractedTextPreview: 'NGUYỄN VĂN A - SENIOR FRONTEND ENGINEER\nKinh nghiệm 5+ năm phát triển ứng dụng React, TypeScript, Tailwind CSS, Next.js...',
    fullText: 'NGUYỄN VĂN A - SENIOR FRONTEND ENGINEER\nKinh nghiệm 5+ năm phát triển ứng dụng React, TypeScript, Tailwind CSS, Next.js. Đã từng tối ưu hiệu năng Web Vitals giảm 40% FCP cho hệ thống e-commerce với 500k MAU.',
    format: 'PDF',
  },
  {
    id: 'doc_seed_02',
    filename: 'JD_Senior_React_Frontend_Lead.docx',
    fileType: 'JD',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSizeKB: 112,
    characterCount: 2950,
    uploadedBy: 'recruiter_hr@techcorp.com',
    uploadedAt: new Date(Date.now() - 3600000 * 2.8).toISOString(),
    extractedTextPreview: 'MÔ TẢ CÔNG VIỆC: SENIOR REACT FRONTEND LEAD\nYêu cầu: 4+ năm kinh nghiệm React, TypeScript, Redux Toolkit, Micro-frontends, REST API, GraphQL...',
    fullText: 'MÔ TẢ CÔNG VIỆC: SENIOR REACT FRONTEND LEAD\nYêu cầu: 4+ năm kinh nghiệm React, TypeScript, Redux Toolkit, Micro-frontends, REST API, GraphQL. Có kinh nghiệm dẫn dắt team 5-8 lập trình viên, viết Unit Test (Jest/RTL).',
    format: 'DOCX',
  },
  {
    id: 'doc_seed_03',
    filename: 'CV_TranThiB_ProductManager.pdf',
    fileType: 'CV',
    mimeType: 'application/pdf',
    fileSizeKB: 310,
    characterCount: 4210,
    uploadedBy: 'tranthib@gmail.com',
    uploadedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    extractedTextPreview: 'TRẦN THỊ B - SENIOR PRODUCT MANAGER\nKinh nghiệm 6 năm quản lý sản phẩm B2B SaaS & FinTech. Kỹ năng: Roadmap Planning, Agile Scrum, Data Analytics...',
    fullText: 'TRẦN THỊ B - SENIOR PRODUCT MANAGER\nKinh nghiệm 6 năm quản lý sản phẩm B2B SaaS & FinTech. Kỹ năng: Roadmap Planning, Agile Scrum, Data Analytics (Mixpanel/Amplitude), User Research, A/B Testing.',
    format: 'PDF',
  },
  {
    id: 'doc_seed_04',
    filename: 'JD_AI_Prompt_Engineer_Lead.txt',
    fileType: 'JD',
    mimeType: 'text/plain',
    fileSizeKB: 45,
    characterCount: 1850,
    uploadedBy: 'admin@cvoptimizer.com',
    uploadedAt: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    extractedTextPreview: 'JOB DESCRIPTION: AI PROMPT ENGINEER & LLM ARCHITECT\nRequirements: Deep knowledge in LLM Fine-Tuning, RAG Architecture, LangChain, Python, VectorDB...',
    fullText: 'JOB DESCRIPTION: AI PROMPT ENGINEER & LLM ARCHITECT\nRequirements: Deep knowledge in LLM Fine-Tuning, RAG Architecture, LangChain, Python, VectorDB (Qdrant/Pinecone), System Evaluation & Benchmarking.',
    format: 'TXT',
  },
];

const MAX_UPLOADED_DOCS = 200;

function recordUploadedDocument(docItem: Omit<UploadedDocumentItem, 'id' | 'uploadedAt'>): UploadedDocumentItem {
  const item: UploadedDocumentItem = {
    id: 'doc_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    uploadedAt: new Date().toISOString(),
    ...docItem,
  };
  uploadedDocuments.unshift(item);
  if (uploadedDocuments.length > MAX_UPLOADED_DOCS) {
    const deleted = uploadedDocuments.pop();
    if (deleted && db) {
      deleteDoc(doc(db, 'uploaded_documents', deleted.id)).catch(err => console.error('Error purging old document:', err));
    }
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(uploadedDocuments, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing documents to file:', err);
  }

  if (db) {
    setDoc(doc(db, 'uploaded_documents', item.id), item).catch(err => console.error('Error saving document to Firestore:', err));
  }
  return item;
}

// --- ANALYSIS RECORDS REPOSITORY ---
const analysisRecords: AnalysisRecordItem[] = [
  {
    id: 'anl_seed_01',
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    userEmail: 'nguyenvana@gmail.com',
    jobTitle: 'Senior React Frontend Lead - nguyenvana@gmail.com',
    overallScore: 88,
    matchLevel: 'XUAT_SAC',
    cvFileName: 'CV_NguyenVanA_SeniorFrontend.pdf',
    jdTitle: 'Senior React Frontend Lead',
    topStrengths: ['Thành thạo React 18, TypeScript, Tailwind', 'Kinh nghiệm tối ưu Web Vitals', 'Xây dựng Design System quy mô lớn'],
    missingSkills: ['Kinh nghiệm với Micro-frontends', 'Viết E2E Test với Playwright'],
    recruiterDecision: 'YES',
    engineUsed: 'Gemini 2.0 Flash Engine',
    durationMs: 1420,
    cvTextLength: 3820,
    jdTextLength: 2950,
  },
  {
    id: 'anl_seed_02',
    timestamp: new Date(Date.now() - 3600000 * 1.4).toISOString(),
    userEmail: 'tranthib@gmail.com',
    jobTitle: 'Senior Product Manager - tranthib@gmail.com',
    overallScore: 74,
    matchLevel: 'TOT',
    cvFileName: 'CV_TranThiB_ProductManager.pdf',
    jdTitle: 'Product Owner / Lead PM',
    topStrengths: ['Xây dựng Roadmap sản phẩm SaaS', 'Sử dụng thuần thục Mixpanel / Amplitude'],
    missingSkills: ['Chứng chỉ PMP hoặc PSM II', 'Kinh nghiệm xử lý SQL queries trực tiếp'],
    recruiterDecision: 'MAYBE',
    engineUsed: 'Gemini 2.0 Flash Engine',
    durationMs: 1650,
    cvTextLength: 4210,
    jdTextLength: 2200,
  },
  {
    id: 'anl_seed_03',
    timestamp: new Date(Date.now() - 3600000 * 0.6).toISOString(),
    userEmail: 'levanc@outlook.com',
    jobTitle: 'AI & Machine Learning Engineer - levanc@outlook.com',
    overallScore: 52,
    matchLevel: 'CAN_CAI_THIEN',
    cvFileName: 'CV_LeVanC_AI_Intern.pdf',
    jdTitle: 'AI Prompt Engineer & LLM Architect',
    topStrengths: ['Hiểu biết cơ bản về Python và PyTorch', 'Có làm project sinh viên với OpenAI API'],
    missingSkills: ['Thiếu kiến trúc RAG nâng cao', 'Chưa từng triển khai VectorDB', 'Chưa có kinh nghiệm LLM Fine-Tuning'],
    recruiterDecision: 'NO',
    engineUsed: 'OpenRouter Gateway (DeepSeek-R1)',
    durationMs: 2100,
    cvTextLength: 1800,
    jdTextLength: 3100,
  },
];

const MAX_ANALYSIS_RECORDS = 200;

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

// Test-only helpers (do not call in production logic)
export function __getFirestoreDbForTesting() {
  return db;
}

export function __setFirestoreDbForTesting(newDb: any) {
  db = newDb;
}

export function __getAnalysisRecordsForTesting(): AnalysisRecordItem[] {
  return analysisRecords;
}

export function __clearAnalysisRecordsForTesting() {
  analysisRecords.length = 0;
}

export function __generateTokenForTesting(user: StoredUser): string {
  return generateToken(user);
}

export async function createAnalysisRecord(
  params: CreateAnalysisRecordParams
): Promise<{ success: boolean; recordId: string; error?: string; item?: AnalysisRecordItem }> {
  const recordId = params.recordId || params.id || `anl_${params.requestId}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const actor = (params.actorUsername || params.createdBy || (params.userEmail ? params.userEmail.split('@')[0] : 'user_guest')).trim();
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
    timestamp: timestamp,
    createdAt: timestamp,
  };

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

// Async helper for recording analysis record
export async function recordAnalysisRecord(
  rec: Omit<AnalysisRecordItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<{ success: boolean; recordId: string; error?: string; item?: AnalysisRecordItem }> {
  const requestId = rec.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status = rec.status || (typeof rec.overallScore === 'number' && Number.isFinite(rec.overallScore) ? 'COMPLETED' : (rec.errorMessage ? 'FAILED' : 'NO_SCORE'));
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

// Helper to deeply remove undefined properties from objects/arrays before Firestore writes
function removeUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return undefined as unknown as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item)) as unknown as T;
  }
  if (value instanceof Date || value instanceof RegExp) {
    return value;
  }
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) {
      result[k] = removeUndefinedDeep(v);
    }
  }
  return result as T;
}

// Helper to check for a valid finite positive rank number (> 0)
function hasValidRank(rank: unknown): rank is number {
  return (
    typeof rank === 'number' &&
    Number.isFinite(rank) &&
    rank > 0
  );
}

// Helper to stably sort batch candidates
function sortBatchCandidates(candidates: SavedBatchCandidate[]): SavedBatchCandidate[] {
  return candidates.sort((a, b) => {
    const aHasRank = hasValidRank(a.rank);
    const bHasRank = hasValidRank(b.rank);

    // 1. Valid ranked candidates first (rank ascending: 1, 2, 3...)
    if (aHasRank && bHasRank) {
      return (a.rank as number) - (b.rank as number);
    }
    if (aHasRank) return -1;
    if (bHasRank) return 1;

    // 2. NO_SCORE before FAILED
    if (a.processingStatus !== b.processingStatus) {
      if (a.processingStatus === 'NO_SCORE' && b.processingStatus === 'FAILED') return -1;
      if (a.processingStatus === 'FAILED' && b.processingStatus === 'NO_SCORE') return 1;
    }

    // 3. Stably sort unranked candidates by candidateName then filename
    const nameDiff = (a.candidateName || '').localeCompare(b.candidateName || '', undefined, { sensitivity: 'base' });
    if (nameDiff !== 0) return nameDiff;
    return (a.filename || '').localeCompare(b.filename || '', undefined, { sensitivity: 'base' });
  });
}

// --- RECRUITER BATCHES REPOSITORY ---
const recruiterBatches: RecruiterBatchDetail[] = [];

// --- CANDIDATE CLOUD HISTORY REPOSITORY (PHASE 2) ---
export interface StoredCandidateHistoryItem extends HistoryItem {
  userId: string;
  username: string;
}

const candidateHistories: StoredCandidateHistoryItem[] = [];

function saveCandidateHistoriesToFile(): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CANDIDATE_HISTORY_FILE, JSON.stringify(candidateHistories, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('Error writing candidate history to file:', err);
  }
}

function saveRecruiterBatchesToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(RECRUITER_BATCHES_FILE, JSON.stringify(recruiterBatches, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('Error writing recruiter batches to file:', err);
    throw new Error('Không thể ghi dữ liệu đợt tuyển dụng vào tệp tin cục bộ.');
  }
}

async function persistRecruiterBatchToFirestore(batch: RecruiterBatchDetail): Promise<void> {
  if (!db) return;

  const batchDocRef = doc(db, 'recruiter_batches', batch.id);

  // 1. Initial metadata write with status SAVING
  const summaryDoc: RecruiterBatchSummary = {
    id: batch.id,
    batchName: batch.batchName,
    roleTitle: batch.roleTitle,
    jdText: batch.jdText,
    jdFileName: batch.jdFileName !== undefined ? batch.jdFileName : undefined,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    createdBy: batch.createdBy,
    status: 'SAVING',
    candidateCount: batch.candidateCount,
    rankedCount: batch.rankedCount,
    noScoreCount: batch.noScoreCount,
    failedCount: batch.failedCount,
    weights: batch.weights !== undefined ? batch.weights : undefined,
    knockoutCriteria: batch.knockoutCriteria !== undefined ? batch.knockoutCriteria : undefined
  };

  try {
    try {
      await setDoc(batchDocRef, removeUndefinedDeep(summaryDoc));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `recruiter_batches/${batch.id}`);
    }

    // 2. Save each candidate to candidates subcollection
    for (const candidate of batch.candidates) {
      const candDocRef = doc(db, 'recruiter_batches', batch.id, 'candidates', candidate.id);
      const cleanCandidate: SavedBatchCandidate = {
        id: candidate.id,
        filename: candidate.filename,
        candidateName: candidate.candidateName,
        success: candidate.success,
        processingStatus: candidate.processingStatus,
        rank: hasValidRank(candidate.rank) ? candidate.rank : null,
        overallScore: candidate.overallScore,
        matchLevel: candidate.matchLevel,
        keywordScore: candidate.keywordScore,
        experienceScore: candidate.experienceScore,
        skillScore: candidate.skillScore,
        topStrengths: candidate.topStrengths || [],
        keyGaps: candidate.keyGaps || [],
        shortRecommendation: candidate.shortRecommendation !== undefined ? candidate.shortRecommendation : '',
        errorMessage: candidate.errorMessage !== undefined ? candidate.errorMessage : undefined,
        cvText: candidate.cvText !== undefined ? candidate.cvText : undefined,
        fullAnalysis: candidate.fullAnalysis !== undefined ? candidate.fullAnalysis : undefined,
        pipelineStage: candidate.pipelineStage !== undefined ? candidate.pipelineStage : 'INBOX',
        notes: candidate.notes !== undefined ? candidate.notes : undefined,
        rating: candidate.rating !== undefined ? candidate.rating : undefined,
        tags: candidate.tags !== undefined ? candidate.tags : undefined,
        weightedScore: candidate.weightedScore !== undefined ? candidate.weightedScore : undefined,
        isKnockedOut: candidate.isKnockedOut !== undefined ? candidate.isKnockedOut : undefined,
        knockoutReason: candidate.knockoutReason !== undefined ? candidate.knockoutReason : undefined
      };
      try {
        await setDoc(candDocRef, removeUndefinedDeep(cleanCandidate));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `recruiter_batches/${batch.id}/candidates/${candidate.id}`);
      }
    }

    // 3. Mark batch status READY with new timestamp
    const readyUpdatedAt = new Date().toISOString();
    try {
      await updateDoc(batchDocRef, removeUndefinedDeep({
        status: 'READY',
        updatedAt: readyUpdatedAt
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `recruiter_batches/${batch.id}`);
    }

    // Keep in-memory batch status and updatedAt identical to Firestore
    batch.status = 'READY';
    batch.updatedAt = readyUpdatedAt;
  } catch (firestoreErr: any) {
    console.error('Error persisting recruiter batch to Firestore:', firestoreErr);
    const failedUpdatedAt = new Date().toISOString();
    batch.status = 'FAILED';
    batch.updatedAt = failedUpdatedAt;
    try {
      await updateDoc(batchDocRef, removeUndefinedDeep({
        status: 'FAILED',
        updatedAt: failedUpdatedAt
      }));
    } catch {
      // ignore secondary update failure
    }
    throw firestoreErr;
  }
}


function getHashKey(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfModule: any = pdfParseModule;

    // 1. Check if PDFParse class exists (pdf-parse v2+ / @cybercity/pdf-parse)
    const PDFParseClass = pdfModule?.PDFParse || (pdfModule?.default && pdfModule.default.PDFParse);
    if (typeof PDFParseClass === 'function') {
      const parser = new PDFParseClass({ data: buffer });
      const result = await parser.getText();
      if (result?.text && result.text.trim()) return result.text;
    }

    // 2. Check if pdfModule or default export is a function (pdf-parse v1)
    let pdfFn = typeof pdfModule === 'function' ? pdfModule : pdfModule?.default;
    if (typeof pdfFn !== 'function') {
      try {
        // @ts-ignore
        pdfFn = require('pdf-parse');
        if (typeof pdfFn !== 'function' && pdfFn && typeof pdfFn.default === 'function') {
          pdfFn = pdfFn.default;
        }
      } catch (e) {
        // ignore
      }
    }

    if (typeof pdfFn === 'function') {
      // Pass options object to prevent pdf-parse from loading disk test files
      const pdfData = await pdfFn(buffer, { max: 0 });
      if (pdfData?.text && pdfData.text.trim()) return pdfData.text;
    }

    // 3. Fallback string extraction for raw PDF text streams
    const rawStr = buffer.toString('utf-8');
    const matches = rawStr.match(/[\w\sàáảãạăắằẳẵặânấầnẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\.,:;()\-\/]{4,}/gi);
    if (matches && matches.join(' ').length > 50) {
      return matches.join('\n');
    }

    throw new Error('Không thể đọc dữ liệu chữ từ file PDF này.');
  } catch (err: any) {
    console.error('parsePdfBuffer Error:', err);

    // Final fallback attempt on error
    try {
      const rawStr = buffer.toString('utf-8');
      const matches = rawStr.match(/[\w\sàáảãạăắằẳẵặânấầnẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\.,:;()\-\/]{4,}/gi);
      if (matches && matches.join(' ').length > 50) {
        return matches.join('\n');
      }
    } catch {
      // ignore
    }

    throw new Error('Lỗi đọc file PDF: ' + (err.message || 'File PDF bị đặt mật khẩu hoặc không chứa định dạng chuẩn.'));
  }
}

dotenv.config();

function isVietnameseText(text: string): boolean {
  return /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text || '');
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Security hardening: hide Express header and add security headers
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiting middleware to protect against API flooding / abuse
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(maxRequests = 50, windowMs = 60 * 1000) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Hệ thống nhận thấy quá nhiều yêu cầu từ bạn trong thời gian ngắn. Vui lòng chờ 1 phút rồi thử lại.',
      });
    }

    record.count++;
    return next();
  };
}


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/api', createRateLimiter(50, 60 * 1000));

app.use(express.json({ limit: '10mb' }));

// Maximum allowed character length per field (prevents DoS / memory bloat / prompt overflows)
const MAX_TEXT_LENGTH = 100000;

function isInputOversized(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => typeof t === 'string' && t.length > MAX_TEXT_LENGTH);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const handleUploadAny = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.any()(req, res, (err: any) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({
        error: 'Lỗi tải tệp: ' + (err.message || 'Dung lượng tệp vượt quá giới hạn 15MB.'),
      });
    }
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      req.file = files[0];
    }
    next();
  });
};

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Logs API Endpoints
app.get('/api/logs', (_req, res) => {
  res.json({ logs: appLogs });
});

app.post('/api/logs', (req, res) => {
  const { source = 'client', level = 'error', message, details, endpoint, userAgent } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  const item = recordLog({
    source,
    level,
    message: String(message),
    details: details ? (typeof details === 'string' ? details : JSON.stringify(details, null, 2)) : undefined,
    endpoint,
    userAgent,
  });
  res.json({ success: true, log: item });
});

app.post('/api/logs/clear', (_req, res) => {
  appLogs.length = 0;
  recordLog({ source: 'server', level: 'info', message: 'System log buffer cleared by user.' });
  res.json({ success: true });
});

// ==========================================
// AUTHENTICATION & USER DATABASE API ROUTES
// ==========================================

// Helper: Get user from token
function getUserFromRequest(req: express.Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.query.token as string);

  if (!token) return null;

  const session = activeSessions.get(token);
  if (session) {
    session.lastActive = Date.now();
    return session.user;
  }
  
  // Try stateless signature verification
  const user = verifyToken(token);
  if (user) {
    // If token signature is valid, verify if session is registered in activeSessions
    const active = getActiveSessionForUsername(user.username);
    if (!active) {
      activeSessions.set(token, {
        user,
        username: user.username,
        loginTime: new Date().toISOString(),
        lastActive: Date.now(),
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1',
        userAgent: (req.headers['user-agent'] as string) || 'Unknown',
      });
      return user;
    } else if (active.token === token) {
      active.session.lastActive = Date.now();
      return active.session.user;
    } else if (user.role === 'admin') {
      // Allow admin token with valid cryptographic signature to update active session seamlessly
      activeSessions.delete(active.token);
      activeSessions.set(token, {
        user,
        username: user.username,
        loginTime: new Date().toISOString(),
        lastActive: Date.now(),
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1',
        userAgent: (req.headers['user-agent'] as string) || 'Unknown',
      });
      return user;
    }
  }

  return null;
}

// 1. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
    const clientUa = (req.headers['user-agent'] as string) || 'Unknown';

    if (!username || !password) {
      recordAuditLog({
        userEmail: String(username || 'anonymous').trim(),
        userRole: 'guest',
        action: 'USER_LOGIN',
        category: 'AUTH',
        status: 'error',
        details: 'Đăng nhập thất bại: Tên đăng nhập hoặc mật khẩu để trống',
        ipAddress: clientIp,
        userAgent: clientUa,
      });
      return res.status(400).json({ success: false, error: 'Tên đăng nhập và mật khẩu không được để trống.' });
    }

    const cleanUsername = String(username).toLowerCase().trim();
    let users: StoredUser[];
    try {
      users = await loadUsersAsync();
    } catch (err: any) {
      if (err instanceof AuthDatabaseUnavailableError || err?.code === 'AUTH_DATABASE_UNAVAILABLE') {
        return res.status(503).json({
          success: false,
          code: 'AUTH_DATABASE_UNAVAILABLE',
          error: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
        });
      }
      throw err;
    }

    const user = users.find((u) => typeof u.username === 'string' && u.username.toLowerCase().trim() === cleanUsername);

    if (!user) {
      recordAuditLog({
        userEmail: cleanUsername,
        userRole: 'guest',
        action: 'USER_LOGIN',
        category: 'AUTH',
        status: 'error',
        details: `Đăng nhập thất bại: Tài khoản "${cleanUsername}" không tồn tại trong hệ thống`,
        ipAddress: clientIp,
        userAgent: clientUa,
      });
      return res.status(401).json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    // Check if account is locked (Normal user rule)
    if (user.role !== 'admin' && user.isLocked) {
      recordAuditLog({
        userEmail: user.username,
        userRole: user.role,
        action: 'USER_LOGIN',
        category: 'SECURITY',
        status: 'error',
        details: `Đăng nhập bị từ chối: Tài khoản "${user.username}" đang bị KHOÁ do nhập sai mật khẩu quá 5 lần`,
        ipAddress: clientIp,
        userAgent: clientUa,
      });
      return res.status(403).json({
        success: false,
        isLocked: true,
        failedLoginAttempts: user.failedLoginAttempts || 5,
        remainingAttempts: 0,
        error: 'Tài khoản của bạn đã bị TỰ ĐỘNG KHÓA do nhập sai mật khẩu quá 5 lần. Vui lòng liên hệ Admin để được mở khóa.',
      });
    }

    let isPasswordValid = false;
    try {
      if (user.passwordHash && typeof user.passwordHash === 'string') {
        isPasswordValid = bcrypt.compareSync(String(password), user.passwordHash);
      }
    } catch (err) {
      console.error('Bcrypt comparison error:', err);
    }

    if (!isPasswordValid) {
      if (user.role !== 'admin') {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.isLocked = true;
          user.lockedAt = new Date().toISOString();
          try {
            await saveUsersAsync(users);
          } catch (saveErr: any) {
            if (saveErr instanceof AuthDatabaseUnavailableError || saveErr?.code === 'AUTH_DATABASE_UNAVAILABLE') {
              return res.status(503).json({
                success: false,
                code: 'AUTH_DATABASE_UNAVAILABLE',
                error: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
              });
            }
          }

          recordAuditLog({
            userEmail: user.username,
            userRole: user.role,
            action: 'ACCOUNT_LOCKED',
            category: 'SECURITY',
            status: 'error',
            details: `Tài khoản "${user.username}" đã TỰ ĐỘNG BỊ KHÓA do nhập sai mật khẩu 5 lần liên tiếp`,
            ipAddress: clientIp,
            userAgent: clientUa,
          });

          return res.status(403).json({
            success: false,
            isLocked: true,
            failedLoginAttempts: 5,
            remainingAttempts: 0,
            error: 'Tài khoản của bạn đã bị TỰ ĐỘNG KHÓA do nhập sai mật khẩu quá 5 lần. Vui lòng liên hệ Admin để mở khóa.',
          });
        } else {
          try {
            await saveUsersAsync(users);
          } catch (saveErr: any) {
            if (saveErr instanceof AuthDatabaseUnavailableError || saveErr?.code === 'AUTH_DATABASE_UNAVAILABLE') {
              return res.status(503).json({
                success: false,
                code: 'AUTH_DATABASE_UNAVAILABLE',
                error: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
              });
            }
          }
          const remaining = 5 - user.failedLoginAttempts;

          recordAuditLog({
            userEmail: user.username,
            userRole: user.role,
            action: 'USER_LOGIN',
            category: 'AUTH',
            status: 'error',
            details: `Đăng nhập thất bại: Mật khẩu không chính xác cho tài khoản "${user.username}" (Lần thử ${user.failedLoginAttempts}/5)`,
            ipAddress: clientIp,
            userAgent: clientUa,
          });

          return res.status(401).json({
            success: false,
            isLocked: false,
            failedLoginAttempts: user.failedLoginAttempts,
            remainingAttempts: remaining,
            error: `Mật khẩu không chính xác. Bạn còn ${remaining} lần thử trước khi tài khoản bị khóa.`,
          });
        }
      } else {
        // Admin account: exempt from locking rule
        recordAuditLog({
          userEmail: user.username,
          userRole: 'admin',
          action: 'USER_LOGIN',
          category: 'AUTH',
          status: 'error',
          details: `Đăng nhập thất bại: Mật khẩu không chính xác cho tài khoản Admin "${user.username}"`,
          ipAddress: clientIp,
          userAgent: clientUa,
        });
        return res.status(401).json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      }
    }

    // Handle concurrent sessions:
    const existingSession = getActiveSessionForUsername(user.username);
    if (existingSession) {
      if (user.role === 'admin' || req.body?.force === true) {
        // Admin accounts or explicit force login automatically override previous sessions
        activeSessions.delete(existingSession.token);
        recordAuditLog({
          userEmail: user.username,
          userRole: user.role === 'admin' ? 'admin' : 'normal',
          action: 'USER_LOGIN',
          category: 'SECURITY',
          status: 'success',
          details: `Phiên đăng nhập cũ từ IP ${existingSession.session.ip} đã được ghi đè bởi phiên đăng nhập mới từ IP ${clientIp}`,
          ipAddress: clientIp,
          userAgent: clientUa,
        });
      } else {
        recordAuditLog({
          userEmail: user.username,
          userRole: user.role,
          action: 'USER_LOGIN',
          category: 'SECURITY',
          status: 'error',
          details: `Từ chối đăng nhập: Tài khoản "${user.username}" hiện đang có phiên làm việc active từ IP ${existingSession.session.ip}`,
          ipAddress: clientIp,
          userAgent: clientUa,
        });

        return res.status(409).json({
          success: false,
          isAlreadyLoggedIn: true,
          error: `Tài khoản "${user.username}" hiện ĐANG CÓ PHIÊN ĐĂNG NHẬP HOẠT ĐỘNG ở thiết bị hoặc trình duyệt khác. Để bảo mật, mỗi tài khoản chỉ được phép đăng nhập tại 1 thời điểm.`,
          activeSessionInfo: {
            loginTime: existingSession.session.loginTime,
            ipAddress: existingSession.session.ip,
          },
        });
      }
    }

    // Login successful: reset failed login count for normal users
    if (user.role !== 'admin' && (user.failedLoginAttempts || 0) > 0) {
      user.failedLoginAttempts = 0;
      try {
        await saveUsersAsync(users);
      } catch (saveErr: any) {
        if (saveErr instanceof AuthDatabaseUnavailableError || saveErr?.code === 'AUTH_DATABASE_UNAVAILABLE') {
          return res.status(503).json({
            success: false,
            code: 'AUTH_DATABASE_UNAVAILABLE',
            error: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
          });
        }
      }
    }

    const token = generateToken(user);
    activeSessions.set(token, {
      user,
      username: user.username,
      loginTime: new Date().toISOString(),
      lastActive: Date.now(),
      ip: clientIp,
      userAgent: clientUa,
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
      token,
    };

    recordLog({
      source: 'server',
      level: 'info',
      message: `Đăng nhập thành công: ${user.username} (${user.role.toUpperCase()})`,
      endpoint: '/api/auth/login',
    });

    recordAuditLog({
      userEmail: user.username,
      userRole: user.role === 'admin' ? 'admin' : 'normal',
      action: 'USER_LOGIN',
      category: 'AUTH',
      status: 'success',
      details: `Đăng nhập thành công với tài khoản ${user.username} (${user.role.toUpperCase()})`,
      ipAddress: clientIp,
      userAgent: clientUa,
    });

    return res.json({ success: true, user: safeUser, token });
  } catch (err: any) {
    console.error('Login route error:', err);
    if (err instanceof AuthDatabaseUnavailableError || err?.code === 'AUTH_DATABASE_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        code: 'AUTH_DATABASE_UNAVAILABLE',
        error: 'Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.'
      });
    }
    return res.status(500).json({ success: false, error: 'Lỗi hệ thống trong quá trình đăng nhập. Vui lòng thử lại.' });
  }
});

// 2. Register (Normal Account)
app.post('/api/auth/register', async (req, res) => {
  const { username, password, fullName } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
  const clientUa = (req.headers['user-agent'] as string) || 'Unknown';

  if (!cleanUsername || cleanUsername.length < 3) {
    recordAuditLog({
      userEmail: cleanUsername || 'anonymous',
      userRole: 'guest',
      action: 'USER_REGISTER',
      category: 'AUTH',
      status: 'error',
      details: 'Đăng ký thất bại: Tên đăng nhập ngắn hơn 3 ký tự',
      ipAddress: clientIp,
      userAgent: clientUa,
    });
    return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
  }
  if (!password || String(password).length < 4) {
    recordAuditLog({
      userEmail: cleanUsername,
      userRole: 'guest',
      action: 'USER_REGISTER',
      category: 'AUTH',
      status: 'error',
      details: 'Đăng ký thất bại: Mật khẩu ngắn hơn 4 ký tự',
      ipAddress: clientIp,
      userAgent: clientUa,
    });
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 4 ký tự.' });
  }

  const users = await loadUsersAsync();
  const existing = users.find((u) => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    recordAuditLog({
      userEmail: cleanUsername,
      userRole: 'guest',
      action: 'USER_REGISTER',
      category: 'AUTH',
      status: 'error',
      details: `Đăng ký thất bại: Tài khoản "${cleanUsername}" đã tồn tại trong hệ thống`,
      ipAddress: clientIp,
      userAgent: clientUa,
    });
    return res.status(400).json({ error: 'Tên đăng nhập này đã tồn tại trong hệ thống.' });
  }

  const newUser: StoredUser = {
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    username: cleanUsername,
    passwordHash: bcrypt.hashSync(String(password), 10),
    fullName: String(fullName || cleanUsername).trim(),
    role: 'normal',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await saveUsersAsync(users);

  const token = generateToken(newUser);
  activeSessions.set(token, {
    user: newUser,
    username: newUser.username,
    loginTime: new Date().toISOString(),
    lastActive: Date.now(),
    ip: clientIp,
    userAgent: clientUa,
  });

  const safeUser = {
    id: newUser.id,
    username: newUser.username,
    fullName: newUser.fullName,
    role: newUser.role,
    createdAt: newUser.createdAt,
    token,
  };

  recordLog({
    source: 'server',
    level: 'info',
    message: `Tài khoản mới được tạo: ${newUser.username}`,
    endpoint: '/api/auth/register',
  });

  recordAuditLog({
    userEmail: newUser.username,
    userRole: 'normal',
    action: 'USER_REGISTER',
    category: 'AUTH',
    status: 'success',
    details: `Tạo tài khoản người dùng mới thành công: ${newUser.username}`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, user: safeUser, token });
});

// 3. Get Current Logged-in User
app.get('/api/auth/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.' });
  }
  const safeUser = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };
  res.json({ success: true, user: safeUser });
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.body?.token as string);
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// 5. Admin: Get List of All Users
app.get('/api/admin/users', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  let users: StoredUser[] = [];
  try {
    users = await loadUsersAsync();
  } catch (err: any) {
    console.error('Error loading users for admin users endpoint:', err);
    users = loadUsers();
  }

  const dateKey = getDateKey();

  // Preload settings once
  let preloadedSettings = { limitEnabled: true, dailyLimit: 5, timezone: 'Asia/Ho_Chi_Minh' };
  try {
    preloadedSettings = await getAiQuotaSettings(db);
  } catch (err: any) {
    console.warn('Error preloading settings for admin users endpoint:', err?.message);
  }

  const safeUsers = await Promise.all(users.map(async (u) => {
    const quotaResult = await getUserQuotaUsage(db, u.id, dateKey, preloadedSettings);

    return {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      createdAt: u.createdAt,
      failedLoginAttempts: u.failedLoginAttempts || 0,
      isLocked: !!u.isLocked,
      lockedAt: u.lockedAt,
      candidateUnits: quotaResult.candidateUnits,
      recruiterUnits: quotaResult.recruiterUnits,
      totalUnits: quotaResult.totalUnits,
      dailyLimit: quotaResult.dailyLimit,
      limitEnabled: quotaResult.limitEnabled,
      storageSource: quotaResult.storageSource,
      dateKey,
      resetAt: getResetAt(),
      quotaHealth: quotaResult.quotaHealth
    };
  }));

  res.json({ success: true, users: safeUsers });
});

// 5b. Admin: Lock User Account
app.post('/api/admin/users/:id/lock', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const { id } = req.params;
  const users = await loadUsersAsync();
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng này.' });
  }

  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Không thể khóa tài khoản Admin quản trị.' });
  }

  user.isLocked = true;
  user.lockedAt = new Date().toISOString();
  await saveUsersAsync(users);

  // Immediately revoke active sessions for locked user
  for (const [token, session] of activeSessions.entries()) {
    if (session.username.toLowerCase() === user.username.toLowerCase()) {
      activeSessions.delete(token);
    }
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'USER_LOCK',
    category: 'USER_MGMT',
    status: 'warning',
    details: `Admin đã KHÓA THỦ CÔNG tài khoản: ${user.username}`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: `Đã khóa tài khoản ${user.username}`, user });
});

// 5c. Admin: Unlock User Account
app.post('/api/admin/users/:id/unlock', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const { id } = req.params;
  const users = await loadUsersAsync();
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng này.' });
  }

  user.isLocked = false;
  user.failedLoginAttempts = 0;
  delete user.lockedAt;
  await saveUsersAsync(users);

  // Clean active sessions for unlocked user
  for (const [token, session] of activeSessions.entries()) {
    if (session.username.toLowerCase() === user.username.toLowerCase()) {
      activeSessions.delete(token);
    }
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'USER_UNLOCK',
    category: 'USER_MGMT',
    status: 'success',
    details: `Admin đã MỞ KHÓA tài khoản: ${user.username}`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: `Đã mở khóa tài khoản ${user.username}`, user });
});

// 5d. Admin: Terminate Active Session for User
app.post('/api/admin/users/:id/terminate-session', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const { id } = req.params;
  const users = await loadUsersAsync();
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy người dùng này.' });
  }

  let terminatedCount = 0;
  for (const [token, session] of activeSessions.entries()) {
    if (session.username.toLowerCase() === user.username.toLowerCase()) {
      activeSessions.delete(token);
      terminatedCount++;
    }
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'SESSION_TERMINATE',
    category: 'SECURITY',
    status: 'success',
    details: `Admin đã HỦY PHIÊN ĐĂNG NHẬP (${terminatedCount} phiên) cho tài khoản: ${user.username}`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: `Đã hủy ${terminatedCount} phiên đăng nhập của tài khoản ${user.username}` });
});

// 6. Admin: Create or Update User
app.post('/api/admin/users', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const { id, username, password, fullName, role, isLocked } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  const users = await loadUsersAsync();

  if (id) {
    // Update
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng này.' });
    }

    users[idx].fullName = fullName ? String(fullName).trim() : users[idx].fullName;
    if (role === 'admin' || role === 'normal') {
      users[idx].role = role;
    }
    if (password && String(password).trim().length >= 4) {
      users[idx].passwordHash = bcrypt.hashSync(String(password).trim(), 10);
    }
    if (typeof isLocked === 'boolean' && users[idx].role !== 'admin') {
      users[idx].isLocked = isLocked;
      if (isLocked) {
        users[idx].lockedAt = new Date().toISOString();
      } else {
        users[idx].failedLoginAttempts = 0;
        delete users[idx].lockedAt;
      }
    }
    await saveUsersAsync(users);
    return res.json({ success: true, user: users[idx] });
  } else {
    // Create new
    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 4 ký tự.' });
    }
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }

    const newUser: StoredUser = {
      id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      username: cleanUsername,
      passwordHash: bcrypt.hashSync(String(password), 10),
      fullName: String(fullName || cleanUsername).trim(),
      role: role === 'admin' ? 'admin' : 'normal',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await saveUsersAsync(users);
    return res.json({ success: true, user: newUser });
  }
});

// 7. Admin: Delete User
app.delete('/api/admin/users/:id', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const { id } = req.params;
  if (id === currentUser.id) {
    return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản Admin đang đăng nhập.' });
  }

  let users = await loadUsersAsync();
  users = users.filter((u) => u.id !== id);
  await saveUsersAsync(users);
  if (db) {
    deleteDoc(doc(db, 'users', id)).catch(err => console.error('Error deleting user from Firestore:', err));
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'USER_DELETE',
    category: 'USER_MGMT',
    status: 'warning',
    details: `Admin đã xóa vĩnh viễn người dùng có ID: ${id}`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true });
});

// 7b. Admin: Get Audit Logs
app.get('/api/admin/audit-logs', (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  res.json({ success: true, auditLogs });
});

// 7c. Admin: Clear Audit Logs
app.delete('/api/admin/audit-logs', (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  auditLogs.length = 0;
  if (db) {
    const colRef = collection(db, 'audit_logs');
    getDocs(colRef).then(snapshot => {
      snapshot.forEach(docSnap => {
        deleteDoc(docSnap.ref).catch(err => console.error('Error clearing audit log from Firestore:', err));
      });
    }).catch(err => console.error('Error fetching audit logs for clear:', err));
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'AUDIT_LOGS_CLEAR',
    category: 'SECURITY',
    status: 'warning',
    details: 'Quản trị viên đã xóa sạch dữ liệu nhật ký kiểm toán (Audit Trail Logs)',
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Đã dọn dẹp toàn bộ nhật ký Audit Log.' });
});

// 7d. Admin: Get Uploaded CV & JD Documents
app.get('/api/admin/documents', (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  res.json({ success: true, documents: uploadedDocuments });
});

// 7e. Admin: Delete Single Uploaded Document
app.delete('/api/admin/documents/:id', (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const { id } = req.params;
  const index = uploadedDocuments.findIndex((d) => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy tài liệu với ID chỉ định.' });
  }

  const deletedDoc = uploadedDocuments.splice(index, 1)[0];
  try {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(uploadedDocuments, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing documents to file:', err);
  }

  if (db) {
    deleteDoc(doc(db, 'uploaded_documents', id)).catch(err => console.error('Error deleting document from Firestore:', err));
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'DOCUMENT_DELETE',
    category: 'USER_MGMT',
    status: 'warning',
    details: `Quản trị viên đã xóa tệp ${deletedDoc.fileType}: ${deletedDoc.filename} (${deletedDoc.id})`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Đã xóa tài liệu thành công.' });
});

// 7f. Admin: Clear All Uploaded Documents
app.delete('/api/admin/documents', (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const count = uploadedDocuments.length;
  uploadedDocuments.length = 0;
  try {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing documents to file:', err);
  }

  if (db) {
    const colRef = collection(db, 'uploaded_documents');
    getDocs(colRef).then(snapshot => {
      snapshot.forEach(docSnap => {
        deleteDoc(docSnap.ref).catch(err => console.error('Error clearing documents from Firestore:', err));
      });
    }).catch(err => console.error('Error fetching documents for clear:', err));
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'DOCUMENTS_CLEAR_ALL',
    category: 'USER_MGMT',
    status: 'warning',
    details: `Quản trị viên đã dọn dẹp sạch toàn bộ ${count} tệp CV & JD được upload`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: `Đã dọn dẹp ${count} tài liệu.` });
});

// 7g. Admin: Get CV Analysis Records History
app.get('/api/admin/analyses', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  if (!db) {
    return res.status(503).json({
      success: false,
      code: 'FIRESTORE_UNAVAILABLE',
      error: 'Analysis log storage is temporarily unavailable.'
    });
  }

  try {
    const colRef = collection(db, 'analysis_records');
    const snapshot = await getDocs(colRef);
    const fetched: AnalysisRecordItem[] = [];
    snapshot.forEach((docSnap) => {
      fetched.push(docSnap.data() as AnalysisRecordItem);
    });

    // Sort descending by timestamp / createdAt
    fetched.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    // Sync in-memory cache
    analysisRecords.length = 0;
    analysisRecords.push(...fetched);

    return res.json({ success: true, analyses: fetched });
  } catch (err: any) {
    const rawErrMsg = err?.message || String(err);
    const sanitized = rawErrMsg.replace(/(api[_-]?key|token|password|secret)=[^&\s]+/gi, '$1=***');
    console.error('[Admin Analyses API Error] Failed to read from Firestore:', sanitized);
    return res.status(503).json({
      success: false,
      code: 'FIRESTORE_UNAVAILABLE',
      error: 'Analysis log storage is temporarily unavailable.'
    });
  }
});

// 7h. Admin: Delete Single Analysis Record
app.delete('/api/admin/analyses/:id', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const { id } = req.params;
  const index = analysisRecords.findIndex((a) => a.id === id);
  if (index === -1 && !db) {
    return res.status(404).json({ error: 'Không tìm thấy kết quả phân tích với ID chỉ định.' });
  }

  let deletedRecord: AnalysisRecordItem | undefined;
  if (index !== -1) {
    deletedRecord = analysisRecords.splice(index, 1)[0];
  }

  try {
    fs.writeFileSync(ANALYSES_FILE, JSON.stringify(analysisRecords, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing analyses to file:', err);
  }

  if (db) {
    try {
      await deleteDoc(doc(db, 'analysis_records', id));
    } catch (err) {
      console.error('Error deleting analysis record from Firestore:', err);
    }
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'ANALYSIS_RECORD_DELETE',
    category: 'USER_MGMT',
    status: 'warning',
    details: `Quản trị viên đã xóa kết quả phân tích ID: ${id}${deletedRecord ? ` của ứng viên ${deletedRecord.userEmail}` : ''}`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Đã xóa bản ghi phân tích thành công.' });
});

// 7i. Admin: Clear All Analysis Records
app.delete('/api/admin/analyses', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const count = analysisRecords.length;
  analysisRecords.length = 0;
  try {
    fs.writeFileSync(ANALYSES_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing analyses to file:', err);
  }

  if (db) {
    try {
      const colRef = collection(db, 'analysis_records');
      const snapshot = await getDocs(colRef);
      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    } catch (err) {
      console.error('Error clearing analyses from Firestore:', err);
    }
  }

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'ANALYSES_CLEAR_ALL',
    category: 'USER_MGMT',
    status: 'warning',
    details: `Quản trị viên đã dọn dẹp toàn bộ ${count} kết quả phân tích CV trong lịch sử`,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: `Đã dọn dẹp ${count} kết quả phân tích.` });
});

// 7j. Admin: Clear System Caches (LRU Memory Optimization)
app.post('/api/admin/clear-cache', (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  analyzeCache.clear();
  updatedCvCache.clear();
  formatCache.clear();

  recordAuditLog({
    userEmail: currentUser.username,
    userRole: 'admin',
    action: 'CACHE_CLEAR',
    category: 'SYSTEM',
    status: 'success',
    details: 'Quản trị viên đã giải phóng bộ nhớ đệm LRU Cache (Analyze, Updated CV & Format Cache)',
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, message: 'Đã xóa bộ nhớ đệm LRU Cache hệ thống thành công.' });
});


// 8. Admin: Get System Stats Overview
app.get('/api/admin/stats', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  let users: StoredUser[];
  try {
    users = await loadUsersAsync();
  } catch (err: any) {
    if (err instanceof AuthDatabaseUnavailableError || err?.code === 'AUTH_DATABASE_UNAVAILABLE') {
      return res.status(503).json({ success: false, code: 'AUTH_DATABASE_UNAVAILABLE', error: 'Dịch vụ xác thực tạm thời không khả dụng.' });
    }
    return res.status(500).json({ success: false, error: 'Lỗi tải danh sách người dùng.' });
  }

  const memory = process.memoryUsage();
  const now = Date.now();

  let aiQuota: { limitEnabled: boolean; dailyLimit: number; timezone: string } = {
    limitEnabled: true,
    dailyLimit: 5,
    timezone: 'Asia/Ho_Chi_Minh'
  };
  try {
    if (db) {
      aiQuota = await getAiQuotaSettings(db);
    }
  } catch (err: any) {
    console.warn('Unable to load Firestore aiQuota settings for admin stats overview:', err?.message);
  }

  const activeSessionsList: any[] = [];
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.lastActive <= SESSION_INACTIVITY_TIMEOUT_MS) {
      activeSessionsList.push({
        username: session.username || session.user?.username,
        role: session.user?.role || 'normal',
        fullName: session.user?.fullName || session.username,
        loginTime: session.loginTime,
        lastActive: new Date(session.lastActive).toISOString(),
        ip: session.ip,
        userAgent: session.userAgent,
      });
    }
  }

  res.json({
    success: true,
    stats: {
      totalUsers: users.length,
      adminUsers: users.filter((u) => u.role === 'admin').length,
      normalUsers: users.filter((u) => u.role === 'normal').length,
      activeSessions: activeSessionsList.length,
      activeSessionsList,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryHeapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      memoryHeapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
      nodeVersion: process.version,
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      openrouterConfigured: !!process.env.OPENROUTER_API_KEY,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      systemTime: new Date().toISOString(),
      aiModels: [
        {
          id: 'gemini',
          provider: 'Google Gemini AI',
          model: 'gemini-2.0-flash',
          status: process.env.GEMINI_API_KEY ? 'active' : 'auto_platform',
          statusLabel: process.env.GEMINI_API_KEY ? 'Đang Hoạt Động (Active)' : 'Platform Managed (Auto)',
          role: 'Engine chính (OCR Vision, CV Analysis, Layout Formatting, Audit & Scoring)',
          configured: !!process.env.GEMINI_API_KEY,
          maskedKey: process.env.GEMINI_API_KEY
            ? `${process.env.GEMINI_API_KEY.slice(0, 6)}...${process.env.GEMINI_API_KEY.slice(-4)}`
            : 'Managed by AI Studio Cloud Environment',
          capabilities: ['Vision OCR', 'CV Structural Audit', 'ATS Scoring', 'Markdown Formatting', 'Cover Letter AI'],
          endpoints: ['/api/analyze-cv-gemini', '/api/format-cv-text', '/api/audit-cv', '/api/generate-cover-letter', '/api/extract-text'],
        },
        {
          id: 'openrouter',
          provider: 'OpenRouter Multi-Model Gateway',
          model: process.env.OPENROUTER_MODEL || 'openrouter/auto (Auto Routing)',
          status: process.env.OPENROUTER_API_KEY ? 'active' : 'standby',
          statusLabel: process.env.OPENROUTER_API_KEY ? 'Đang Hoạt Động (Active)' : 'Sẵn Sàng Dự Phòng (Standby)',
          role: 'Cổng đa mô hình dự phòng & Điều phối tải (Load Balancer)',
          configured: !!process.env.OPENROUTER_API_KEY,
          maskedKey: process.env.OPENROUTER_API_KEY
            ? `${process.env.OPENROUTER_API_KEY.slice(0, 6)}...${process.env.OPENROUTER_API_KEY.slice(-4)}`
            : 'Chưa khai báo OPENROUTER_API_KEY (Tùy chọn)',
          capabilities: ['Auto Model Routing', 'Multi-Model Fallback', 'OpenRouter Gateway', 'Dynamic Model Switch'],
          endpoints: ['/api/openrouter-fallback'],
        },
        {
          id: 'openai',
          provider: 'OpenAI Direct API',
          model: 'gpt-4o-mini',
          status: process.env.OPENAI_API_KEY ? 'active' : 'standby',
          statusLabel: process.env.OPENAI_API_KEY ? 'Đang Hoạt Động (Active)' : 'Sẵn Sàng Dự Phòng (Standby)',
          role: 'Engine dự phòng khẩn cấp (Backup Pipeline)',
          configured: !!process.env.OPENAI_API_KEY,
          maskedKey: process.env.OPENAI_API_KEY
            ? `${process.env.OPENAI_API_KEY.slice(0, 6)}...${process.env.OPENAI_API_KEY.slice(-4)}`
            : 'Chưa khai báo OPENAI_API_KEY (Tùy chọn)',
          capabilities: ['Direct GPT-4o Mini', 'High Concurrency Fallback'],
          endpoints: ['/api/openai-fallback'],
        },
      ],
      aiQuota,
      appSettings: aiQuota,
    },
  });
});

// Admin: Update App Limit Settings
app.post('/api/admin/settings', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }
  const { limitEnabled, dailyLimit } = req.body;
  try {
    const updated = await updateAiQuotaSettings(db, {
      limitEnabled: typeof limitEnabled === 'boolean' ? limitEnabled : undefined,
      dailyLimit: typeof dailyLimit === 'number' && dailyLimit >= 1 ? dailyLimit : undefined,
      userEmail: currentUser.username
    });
    res.json({ success: true, message: 'Đã cập nhật cấu hình giới hạn phân tích thành công.', appSettings: updated, aiQuota: updated });
  } catch (err: any) {
    if (err?.message === 'QUOTA_SERVICE_UNAVAILABLE') {
      return res.status(503).json({ success: false, code: 'QUOTA_SERVICE_UNAVAILABLE', error: 'Dịch vụ quota tạm thời không khả dụng.' });
    }
    res.status(500).json({ success: false, error: err?.message || 'Lỗi hệ thống khi cập nhật settings.' });
  }
});

// Admin: Reset a user's analysis count
app.post('/api/admin/users/:id/reset-limit', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }
  const rawUserId = req.params.id;
  const users = await loadUsersAsync();
  const dbUser = users.find(u => u.id === rawUserId || u.username === rawUserId);
  if (!dbUser) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
  }

  if (dbUser.role !== 'normal') {
    return res.status(400).json({ error: 'Chỉ có thể đặt lại số lượt cho tài khoản có quyền người dùng thường (normal).' });
  }

  const userId = normalizeUserId(dbUser.id);
  const dateKey = getDateKey();

  const preResetQuota = await getUserQuotaUsage(db, userId, dateKey);

  try {
    const result = await resetUserQuotaForDate(db, userId, dateKey);
    
    if (!result.success) {
      if (result.local.success || result.firestore.success) {
        recordAuditLog({
          userEmail: currentUser.username || currentUser.email || 'admin',
          userRole: 'admin',
          action: 'RESET_USER_QUOTA',
          category: 'SYSTEM',
          status: 'error',
          details: `Reset quota thất bại một phần cho ${dbUser.username}. Local=${result.local.success}, Firestore=${result.firestore.success}.`,
          ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Unknown'
        });
        return res.status(503).json({
          success: false,
          code: 'QUOTA_RESET_PARTIAL_FAILURE',
          error: 'Quota chỉ được reset tại một nguồn, không đảm bảo tính toàn vẹn.',
          local: { success: result.local.success },
          firestore: { success: result.firestore.success }
        });
      } else {
        recordAuditLog({
          userEmail: currentUser.username || currentUser.email || 'admin',
          userRole: 'admin',
          action: 'RESET_USER_QUOTA',
          category: 'SYSTEM',
          status: 'error',
          details: `Reset quota thất bại hoàn toàn cho ${dbUser.username}. Local=${result.local.success}, Firestore=${result.firestore.success}.`,
          ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Unknown'
        });
        return res.status(500).json({ success: false, error: 'Reset quota thất bại.' });
      }
    }

    // Reservation cleanup
    if (db) {
      try {
        const resQuery = query(collection(db, 'ai_reservations'), where('userId', '==', userId), where('dateKey', '==', dateKey));
        const resSnap = await getDocs(resQuery);
        for (const dSnap of resSnap.docs) {
          await deleteDoc(dSnap.ref);
        }
      } catch (resErr) {
        console.warn('[reset-limit] Reservation deletion warning:', resErr);
      }
    }

    const postResetQuota = await getUserQuotaUsage(db, userId, dateKey);

    if (
      postResetQuota.candidateUnits !== 0 ||
      postResetQuota.recruiterUnits !== 0 ||
      postResetQuota.totalUnits !== 0
    ) {
      recordAuditLog({
        userEmail: currentUser.username || currentUser.email || 'admin',
        userRole: 'admin',
        action: 'RESET_USER_QUOTA',
        category: 'SYSTEM',
        status: 'error',
        details: `Reset quota thất bại xác minh sau reset cho ${dbUser.username}.`,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown'
      });
      return res.status(500).json({ success: false, error: 'Reset quota thất bại xác minh.' });
    }
    
    recordAuditLog({
      userEmail: currentUser.username || currentUser.email || 'admin',
      userRole: 'admin',
      action: 'RESET_USER_QUOTA',
      category: 'SYSTEM',
      status: 'success',
      details: `Trước: Cand ${preResetQuota.candidateUnits}, Batch ${preResetQuota.recruiterUnits}, Total ${preResetQuota.totalUnits}/${preResetQuota.dailyLimit}. Sau: Cand ${postResetQuota.candidateUnits}, Batch ${postResetQuota.recruiterUnits}, Total ${postResetQuota.totalUnits}/${postResetQuota.dailyLimit}. Nguồn: ${result.storageSource}.`,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown'
    });

    if (dbUser.dailyAnalysisCount) {
      dbUser.dailyAnalysisCount[dateKey] = 0;
      await saveUsersAsync(users);
    }

    return res.json({
      success: true,
      userId: dbUser.id,
      username: dbUser.username,
      candidateUnits: postResetQuota.candidateUnits,
      recruiterUnits: postResetQuota.recruiterUnits,
      totalUnits: postResetQuota.totalUnits,
      dailyLimit: postResetQuota.dailyLimit,
      remainingUnits: postResetQuota.remainingUnits,
      storageSource: result.storageSource,
      quotaHealth: result.quotaHealth
    });

  } catch (err: any) {
    console.error('[reset-limit] Error:', err);
    return res.status(500).json({ success: false, error: 'Đã có lỗi xảy ra.' });
  }
});

// ==========================================
// RECRUITER BATCH PERSISTENCE API ROUTES
// ==========================================

const ALLOWED_BATCH_MATCH_LEVELS = [
  'Very High',
  'High',
  'Medium',
  'Low',
  'NOT_AVAILABLE'
] as const;

function normalizeScore(val: any): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  return null;
}

// 1. POST /api/recruiter/batches - Save batch results
app.post('/api/recruiter/batches', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để lưu kết quả tuyển dụng.' });
    }

    const { batchName, roleTitle, jdText, jdFileName, candidates: rawCandidates } = req.body || {};

    if (!batchName || typeof batchName !== 'string' || !batchName.trim()) {
      return res.status(400).json({ error: 'Tên đợt tuyển dụng (batchName) là bắt buộc.' });
    }
    if (!roleTitle || typeof roleTitle !== 'string' || !roleTitle.trim()) {
      return res.status(400).json({ error: 'Vị trí tuyển dụng (roleTitle) là bắt buộc.' });
    }
    if (!jdText || typeof jdText !== 'string' || !jdText.trim()) {
      return res.status(400).json({ error: 'Nội dung mô tả công việc (jdText) là bắt buộc.' });
    }
    if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
      return res.status(400).json({ error: 'Danh sách ứng viên (candidates) không được để trống.' });
    }

    const cleanBatchName = batchName.trim();
    const cleanRoleTitle = roleTitle.trim();
    const cleanJdText = jdText.trim();
    const cleanJdFileName = (typeof jdFileName === 'string' && jdFileName.trim()) ? jdFileName.trim() : undefined;

    const createdBy: RecruiterBatchOwner = {
      userId: currentUser.id,
      username: currentUser.username,
      fullName: currentUser.fullName || currentUser.username
    };

    // Normalize candidates with server-generated unique IDs and exact match levels
    const normalizedCandidates: SavedBatchCandidate[] = rawCandidates.map((raw: any, idx: number) => {
      const candidateId = `cand_${crypto.randomUUID()}`;
      const filename = (typeof raw.filename === 'string' && raw.filename.trim())
        ? raw.filename.trim()
        : `candidate_${idx + 1}.pdf`;
      const candidateName = (typeof raw.candidateName === 'string' && raw.candidateName.trim())
        ? raw.candidateName.trim()
        : extractNameFromFilename(filename) || filename.replace(/\.[^/.]+$/, '');

      const isFailed = raw.success === false || !!raw.errorMessage;
      const overallScore = isFailed ? null : normalizeScore(raw.overallScore);
      const keywordScore = isFailed ? null : normalizeScore(raw.keywordScore);
      const experienceScore = isFailed ? null : normalizeScore(raw.experienceScore);
      const skillScore = isFailed ? null : normalizeScore(raw.skillScore);

      const processingStatus: CandidateProcessingStatus = isFailed
        ? 'FAILED'
        : (overallScore !== null ? 'COMPLETED' : 'NO_SCORE');

      let matchLevel: 'Very High' | 'High' | 'Medium' | 'Low' | 'NOT_AVAILABLE' = 'NOT_AVAILABLE';
      if (typeof raw.matchLevel === 'string' && (ALLOWED_BATCH_MATCH_LEVELS as readonly string[]).includes(raw.matchLevel)) {
        matchLevel = raw.matchLevel as any;
      }

      const topStrengths: string[] = isFailed
        ? []
        : (Array.isArray(raw.topStrengths)
            ? raw.topStrengths.filter((s: any): s is string => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim())
            : []);

      const keyGaps: string[] = isFailed
        ? []
        : (Array.isArray(raw.keyGaps)
            ? raw.keyGaps.filter((g: any): g is string => typeof g === 'string' && g.trim().length > 0).map((g: string) => g.trim())
            : []);

      const shortRecommendation = isFailed
        ? ''
        : ((typeof raw.shortRecommendation === 'string') ? raw.shortRecommendation.trim() : '');

      return {
        id: candidateId,
        filename,
        candidateName,
        success: !isFailed,
        processingStatus,
        rank: null,
        overallScore,
        matchLevel,
        keywordScore,
        experienceScore,
        skillScore,
        topStrengths,
        keyGaps,
        shortRecommendation,
        errorMessage: isFailed ? (raw.errorMessage !== undefined ? raw.errorMessage : 'Phân tích ứng viên thất bại') : undefined,
        cvText: raw.cvText !== undefined ? raw.cvText : undefined,
        fullAnalysis: raw.fullAnalysis !== undefined ? raw.fullAnalysis : undefined,
        pipelineStage: (typeof raw.pipelineStage === 'string' && ['INBOX', 'SHORTLIST', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(raw.pipelineStage)) ? raw.pipelineStage : 'INBOX',
        notes: (typeof raw.notes === 'string') ? raw.notes.trim() : undefined,
        rating: (typeof raw.rating === 'number' && Number.isFinite(raw.rating)) ? Math.max(0, Math.min(5, Math.round(raw.rating))) : undefined,
        tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim()) : undefined,
        weightedScore: (typeof raw.weightedScore === 'number' && Number.isFinite(raw.weightedScore)) ? raw.weightedScore : undefined,
        isKnockedOut: typeof raw.isKnockedOut === 'boolean' ? raw.isKnockedOut : undefined,
        knockoutReason: (typeof raw.knockoutReason === 'string') ? raw.knockoutReason.trim() : undefined
      };
    });

    // Server-side rank snapshot for COMPLETED candidates
    const completedCandidates = normalizedCandidates.filter(c => c.processingStatus === 'COMPLETED');
    completedCandidates.sort((a, b) => {
      const scoreDiff = (b.overallScore as number) - (a.overallScore as number);
      if (scoreDiff !== 0) return scoreDiff;
      const nameDiff = a.candidateName.localeCompare(b.candidateName, undefined, { sensitivity: 'base' });
      if (nameDiff !== 0) return nameDiff;
      return a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' });
    });

    completedCandidates.forEach((c, index) => {
      c.rank = index + 1;
    });

    // Stable sort across all candidate statuses
    sortBatchCandidates(normalizedCandidates);

    const candidateCount = normalizedCandidates.length;
    const rankedCount = completedCandidates.length;
    const noScoreCount = normalizedCandidates.filter(c => c.processingStatus === 'NO_SCORE').length;
    const failedCount = normalizedCandidates.filter(c => c.processingStatus === 'FAILED').length;

    const nowIso = new Date().toISOString();
    const clientBatchId = (req.body?.batchId as string)?.trim() || (req.body?.id as string)?.trim();
    const batchId = clientBatchId || `batch_${crypto.randomUUID()}`;
    const initialStatus: RecruiterBatchStatus = db ? 'SAVING' : 'READY';

    const newBatchDetail: RecruiterBatchDetail = {
      id: batchId,
      batchName: cleanBatchName,
      roleTitle: cleanRoleTitle,
      jdText: cleanJdText,
      jdFileName: cleanJdFileName,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy,
      status: initialStatus,
      candidateCount,
      rankedCount,
      noScoreCount,
      failedCount,
      weights: (req.body?.weights && typeof req.body.weights === 'object') ? req.body.weights : undefined,
      knockoutCriteria: (req.body?.knockoutCriteria && typeof req.body.knockoutCriteria === 'object') ? req.body.knockoutCriteria : undefined,
      candidates: normalizedCandidates
    };

    // Pre-insert into in-memory store (in-memory will reflect SAVING while Firestore persists)
    recruiterBatches.unshift(newBatchDetail);

    // Persistence Flow:
    if (db) {
      // 1. Cloud Firestore primary persistence
      try {
        await persistRecruiterBatchToFirestore(newBatchDetail);
      } catch (firestoreErr) {
        console.error('Firestore save failed for recruiter batch:', firestoreErr);
        // Best effort to save local file as FAILED
        try {
          saveRecruiterBatchesToFile();
        } catch (localErr) {
          console.warn('Secondary local file write also failed for FAILED batch:', localErr);
        }
        return res.status(500).json({
          error: 'Không thể lưu đợt tuyển dụng vào cơ sở dữ liệu đám mây.'
        });
      }

      // 2. Update batchName across analysis_records with matching batchId in memory and Firestore
      let updatedCount = 0;
      for (const rec of analysisRecords) {
        if (rec.batchId === batchId) {
          rec.batchName = cleanBatchName;
          updatedCount++;
        }
      }

      try {
        const analysisCol = collection(db, 'analysis_records');
        const q = query(analysisCol, where('batchId', '==', batchId));
        const matchingDocs = await getDocs(q);
        for (const dSnap of matchingDocs.docs) {
          await updateDoc(doc(db, 'analysis_records', dSnap.id), {
            batchName: cleanBatchName
          });
        }
      } catch (updateErr) {
        console.warn('Warning: Could not update batchName on Firestore analysis_records:', updateErr);
      }

      // 3. Local cache file update
      try {
        saveRecruiterBatchesToFile();
        if (updatedCount > 0) {
          fs.writeFileSync(ANALYSES_FILE, JSON.stringify(analysisRecords, null, 2), 'utf-8');
        }
      } catch (localErr) {
        console.warn('Warning: Firestore saved successfully but local file cache write failed:', localErr);
      }
    } else {
      // Local-only persistence
      for (const rec of analysisRecords) {
        if (rec.batchId === batchId) {
          rec.batchName = cleanBatchName;
        }
      }
      try {
        saveRecruiterBatchesToFile();
        fs.writeFileSync(ANALYSES_FILE, JSON.stringify(analysisRecords, null, 2), 'utf-8');
      } catch (localErr) {
        console.error('Local persistence failed:', localErr);
        // Rollback in-memory addition
        const idx = recruiterBatches.indexOf(newBatchDetail);
        if (idx !== -1) {
          recruiterBatches.splice(idx, 1);
        }
        return res.status(500).json({
          error: 'Không thể lưu dữ liệu đợt tuyển dụng vào tệp tin cục bộ.'
        });
      }
    }

    // Record audit log only upon successful persistence
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
    const clientUa = req.headers['user-agent'];
    recordAuditLog({
      userEmail: currentUser.username,
      userRole: currentUser.role === 'admin' ? 'admin' : 'normal',
      action: 'RECRUITER_BATCH_CREATED',
      category: 'AI_SERVICE',
      status: 'success',
      details: `Đã lưu đợt phân tích Recruiter Batch: "${cleanBatchName}" (ID: ${batchId}, Vị trí: "${cleanRoleTitle}", Tổng: ${candidateCount}, Đã xếp hạng: ${rankedCount}, Không có điểm: ${noScoreCount}, Thất bại: ${failedCount})`,
      ipAddress: clientIp,
      userAgent: clientUa
    });

    return res.status(201).json({
      success: true,
      batch: newBatchDetail
    });
  } catch (err: any) {
    console.error('API /api/recruiter/batches POST Error:', err);
    return res.status(500).json({
      error: 'Lỗi hệ thống khi lưu kết quả đợt tuyển dụng.'
    });
  }
});

// 2. GET /api/recruiter/batches - List saved batches summary
app.get('/api/recruiter/batches', (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để xem danh sách batch.' });
    }

    let userBatches = currentUser.role === 'admin'
      ? [...recruiterBatches]
      : recruiterBatches.filter(
          b => b.createdBy.userId === currentUser.id || b.createdBy.username.toLowerCase() === currentUser.username.toLowerCase()
        );

    // Optional query filtering
    const search = (req.query.search as string)?.toLowerCase().trim();
    if (search) {
      userBatches = userBatches.filter(b =>
        b.batchName.toLowerCase().includes(search) ||
        b.roleTitle.toLowerCase().includes(search) ||
        (b.jdFileName && b.jdFileName.toLowerCase().includes(search))
      );
    }

    const statusFilter = (req.query.status as string)?.trim();
    if (statusFilter) {
      userBatches = userBatches.filter(b => b.status === statusFilter);
    }

    // Sort newest first
    userBatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Map to RecruiterBatchSummary (omit candidates and fullAnalysis)
    const summaries: RecruiterBatchSummary[] = userBatches.map(b => ({
      id: b.id,
      batchName: b.batchName,
      roleTitle: b.roleTitle,
      jdText: b.jdText,
      jdFileName: b.jdFileName,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      createdBy: b.createdBy,
      status: b.status,
      candidateCount: b.candidateCount,
      rankedCount: b.rankedCount,
      noScoreCount: b.noScoreCount,
      failedCount: b.failedCount
    }));

    return res.json({
      success: true,
      batches: summaries
    });
  } catch (err: any) {
    console.error('API /api/recruiter/batches GET Error:', err);
    return res.status(500).json({
      error: 'Lỗi hệ thống khi tải danh sách đợt tuyển dụng.'
    });
  }
});

// 3. GET /api/recruiter/batches/:id - Get batch detail
app.get('/api/recruiter/batches/:id', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để mở chi tiết batch.' });
    }

    const { id } = req.params;
    let batch = recruiterBatches.find(b => b.id === id);

    // Fallback: If not in memory, try loading from Firestore
    if (!batch && db) {
      try {
        const batchDocRef = doc(db, 'recruiter_batches', id);
        let batchDocSnap;
        try {
          batchDocSnap = await getDoc(batchDocRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `recruiter_batches/${id}`);
        }

        if (batchDocSnap.exists()) {
          const summary = batchDocSnap.data() as RecruiterBatchSummary;
          const candidatesCol = collection(db, 'recruiter_batches', id, 'candidates');
          let candSnapshot;
          try {
            candSnapshot = await getDocs(candidatesCol);
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, `recruiter_batches/${id}/candidates`);
          }

          const candidates = candSnapshot.docs.map(d => {
            const c = d.data() as SavedBatchCandidate;
            c.rank = hasValidRank(c.rank) ? c.rank : null;
            return c;
          });

          sortBatchCandidates(candidates);

          batch = {
            ...summary,
            candidates
          };
          recruiterBatches.unshift(batch);
          try {
            saveRecruiterBatchesToFile();
          } catch (lErr) {
            console.warn('Could not save loaded batch to local file cache:', lErr);
          }
        }
      } catch (fetchErr) {
        console.warn('Could not load batch from Firestore:', fetchErr);
        // Throw or pass through if it's already a JSON error string
        if (fetchErr instanceof Error && fetchErr.message.startsWith('{')) {
          return res.status(500).json({ error: fetchErr.message });
        }
      }
    }

    if (!batch) {
      return res.status(404).json({ error: 'Không tìm thấy đợt tuyển dụng với ID chỉ định.' });
    }

    // Access control: Only owner or admin can view detail
    const isOwner = batch.createdBy.userId === currentUser.id ||
      batch.createdBy.username.toLowerCase() === currentUser.username.toLowerCase();
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập đợt tuyển dụng này.' });
    }

    return res.json({
      success: true,
      batch
    });
  } catch (err: any) {
    console.error('API /api/recruiter/batches/:id GET Error:', err);
    return res.status(500).json({ error: 'Lỗi server nội bộ.' });
  }
});

// 3.5. PUT /api/recruiter/batches/:id - Update batch metadata, weights, knockout criteria, and candidates (pipeline, notes, ratings, tags)
app.put('/api/recruiter/batches/:id', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
    }

    const { id } = req.params;
    let batchIndex = recruiterBatches.findIndex(b => b.id === id);

    if (batchIndex === -1 && db) {
      try {
        const batchDocRef = doc(db, 'recruiter_batches', id);
        const batchDocSnap = await getDoc(batchDocRef);
        if (batchDocSnap.exists()) {
          const summary = batchDocSnap.data() as RecruiterBatchSummary;
          const candidatesCol = collection(db, 'recruiter_batches', id, 'candidates');
          const candSnapshot = await getDocs(candidatesCol);
          const candidates = candSnapshot.docs.map(d => {
            const c = d.data() as SavedBatchCandidate;
            c.rank = hasValidRank(c.rank) ? c.rank : null;
            return c;
          });
          sortBatchCandidates(candidates);
          const loadedBatch = { ...summary, candidates };
          recruiterBatches.unshift(loadedBatch);
          batchIndex = 0;
        }
      } catch (fErr) {
        console.warn('Error loading batch from Firestore for PUT:', fErr);
      }
    }

    if (batchIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đợt tuyển dụng.' });
    }

    const batch = recruiterBatches[batchIndex];
    if (batch.createdBy.userId !== currentUser.id && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Truy cập bị từ chối.' });
    }

    const body = req.body || {};
    const nowIso = new Date().toISOString();

    if (body.weights && typeof body.weights === 'object') {
      batch.weights = body.weights;
    }
    if (body.knockoutCriteria && typeof body.knockoutCriteria === 'object') {
      batch.knockoutCriteria = body.knockoutCriteria;
    }
    if (typeof body.batchName === 'string' && body.batchName.trim()) {
      batch.batchName = body.batchName.trim();
    }
    if (typeof body.roleTitle === 'string' && body.roleTitle.trim()) {
      batch.roleTitle = body.roleTitle.trim();
    }

    if (Array.isArray(body.candidates)) {
      for (const updatedCand of body.candidates) {
        const targetCand = batch.candidates.find(c => c.id === updatedCand.id || c.filename === updatedCand.filename);
        if (targetCand) {
          if (updatedCand.pipelineStage) targetCand.pipelineStage = updatedCand.pipelineStage;
          if (updatedCand.notes !== undefined) targetCand.notes = updatedCand.notes;
          if (updatedCand.rating !== undefined) targetCand.rating = updatedCand.rating;
          if (Array.isArray(updatedCand.tags)) targetCand.tags = updatedCand.tags;
          if (updatedCand.weightedScore !== undefined) targetCand.weightedScore = updatedCand.weightedScore;
          if (updatedCand.isKnockedOut !== undefined) targetCand.isKnockedOut = updatedCand.isKnockedOut;
          if (updatedCand.knockoutReason !== undefined) targetCand.knockoutReason = updatedCand.knockoutReason;
          if (updatedCand.rank !== undefined) targetCand.rank = updatedCand.rank;
        }
      }
    }

    batch.updatedAt = nowIso;

    if (db) {
      try {
        const batchDocRef = doc(db, 'recruiter_batches', batch.id);
        const updateSummary: Partial<RecruiterBatchSummary> = {
          batchName: batch.batchName,
          roleTitle: batch.roleTitle,
          updatedAt: nowIso,
          weights: batch.weights,
          knockoutCriteria: batch.knockoutCriteria
        };
        await updateDoc(batchDocRef, removeUndefinedDeep(updateSummary));

        if (Array.isArray(body.candidates)) {
          for (const cand of batch.candidates) {
            const candDocRef = doc(db, 'recruiter_batches', batch.id, 'candidates', cand.id);
            await setDoc(candDocRef, removeUndefinedDeep(cand), { merge: true });
          }
        }
      } catch (fsErr) {
        console.warn('Warning: Firestore update failed for batch:', fsErr);
      }
    }

    try {
      saveRecruiterBatchesToFile();
    } catch (lErr) {
      console.warn('Local file cache write failed on update:', lErr);
    }

    return res.json({
      success: true,
      batch
    });
  } catch (err: any) {
    console.error('API /api/recruiter/batches/:id PUT Error:', err);
    return res.status(500).json({ error: 'Lỗi server nội bộ khi cập nhật đợt tuyển dụng.' });
  }
});

// 4. DELETE /api/recruiter/batches/:id - Delete a batch
app.delete('/api/recruiter/batches/:id', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) return res.status(401).json({ error: 'Vui lòng đăng nhập.' });

    const batchId = req.params.id;
    const batchIndex = recruiterBatches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) return res.status(404).json({ error: 'Không tìm thấy đợt tuyển dụng.' });
    
    const batch = recruiterBatches[batchIndex];
    if (batch.createdBy.userId !== currentUser.id && currentUser.role !== 'admin') return res.status(403).json({ error: 'Truy cập bị từ chối.' });

    // Firestore deletion
    if (db) {
       // Delete candidates subcollection
       const candidatesCol = collection(db, 'recruiter_batches', batchId, 'candidates');
       const candidatesSnap = await getDocs(candidatesCol);
       for (const cDoc of candidatesSnap.docs) {
         await deleteDoc(cDoc.ref);
       }
       // Delete batch document
       await deleteDoc(doc(db, 'recruiter_batches', batchId));
    }
    
    // Update local state
    recruiterBatches.splice(batchIndex, 1);
    saveRecruiterBatchesToFile();
    
    recordAuditLog({
        userEmail: currentUser.email || '',
        userRole: currentUser.role,
        action: 'RECRUITER_BATCH_DELETED',
        category: 'SYSTEM',
        status: 'success',
        details: `Deleted batch ${batchId}`
    });

    res.json({ success: true, deletedId: batchId });
  } catch (err) {
    console.error('API /api/recruiter/batches/:id DELETE Error:', err);
    res.status(500).json({ error: 'Lỗi server nội bộ.' });
  }
});

// 5. DELETE /api/recruiter/batches - Delete all batches of user
app.delete('/api/recruiter/batches', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) return res.status(401).json({ error: 'Vui lòng đăng nhập.' });

    const userBatches = recruiterBatches.filter(b => b.createdBy.userId === currentUser.id);
    const deletedCount = userBatches.length;

    for (const batch of userBatches) {
        // Firestore deletion
        if (db) {
            const candidatesCol = collection(db, 'recruiter_batches', batch.id, 'candidates');
            const candidatesSnap = await getDocs(candidatesCol);
            for (const cDoc of candidatesSnap.docs) {
              await deleteDoc(cDoc.ref);
            }
            await deleteDoc(doc(db, 'recruiter_batches', batch.id));
        }
    }

    // Update local state
    const newBatches = recruiterBatches.filter(b => b.createdBy.userId !== currentUser.id);
    recruiterBatches.length = 0;
    recruiterBatches.push(...newBatches);
    saveRecruiterBatchesToFile();
    
    recordAuditLog({
        userEmail: currentUser.email || '',
        userRole: currentUser.role,
        action: 'RECRUITER_BATCHES_BULK_DELETED',
        category: 'SYSTEM',
        status: 'success',
        details: `Deleted ${deletedCount} batches`
    });

    res.json({ success: true, deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server nội bộ.' });
  }
});

// ==========================================
// CANDIDATE CLOUD HISTORY API ROUTES (PHASE 2)
// ==========================================

// 1. GET /api/candidate/history - Fetch user candidate history
app.get('/api/candidate/history', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để xem lịch sử phân tích CV.' });
    }

    // Try fetching from Firestore if available
    if (db) {
      try {
        const historyCol = collection(db, 'candidate_history');
        const q = query(historyCol, where('userId', '==', currentUser.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const cloudItems: StoredCandidateHistoryItem[] = [];
          snap.forEach((docSnap) => {
            cloudItems.push(docSnap.data() as StoredCandidateHistoryItem);
          });
          // Update in-memory cache for this user
          const otherUsersItems = candidateHistories.filter((h) => h.userId !== currentUser.id);
          candidateHistories.length = 0;
          candidateHistories.push(...cloudItems, ...otherUsersItems);
          saveCandidateHistoriesToFile();
        }
      } catch (firestoreErr) {
        console.warn('Warning: Firestore read error on /api/candidate/history, falling back to memory/file cache:', firestoreErr);
      }
    }

    const userHistories = candidateHistories
      .filter((h) => h.userId === currentUser.id || h.username?.toLowerCase() === currentUser.username.toLowerCase())
      .sort((a, b) => (b.updatedAt || b.timestamp || 0) - (a.updatedAt || a.timestamp || 0));

    return res.json({
      success: true,
      items: userHistories,
    });
  } catch (err: any) {
    console.error('API /api/candidate/history GET Error:', err);
    return res.status(500).json({ error: 'Lỗi khi tải lịch sử phân tích CV đám mây.' });
  }
});

// 2. POST /api/candidate/history - Save or batch-sync candidate history items
app.post('/api/candidate/history', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để lưu lịch sử phân tích CV.' });
    }

    const { item, items } = req.body || {};
    const inputItems: HistoryItem[] = Array.isArray(items)
      ? items
      : item
      ? [item]
      : [];

    if (inputItems.length === 0) {
      return res.status(400).json({ error: 'Dữ liệu phân tích CV không được để trống.' });
    }

    let savedCount = 0;
    const now = Date.now();

    for (const rawItem of inputItems) {
      if (!rawItem) continue;
      const historyId = rawItem.id || `cand_hist_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const storedItem: StoredCandidateHistoryItem = {
        ...rawItem,
        id: historyId,
        userId: currentUser.id,
        username: currentUser.username,
        timestamp: rawItem.timestamp || now,
        updatedAt: rawItem.updatedAt || now,
        isSynced: true,
      };

      // Sanitize undefined fields for Firestore
      const sanitized = removeUndefinedDeep(storedItem);

      // Memory cache update
      const existingIdx = candidateHistories.findIndex((h) => h.id === historyId);
      if (existingIdx >= 0) {
        candidateHistories[existingIdx] = storedItem;
      } else {
        candidateHistories.unshift(storedItem);
      }

      // Firestore persistence
      if (db) {
        try {
          await setDoc(doc(db, 'candidate_history', historyId), sanitized);
        } catch (fsErr) {
          console.warn('Warning: Could not save candidate history item to Firestore:', fsErr);
        }
      }

      savedCount++;
    }

    saveCandidateHistoriesToFile();

    recordAuditLog({
      userEmail: currentUser.username,
      userRole: currentUser.role === 'admin' ? 'admin' : 'normal',
      action: 'CANDIDATE_HISTORY_SYNCED',
      category: 'AI_SERVICE',
      status: 'success',
      details: `Đồng bộ ${savedCount} bản ghi phân tích CV của ứng viên ${currentUser.username} lên đám mây.`,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      count: savedCount,
    });
  } catch (err: any) {
    console.error('API /api/candidate/history POST Error:', err);
    return res.status(500).json({ error: 'Lỗi khi lưu lịch sử phân tích CV lên đám mây.' });
  }
});

// 3. PUT /api/candidate/history/:id - Rename or update candidate history item
app.put('/api/candidate/history/:id', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
    }

    const { id } = req.params;
    const { companyName, jobTitle, title, isCustomTitle } = req.body || {};

    const existingIdx = candidateHistories.findIndex((h) => h.id === id);
    if (existingIdx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi lịch sử phân tích CV.' });
    }

    const item = candidateHistories[existingIdx];
    if (item.userId !== currentUser.id && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa bản ghi này.' });
    }

    if (companyName !== undefined) item.companyName = typeof companyName === 'string' ? companyName.trim() : item.companyName;
    if (jobTitle !== undefined) item.jobTitle = typeof jobTitle === 'string' ? jobTitle.trim() : item.jobTitle;
    if (title !== undefined) item.title = typeof title === 'string' ? title.trim() : item.title;
    if (isCustomTitle !== undefined) item.isCustomTitle = Boolean(isCustomTitle);
    item.updatedAt = Date.now();

    saveCandidateHistoriesToFile();

    if (db) {
      try {
        await updateDoc(doc(db, 'candidate_history', id), {
          companyName: item.companyName || '',
          jobTitle: item.jobTitle || '',
          title: item.title,
          isCustomTitle: item.isCustomTitle,
          updatedAt: item.updatedAt,
        });
      } catch (fsErr) {
        console.warn('Warning: Could not update candidate history in Firestore:', fsErr);
      }
    }

    return res.json({
      success: true,
      item,
    });
  } catch (err: any) {
    console.error('API /api/candidate/history/:id PUT Error:', err);
    return res.status(500).json({ error: 'Lỗi khi cập nhật bản ghi lịch sử CV.' });
  }
});

// 4. DELETE /api/candidate/history/:id - Delete single candidate history item
app.delete('/api/candidate/history/:id', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
    }

    const { id } = req.params;
    const existingIdx = candidateHistories.findIndex((h) => h.id === id);
    if (existingIdx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi lịch sử phân tích CV.' });
    }

    const item = candidateHistories[existingIdx];
    if (item.userId !== currentUser.id && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bản ghi này.' });
    }

    candidateHistories.splice(existingIdx, 1);
    saveCandidateHistoriesToFile();

    if (db) {
      try {
        await deleteDoc(doc(db, 'candidate_history', id));
      } catch (fsErr) {
        console.warn('Warning: Could not delete candidate history from Firestore:', fsErr);
      }
    }

    return res.json({ success: true, message: 'Đã xóa bản ghi thành công.' });
  } catch (err: any) {
    console.error('API /api/candidate/history/:id DELETE Error:', err);
    return res.status(500).json({ error: 'Lỗi khi xóa bản ghi lịch sử CV.' });
  }
});

// 5. DELETE /api/candidate/history - Clear all candidate history for user
app.delete('/api/candidate/history', async (req, res) => {
  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
    }

    const userItems = candidateHistories.filter((h) => h.userId === currentUser.id);
    const deletedCount = userItems.length;

    // Remove user items from in-memory cache
    const remaining = candidateHistories.filter((h) => h.userId !== currentUser.id);
    candidateHistories.length = 0;
    candidateHistories.push(...remaining);
    saveCandidateHistoriesToFile();

    if (db) {
      try {
        for (const item of userItems) {
          await deleteDoc(doc(db, 'candidate_history', item.id));
        }
      } catch (fsErr) {
        console.warn('Warning: Could not clear candidate history in Firestore:', fsErr);
      }
    }

    recordAuditLog({
      userEmail: currentUser.username,
      userRole: currentUser.role === 'admin' ? 'admin' : 'normal',
      action: 'CANDIDATE_HISTORY_CLEARED',
      category: 'USER_MGMT',
      status: 'warning',
      details: `Đã xóa toàn bộ ${deletedCount} bản ghi lịch sử phân tích CV của ứng viên ${currentUser.username}.`,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ success: true, deletedCount });
  } catch (err: any) {
    console.error('API /api/candidate/history DELETE Error:', err);
    return res.status(500).json({ error: 'Lỗi khi xóa toàn bộ lịch sử CV.' });
  }
});

// 9. Admin: Test Live Connection to AI Models (Ping Test)
app.post('/api/admin/ping-ai', async (req, res) => {
  const currentUser = getUserFromRequest(req);
  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối. Yêu cầu tài khoản Admin.' });
  }

  const results: any[] = [];

  // 1. Live Ping Test to Google Gemini API
  const geminiStart = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }

    // Strict 3 seconds timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Reply with "PONG" only.'
          }]
        }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const geminiLat = Date.now() - geminiStart;

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP error ${res.status} (${res.statusText})`;
      throw new Error(errMsg);
    }

    const data = await res.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    results.push({
      id: 'gemini',
      provider: 'Google Gemini AI',
      model: 'gemini-3.6-flash',
      status: 'online',
      latencyMs: geminiLat,
      message: 'Kết nối trực tiếp thành công! Mô hình gemini-3.6-flash phản hồi bình thường.',
      responseSnippet: textResponse.trim().slice(0, 60),
      testedAt: new Date().toISOString(),
      configuredKey: true,
    });
  } catch (err: any) {
    let errMsg = err.message || String(err);
    if (err.name === 'AbortError') {
      errMsg = 'Yêu cầu kết nối bị quá thời gian (Timeout 3000ms)';
    }
    results.push({
      id: 'gemini',
      provider: 'Google Gemini AI',
      model: 'gemini-3.6-flash',
      status: 'error',
      latencyMs: Date.now() - geminiStart,
      message: 'Lỗi phản hồi từ Gemini API: ' + errMsg,
      testedAt: new Date().toISOString(),
      configuredKey: !!process.env.GEMINI_API_KEY,
    });
  }

  // 2. Live Ping Test to OpenRouter API
  const openrouterStart = Date.now();
  let rawOpenRouter = (process.env.OPENROUTER_API_KEY || '').trim();
  let rawOpenAI = (process.env.OPENAI_API_KEY || '').trim();

  // Smart detect if OpenAI key was mistakenly placed in OPENROUTER_API_KEY
  let openrouterApiKey = '';
  let openaiApiKey = rawOpenAI;

  if (rawOpenRouter.startsWith('sk-or-')) {
    openrouterApiKey = rawOpenRouter;
  } else if (rawOpenRouter.startsWith('sk-proj-') || rawOpenRouter.startsWith('sk-')) {
    // It's an OpenAI key put in OpenRouter variable
    if (!openaiApiKey) {
      openaiApiKey = rawOpenRouter;
    }
  } else if (rawOpenRouter) {
    openrouterApiKey = rawOpenRouter;
  }

  if (openrouterApiKey && openrouterApiKey.length > 5) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'https://ai.studio',
          'X-Title': 'CV Auditor Connection Check'
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10,
        }),
      });
      const lat = Date.now() - openrouterStart;
      if (response.ok) {
        const data = await response.json();
        results.push({
          id: 'openrouter',
          provider: 'OpenRouter Multi-Model Gateway',
          model: data.model || 'openrouter/auto',
          status: 'online',
          latencyMs: lat,
          message: 'Kết nối thành công tới OpenRouter API Gateway!',
          responseSnippet: data.choices?.[0]?.message?.content?.trim() || 'OK',
          testedAt: new Date().toISOString(),
          configuredKey: true,
        });
      } else {
        const errText = await response.text();
        let parsedErr: any;
        try { parsedErr = JSON.parse(errText); } catch { parsedErr = errText; }
        const errMsgDetail = parsedErr?.error?.message || parsedErr?.message || errText.slice(0, 150);
        results.push({
          id: 'openrouter',
          provider: 'OpenRouter Multi-Model Gateway',
          model: 'openrouter/auto',
          status: 'error',
          latencyMs: lat,
          message: `OpenRouter trả về lỗi HTTP ${response.status}: ${errMsgDetail}`,
          testedAt: new Date().toISOString(),
          configuredKey: true,
        });
      }
    } catch (err: any) {
      results.push({
        id: 'openrouter',
        provider: 'OpenRouter Multi-Model Gateway',
        model: 'openrouter/auto',
        status: 'error',
        latencyMs: Date.now() - openrouterStart,
        message: 'Không thể kết nối OpenRouter Gateway: ' + (err.message || String(err)),
        testedAt: new Date().toISOString(),
        configuredKey: true,
      });
    }
  } else {
    const isMistakenKey = rawOpenRouter.startsWith('sk-proj-');
    results.push({
      id: 'openrouter',
      provider: 'OpenRouter Multi-Model Gateway',
      model: process.env.OPENROUTER_MODEL || 'openrouter/auto (Auto Routing)',
      status: isMistakenKey ? 'error' : 'standby',
      latencyMs: 0,
      message: isMistakenKey
        ? 'Phát hiện Key trong OPENROUTER_API_KEY là của OpenAI (sk-proj-...). Vui lòng nhập đúng OpenRouter Key (dạng sk-or-v1-...).'
        : 'OPENROUTER_API_KEY chưa được khai báo. Cổng dự phòng ở trạng thái chờ (Standby).',
      testedAt: new Date().toISOString(),
      configuredKey: false,
    });
  }

  // 3. Live Ping Test to OpenAI API
  if (openaiApiKey && openaiApiKey.length > 5) {
    const openaiStart = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 10,
        }),
      });
      const lat = Date.now() - openaiStart;
      if (response.ok) {
        const data = await response.json();
        results.push({
          id: 'openai',
          provider: 'OpenAI Direct API',
          model: 'gpt-4o-mini',
          status: 'online',
          latencyMs: lat,
          message: 'Kết nối thành công tới OpenAI Direct API!',
          responseSnippet: data.choices?.[0]?.message?.content?.trim() || 'OK',
          testedAt: new Date().toISOString(),
          configuredKey: true,
        });
      } else {
        const errText = await response.text().catch(() => '');
        let detailedMsg = `OpenAI trả về lỗi HTTP ${response.status}`;
        if (response.status === 429) {
          detailedMsg = `Lỗi HTTP 429: Hết Hạn Ngạch (Insufficient Quota) hoặc Vượt Giới Hạn Tốc Độ (Rate Limit).`;
        } else if (response.status === 401) {
          detailedMsg = `Lỗi HTTP 401: Key OpenAI không đúng hoặc bị vô hiệu hóa.`;
        }
        results.push({
          id: 'openai',
          provider: 'OpenAI Direct API',
          model: 'gpt-4o-mini',
          status: 'error',
          latencyMs: lat,
          message: detailedMsg,
          responseSnippet: errText.slice(0, 80),
          testedAt: new Date().toISOString(),
          configuredKey: true,
        });
      }
    } catch (err: any) {
      results.push({
        id: 'openai',
        provider: 'OpenAI Direct API',
        model: 'gpt-4o-mini',
        status: 'error',
        latencyMs: Date.now() - openaiStart,
        message: 'Lỗi kết nối OpenAI: ' + (err.message || String(err)),
        testedAt: new Date().toISOString(),
        configuredKey: true,
      });
    }
  } else {
    results.push({
      id: 'openai',
      provider: 'OpenAI Direct API',
      model: 'gpt-4o-mini',
      status: 'standby',
      latencyMs: 0,
      message: 'OPENAI_API_KEY chưa được khai báo. Mô hình ở trạng thái chờ (Standby).',
      testedAt: new Date().toISOString(),
      configuredKey: false,
    });
  }

  res.json({ success: true, results, testedAt: new Date().toISOString() });
});


// API Endpoint for Extracting Text from PDF, DOCX, TXT, Images, etc.
app.post('/api/extract-text', handleUploadAny, async (req, res) => {
  const reqLang = (req.query.lang || req.body?.lang || 'vi') === 'en' ? 'en' : 'vi';
  const isEn = reqLang === 'en';

  try {
    const uploadedFile = req.file || (req.files as Express.Multer.File[])?.[0];

    if (!uploadedFile) {
      return res.status(400).json({ error: isEn ? 'No uploaded file found.' : 'Không tìm thấy tệp được tải lên.' });
    }

    const { originalname, buffer, mimetype } = uploadedFile;
    const extension = path.extname(originalname).toLowerCase();
    let extractedText = '';

    const isImage = mimetype.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(extension);

    if (
      extension === '.docx' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || '';
    } else if (extension === '.pdf' || mimetype === 'application/pdf' || mimetype.includes('pdf')) {
      try {
        extractedText = await parsePdfBuffer(buffer);
      } catch (pdfErr) {
        console.warn('pdf-parse failed, will attempt Gemini Vision OCR:', pdfErr);
      }

      // If PDF text extraction yielded nothing or less than 20 chars (scanned PDF), use Gemini Vision OCR
      if (!extractedText || extractedText.trim().length < 20) {
        console.log('PDF text is empty or too short. Attempting Gemini Vision OCR fallback...');
        const ocrText = await extractTextWithGeminiVision(buffer, mimetype || 'application/pdf', extension);
        if (ocrText && ocrText.trim().length > 10) {
          extractedText = ocrText;
        }
      }
    } else if (isImage) {
      console.log('Uploaded file is an image. Attempting Gemini Vision OCR...');
      extractedText = await extractTextWithGeminiVision(buffer, mimetype || 'image/jpeg', extension);
    } else if (extension === '.doc') {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } catch {
        extractedText = buffer.toString('utf-8').replace(/[^\x20-\x7E\s\u00C0-\u024F\u1EA0-\u1EF9]/g, ' ');
      }
      if (!extractedText || extractedText.trim().length < 20) {
        const ocrText = await extractTextWithGeminiVision(buffer, mimetype, extension);
        if (ocrText && ocrText.trim().length > 10) {
          extractedText = ocrText;
        }
      }
    } else if (
      extension === '.txt' ||
      extension === '.md' ||
      extension === '.text' ||
      extension === '.json' ||
      extension === '.csv' ||
      extension === '.rtf' ||
      mimetype.startsWith('text/')
    ) {
      extractedText = buffer.toString('utf-8');
    } else {
      // General text fallback attempt
      const rawBufStr = buffer.toString('utf-8');
      const printableCharRatio = (rawBufStr.match(/[\x20-\x7E\s\u00C0-\u024F\u1EA0-\u1EF9]/g) || []).length / Math.max(rawBufStr.length, 1);
      if (printableCharRatio > 0.6) {
        extractedText = rawBufStr;
      } else {
        // Try Gemini Vision OCR before giving up
        const ocrText = await extractTextWithGeminiVision(buffer, mimetype, extension);
        if (ocrText && ocrText.trim().length > 10) {
          extractedText = ocrText;
        } else {
          return res.status(400).json({
            error: isEn
              ? 'Unsupported file format. Please upload .pdf, .docx, .txt, or image files.'
              : 'Định dạng tệp không hỗ trợ. Vui lòng tải lên tệp .pdf, .docx, .txt hoặc ảnh.',
          });
        }
      }
    }

    extractedText = extractedText
      .replace(/\0/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!extractedText) {
      return res.status(422).json({
        error: isEn
          ? 'File contains no readable text. You can paste the content directly into the text box below.'
          : 'Tệp tải lên không chứa văn bản đọc được. Bạn có thể dán nội dung trực tiếp vào ô bên dưới.',
      });
    }

    const cleanedText = cleanAndStructureExtractedText(extractedText);
    const safeFilename = path.basename(originalname).replace(/[^\w\s\.\-àáảãạăắằẳẵặânấầnẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi, '_');

    const currentUser = getUserFromRequest(req);
    const isJd = (req.body?.type === 'jd' || safeFilename.toLowerCase().includes('jd'));
    let docFormat: 'PDF' | 'DOCX' | 'TXT' | 'IMAGE' | 'TEXT_INPUT' = 'TXT';
    if (extension === '.pdf') docFormat = 'PDF';
    else if (extension === '.docx' || extension === '.doc') docFormat = 'DOCX';
    else if (isImage) docFormat = 'IMAGE';

    recordUploadedDocument({
      filename: safeFilename,
      fileType: isJd ? 'JD' : 'CV',
      mimeType: mimetype || 'application/octet-stream',
      fileSizeKB: Math.round(buffer.length / 1024) || 1,
      characterCount: cleanedText.length,
      uploadedBy: currentUser ? currentUser.username : 'user_guest',
      extractedTextPreview: cleanedText.slice(0, 180) + (cleanedText.length > 180 ? '...' : ''),
      fullText: cleanedText,
      format: docFormat,
    });

    return res.json({
      text: cleanedText,
      rawText: extractedText,
      filename: safeFilename,
      characterCount: cleanedText.length,
    });
  } catch (err: any) {
    console.error('API /api/extract-text Error:', err);
    recordLog({
      source: 'upload',
      level: 'error',
      message: 'Failed to extract text from file',
      details: err?.stack || err?.message || String(err),
      endpoint: '/api/extract-text',
    });
    return res.status(500).json({
      error: (isEn ? 'Failed to extract text from file: ' : 'Không thể trích xuất nội dung từ tệp: ') + (err.message || 'Unknown error'),
    });
  }
});

// ==========================================
// JD URL EXTRACTION & AUTH POPUP ASSIST API
// ==========================================

import {
  validatePublicJobUrl,
  detectJobSiteName,
  extractLinkedInJobId,
  decodeHtmlEntities,
  stripHtmlToFormattedText,
  extractJsonLdJobPosting,
  extractMetaAndBodyText,
  isLikelyAuthOrBotWall,
  cleanPortalTitleSuffix,
  cleanJdTextHeuristically,
} from './src/utils/jdUrlExtractorHelpers';

export {
  validatePublicJobUrl,
  detectJobSiteName,
  extractLinkedInJobId,
  decodeHtmlEntities,
  stripHtmlToFormattedText,
  extractJsonLdJobPosting,
  extractMetaAndBodyText,
  isLikelyAuthOrBotWall,
  cleanPortalTitleSuffix,
  cleanJdTextHeuristically,
};

export async function cleanAndExtractJdWithAi(
  rawInputText: string,
  sourceInfo: { url?: string; siteName?: string; hintTitle?: string },
  lang: 'vi' | 'en'
): Promise<{ isAuthWall: boolean; jobTitle: string; jdText: string }> {
  const trimmedInput = rawInputText.slice(0, 35000).trim();

  try {
    const ai = getGeminiClient(20000);
    const prompt = `
You are an expert HR Data Extraction Engine.
Below is raw text extracted or copied from a job posting webpage (${sourceInfo.siteName || 'Job Portal'}${sourceInfo.url ? ` - ${sourceInfo.url}` : ''}).

Your tasks:
1. Determine if this text actually contains a Job Description (JD) or if it is ONLY a login wall / sign-in prompt / Cloudflare captcha / empty error page with no job details.
   - Set "isAuthWall": true ONLY IF there is no actual job description content and the text is mainly asking the user to sign in, verify they are human, or showing an error.
2. If it contains a Job Description, extract and format the COMPLETE Job Description into clean, structured Markdown in its ORIGINAL language (do NOT translate the JD).
   - Strip out website navigation menus, "Sign in / Register" buttons, "Similar Jobs / Việc làm tương tự", company reviews sidebar, footer copyright, and cookie notices.
   - Keep 100% of the job details: Job Title, Company Name, Location/Work mode, Job Overview/Summary, Responsibilities/Job Description, Requirements/Qualifications/Skills, and Benefits/Compensation.
   - Use clear Markdown headings (e.g., # Job Title, ## Mô tả công việc / Responsibilities, ## Yêu cầu ứng viên / Requirements, ## Quyền lợi / Benefits) and bullet points ("- ").

Respond ONLY with valid JSON matching this exact structure:
{
  "isAuthWall": boolean,
  "companyName": "Hiring company name (e.g. FPT Software, Techcombank) or empty string if not mentioned",
  "jobTitle": "Clean job title (e.g. Senior React Developer)",
  "jdText": "Full cleaned Markdown job description"
}

RAW WEBPAGE TEXT:
"""
${trimmedInput}
"""
`;

    const response = await callGeminiWithRetry(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
      timeoutMs: 18000,
    });

    if (response?.text) {
      const parsed = parseJsonSafely(response.text);
      if (parsed && typeof parsed === 'object') {
        if (parsed.isAuthWall === true) {
          return { isAuthWall: true, jobTitle: '', jdText: '' };
        }
        if (typeof parsed.jdText === 'string' && parsed.jdText.trim().length > 60) {
          const cleanRole = typeof parsed.jobTitle === 'string' && parsed.jobTitle.trim()
            ? parsed.jobTitle.trim()
            : cleanPortalTitleSuffix(sourceInfo.hintTitle || '');
          const cleanCompany = typeof parsed.companyName === 'string' && parsed.companyName.trim()
            ? parsed.companyName.trim()
            : '';
          let formattedJd = parsed.jdText.trim();
          if (cleanCompany && !/(?:công\s*ty|company)\s*:/i.test(formattedJd.slice(0, 300))) {
            if (formattedJd.startsWith('#')) {
              const firstNewline = formattedJd.indexOf('\n');
              if (firstNewline !== -1) {
                formattedJd = `${formattedJd.slice(0, firstNewline)}\n**Công ty / Company:** ${cleanCompany}${formattedJd.slice(firstNewline)}`;
              }
            } else {
              formattedJd = `# ${cleanRole || 'Job Description'}\n**Công ty / Company:** ${cleanCompany}\n\n${formattedJd}`;
            }
          }
          return {
            isAuthWall: false,
            jobTitle: cleanCompany && cleanRole && !cleanRole.toLowerCase().includes(cleanCompany.toLowerCase())
              ? `${cleanCompany} - ${cleanRole}`
              : cleanRole,
            jdText: formattedJd,
          };
        }
      }
    }
  } catch (aiErr: any) {
    console.warn('[JD URL Extract] AI structuring fallback triggered:', aiErr?.message || aiErr);
  }

  // Heuristic fallback when AI is unavailable or rate-limited
  return cleanJdTextHeuristically(trimmedInput, sourceInfo, lang);
}

// 1. POST /api/extract-jd-from-url - Fetch & extract JD from a job posting link
app.post('/api/extract-jd-from-url', async (req, res) => {
  const reqLang = (req.query.lang || req.body?.lang || 'vi') === 'en' ? 'en' : 'vi';
  const isEn = reqLang === 'en';

  try {
    const { url: rawUrl } = req.body || {};
    const validation = validatePublicJobUrl(rawUrl);
    if (!validation.valid || !validation.parsed) {
      return res.status(400).json({
        success: false,
        error: isEn ? validation.errorEn : validation.errorVi,
      });
    }

    const parsedUrl = validation.parsed;
    const siteName = detectJobSiteName(parsedUrl);
    const browserHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
    };

    // Special handling for LinkedIn job URLs: try LinkedIn public guest API first if jobId is present
    const linkedInJobId = extractLinkedInJobId(parsedUrl);
    if (linkedInJobId) {
      try {
        const guestApiUrl = `https://www.linkedin.com/jobs-guest/api/jobPosting/${linkedInJobId}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const liRes = await fetch(guestApiUrl, {
          method: 'GET',
          headers: browserHeaders,
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (liRes.ok) {
          const liHtml = await liRes.text();
          const { pageTitle, bodyText } = extractMetaAndBodyText(liHtml);
          if (bodyText && bodyText.length > 150) {
            const structured = await cleanAndExtractJdWithAi(
              bodyText,
              { url: parsedUrl.toString(), siteName: 'LinkedIn', hintTitle: pageTitle },
              reqLang
            );
            if (!structured.isAuthWall && structured.jdText.length > 80) {
              return res.json({
                success: true,
                requiresAuth: false,
                siteName: 'LinkedIn',
                sourceUrl: parsedUrl.toString(),
                jobTitle: structured.jobTitle || pageTitle || 'LinkedIn Job',
                text: structured.jdText,
              });
            }
          }
        }
      } catch (liErr) {
        console.warn('[JD URL Extract] LinkedIn guest API attempt failed, falling back to direct fetch:', liErr);
      }
    }

    // Standard fetch with timeout
    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: browserHeaders,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      console.warn('[JD URL Extract] Network/fetch error for URL:', parsedUrl.toString(), fetchErr?.message);
      return res.json({
        success: false,
        requiresAuth: true,
        siteName,
        sourceUrl: parsedUrl.toString(),
        reason: isEn
          ? `${siteName} requires browser login or security verification to view this job posting.`
          : `Trang ${siteName} yêu cầu đăng nhập hoặc xác thực trình duyệt để đọc nội dung tin tuyển dụng này.`,
      });
    }

    const finalUrl = response.url || parsedUrl.toString();
    const rawHtml = await response.text().catch(() => '');

    // 1. Check for structured JSON-LD JobPosting schema first (works even on many complex SPAs)
    const jsonLdJob = extractJsonLdJobPosting(rawHtml);
    if (jsonLdJob && jsonLdJob.descriptionText && jsonLdJob.descriptionText.length > 120) {
      const structured = await cleanAndExtractJdWithAi(
        jsonLdJob.descriptionText,
        { url: finalUrl, siteName, hintTitle: jsonLdJob.title },
        reqLang
      );
      if (!structured.isAuthWall && structured.jdText.length > 80) {
        return res.json({
          success: true,
          requiresAuth: false,
          siteName,
          sourceUrl: parsedUrl.toString(),
          jobTitle: structured.jobTitle || jsonLdJob.title || siteName,
          text: structured.jdText,
        });
      }
    }

    // 2. Extract general HTML meta & visible text
    const { pageTitle, metaDescription, bodyText } = extractMetaAndBodyText(rawHtml);
    const combinedRawText = [
      pageTitle ? `# ${pageTitle}` : '',
      metaDescription ? `${metaDescription}` : '',
      bodyText,
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    // 3. Check if blocked by login wall / Cloudflare / anti-bot
    if (
      isLikelyAuthOrBotWall({
        status: response.status,
        finalUrl,
        rawHtml,
        pageTitle,
        extractedText: combinedRawText,
      })
    ) {
      return res.json({
        success: false,
        requiresAuth: true,
        siteName,
        sourceUrl: parsedUrl.toString(),
        reason: isEn
          ? `${siteName} requires you to sign in on your browser before viewing this Job Description.`
          : `Trang ${siteName} yêu cầu đăng nhập tài khoản để xem nội dung Mô tả công việc (JD) này.`,
      });
    }

    // 4. Clean & structure via AI
    const structured = await cleanAndExtractJdWithAi(
      combinedRawText,
      { url: finalUrl, siteName, hintTitle: pageTitle },
      reqLang
    );

    if (structured.isAuthWall || !structured.jdText || structured.jdText.trim().length < 80) {
      return res.json({
        success: false,
        requiresAuth: true,
        siteName,
        sourceUrl: parsedUrl.toString(),
        reason: isEn
          ? `${siteName} requires you to sign in on your browser to read the full Job Description.`
          : `Trang ${siteName} yêu cầu đăng nhập để hiển thị đầy đủ nội dung Mô tả công việc (JD).`,
      });
    }

    return res.json({
      success: true,
      requiresAuth: false,
      siteName,
      sourceUrl: parsedUrl.toString(),
      jobTitle: structured.jobTitle || pageTitle || siteName,
      text: structured.jdText,
    });
  } catch (err: any) {
    console.error('API /api/extract-jd-from-url Error:', err);
    return res.status(500).json({
      success: false,
      error: (isEn ? 'Failed to extract JD from URL: ' : 'Lỗi khi trích xuất JD từ liên kết: ') + (err?.message || 'Unknown error'),
    });
  }
});

// 2. POST /api/clean-pasted-jd - AI-powered JD extraction from logged-in popup clipboard copy
app.post('/api/clean-pasted-jd', async (req, res) => {
  const reqLang = (req.query.lang || req.body?.lang || 'vi') === 'en' ? 'en' : 'vi';
  const isEn = reqLang === 'en';

  try {
    const { rawText, sourceUrl } = req.body || {};
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 30) {
      return res.status(400).json({
        success: false,
        error: isEn
          ? 'Copied content is empty or too short. Please copy the job posting content from the login popup window first.'
          : 'Nội dung sao chép trống hoặc quá ngắn. Vui lòng sao chép (Ctrl+A rồi Ctrl+C) nội dung trang tuyển dụng từ cửa sổ vừa đăng nhập.',
      });
    }

    let siteName = 'Job Portal';
    if (sourceUrl && typeof sourceUrl === 'string') {
      try {
        siteName = detectJobSiteName(new URL(sourceUrl));
      } catch {
        // ignore
      }
    }

    const structured = await cleanAndExtractJdWithAi(
      rawText,
      { url: sourceUrl, siteName },
      reqLang
    );

    if (structured.isAuthWall || !structured.jdText || structured.jdText.trim().length < 40) {
      return res.status(422).json({
        success: false,
        error: isEn
          ? 'Could not find valid Job Description details in the copied text (it appears to still be a login/verification page). Please sign in until the job posting is visible before copying.'
          : 'Không tìm thấy nội dung Mô tả công việc hợp lệ trong văn bản vừa sao chép (có vẻ trang vẫn đang ở màn hình Đăng nhập/Xác thực). Vui lòng hoàn tất đăng nhập đến khi thấy chi tiết tin tuyển dụng rồi sao chép lại.',
      });
    }

    return res.json({
      success: true,
      siteName,
      sourceUrl: sourceUrl || '',
      jobTitle: structured.jobTitle || siteName,
      text: structured.jdText,
    });
  } catch (err: any) {
    console.error('API /api/clean-pasted-jd Error:', err);
    return res.status(500).json({
      success: false,
      error: (isEn ? 'Failed to process JD content: ' : 'Không thể xử lý nội dung JD: ') + (err?.message || 'Unknown error'),
    });
  }
});

// Helper: Map file extensions to standard MIME types
function getMimeTypeFromExtension(ext: string): string {
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.txt': return 'text/plain';
    case '.rtf': return 'application/rtf';
    case '.md': return 'text/markdown';
    default: return 'application/octet-stream';
  }
}

// Helper: Extract text from any file buffer (PDF, DOCX, TXT, etc.)
async function extractTextFromBuffer(buffer: Buffer, originalname: string, mimetype: string): Promise<string> {
  const extension = path.extname(originalname).toLowerCase();
  let extractedText = '';

  const isImage = mimetype.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'].includes(extension);

  if (
    extension === '.docx' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value || '';
  } else if (extension === '.pdf' || mimetype === 'application/pdf' || mimetype.includes('pdf')) {
    try {
      extractedText = await parsePdfBuffer(buffer);
    } catch (pdfErr) {
      console.warn('pdf-parse failed in batch extraction:', pdfErr);
    }

    if (!extractedText || extractedText.trim().length < 20) {
      const ocrText = await extractTextWithGeminiVision(buffer, mimetype || 'application/pdf', extension);
      if (ocrText && ocrText.trim().length > 10) {
        extractedText = ocrText;
      }
    }
  } else if (isImage) {
    extractedText = await extractTextWithGeminiVision(buffer, mimetype || 'image/jpeg', extension);
  } else if (extension === '.doc') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || '';
    } catch {
      extractedText = buffer.toString('utf-8').replace(/[^\x20-\x7E\s\u00C0-\u024F\u1EA0-\u1EF9]/g, ' ');
    }
    if (!extractedText || extractedText.trim().length < 20) {
      const ocrText = await extractTextWithGeminiVision(buffer, mimetype, extension);
      if (ocrText && ocrText.trim().length > 10) {
        extractedText = ocrText;
      }
    }
  } else if (
    extension === '.txt' ||
    extension === '.md' ||
    extension === '.text' ||
    extension === '.json' ||
    extension === '.csv' ||
    extension === '.rtf' ||
    mimetype.startsWith('text/')
  ) {
    extractedText = buffer.toString('utf-8');
  } else {
    const rawBufStr = buffer.toString('utf-8');
    const printableCharRatio = (rawBufStr.match(/[\x20-\x7E\s\u00C0-\u024F\u1EA0-\u1EF9]/g) || []).length / Math.max(rawBufStr.length, 1);
    if (printableCharRatio > 0.6) {
      extractedText = rawBufStr;
    } else {
      const ocrText = await extractTextWithGeminiVision(buffer, mimetype, extension);
      if (ocrText && ocrText.trim().length > 10) {
        extractedText = ocrText;
      }
    }
  }

  return extractedText
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Helper: Promise-based concurrency pool
async function processBatchInPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = Promise.resolve().then(() => fn(item, i));
    results.push(p);
    if (limit <= items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// Helper: Build the optimal comparative Prompt for Gemini
function buildBatchPrompt(cvText: string, jdText: string, lang: 'vi' | 'en'): string {
  const isEn = lang === 'en';
  return `
You are an expert recruiter and CV evaluation system.
Analyze the candidate's CV against the provided Job Description (JD).

JD Content:
"""
${jdText}
"""

CV Content:
"""
${cvText}
"""

Return a rigorous comparison and matching analysis in JSON format conforming EXACTLY to the following schema:
- candidateName: Full name of the candidate extracted from the CV. If not found, use a short, smart placeholder based on email or filename, or 'Unknown'.
- overallScore: Match score from 0 to 100 based on how well the candidate fits the requirements. Be objective and professional.
- matchLevel: Match level assessment, must be one of: 'Very High', 'High', 'Medium', 'Low'.
- keywordScore: Match score for keywords and skills overlap (0 to 100).
- experienceScore: Match score for experience years, responsibilities, and industry outcomes (0 to 100).
- skillScore: Match score for core technical & soft skills required by the JD (0 to 100).
- topStrengths: An array of 3 to 5 detailed bullet points showing the candidate's biggest strengths matching this JD (in ${isEn ? 'English' : 'Vietnamese'}).
- keyGaps: An array of 3 to 5 detailed bullet points detailing the key missing skills, tools, or requirements (in ${isEn ? 'English' : 'Vietnamese'}).
- shortRecommendation: A 1-sentence professional hiring recommendation summarizing their fit (in ${isEn ? 'English' : 'Vietnamese'}).

CRITICAL LANGUAGE CONSTRAINT:
All output fields (topStrengths, keyGaps, shortRecommendation, candidateName) MUST be written strictly in ${isEn ? 'ENGLISH' : 'VIETNAMESE'}. Under no circumstances should any mixed-language results or simultaneous translations be returned. Keep professional/technical terms (e.g., SLA, KPI, CAB, CMDB) or CV quotations verbatim and untranslated.

Crucial: Return ONLY valid JSON matching the specified schema. No markdown formatting outside the JSON, no backticks, no comments.
`;
}

function isPlausiblePersonName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim().replace(/^[\*\#\-\•\>\s]+/, '').replace(/[\*\#\-\•\:\,\.]+$/, '').trim();
  if (clean.length < 2 || clean.length > 45) return false;

  // Must not end with sentence punctuation or contain colons or numbers
  if (/[.:;?!]$/.test(clean)) return false;
  if (/\d/.test(clean)) return false; // e.g. "1 of 4", "2024", "100%"
  if (/@|https?:\/\/|www\.|\.com|\.vn|\.org|\.net/i.test(clean)) return false;

  const lower = clean.toLowerCase();

  // Blacklist of phrases/skills/headings/stop words that are NOT personal names
  const forbiddenPatterns = [
    'team leadership', 'leadership', 'kpi', 'pdp', 'development', 'management',
    'engineer', 'developer', 'designer', 'consultant', 'analyst', 'manager', 'lead',
    'curriculum vitae', 'resume', 'applicant cv', 'personal details', 'contact info',
    'work experience', 'professional experience', 'skills', 'technical skills',
    'core competencies', 'education', 'certifications', 'projects', 'summary',
    'executive summary', 'objective', 'career objective', 'about me', 'profile',
    'page', 'of', 'responsibilities', 'achievements', 'awards', 'languages',
    'hồ sơ', 'sơ yếu', 'lý lịch', 'kinh nghiệm', 'kỹ năng', 'học vấn', 'mục tiêu',
    'thông tin', 'liên hệ', 'dự án', 'chức vụ', 'công việc', 'trách nhiệm',
    'thành tích', 'chứng chỉ', 'việc của', 'nhân sự', 'kế toán', 'lập trình',
    'quản lý', 'trưởng phòng', 'giám đốc', 'chuyên viên', 'thực tập', 'trang',
    'bản quyền', 'mô tả', 'tuyển dụng', 'đánh giá', 'chuyên môn'
  ];

  for (const pattern of forbiddenPatterns) {
    if (lower.includes(pattern)) return false;
  }

  // Word count check (names are normally 1 to 5 words)
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;

  // At least one word should start with uppercase or contain Vietnamese diacritics
  const hasCapitalOrSpecial = words.some(w => /^[A-ZÀ-Ỹ]/.test(w));
  return hasCapitalOrSpecial;
}

function extractNameFromFilename(filename: string): string {
  if (!filename) return '';
  // Remove extension
  let base = filename.replace(/\.[^/.]+$/, '');
  
  // Remove common prefix / suffix keywords
  base = base
    .replace(/^(cv|resume|jd|profile|hosocanhan|hoso|don_ung_tuyen|ungvien)[\s_\-\.]+/i, '')
    .replace(/[\s_\-\.]+(cv|resume|jd|profile|v\d+|\d{4}|final|updated|new|latest|pdf|docx)$/i, '')
    .replace(/[\s_\-\.]+(senior|junior|lead|frontend|backend|fullstack|dev|engineer|pm|ba|qa|intern|specialist).*$/i, '');

  // Replace symbols with space
  base = base.replace(/[\-_.]+/g, ' ');

  // Split camelCase words e.g. "NguyenVanA" -> "Nguyen Van A"
  base = base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Clean words and capitalize
  const words = base.split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
  if (words.length > 0 && words.length <= 5) {
    const formatted = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    if (isPlausiblePersonName(formatted)) {
      return formatted;
    }
    return formatted;
  }
  return base.trim();
}

function extractCandidateName(cvText: string, filename?: string): string {
  if (cvText) {
    const lines = cvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Scan the first 15 lines for a clean candidate name
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i];
      let clean = line.replace(/^[\*\#\-\•\>\s]+/, '').replace(/[\*\#\-\•\:\,\.]+$/, '').trim();
      
      // If line is like "Họ và tên: Nguyễn Văn A" or "Name: John Doe"
      const namePrefixMatch = clean.match(/^(?:họ\s*(?:và|&)?\s*tên|full\s*name|candidate\s*name|name)\s*[:\-]\s*(.+)$/i);
      if (namePrefixMatch && isPlausiblePersonName(namePrefixMatch[1])) {
        return namePrefixMatch[1].trim();
      }

      // If line has a title separator like "NGUYỄN VĂN A - SENIOR FRONTEND ENGINEER"
      if (clean.includes(' - ') || clean.includes(' | ')) {
        const parts = clean.split(/\s+[\-\|]\s+/);
        if (parts[0] && isPlausiblePersonName(parts[0])) {
          return parts[0].trim();
        }
      }

      if (isPlausiblePersonName(clean)) {
        return clean;
      }
    }
  }

  // Fallback to filename extraction
  if (filename) {
    const fromFilename = extractNameFromFilename(filename);
    if (fromFilename && isPlausiblePersonName(fromFilename)) return fromFilename;
    if (fromFilename) return fromFilename;
  }

  return '';
}

// API Endpoint for Batch CV Processing & Leaderboard
app.post('/api/batch-analyze', handleUploadAny, async (req, res) => {
  const lang = (req.query.lang || req.body?.lang || 'vi') === 'en' ? 'en' : 'vi';
  const isEn = lang === 'en';

  try {
    const currentUser = getUserFromRequest(req);
    if (!currentUser) return res.status(401).json({ error: isEn ? 'Unauthorized' : 'Chưa đăng nhập.' });

    const rawJdText = req.body?.jdText || '';
    const jdText = cleanAndStructureExtractedText(rawJdText);
    if (!jdText || !jdText.trim()) {
      return res.status(400).json({
        error: isEn ? 'Please provide a Job Description (JD).' : 'Vui lòng cung cấp Mô tả công việc (JD).',
      });
    }

    const uploadedFiles = req.files as Express.Multer.File[];
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        error: isEn ? 'Please upload at least one CV or ZIP file.' : 'Vui lòng tải lên ít nhất một tệp CV hoặc tệp ZIP.',
      });
    }

    const allFiles: { originalname: string; buffer: Buffer; mimetype: string }[] = [];

    for (const file of uploadedFiles) {
      const ext = path.extname(file.originalname).toLowerCase();
      const isZip = ext === '.zip' || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed';

      if (isZip) {
        try {
          const zip = new AdmZip(file.buffer);
          const entries = zip.getEntries();
          for (const entry of entries) {
            if (!entry.isDirectory) {
              const entryName = entry.entryName;
              const entryExt = path.extname(entryName).toLowerCase();
              const allowedExts = ['.pdf', '.docx', '.doc', '.txt', '.rtf', '.md'];
              if (allowedExts.includes(entryExt)) {
                const entryBuffer = entry.getData();
                allFiles.push({
                  originalname: path.basename(entryName),
                  buffer: entryBuffer,
                  mimetype: getMimeTypeFromExtension(entryExt)
                });
              }
            }
          }
        } catch (zipErr: any) {
          console.error('Error parsing ZIP file:', zipErr);
          return res.status(400).json({
            error: isEn
              ? `Failed to extract files from ZIP archive: ${zipErr.message}`
              : `Lỗi khi giải nén tệp ZIP: ${zipErr.message}`,
          });
        }
      } else {
        allFiles.push({
          originalname: file.originalname,
          buffer: file.buffer,
          mimetype: file.mimetype
        });
      }
    }

    if (allFiles.length === 0) {
      return res.status(400).json({
        error: isEn
          ? 'No valid CV files found in upload.'
          : 'Không tìm thấy tệp CV hợp lệ nào từ danh sách tải lên.',
      });
    }

    const maxBatchSize = 15;
    if (allFiles.length > maxBatchSize) {
      return res.status(400).json({
        error: isEn
          ? `Batch size exceeds the limit of ${maxBatchSize} CVs. Please upload fewer files.`
          : `Số lượng CV xử lý hàng loạt vượt quá giới hạn ${maxBatchSize} tệp. Vui lòng tải lên ít tệp hơn.`,
      });
    }

    const headerReqId = (req.headers['x-request-id'] as string)?.trim();
    const bodyReqId = (req.body?.requestId as string)?.trim();
    const requestId = headerReqId || bodyReqId || ('req_batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    const batchId = (req.body?.batchId as string)?.trim() || ('batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const batchName = (req.body?.batchName as string)?.trim() || undefined;
    const actorUsername = currentUser ? currentUser.username : 'user_batch_hr';
    const createdBy = currentUser ? currentUser.username : actorUsername;
    const userEmailVal = currentUser?.email || (actorUsername.includes('@') ? actorUsername : `${actorUsername}@system.local`);

    const firstLine = jdText.trim().split('\n')[0] || '';
    const jdTitleVal = firstLine.substring(0, 36) || (isEn ? 'Job Description' : 'Vị trí công việc');

    const auditResults: { expected: number; saved: number; failed: number; recordIds: string[] } = {
      expected: allFiles.length,
      saved: 0,
      failed: 0,
      recordIds: [],
    };

    const extractedCandidates: { filename: string; text: string; fileIndex: number }[] = [];
    const failedExtractionResults: any[] = [];
    
    for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        try {
            const rawText = await extractTextFromBuffer(file.buffer, file.originalname, file.mimetype);
            if (rawText && rawText.trim().length > 5) {
                extractedCandidates.push({
                    filename: file.originalname,
                    text: cleanAndStructureExtractedText(rawText),
                    fileIndex: i
                });
            } else {
                failedExtractionResults.push({ filename: file.originalname, error: 'Empty/Short content' });
            }
        } catch (err) {
            failedExtractionResults.push({ filename: file.originalname, error: err });
        }
    }

    const requestedUnits = extractedCandidates.length;
    if (requestedUnits === 0) {
        return res.status(400).json({ error: isEn ? 'No readable CVs found.' : 'Không tìm thấy CV nào có nội dung đọc được.' });
    }

    try {
      const quotaRes = await reserveAiQuota(db, {
        user: currentUser,
        units: requestedUnits,
        source: 'recruiter_batch',
        requestId
      });
      if (!quotaRes.allowed) {
        return res.status(429).json({
          success: false,
          code: 'DAILY_AI_LIMIT_EXCEEDED',
          dailyLimit: quotaRes.dailyLimit,
          used: quotaRes.usedBefore,
          requested: requestedUnits,
          remaining: quotaRes.remaining,
          resetAt: quotaRes.resetAt,
          requestId
        });
      }
    } catch (err: any) {
      console.error('[Batch Analyze Quota Error]', err);
      if (err.message === 'QUOTA_SERVICE_UNAVAILABLE') {
        return res.status(503).json({
          success: false,
          code: 'QUOTA_SERVICE_UNAVAILABLE',
          error: isEn ? 'Quota service unavailable.' : 'Dịch vụ kiểm soát lượt tạm thời không khả dụng.',
          requestId
        });
      }
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_API_ERROR',
        error: isEn ? 'Quota check failed.' : 'Lỗi kiểm tra lượt phân tích.',
        requestId
      });
    }


    if (extractedCandidates.length === 0) {
      return res.status(200).json({
        success: true,
        requestId,
        batchId,
        results: failedExtractionResults,
        processedAt: new Date().toISOString(),
        audit: auditResults,
      });
    }

    const ai = getGeminiClient();

    const analysisResults = await processBatchInPool(extractedCandidates, 3, async (candidate, candIdx) => {
      const candStartTime = Date.now();
      const deterministicRecordId = `anl_${requestId}_${candidate.fileIndex}_${candidate.filename.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16)}`;

      try {
        const cacheKey = getHashKey({
          cvText: candidate.text,
          jdText,
          clarifyingAnswers: undefined,
          lang,
          analysisPromptVersion: 'phase1-step1.2-v2'
        });

        let finalResult: any;

        if (analyzeCache.has(cacheKey)) {
          console.log(`[Batch Pipeline Cache Hit] Returning cached analysis for candidate: ${candidate.filename}`);
          finalResult = analyzeCache.get(cacheKey);
          if (finalResult) {
            finalResult.outputLanguage = lang;
          }
        } else {
          console.log(`[Batch Pipeline] Starting 3-step sequential evaluation for candidate: ${candidate.filename}`);

          // --- STEP 1: DRAFT ANALYSIS (GEMINI) ---
          const draftPromptText = buildPrompt(candidate.text, jdText, undefined, lang as 'vi' | 'en');
          const draftResponse = await callGeminiWithRetry(ai, {
            contents: draftPromptText,
            config: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: analysisResponseSchema,
            },
          });

          const draftText = draftResponse.text;
          if (!draftText) {
            throw new Error('No response received from Step 1 AI model.');
          }
          const draftAnalysis = parseJsonSafely(draftText);

          // --- STEP 2: AUDITOR QUALITY CHECK (OPENROUTER / GEMINI) ---
          const { auditFeedback } = await runAuditorStep(
            ai,
            candidate.text,
            jdText,
            draftAnalysis,
            lang as 'vi' | 'en'
          );

          // --- STEP 3: SYNTHESIS & REFINEMENT (GEMINI SYNTHESIZER) ---
          try {
            finalResult = await runSynthesizerStep(
              ai,
              candidate.text,
              jdText,
              draftAnalysis,
              auditFeedback,
              undefined,
              lang as 'vi' | 'en'
            );
          } catch (synthErr) {
            console.warn('[Batch Pipeline] Synthesizer error, falling back to draft + audit log:', synthErr);
            finalResult = draftAnalysis;
          }

          if (finalResult) {
            finalResult.outputLanguage = lang;
          }

          // Save to shared analysis cache
          analyzeCache.set(cacheKey, finalResult);
        }

        // --- DATA MAPPING TO CANDIDATE RESULT ---
        let candidateName = '';
        if (finalResult.candidateName && isPlausiblePersonName(finalResult.candidateName)) {
          candidateName = finalResult.candidateName.trim();
        } else {
          candidateName = extractCandidateName(candidate.text, candidate.filename);
        }
        if (!candidateName || !isPlausiblePersonName(candidateName)) {
          candidateName = extractNameFromFilename(candidate.filename) || candidate.filename.replace(/\.[^/.]+$/, "");
        }
        const rawOverallScore = finalResult.feature1?.scores?.overallRoleScore;
        const overallScore = (typeof rawOverallScore === 'number' && Number.isFinite(rawOverallScore)) ? rawOverallScore : null;

        let matchLevel: 'Very High' | 'High' | 'Medium' | 'Low' | 'NOT_AVAILABLE' = 'NOT_AVAILABLE';
        if (overallScore !== null) {
          if (overallScore >= 85) matchLevel = 'Very High';
          else if (overallScore >= 70) matchLevel = 'High';
          else if (overallScore >= 50) matchLevel = 'Medium';
          else matchLevel = 'Low';
        }

        let dbMatchLevel: 'XUAT_SAC' | 'TOT' | 'TRUNG_BINH' | 'CAN_CAI_THIEN' | 'NOT_AVAILABLE' = 'NOT_AVAILABLE';
        if (overallScore !== null) {
          if (overallScore >= 85) dbMatchLevel = 'XUAT_SAC';
          else if (overallScore >= 70) dbMatchLevel = 'TOT';
          else if (overallScore >= 50) dbMatchLevel = 'TRUNG_BINH';
          else dbMatchLevel = 'CAN_CAI_THIEN';
        }

        // topStrengths strictly from feature1.summary.biggestStrength
        const topStrengths: string[] = (typeof finalResult.feature1?.summary?.biggestStrength === 'string' && finalResult.feature1.summary.biggestStrength.trim())
          ? [finalResult.feature1.summary.biggestStrength.trim()]
          : [];

        // keyGaps strictly from feature1.summary.missingKeywordsSkills
        const keyGaps: string[] = Array.isArray(finalResult.feature1?.summary?.missingKeywordsSkills)
          ? finalResult.feature1.summary.missingKeywordsSkills
              .filter((item: any): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item: string) => item.trim())
          : [];

        // shortRecommendation strictly from real data
        const shortRecommendation = (typeof finalResult.feature3?.firstImpression10s === 'string' && finalResult.feature3.firstImpression10s.trim())
          ? finalResult.feature3.firstImpression10s.trim()
          : ((typeof finalResult.shortRecommendation === 'string' && finalResult.shortRecommendation.trim())
            ? finalResult.shortRecommendation.trim()
            : '');

        const candNameVal = candidateName || candidate.filename.replace(/\.[^/.]+$/, "");
        const formattedJobTitle = `${jdTitleVal} - ${candNameVal}`;
        const rawInvite = finalResult.feature3?.inviteDecision;
        const recruiterDecisionVal = (rawInvite === 'YES' || rawInvite === 'MAYBE' || rawInvite === 'NO') ? rawInvite : undefined;
        const candDurationMs = Date.now() - candStartTime;
        const processingStatus: 'COMPLETED' | 'NO_SCORE' = overallScore !== null ? 'COMPLETED' : 'NO_SCORE';

        const rawKw = finalResult.feature1?.scores?.keywordMatchScore;
        const keywordScore = (typeof rawKw === 'number' && Number.isFinite(rawKw)) ? rawKw : null;

        const rawExp = finalResult.feature1?.scores?.experienceOutcomeScore;
        const experienceScore = (typeof rawExp === 'number' && Number.isFinite(rawExp)) ? rawExp : null;

        const rawSk = finalResult.feature1?.scores?.skillMatchScore;
        const skillScore = (typeof rawSk === 'number' && Number.isFinite(rawSk)) ? rawSk : null;

        // Save analysis record
        const logRes = await createAnalysisRecord({
          id: deterministicRecordId,
          recordId: deterministicRecordId,
          requestId,
          source: 'recruiter_batch',
          batchId,
          batchName,
          candidateId: `cand_${candIdx + 1}`,
          candidateName: candNameVal,
          fileName: candidate.filename,
          cvFileName: candidate.filename,
          jobTitle: formattedJobTitle,
          actorUsername,
          createdBy,
          userEmail: userEmailVal,
          status: processingStatus,
          overallScore,
          keywordScore,
          experienceScore,
          skillsScore: skillScore,
          matchLevel: dbMatchLevel,
          topStrengths,
          missingSkills: keyGaps,
          recommendation: shortRecommendation,
          recruiterDecision: recruiterDecisionVal,
          engineUsed: 'Gemini 2.0 Flash Batch Pipeline',
          durationMs: candDurationMs,
          cvTextLength: candidate.text.length,
          jdTextLength: jdText.length,
          fullAnalysis: finalResult,
        });

        if (logRes.success) {
          auditResults.saved++;
          auditResults.recordIds.push(deterministicRecordId);
        } else {
          auditResults.failed++;
          console.error(
            `[Recruiter Batch Audit Failed] requestId=${requestId}, candidate=${candidate.filename}, error=${logRes.error}`
          );
        }

        return {
          filename: candidate.filename,
          success: true,
          candidateName,
          overallScore,
          matchLevel,
          keywordScore,
          experienceScore,
          skillScore,
          topStrengths,
          keyGaps,
          shortRecommendation,
          cvText: candidate.text,
          fullAnalysis: finalResult,
          analysisRecordId: deterministicRecordId,
        };
      } catch (err: any) {
        const candDurationMs = Date.now() - candStartTime;
        const candName = extractNameFromFilename(candidate.filename) || candidate.filename.replace(/\.[^/.]+$/, "");
        const safeErrMsg = (err?.message || 'Lỗi xử lý AI.').replace(/(api[_-]?key|token|password|secret)=[^&\s]+/gi, '$1=***');
        const safeErrCode = err?.code || 'AI_PROCESSING_ERROR';
        console.error(`Error in 3-step pipeline for candidate CV ${candidate.filename}:`, safeErrMsg);

        const logRes = await createAnalysisRecord({
          id: deterministicRecordId,
          recordId: deterministicRecordId,
          requestId,
          source: 'recruiter_batch',
          batchId,
          batchName,
          candidateId: `cand_${candIdx + 1}`,
          candidateName: candName,
          fileName: candidate.filename,
          cvFileName: candidate.filename,
          jobTitle: `${jdTitleVal} - ${candName}`,
          actorUsername,
          createdBy,
          userEmail: userEmailVal,
          status: 'FAILED',
          overallScore: null,
          keywordScore: null,
          experienceScore: null,
          skillsScore: null,
          matchLevel: 'NOT_AVAILABLE',
          topStrengths: [],
          missingSkills: [],
          recommendation: '',
          recruiterDecision: undefined,
          engineUsed: 'Gemini 2.0 Flash Batch Pipeline',
          durationMs: candDurationMs,
          cvTextLength: candidate.text.length,
          jdTextLength: jdText.length,
          fullAnalysis: undefined,
          errorCode: safeErrCode,
          errorMessage: safeErrMsg,
        });

        if (logRes.success) {
          auditResults.saved++;
          auditResults.recordIds.push(deterministicRecordId);
        } else {
          auditResults.failed++;
          console.error(
            `[Recruiter Batch Audit Failed (Failed CV)] requestId=${requestId}, candidate=${candidate.filename}, error=${logRes.error}`
          );
        }

        return {
          filename: candidate.filename,
          success: false,
          candidateName: candName,
          overallScore: null,
          matchLevel: 'NOT_AVAILABLE',
          keywordScore: null,
          experienceScore: null,
          skillScore: null,
          topStrengths: [],
          keyGaps: [],
          shortRecommendation: '',
          errorMessage: safeErrMsg,
          analysisRecordId: deterministicRecordId,
        };
      }
    });

    const combinedResults = [...analysisResults, ...failedExtractionResults];

    combinedResults.sort((a, b) => {
      const aValid = a.success !== false && typeof a.overallScore === 'number' && Number.isFinite(a.overallScore);
      const bValid = b.success !== false && typeof b.overallScore === 'number' && Number.isFinite(b.overallScore);

      if (aValid && bValid) {
        return (b.overallScore as number) - (a.overallScore as number);
      }
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      return 0;
    });

    if (auditResults.failed > 0) {
      console.warn(`[Recruiter Batch Audit Warning] Batch completed with ${auditResults.failed}/${auditResults.expected} failed persistence writes.`, {
        requestId,
        batchId,
        audit: auditResults,
      });
    }

    res.json({
      success: true,
      requestId,
      batchId,
      results: combinedResults,
      processedAt: new Date().toISOString(),
      audit: auditResults,
    });

  } catch (err: any) {
    console.error('Batch Analyze Error:', err);
    res.status(500).json({
      error: isEn
        ? `An internal error occurred during batch processing: ${err.message}`
        : `Lỗi hệ thống xảy ra khi xử lý hàng loạt: ${err.message}`,
    });
  }
});

async function extractTextWithGeminiVision(buffer: Buffer, mimetype: string, extension: string): Promise<string> {
  try {
    const ai = getGeminiClient();
    let inlineMime = mimetype;
    if (!inlineMime || inlineMime === 'application/octet-stream') {
      if (extension === '.pdf') inlineMime = 'application/pdf';
      else if (extension === '.png') inlineMime = 'image/png';
      else if (extension === '.webp') inlineMime = 'image/webp';
      else inlineMime = 'image/jpeg';
    }

    const response = await callGeminiWithRetry(ai, {
      models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'],
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: inlineMime,
                data: buffer.toString('base64'),
              },
            },
            {
              text: 'Accurately transcribe and extract ALL text content from this document or image. Preserve section headings, experience bullets, contact details, dates, skills, and numbers. Output ONLY the raw extracted text directly without conversational intro or markdown backticks.',
            },
          ],
        },
      ],
    });

    return response.text ? response.text.trim() : '';
  } catch (err) {
    console.warn('Gemini Vision OCR fallback failed:', err);
    return '';
  }
}

function cleanAndStructureExtractedText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Convert bullet point variations to standard dash
  text = text.replace(/^[ \t]*[\u2022\u25cf\u25cb\u25aa\u25fe\u25b6\u2713\u2013\u2014*][ \t]*/gm, '- ');

  const rawLines = text.split('\n');
  const cleanedLines: string[] = [];

  const sectionHeadersRegex = /^(thông tin|thông tin liên hệ|contact|contact info|tóm tắt|tóm tắt năng lực|mục tiêu nghề nghiệp|summary|executive summary|career objective|kinh nghiệm|kinh nghiệm làm việc|quá trình làm việc|work experience|professional experience|experience|kỹ năng|kỹ năng chuyên môn|kỹ năng kỹ thuật|skills|technical skills|core competencies|học vấn|bằng cấp|trình độ học vấn|education|certifications|chứng chỉ|chứng chỉ chuyên môn|dự án|dự án tiêu biểu|projects|featured projects)$/i;

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();

    if (!trimmed) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      continue;
    }

    const strippedHeading = trimmed.replace(/^#+\s*/, '').replace(/[:\-\=]+$/, '').trim();

    // Is it a section header?
    if (
      sectionHeadersRegex.test(strippedHeading) ||
      (strippedHeading.length >= 4 &&
        strippedHeading.length <= 40 &&
        /^[A-Z0-9\s&/.,-]{4,40}$/.test(strippedHeading) &&
        !/[a-z]/.test(strippedHeading) &&
        !trimmed.includes('.') &&
        !trimmed.startsWith('- '))
    ) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      cleanedLines.push(`## ${strippedHeading.toUpperCase()}`);
      cleanedLines.push('');
      continue;
    }

    // Is it a bullet point?
    if (trimmed.startsWith('- ')) {
      cleanedLines.push(trimmed);
      continue;
    }

    // Check if previous line can be joined (PDF line break repair)
    if (cleanedLines.length > 0) {
      const lastLineIdx = cleanedLines.length - 1;
      const lastLine = cleanedLines[lastLineIdx];

      // Don't join if last line is empty, a header, or ends with sentence ending punctuation
      if (
        lastLine &&
        !lastLine.startsWith('#') &&
        !lastLine.startsWith('- ') &&
        !/[.:;?!]$/.test(lastLine) &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('- ')
      ) {
        cleanedLines[lastLineIdx] = `${lastLine} ${trimmed}`;
        continue;
      }
    }

    cleanedLines.push(trimmed);
  }

  let result = cleanedLines.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

// API Endpoint for AI Formatting CV layout into crisp Markdown structure
app.post('/api/format-cv-text', async (req, res) => {
  try {
    const { rawCvText, lang = 'vi' } = req.body;
    if (!rawCvText || !rawCvText.trim()) {
      return res.status(400).json({ error: 'Nội dung CV trống.' });
    }

    if (isInputOversized(rawCvText)) {
      return res.status(400).json({
        error: lang === 'en'
          ? 'CV text exceeds maximum allowed length (100,000 characters).'
          : 'Nội dung CV quá dài (vượt quá 100,000 ký tự). Vui lòng cắt bớt.',
      });
    }

    const cacheKey = getHashKey({ rawCvText, lang });
    if (formatCache.has(cacheKey)) {
      console.log('[Cache Hit] Returning cached formatted CV text.');
      return res.json({ formattedText: formatCache.get(cacheKey) });
    }

    try {
      const ai = getGeminiClient();
      const isCvVi = isVietnameseText(rawCvText);

      const promptText = `
You are an Executive Resume Writer & CV Optimization Expert.
Task: Take the raw CV text below and REFORMAT IT INTO A CLEAN, STYLISH, PROFESSIONAL MARKDOWN CV.

STRICT LANGUAGE PRESERVATION MANDATE (CRITICAL):
- You MUST output the reformatted CV in the EXACT SAME PRIMARY LANGUAGE as the original raw CV text.
- Original CV language detected: ${isCvVi ? 'VIETNAMESE' : 'ENGLISH'}.
- ABSOLUTELY DO NOT TRANSLATE the candidate's CV into a different language. If the original CV is in English, keep all headings and content in English. If the original CV is in Vietnamese, keep all headings and content in Vietnamese.

CRITICAL FORMATTING RULES:
1. HONESTY: Preserve 100% of candidate's original facts, company names, job titles, dates, projects, technologies, and metrics. DO NOT invent new companies or fake credentials.
2. STANDARD MARKDOWN CV STRUCTURE:
${isCvVi ? `   - # HỌ VÀ TÊN - VỊ TRÍ ỨNG TUYỂN
   - ## THÔNG TIN LIÊN HỆ (Email, Số điện thoại, Địa điểm, LinkedIn/GitHub)
   - ## TÓM TẮT NĂNG LỰC
   - ## KINH NGHIỆM LÀM VIỆC (Mỗi vị trí hiển thị rõ: **Chức danh** | **Tên Công Ty** (Tháng/Năm - Tháng/Năm); Trình bày các trách nhiệm & thành tựu bằng dấu "- ")
   - ## KỸ NĂNG CHUYÊN MÔN & CÔNG CỤ
   - ## HỌC VẤN & CHỨNG CHỈ` : `   - # CANDIDATE NAME - TARGET POSITION
   - ## CONTACT INFORMATION (Email, Phone, Location, LinkedIn/GitHub)
   - ## EXECUTIVE SUMMARY
   - ## PROFESSIONAL EXPERIENCE (For each role: **Title** | **Company Name** (MM/YYYY - MM/YYYY); Bullet points for responsibilities & achievements using "- ")
   - ## TECHNICAL SKILLS & COMPETENCIES
   - ## EDUCATION & CERTIFICATIONS`}
3. FIX PDF PARSING ARTIFACTS: Repair broken line wraps and replace bullet symbols with standard dash "- ".

RAW CV TEXT:
${rawCvText}
`;

      const response = await callGeminiWithRetry(ai, {
        contents: promptText,
      });

      const formattedText = response.text || rawCvText;
      formatCache.set(cacheKey, formattedText);
      return res.json({ formattedText });
    } catch (err: any) {
      const errString = String(err?.message || err);
      console.warn('API /api/format-cv-text Gemini Error, using fallback cleaner:', errString);

      const fallbackFormatted = createFallbackFormatCv(rawCvText);
      formatCache.set(cacheKey, fallbackFormatted);
      return res.json({ formattedText: fallbackFormatted });
    }
  } catch (err: any) {
    console.error('API /api/format-cv-text Error:', err);
    return res.status(500).json({ error: formatGeminiError(err, req.body.lang as 'vi' | 'en') });
  }
});

// Helper to initialize Gemini SDK
function getGeminiClient(timeoutMs?: number) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  const httpOptions: any = {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  };
  if (timeoutMs) {
    httpOptions.timeout = timeoutMs;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions,
  });
}

function parseJsonSafely(text: string): any {
  if (!text) throw new Error('Empty text response from AI');
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // 1. First attempt: standard JSON parse
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // 2. Second attempt: sanitize unescaped control characters/newlines inside string values
    try {
      const sanitized = cleaned.replace(/[\u0000-\u001F]+/g, (match) => {
        if (match === '\n' || match === '\r\n') return '\\n';
        if (match === '\t') return '\\t';
        return '';
      });
      return JSON.parse(sanitized);
    } catch (_) {}

    // 3. Third attempt: repair truncated JSON string (auto-close string quotes & brackets)
    try {
      let repaired = cleaned;
      let inString = false;
      let escape = false;
      const stack: string[] = [];

      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{' || char === '[') {
            stack.push(char);
          } else if (char === '}' || char === ']') {
            if (stack.length > 0) stack.pop();
          }
        }
      }

      if (inString) {
        repaired += '"';
      }

      // Remove trailing comma if present before closing
      repaired = repaired.replace(/,\s*$/, '');

      while (stack.length > 0) {
        const last = stack.pop();
        if (last === '{') repaired += '}';
        else if (last === '[') repaired += ']';
      }

      return JSON.parse(repaired);
    } catch (_) {}

    // If repairs fail, throw original error
    throw err;
  }
}

function formatGeminiError(err: any, lang: 'vi' | 'en' = 'vi'): string {
  const msg = String(err?.message || err || '');
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return lang === 'en'
      ? 'AI rate limit / quota exceeded. Please wait 15–30 seconds and try again.'
      : 'Hệ thống AI tạm thời đạt giới hạn lượt dùng (Rate Limit / Quota Exceeded). Vui lòng đợi 15–30 giây rồi bấm Phân Tích lại.';
  }
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    return lang === 'en'
      ? 'The AI model is currently experiencing high demand. Please wait a few seconds and try again.'
      : 'Mô hình AI đang quá tải cục bộ (High Demand). Vui lòng chờ vài giây rồi thử lại.';
  }
  return err?.message || (lang === 'en' ? 'An error occurred during AI processing.' : 'Đã có lỗi xảy ra trong quá trình xử lý AI.');
}

const modelCooldowns = new Map<string, number>();

function isModelInCooldown(modelName: string): boolean {
  const expiry = modelCooldowns.get(modelName);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    modelCooldowns.delete(modelName);
    return false;
  }
  return true;
}

function setModelCooldown(modelName: string, durationMs: number = 60000) {
  modelCooldowns.set(modelName, Date.now() + durationMs);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function callGeminiWithRetry(
  ai: GoogleGenAI,
  requestOptions: {
    contents: string | any;
    config?: any;
    models?: string[];
    timeoutMs?: number;
    disableFallback?: boolean;
  }
) {
  const candidateModels = requestOptions.models || [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  let modelsToTry = candidateModels.filter((m) => !isModelInCooldown(m));
  if (modelsToTry.length === 0) {
    modelsToTry = candidateModels;
  }

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        let configToUse = requestOptions.config;
        if (attempt === 2 && requestOptions.config?.responseSchema) {
          console.info(`[Gemini Call] Model ${modelName} attempt 2: Retrying WITHOUT responseSchema to bypass structured output/validation constraints.`);
          const { responseSchema, ...restConfig } = requestOptions.config;
          configToUse = restConfig;
        }

        const apiCall = ai.models.generateContent({
          model: modelName,
          contents: requestOptions.contents,
          config: configToUse,
        });

        const timeoutToUse = requestOptions.timeoutMs || 25000;
        const response = await withTimeout(
          apiCall,
          timeoutToUse,
          `API call to model ${modelName} timed out (exceeded ${timeoutToUse}ms)`
        );

        if (response && response.text) {
          (response as any).modelUsed = modelName;
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errString = String(err?.message || err || '');

        if (errString.includes('timed out') || errString.includes('timeout') || errString.includes('ETIMEDOUT') || errString.includes('AbortError')) {
          console.info(`[Gemini Call] Model ${modelName} timed out (${requestOptions.timeoutMs || 25000}ms). Putting on 60s cooldown and trying next model...`);
          setModelCooldown(modelName, 60000); // 1 min cooldown
          break; // break attempt loop to switch to next model immediately
        }

        if (errString.includes('404') || errString.includes('NOT_FOUND') || errString.includes('not found') || errString.includes('no longer available')) {
          console.info(`[Gemini Call] Model ${modelName} is not available/404. Skipping to next model...`);
          setModelCooldown(modelName, 300000); // 5 min cooldown for 404
          break;
        }

        if (errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED') || errString.includes('quota') || errString.includes('503') || errString.includes('UNAVAILABLE') || errString.includes('high demand')) {
          console.info(`[Gemini Call] Model ${modelName} busy/quota/high demand. Putting on 60s cooldown and trying next model...`);
          setModelCooldown(modelName, 60000); // 1 min cooldown
          break;
        } else {
          console.warn(`[Gemini Call] Model ${modelName} (attempt ${attempt}) error: ${err?.message || errString.slice(0, 150)}`);
        }

        if (attempt < 2) {
          const delay = attempt * 800;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  if (requestOptions.disableFallback) {
    throw lastError || new Error('All Gemini models failed to respond.');
  }

  // If all Gemini models hit rate limits or fail, check for OpenRouter API fallback
  const openRouterApiKey = (process.env.OPENROUTER_API_KEY || (process.env.OPENAI_API_KEY?.startsWith('sk-or-') ? process.env.OPENAI_API_KEY : '')).trim();
  if (openRouterApiKey && openRouterApiKey.length > 5) {
    console.info('[AI Fallback] Gemini models exhausted/rate-limited. Calling OpenRouter API fallback...');
    const promptText = typeof requestOptions.contents === 'string'
      ? requestOptions.contents
      : JSON.stringify(requestOptions.contents);

    const isJsonMode = requestOptions.config?.responseMimeType === 'application/json';
    const openRouterModels = [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'openrouter/auto',
      'openrouter/free',
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.1-8b-instruct:free'
    ];

    for (const model of openRouterModels) {
      try {
        const reqBody: any = {
          model,
          messages: [
            {
              role: 'system',
              content: isJsonMode
                ? 'You are an expert AI assistant. You MUST reply ONLY with valid JSON matching the requested schema.'
                : 'You are an expert AI assistant.'
            },
            { role: 'user', content: promptText }
          ],
          max_tokens: 1200,
          temperature: 0.2
        };

        if (isJsonMode) {
          reqBody.response_format = { type: 'json_object' };
        }

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': process.env.APP_URL || 'https://ai.studio',
            'X-Title': 'CV Auditor System'
          },
          body: JSON.stringify(reqBody)
        });

        if (res.ok) {
          const data = await res.json();
          let textContent = data.choices?.[0]?.message?.content;
          if (textContent) {
            console.log(`[AI Fallback OpenRouter] Model ${model} succeeded.`);
            if (isJsonMode && textContent.startsWith('```')) {
              textContent = textContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            }
            return { text: textContent };
          }
        }
      } catch (orErr: any) {
        console.info(`[AI Fallback OpenRouter] ${model} error: ${orErr?.message || orErr}`);
      }
    }
  }

  throw lastError || new Error('All Gemini & fallback AI models failed to respond.');
}

// Helper fallback engines for testing when Gemini API free tier quota is hit
function createFallbackAnalysis(cvText: string, jdText: string, lang: 'vi' | 'en' = 'vi') {
  const isEn = lang === 'en';

  // Extract JD key terms heuristically
  const rawWords = jdText
    .replace(/[^\w\sàáảãạăắằẳẵặânấầnẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const uniqueJdTerms = Array.from(new Set(rawWords)).slice(0, 10);
  const sampleTerms = uniqueJdTerms.length >= 4 ? uniqueJdTerms : [
    'Project Management', 'Agile/Scrum', 'React', 'Node.js', 'System Architecture',
    'Team Leadership', 'CI/CD', 'Problem Solving', 'Data Analysis', 'SQL'
  ];

  const jdKeywords = sampleTerms.map((term, idx) => {
    const categories = [
      isEn ? 'Technical Skills' : 'Kỹ năng chuyên môn',
      isEn ? 'Tools & Methodologies' : 'Công cụ, phần mềm hoặc phương pháp',
      isEn ? 'Desired Experience' : 'Kinh nghiệm mong muốn',
      isEn ? 'Work Expectations' : 'Kết quả đầu ra hoặc kỳ vọng công việc',
      isEn ? 'Qualities & Work Style' : 'Phẩm chất hoặc cách làm việc',
    ];
    const importances = [
      isEn ? 'High Priority' : 'Rất quan trọng',
      isEn ? 'Important' : 'Quan trọng',
      isEn ? 'Advantageous' : 'Có lợi thế',
    ];
    const importance = importances[idx % importances.length];
    return {
      keyword: term,
      category: categories[idx % categories.length],
      importance,
      isMustHave: idx % importances.length === 0,
    };
  });

  const comparisonTable = jdKeywords.map((item) => {
    const isMatched = cvText.toLowerCase().includes(item.keyword.toLowerCase());
    return {
      jdTerm: item.keyword,
      importance: item.importance,
      isMustHave: item.isMustHave,
      cvEvidence: isMatched
        ? (isEn ? `CV mentions experience related to ${item.keyword}` : `CV có đề cập kinh nghiệm liên quan đến ${item.keyword}`)
        : (isEn ? 'Missing' : 'Thiếu thông tin'),
      gapOrClarification: isMatched
        ? (isEn ? 'Adequately referenced' : 'Đã khớp tốt trong CV')
        : (isEn ? `Recommend adding specific project evidence for ${item.keyword}` : `Cần bổ sung dẫn chứng dự án cụ thể về ${item.keyword}`),
      matchStatus: (isMatched ? 'khop' : 'can_bo_sung') as 'khop' | 'can_bo_sung' | 'thieu',
      targetSection: isMatched
        ? (isEn ? 'Work Experience / Technical Skills' : 'Mục Kinh nghiệm làm việc / Kỹ năng chuyên môn')
        : (isEn ? 'Recent Work Experience & Executive Summary' : 'Mục Kinh nghiệm dự án gần nhất & Tóm tắt mở đầu'),
      suggestedPhrasing: isMatched
        ? ''
        : (isEn
          ? `Spearheaded implementation of ${item.keyword} across core workflows, improving delivery efficiency by 25% and meeting SLA targets.`
          : `Trực tiếp triển khai và tối ưu hóa ${item.keyword} trong dự án trọng điểm, giúp tăng 25% hiệu suất vận hành và đáp ứng 100% chỉ tiêu SLA/KPI.`),
    };
  });

  const isCvEn = !isVietnameseText(cvText);

  const cvLines = cvText
    .split('\n')
    .map((l) => l.trim().replace(/^[•\-\*]\s*/, ''))
    .filter((l) => l.length > 15 && !l.startsWith('#'));

  const sampleBullets = cvLines.slice(0, 5).length > 0 ? cvLines.slice(0, 5) : [
    isCvEn ? 'Responsible for managing team projects and coordinating deliverables' : 'Chịu trách nhiệm quản lý dự án và điều phối tiến độ công việc',
    isCvEn ? 'Developed web features and fixed critical software bugs' : 'Phát triển các tính năng phần mềm và sửa lỗi hệ thống',
    isCvEn ? 'Worked with cross-functional teams to improve operational efficiency' : 'Phối hợp với các phòng ban để tối ưu hóa quy trình làm việc',
    isCvEn ? 'Implemented CI/CD automation pipelines and integration testing' : 'Triển khai tự động hóa CI/CD và quy trình kiểm thử chất lượng',
    isCvEn ? 'Optimized system database queries and monitored uptime performance' : 'Tối ưu hóa hiệu năng truy vấn cơ sở dữ liệu và giám sát hệ thống'
  ];

  const rewrittenBullets = sampleBullets.map((bullet, idx) => ({
    originalBullet: bullet,
    issueInOriginal: isEn
      ? 'Lacks measurable metrics, impact scale, and explicit action structure.'
      : 'Thiếu số liệu định lượng, quy mô tác động và chưa áp dụng công thức viết CV chuẩn.',
    rewrittenBullet: isCvEn
      ? `Spearheaded project delivery using Agile framework, achieving 25% efficiency gain and saving 15 hours weekly.`
      : `Chủ trì triển khai quy trình Agile cho dự án, giúp tăng 25% năng suất làm việc và tiết kiệm 15 giờ/tuần.`,
    reasonBetter: isEn
      ? 'Uses strong action verb, quantifies metric impact (25%), and explicitly links action to results.'
      : 'Sử dụng động từ hành động mạnh, bổ sung chỉ số định lượng (25%) và liên kết hành động tới kết quả.',
    isLackingInfo: false,
    embeddedKeywords: [jdKeywords[idx % jdKeywords.length]?.keyword || (isCvEn ? 'Agile Framework' : 'Quy trình Agile')],
    metricPlaceholders: [isCvEn ? '[25% efficiency gain]' : '[25% năng suất làm việc]', isCvEn ? '[15 hours weekly]' : '[15 giờ/tuần]'],
  }));

  return {
    isDemoFallback: true,
    pipelineMetadata: {
      modelPattern: 'Mô hình A: Sequential Verification (Tạo bản nháp ➔ Review ➔ Hoàn thiện)',
      steps: [
        {
          step: 1,
          name: isEn ? 'Draft Analysis' : 'Tạo bản nháp (Draft Analysis)',
          provider: 'Gemini',
          status: 'completed',
          details: isEn ? 'Draft generated via smart analysis engine' : 'Đã khởi tạo bản phân tích nháp'
        },
        {
          step: 2,
          name: isEn ? 'Auditor Quality Check' : 'Đánh giá & Phản biện (Auditor / Quality Checker)',
          provider: 'Gemini Auditor',
          status: 'completed',
          details: isEn ? 'Audited against JD requirements' : 'Đã kiểm tra phản biện lỗi thiếu từ khóa & khoảng trống'
        },
        {
          step: 3,
          name: isEn ? 'Synthesizer & Refinement' : 'Tổng hợp & Hoàn thiện (Synthesizer)',
          provider: 'Gemini',
          status: 'completed',
          details: isEn ? 'Final report synthesized' : 'Báo cáo đã hoàn thiện tổng hợp'
        }
      ],
      auditorFeedback: isEn
        ? 'Auditor Notice: High-priority JD technical terms verified against candidate achievements. Recommended adding metric ROI quantification to top experience bullet points.'
        : 'Ghi chú phản biện từ Auditor: Đã rà soát các từ khóa kỹ thuật trọng yếu so với các dòng kinh nghiệm. Khuyến nghị bổ sung số liệu định lượng (ROI, %) vào các dòng dự án hàng đầu.',
      usedOpenAiKey: false
    },
    feature1: {
      jdKeywords,
      comparisonTable,
      scores: {
        keywordMatchScore: 78,
        skillMatchScore: 82,
        experienceOutcomeScore: 72,
        overallRoleScore: 77,
        projectedOverallScore: 91,
        keywordRationale: isEn
          ? 'Matches core domain terminology (78%), but lacks explicit mention of several specialized methodologies required by the JD.'
          : 'Bao phủ tốt nhóm thuật ngữ cốt lõi (78%), nhưng còn thiếu một số từ khóa phương pháp luận và công cụ nâng cao trong JD.',
        skillRationale: isEn
          ? 'Strong foundational technical skills (82%), though some tools are only listed without project execution context.'
          : 'Đạt 82% nhờ nền tảng kỹ năng chuyên môn vững, tuy nhiên một vài công cụ mới dừng ở mức liệt kê tên, thiếu dẫn chứng thực thi.',
        experienceRationale: isEn
          ? 'Scored 72% because work history bullets focus on responsibilities rather than quantifiable KPIs, ROI, or system scale.'
          : 'Đạt 72% do phần kinh nghiệm đang thiên về liệt kê đầu việc, thiếu số liệu định lượng kết quả (%, KPI, SLA, quy mô dự án).',
        overallRationale: isEn
          ? 'Solid baseline fit (77%). By incorporating missing Must-Have keywords and adding concrete KPI metrics to recent roles, overall fit can rise to ~91%.'
          : 'Độ khớp nền tảng khá tốt (77%). Nếu bổ sung đủ các tiêu chí Bắt buộc (Must-Have) đang khuyết và thêm số liệu KPI vào 2 công ty gần nhất, điểm có thể tăng lên ~91%.',
      },
      summary: {
        biggestStrength: isEn
          ? 'CV demonstrates solid background in core domain tasks and relevant technical foundation.'
          : 'CV thể hiện nền tảng kỹ năng chuyên môn chắc chắn và có kinh nghiệm thực tế sát với yêu cầu vai trò.',
        missingKeywordsSkills: [
          isEn ? 'Quantifiable ROI and cost-reduction metrics' : 'Chỉ số đo lường hiệu quả (ROI, % tăng trưởng, ngân sách)',
          isEn ? 'Advanced tools or methodologies mentioned in JD' : 'Các công cụ/phương pháp nâng cao được ghi trong JD',
        ],
        weakOrVagueSections: [
          isEn ? 'Work experience bullets lack specific numeric scale' : 'Các dòng mô tả kinh nghiệm còn chung chung, thiếu quy mô dự án',
          isEn ? 'Executive summary could be more tailored to role' : 'Tóm tắt bản thân chưa nêu rõ giá trị độc bản cho công ty',
        ],
        immediateActions: [
          isEn ? '1. Add metric numbers (%, $, team size) to top 3 experience bullet points.' : '1. Bổ sung chỉ số đo lường (%, doanh số, quy mô nhóm) vào 3 bullet point hàng đầu.',
          isEn ? '2. Integrate key missing keywords directly from JD.' : '2. Lồng ghép các từ khóa chuyên môn quan trọng từ JD vào phần Kỹ Năng.',
          isEn ? '3. Reformat bullet points using standard action formula.' : '3. Viết lại phần kinh nghiệm theo công thức chuẩn.',
          isEn ? '4. Highlight top accomplishments in a distinct Key Achievements section.' : '4. Đưa các thành tựu nổi bật lên vị trí dễ thấy nhất trong 10 giây đầu.',
          isEn ? '5. Align job title header with exact role title in Job Description.' : '5. Chỉnh sửa tiêu đề CV sát với tên vị trí tuyển dụng trong JD.',
        ],
      },
    },
    feature2: {
      clarifyingQuestions: [
        isEn ? 'What was the exact project budget or revenue scale you managed?' : 'Quy mô ngân sách hoặc doanh thu của các dự án bạn từng phụ trách là bao nhiêu?',
        isEn ? 'How many team members did you directly lead or mentor?' : 'Số lượng thành viên bạn trực tiếp quản lý hoặc hướng dẫn là bao nhiêu người?',
        isEn ? 'What key percentage efficiency improvement was achieved in your last role?' : 'Tỷ lệ % cải thiện hiệu suất hoặc tiết kiệm chi phí đạt được trong vai trò gần nhất là bao nhiêu?',
      ],
      tailoredSummaries: {
        technicalFocus: {
          title: isEn ? 'Version 1: Technical & Engineering Mastery Focus' : 'Bản 1: Định vị Chuyên môn / Kỹ thuật sâu',
          focusType: 'technical',
          pitch: isEn
            ? 'Results-driven Specialist with proven technical mastery across core industry tools and modern workflows. Experienced in architecting robust systems, adhering to strict engineering standards, and solving complex technical challenges. Ready to deliver scalable engineering solutions tailored to the organization.'
            : 'Chuyên viên Chuyên môn với nền tảng kỹ thuật vững vàng và kinh nghiệm thực chiến với các công nghệ lõi. Dày dặn kinh nghiệm thiết kế giải pháp kỹ thuật, chuẩn hóa quy trình và giải quyết bài toán phức tạp. Cam kết mang lại giá trị công nghệ bền vững, chất lượng cao tại quý công ty.',
          keyHighlights: isEn
            ? ['Core technical stack mastery', 'System architecture & clean code standards', 'Performance optimization & reliability']
            : ['Làm chủ công nghệ cốt lõi và kiến trúc hệ thống', 'Chuẩn hóa quy trình kỹ thuật và chất lượng', 'Tối ưu hóa hiệu năng và độ ổn định'],
        },
        managementFocus: {
          title: isEn ? 'Version 2: Leadership & Business Impact Focus' : 'Bản 2: Tác động Quản lý & Giá trị Kinh doanh',
          focusType: 'management',
          pitch: isEn
            ? 'Proactive Professional focused on connecting technical excellence with measurable business impact. Adept at driving cross-functional progress, optimizing operational turnaround, and ensuring strict SLA/KPI delivery. Committed to driving growth and resource efficiency at the organization.'
            : 'Nhân sự Chuyên môn định hướng tạo giá trị thực tế, sở hữu năng lực liên kết giải pháp kỹ thuật với mục tiêu kinh doanh của tổ chức. Có thế mạnh quản lý tiến độ, điều phối đội ngũ liên phòng ban và tối ưu hóa hiệu suất vận hành. Sẵn sàng đồng hành cùng quý công ty bứt phá các chỉ tiêu KPI chiến lược.',
          keyHighlights: isEn
            ? ['Cross-functional team coordination', 'Process optimization & cost/time savings', '100% KPI & delivery timeline fulfillment']
            : ['Điều phối liên phòng ban và dẫn dắt tiến độ', 'Tối ưu hóa quy trình, tiết kiệm thời gian và chi phí', 'Cam kết đạt 100% chỉ tiêu KPI & SLA'],
        },
      },
      sectionAudit: {
        overallSectionRating: isEn
          ? 'Structural Health: 75/100. Work Experience quantification and Executive Summary are the top priority areas for score elevation.'
          : 'Độ hoàn thiện cấu trúc CV: 75/100. Định lượng số liệu ở phần Kinh nghiệm và bổ sung Tóm tắt mở đầu là 2 ưu tiên hàng đầu để tăng điểm.',
        sections: [
          {
            sectionKey: 'summary',
            sectionName: isEn ? 'Executive Summary' : 'Tóm tắt mở đầu (Executive Summary)',
            status: 'can_cai_thien',
            score: 70,
            comment: isEn
              ? 'Executive pitch is somewhat general; needs sharper alignment with target company goals.'
              : 'Đoạn giới thiệu bản thân còn mang tính tự sự chung chung, chưa làm bật được điểm độc bản khớp với JD.',
            actionableFix: isEn
              ? 'Replace with one of the tailored 3-4 sentence elevator pitches provided above.'
              : 'Thay thế bằng 1 trong 2 bản Tóm tắt mở đầu may đo ở trên, đặt ngay dưới phần thông tin liên hệ.',
          },
          {
            sectionKey: 'experience',
            sectionName: isEn ? 'Work Experience & Impact' : 'Kinh nghiệm làm việc & Kết quả (Work Experience)',
            status: 'can_cai_thien',
            score: 68,
            comment: isEn
              ? 'Bullets primarily describe daily duties; lacks quantified metrics (%, ROI, scale).'
              : 'Các dòng mô tả công việc đang nặng về liệt kê nhiệm vụ, thiếu số liệu đo lường kết quả (%, KPI, ngân sách).',
            actionableFix: isEn
              ? 'Use the XYZ formula: Accomplished [X], measured by [Y], by doing [Z]. Fill in suggested metric placeholders.'
              : 'Áp dụng công thức XYZ: Đạt được [X], đo bằng [Y], thông qua [Z]. Bổ sung số liệu vào các vị trí được gợi ý.',
          },
          {
            sectionKey: 'skills',
            sectionName: isEn ? 'Skills Structure & Grouping' : 'Cấu trúc Kỹ năng chuyên môn (Core Skills)',
            status: 'tot',
            score: 82,
            comment: isEn
              ? 'Skills are clearly listed. Ensure top Must-Have keywords from the JD are placed prominently.'
              : 'Kỹ năng đã được trình bày rõ ràng. Cần đẩy các từ khóa Bắt buộc (Must-Have) của JD lên đầu danh mục.',
            actionableFix: isEn
              ? 'Categorize skills into Core Technical, Tools/Platforms, and Professional Methodologies.'
              : 'Phân nhóm thành 3 mục: Kỹ năng Chuyên môn, Công cụ/Nền tảng và Phương pháp làm việc (Agile/Scrum).',
          },
          {
            sectionKey: 'education_ats',
            sectionName: isEn ? 'Education & ATS Standards' : 'Học vấn/Chứng chỉ & Chuẩn ATS (Education & ATS)',
            status: 'tot',
            score: 85,
            comment: isEn
              ? 'Clean layout and standard headers ensure high compatibility with automated ATS parsers.'
              : 'Bố cục một cột chuẩn, không dùng hình ảnh/bảng phức tạp, độ tương thích rất cao với hệ thống lọc ATS tự động.',
            actionableFix: isEn
              ? 'List relevant professional certifications and graduation honors to reinforce credibility.'
              : 'Bổ sung thêm các chứng chỉ chuyên ngành quốc tế (nếu có) để tăng tính cạnh tranh của hồ sơ.',
          },
        ],
      },
      rewrittenBullets,
    },
    feature3: {
      inviteDecision: 'MAYBE' as 'YES' | 'NO' | 'MAYBE',
      decisionReason: isEn
        ? 'Candidate has relevant core skills, but work impact lacks quantified evidence in the 10-second skim.'
        : 'Ứng viên có kỹ năng phù hợp nhưng kết quả công việc chưa được chứng minh bằng số liệu trong 10 giây đọc lướt.',
      firstImpression10s: isEn
        ? 'Clean layout and relevant work history, but key strengths require deeper reading to locate.'
        : 'Cấu trúc CV rõ ràng, quá trình làm việc liên tục nhưng các điểm mạnh vượt trội chưa bứt phá ngay.',
      immediateStrength: isEn
        ? 'Solid hands-on experience in core operational and domain tasks.'
        : 'Kinh nghiệm làm việc thực chiến rõ ràng trong các nghiệp vụ cốt lõi.',
      biggestDoubt: isEn
        ? 'Unclear level of leadership initiative and scale of projects handled.'
        : 'Mức độ chủ động dẫn dắt và quy mô chịu trách nhiệm thực sự của ứng viên chưa thể hiện rõ.',
      fastestPointLossSection: isEn
        ? 'Detailed work responsibilities section lacking concrete numbers.'
        : 'Phần chi tiết trách nhiệm công việc bị dài dòng và thiếu chỉ số ấn tượng.',
      top3MustFix: [
        isEn ? 'Quantify achievements with concrete numbers (%, $, team size).' : 'Định lượng thành tựu bằng số liệu cụ thể (%, ngân sách, số người).',
        isEn ? 'Incorporate exact JD technical terms in skills summary.' : 'Lồng ghép chính xác các thuật ngữ chuyên môn từ JD vào tóm tắt kỹ năng.',
        isEn ? 'Apply action formula to all main work experience bullets.' : 'Áp dụng công thức hành động cho toàn bộ các dòng kinh nghiệm làm việc.',
      ],
      seniorityFit: {
        overallAssessment: 'match',
        overallAssessmentLabel: isEn ? 'Good Fit (Sweet Spot)' : 'Đúng Tầm (Sweet Spot)',
        summaryRationale: isEn
          ? 'Candidate brings relevant professional tenure and foundational domain alignment with this role.'
          : 'Ứng viên có thâm niên làm việc phù hợp và độ chín chuyên môn nằm trong vùng kỳ vọng của vị trí tuyển dụng.',
        positioningAdvice: isEn
          ? 'Emphasize measurable outcomes and project ownership in your interview stories to solidify confidence.'
          : 'Hãy nhấn mạnh các câu chuyện về tác động thực tế và tinh thần chủ động giải quyết bài toán để củng cố niềm tin với Hội đồng phỏng vấn.',
        dimensions: [
          {
            dimensionKey: 'level_tenure',
            dimensionName: isEn ? 'Level & Career Tenure' : 'Cấp bậc & Thâm niên thực chiến',
            jdExpectation: isEn ? 'Relevant career tenure aligned with target role' : 'Thâm niên tương thích với chức danh ứng tuyển',
            cvReality: isEn ? 'Solid work history demonstrated across relevant positions' : 'Quá trình công tác liên tục trong các vị trí liên quan',
            assessment: 'match',
            comment: isEn
              ? 'Tenure duration meets the baseline expectation for this role.'
              : 'Tổng thời gian công tác đáp ứng tốt mặt bằng chung của vị trí này.',
          },
          {
            dimensionKey: 'scale_complexity',
            dimensionName: isEn ? 'Scale & System Complexity' : 'Quy mô & Độ phức tạp dự án',
            jdExpectation: isEn ? 'Experience handling realistic production / enterprise workloads' : 'Kinh nghiệm xử lý nghiệp vụ thực tế hoặc hệ thống doanh nghiệp',
            cvReality: isEn ? 'Demonstrated execution in primary production workflows' : 'Đã tham gia vận hành các quy trình nghiệp vụ cốt lõi',
            assessment: 'match',
            comment: isEn
              ? 'Work complexity is appropriate, though adding scale figures would elevate credibility.'
              : 'Độ phức tạp phù hợp, nếu bổ sung thêm quy mô định lượng sẽ tạo ấn tượng mạnh mẽ hơn.',
          },
          {
            dimensionKey: 'scope_ownership',
            dimensionName: isEn ? 'Scope of Ownership & Initiative' : 'Phạm vi Tự chủ & Dẫn dắt',
            jdExpectation: isEn ? 'Independent problem solving and proactive ownership' : 'Chủ động giải quyết vấn đề và chịu trách nhiệm đầu ra',
            cvReality: isEn ? 'Hands-on contributor with capability to own dedicated modules' : 'Thực thi vững vàng và có khả năng phụ trách các mảng độc lập',
            assessment: 'match',
            comment: isEn
              ? 'Candidate shows solid individual ownership capability.'
              : 'Ứng viên thể hiện khả năng làm chủ công việc tốt trong phạm vi được giao.',
          },
          {
            dimensionKey: 'domain_match',
            dimensionName: isEn ? 'Domain & Business Context' : 'Độ khớp Ngành nghề & Nghiệp vụ',
            jdExpectation: isEn ? 'Foundational familiarity with industry workflows and standards' : 'Hiểu biết căn bản về quy chuẩn và văn hóa vận hành ngành',
            cvReality: isEn ? 'Transferable operational practices across related business domains' : 'Các kỹ năng và quy trình chuyên môn có khả năng chuyển đổi tốt',
            assessment: 'match',
            comment: isEn
              ? 'Strong transferable skill set minimizes onboarding overhead.'
              : 'Bộ kỹ năng cốt lõi giúp rút ngắn thời gian làm quen khi tiếp nhận công việc.',
          },
        ],
      },
      riskMitigationMatrix: [
        {
          riskType: 'metric_lacking',
          riskTitle: isEn ? 'Lack of Quantified Outcome Metrics' : 'Thiếu Số Liệu & Thành Tựu Định Lượng',
          severity: 'high',
          recruiterConcern: isEn
            ? 'Achievements listed without metrics or percentages make impact assessment difficult.'
            : 'Các thành tựu chưa gắn liền với số liệu cụ thể (%, ngân sách, SLA) khiến kết quả bị trừ điểm tin cậy.',
          cvMitigation: isEn
            ? 'Restructure key achievements using the XYZ formula: Accomplished [X], measured by [Y], by doing [Z].'
            : 'Cập nhật lại các bullet chính theo công thức XYZ: Đạt được [X], đo lường bằng [Y], thông qua giải pháp [Z].',
          interviewDefense: isEn
            ? 'Prepare 2-3 specific case studies with exact starting baselines and percentage gains to cite during interviews.'
            : 'Chuẩn bị sẵn 2-3 câu chuyện thực tế có số liệu mốc trước - sau để chứng minh thuyết phục khi được hỏi.',
        },
        {
          riskType: 'domain_mismatch',
          riskTitle: isEn ? 'Domain Ramp-Up Time' : 'Thời Gian Làm Quen Với Nghiệp Vụ Mới',
          severity: 'medium',
          recruiterConcern: isEn
            ? 'Recruiter needs confidence that you can contribute quickly without extensive workflow training.'
            : 'Nhà tuyển dụng cần sự yên tâm rằng ứng viên có thể tạo ra giá trị ngay mà không mất thời gian đào tạo lại quy trình.',
          cvMitigation: isEn
            ? 'Incorporate standardized methodologies (Agile, ITIL, Compliance) in your summary and core skills.'
            : 'Lồng ghép các tiêu chuẩn và phương pháp luận chung (Agile, ITIL, quy trình chất lượng) vào phần tóm tắt để tạo sự tin tưởng.',
          interviewDefense: isEn
            ? 'Cite a past instance where you quickly onboarded onto unfamiliar business workflows within the first 30 days.'
            : 'Nêu bật khả năng tự học và dẫn chứng một trường hợp bạn đã làm chủ nghiệp vụ mới trong tháng đầu tiên.',
        },
      ],
    },
    feature4: {
      interviewPrepSummary: isEn
        ? 'Curated 6 practical interview battle questions focusing on quantified project outcomes, production crisis handling, and fast 90-day onboarding value.'
        : 'Bộ 6 câu hỏi phỏng vấn thực chiến xoáy sâu vào kỹ năng định lượng kết quả dự án, xử lý sự cố hệ thống và lộ trình tạo giá trị trong 90 ngày đầu.',
      questions: [
        {
          question: isEn
            ? 'In your CV, achievements are described qualitatively. Can you walk through a specific project and quantify your direct business or performance impact?'
            : 'Trong CV của bạn, các thành tựu phần lớn được mô tả định tính. Bạn hãy chia sẻ một dự án cụ thể và định lượng kết quả hoặc giá trị kinh doanh mà bạn trực tiếp tạo ra?',
          category: isEn ? 'CV Gap Verification' : 'Kiểm chứng khoảng trống CV',
          difficulty: isEn ? 'High Priority' : 'Trọng tâm',
          sourceGapOrDoubt: isEn
            ? 'CV lacks explicit metric baselines, ROI, or percentage gains in work history.'
            : 'CV còn thiếu các mốc chỉ số định lượng (%, ngân sách, thời gian, SLA) ở các vị trí gần nhất.',
          interviewerIntent: isEn
            ? 'Verify whether you truly owned business results or merely participated in routine team tasks.'
            : 'Kiểm chứng ứng viên thực sự làm chủ kết quả đầu ra hay chỉ tham gia hỗ trợ các công việc thường nhật.',
          starAnswerGuide: {
            situationTask: isEn
              ? 'Name a major project where operational inefficiency or technical delay created a business challenge.'
              : 'Nêu một dự án trọng điểm gặp vấn đề về hiệu suất vận hành hoặc tắc nghẽn kỹ thuật cần khắc phục.',
            action: isEn
              ? 'Detail the architecture/process optimizations you introduced and how you tracked progress.'
              : 'Trình bày giải pháp tối ưu hóa bạn trực tiếp đề xuất, công cụ đo lường và cách phối hợp triển khai.',
            result: isEn
              ? 'Cite verified outcome: e.g. 25% throughput increase, 15 hours saved weekly, 100% on-time delivery.'
              : 'Đưa ra con số cụ thể: tăng 25% hiệu suất, tiết kiệm 15 giờ/tuần, đạt 100% mục tiêu tiến độ.',
          },
          pitfallToAvoid: isEn
            ? 'Avoid claiming credit for the entire team work without specifying your exact individual contribution.'
            : 'Tránh nhận vơ thành tích chung của cả tập thể mà không nói rõ vai trò và đóng góp cá nhân của mình.',
        },
        {
          question: isEn
            ? 'Our role requires rapid integration into domain workflows. How did you adapt when working with an unfamiliar business domain in the past?'
            : 'Vị trí này đòi hỏi khả năng thích ứng nghiệp vụ nhanh. Bạn từng làm quen và làm chủ một lĩnh vực hoàn toàn mới như thế nào trong quá khứ?',
          category: isEn ? 'CV Gap Verification' : 'Kiểm chứng khoảng trống CV',
          difficulty: isEn ? 'Hard' : 'Khó',
          sourceGapOrDoubt: isEn
            ? 'Potential domain transition between candidate past companies and target industry.'
            : 'Độ lệch ngành nghề/nghiệp vụ giữa môi trường làm việc trước đây và lĩnh vực của công ty tuyển dụng.',
          interviewerIntent: isEn
            ? 'Evaluate self-learning agility, curiosity, and speed of reaching peak productivity.'
            : 'Đánh giá khả năng tự học, độ nhạy bén với nghiệp vụ mới và tốc độ hòa nhập để tạo giá trị.',
          starAnswerGuide: {
            situationTask: isEn
              ? 'Describe joining a company or project with complex, unfamiliar business logic.'
              : 'Lấy dẫn chứng khi bạn mới nhận việc tại một công ty/dự án có mô hình nghiệp vụ lạ và phức tạp.',
            action: isEn
              ? 'Explain how you proactively studied documentation, shadowed domain experts, and built practical prototypes.'
              : 'Nêu cách bạn chủ động đọc tài liệu, trao đổi với chuyên gia nghiệp vụ (BA/PO) và lập bản đồ quy trình.',
            result: isEn
              ? 'Delivered first key feature ahead of schedule within 30 days with zero domain defects.'
              : 'Hoàn thành đầu việc độc lập ngay trong tháng đầu tiên và được khách hàng/quản lý đánh giá cao.',
          },
          pitfallToAvoid: isEn
            ? 'Do not say you expect the company to provide full hand-holding training from scratch.'
            : 'Tuyệt đối không tỏ ra thụ động hoặc chờ đợi công ty phải cử người "cầm tay chỉ việc" từng li từng tí.',
        },
        {
          question: isEn
            ? 'Can you describe a critical production incident or major bottleneck you handled under strict deadline pressure?'
            : 'Hãy mô tả một sự cố nghiêm trọng hoặc nút thắt cổ chai kỹ thuật lớn nhất bạn từng trực tiếp ứng cứu dưới áp lực thời gian?',
          category: isEn ? 'Deep-Dive Technical & Scenario' : 'Tình huống & Chuyên môn sâu',
          difficulty: isEn ? 'Very Hard' : 'Rất khó',
          sourceGapOrDoubt: isEn
            ? 'JD requires robust troubleshooting and system stability maintenance under enterprise conditions.'
            : 'JD yêu cầu tính sẵn sàng cao và khả năng phản ứng nhanh với các sự cố bất ngờ.',
          interviewerIntent: isEn
            ? 'Assess root-cause diagnostic method, emotional composure, and communication during critical downtime.'
            : 'Xem xét tư duy chẩn đoán nguyên nhân gốc, sự bình tĩnh và cách thông tin liên lạc khi xảy ra sự cố.',
          starAnswerGuide: {
            situationTask: isEn
              ? 'State the incident trigger, business impact, and recovery SLA deadline.'
              : 'Tóm lược sự cố: triệu chứng ban đầu, dịch vụ bị gián đoạn và giới hạn thời gian xử lý.',
            action: isEn
              ? 'Explain log analysis, containment strategy, root cause identification, and remediation.'
              : 'Trình bày cách phân tích log/monitoring, cô lập vùng ảnh hưởng, tìm ra điểm lỗi và đưa ra bản vá.',
            result: isEn
              ? 'Restored service within SLA and instituted automated preventive monitoring.'
              : 'Khôi phục hệ thống trong thời hạn SLA và thiết lập thêm cảnh báo tự động để không lặp lại lỗi.',
          },
          pitfallToAvoid: isEn
            ? 'Never blame previous colleagues or vendors. Stay focused on technical troubleshooting facts.'
            : 'Tuyệt đối không đổ lỗi cho đồng nghiệp, khách hàng hay hạ tầng bên thứ ba. Hãy tập trung vào giải pháp.',
        },
        {
          question: isEn
            ? 'How do you balance technical quality / clean architecture with urgent business deadlines?'
            : 'Bạn cân bằng giữa chất lượng kỹ thuật (chuẩn hóa code/kiến trúc) và áp lực bàn giao tiến độ gấp của kinh doanh như thế nào?',
          category: isEn ? 'Deep-Dive Technical & Scenario' : 'Tình huống & Chuyên môn sâu',
          difficulty: isEn ? 'Hard' : 'Khó',
          sourceGapOrDoubt: isEn
            ? 'Testing engineering pragmatism vs theoretical idealism.'
            : 'Kiểm tra tính thực tế và khả năng cân đối giữa nợ kỹ thuật (technical debt) và nhu cầu kinh doanh.',
          interviewerIntent: isEn
            ? 'Identify whether the candidate is dogmatic or practical when commercial realities require compromise.'
            : 'Nhà tuyển dụng muốn biết ứng viên có tư duy linh hoạt vì mục tiêu chung hay cố chấp áp dụng sách vở.',
          starAnswerGuide: {
            situationTask: isEn
              ? 'Recall a release with tight deadline where building a perfect architecture would cause a business delay.'
              : 'Kể lại một đợt bàn giao sản phẩm gấp mà nếu áp dụng kiến trúc hoàn hảo 100% sẽ bị trễ hạn thương mại.',
            action: isEn
              ? 'Explain how you phased the solution: MVP launch first with safeguards, followed by technical refactoring.'
              : 'Trình bày cách bạn chia nhỏ giải pháp: bàn giao bản MVP an toàn trước, ghi nhận nợ kỹ thuật và lên kế hoạch refactor sau.',
            result: isEn
              ? 'Hit release date successfully and eliminated technical debt during the subsequent sprint.'
              : 'Kịp tiến độ ra mắt thị trường và dọn dẹp sạch nợ kỹ thuật ngay ở sprint kế tiếp.',
          },
          pitfallToAvoid: isEn
            ? 'Do not say you always cut corners without later paying off technical debt.'
            : 'Không được nói "cứ làm ẩu cho kịp là được" mà không có kế hoạch kiểm soát chất lượng lâu dài.',
        },
        {
          question: isEn
            ? 'Describe a technical disagreement you had with a team lead or peer. How did you resolve it collaboratively?'
            : 'Chia sẻ một lần bạn có quan điểm kỹ thuật khác biệt hoặc bất đồng giải pháp với đồng nghiệp/trưởng nhóm. Bạn đã giải quyết ra sao?',
          category: isEn ? 'Seniority & Behavioral Leadership' : 'Tầm vóc & Cách làm việc',
          difficulty: isEn ? 'Hard' : 'Khó',
          sourceGapOrDoubt: isEn
            ? 'Assessing interpersonal maturity, emotional intelligence, and team harmony.'
            : 'Đánh giá độ chín chắn trong giao tiếp, khả năng lắng nghe và tôn trọng sự đa dạng quan điểm.',
          interviewerIntent: isEn
            ? 'Hiring team wants to know if you can debate with data rather than ego, and commit once decided.'
            : 'Hội đồng tuyển dụng kiểm tra xem bạn có dựa trên dữ liệu để tranh luận và sẵn sàng cam kết thực thi khi có quyết định chung hay không.',
          starAnswerGuide: {
            situationTask: isEn
              ? 'Provide context on the opposing viewpoints regarding a technology choice or workflow.'
              : 'Nêu ngắn gọn bản chất hai luồng ý kiến khác nhau về mặt kỹ thuật mà không chỉ trích quan điểm của đối phương.',
            action: isEn
              ? 'Describe setting up an objective benchmark, prototyping both, and discussing trade-offs calmly.'
              : 'Nêu cách bạn đề xuất làm thử nghiệm so sánh khách quan (benchmark/POC), phân tích ưu-nhược điểm dựa trên số liệu.',
            result: isEn
              ? 'Reached unanimous agreement and delivered the chosen approach with full team support.'
              : 'Đạt được sự đồng thuận cao trong nhóm, duy trì tinh thần đoàn kết và giải pháp vận hành tối ưu.',
          },
          pitfallToAvoid: isEn
            ? 'Avoid portraying yourself as a lone genius who had to tolerate incompetent teammates.'
            : 'Tránh thái độ ngạo mạn tự cho mình luôn đúng, coi thường năng lực đồng nghiệp hoặc có thái độ ấm ức khi không được chọn.',
        },
        {
          question: isEn
            ? 'What is your structured 30-60-90 day plan to make a tangible impact if selected for this role?'
            : 'Nếu được lựa chọn, kế hoạch hành động 30-60-90 ngày đầu tiên của bạn để tạo ra giá trị thiết thực là gì?',
          category: isEn ? 'Seniority & Behavioral Leadership' : 'Tầm vóc & Cách làm việc',
          difficulty: isEn ? 'High Priority' : 'Trọng tâm',
          sourceGapOrDoubt: isEn
            ? 'Evaluating readiness, initiative, and strategic vision for this role.'
            : 'Đánh giá tính chủ động, khả năng tự định hướng và tầm nhìn công việc của ứng viên.',
          interviewerIntent: isEn
            ? 'Ensure candidate has a proactive mindset and understands how to ramp up smoothly without high friction.'
            : 'Xác định xem ứng viên có phương pháp hòa nhập bài bản và mục tiêu rõ ràng hay chỉ thụ động chờ người khác hướng dẫn.',
          starAnswerGuide: {
            situationTask: isEn
              ? 'Address target job responsibilities and onboarding expectations.'
              : 'Xác định kỳ vọng then chốt của vị trí ứng tuyển trong 3 tháng đầu.',
            action: isEn
              ? 'Break into 3 clear phases: Days 1-30 (deep dive into architecture & processes), Days 31-60 (independent ownership & first feature delivery), Days 61-90 (process optimization & mentoring).'
              : 'Chia rõ 3 giai đoạn: 30 ngày (học hỏi quy trình, nắm chắc hệ thống), 60 ngày (nhận trách nhiệm độc lập, bàn giao tính năng đầu tiên), 90 ngày (đề xuất cải tiến và tối ưu hóa).',
            result: isEn
              ? 'Achieves full autonomous productivity quickly and contributes directly to core team KPIs.'
              : 'Trở thành nhân sự chủ lực tự chủ trong vận hành, đóng góp ngay vào các chỉ tiêu KPI chung của phòng ban.',
          },
          pitfallToAvoid: isEn
            ? 'Do not give a vague answer like "I will do whatever tasks my manager assigns me".'
            : 'Tuyệt đối không trả lời thụ động kiểu "Sếp giao gì em làm nấy". Cần thể hiện tư duy làm chủ công việc.',
        },
      ],
    },
  };
}

function createFallbackUpdatedCv(cvText: string, customInstruction?: string, lang: 'vi' | 'en' = 'vi') {
  const isEn = lang === 'en';
  let formattedCv = cvText.trim();
  if (!formattedCv.startsWith('#')) {
    formattedCv = `# ${isEn ? 'CURRICULUM VITAE' : 'SƠ YẾU LÝ LỊCH CHUYÊN MÔN'}\n\n` + formattedCv;
  }

  formattedCv = formattedCv
    .replace(/\n•\s*/g, '\n* ')
    .replace(/\n-\s*/g, '\n* ');

  if (customInstruction) {
    formattedCv += `\n\n## ${isEn ? 'ADDITIONAL HIGHLIGHTS' : 'BỔ SUNG THEO YÊU CẦU'}\n* ${customInstruction}`;
  }

  return {
    isDemoFallback: true,
    updatedCvMarkdown: formattedCv,
    summaryOfChanges: [
      isEn ? 'Standardized professional Markdown structure with clear section headers' : 'Chuẩn hóa cấu trúc Markdown chuyên nghiệp với các tiêu đề rõ ràng',
      isEn ? 'Enhanced experience bullets using action verbs and quantified impact metrics' : 'Tối ưu hóa các bullet point kinh nghiệm bằng động từ hành động và chỉ số đo lường',
      isEn ? 'Integrated high-priority JD keywords into technical skills summary' : 'Tích hợp các từ khóa JD ưu tiên cao vào phần tóm tắt kỹ năng',
      isEn ? 'Addressed recruiter doubts by highlighting leadership and project scope' : 'Khắc phục nghi ngờ của nhà tuyển dụng bằng cách nhấn mạnh vai trò và quy mô dự án',
    ],
  };
}

function createFallbackFormatCv(rawCvText: string): string {
  let cleaned = rawCvText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[•\-\*]\s*/gm, '* ');

  if (!cleaned.startsWith('#')) {
    cleaned = `# APPLICANT CV\n\n` + cleaned;
  }
  return cleaned;
}
function buildPrompt(cvText: string, jdText: string, clarifyingAnswers?: string, lang: 'vi' | 'en' = 'vi') {
  const isEn = lang === 'en';

  if (isEn) {
    return `
You are a Senior Talent Acquisition Lead and Executive Resume Optimization Expert.
Your mission is to rigorously analyze, score, and optimize a candidate's CV against the provided Job Description (JD).

=== INPUT DATA ===

1. JOB DESCRIPTION (JD):
${jdText}

2. CANDIDATE'S CV:
${cvText}

${clarifyingAnswers ? `3. CANDIDATE'S CLARIFYING ANSWERS:\n${clarifyingAnswers}\n` : ''}

=== PROCESSING REQUIREMENTS ===

--- CANDIDATE & JOB POSITION IDENTIFICATION ---
- Extract the candidate's exact full name (candidateName) from the CV header, contact block, or title (e.g. 'Nguyễn Văn A', 'John Smith'). Do NOT return a job skill, bullet point, phrase, or section header as the candidate name. If not found, leave as empty string or a clean identifier.
- Extract the exact target Job Title / Role Position (jobTitle) from the JD (e.g. 'Senior DevOps Engineer', 'Head of IT Infrastructure'). Do NOT return a technical skill keyword as the jobTitle.
- Extract the hiring Company Name / Organization (companyName) from the JD (e.g. 'FPT Software', 'Techcombank', 'VNG Corporation'). If the JD does not mention any company name, return an empty string ''.

--- FEATURE 1: RECRUITER KEYWORD EXTRACTION & CV COMPARISON ---
1. Extract & categorize key JD terms into 5 groups:
   - "Technical Skills"
   - "Tools, Software & Methodologies"
   - "Desired Experience"
   - "Deliverables & Expected Outcomes"
   - "Attributes & Work Style"
   Assign importance level: "High Priority", "Medium Priority", or "Nice to Have".
   Assign isMustHave (boolean): true if this is a mandatory / knock-out requirement in the JD, false if it is a bonus / nice-to-have skill.
2. Create CV vs JD Comparison Table:
   - Importance level & isMustHave (boolean: true for Must-Have / Knock-out, false for Nice-to-Have)
   - Where in CV this is demonstrated (quote exact evidence from CV)
   - Gap or recommended addition
   - matchStatus: "khop" | "can_bo_sung" | "thieu"
   - targetSection: Specific CV section where the candidate should insert or strengthen this item (e.g., "Executive Summary", "Work Experience at [Company Name]", "Technical Skills").
   - suggestedPhrasing: For items with matchStatus "can_bo_sung" or "thieu", write a ready-to-use, realistic 1-sentence CV snippet/bullet (in the SAME language as the candidate's CV) that the candidate can copy and adapt directly into that targetSection (use [X]% or [Metric] placeholders if exact numbers are unknown). For "khop", return an empty string "".
3. Calculate Fit Scores (0 - 100%) & Detailed Score Rationales:
   - Technical Keyword Match (%) + keywordRationale (Explain why this score was given and what specific missing/weak terms pulled it down)
   - Skill Set Match (%) + skillRationale (Explain why this score was given and which core vs bonus skills lack depth)
   - Experience & Outcome Match (%) + experienceRationale (Explain why this score was given based on seniority, project scale, and quantified outcomes)
   - Overall Role Fit (%) + projectedOverallScore (0 - 100%: realistic target score achievable if the candidate optimizes CV presentation and fills the addressable gaps) + overallRationale (Explain the main score drivers and how to bridge the gap from overallRoleScore to projectedOverallScore)
4. Analysis Summary:
   - Biggest strength of CV relative to JD
   - Key missing keywords, skills, or experience
   - Weak or overly vague sections in CV
   - 5 immediate actions to boost CV competitiveness

--- FEATURE 2: SECTION-BY-SECTION STRUCTURAL REVIEW, TARGETED SUMMARIES & REWRITTEN BULLETS ---
1. Check CV. If critical metrics/tools are missing, provide MAXIMUM 3 concise clarifying questions.
2. Targeted Professional Summaries (tailoredSummaries):
   - Generate exactly 2 high-impact targeted professional summaries. MANDATORY WORD COUNT: EACH SUMMARY MUST BE BETWEEN 50 AND 200 WORDS (up to 250 words for Senior/Executive profiles, minimum 3–4 substantive sentences). ABSOLUTELY DO NOT write a brief 1-2 sentence snippet under 50 words!
   - Follow this 4-sentence structure:
     + Sentence 1 (Identity & Seniority): Verified professional role + years of experience from CV + core specialization.
     + Sentence 2 (Key Achievements & JD Fit): Standout accomplishment or complex technical challenge resolved from CV.
     + Sentence 3 (Methodology & Standards): Agile discipline, engineering rigor, or cross-functional teamwork.
     + Sentence 4 (Target Commitment): Concrete value commitment delivered to [Company Name] in [Job Title] role.
   - CRITICAL REQUIREMENT ON SUMMARY ACCURACY: Both summaries MUST be strictly grounded in the candidate's actual CV data (verified skills, years of experience, past achievements). Absolutely DO NOT hallucinate fake roles, fake companies, or fake metrics.
   - Write in the SAME primary language as the candidate's CV.
3. Section-by-Section Structural Review (sectionAudit):
   - Provide overallSectionRating (summary diagnostic sentence on structural health).
   - Perform an ATS and structural review across all 4 mandatory sections:
     1. sectionKey: 'summary', sectionName: 'Executive Summary'
     2. sectionKey: 'experience', sectionName: 'Work Experience & Impact'
     3. sectionKey: 'skills', sectionName: 'Skills Structure & Grouping'
     4. sectionKey: 'education_ats', sectionName: 'Education, Certifications & ATS Standards'
   - For each section, provide:
     - status: "tot" (strong / standard met) | "can_cai_thien" (needs improvement) | "yeu_nghiem_trong" (needs urgent attention)
     - score: integer from 0 to 100
     - comment: candid diagnosis of strengths or weaknesses
     - actionableFix: exact, actionable recommendation on how to adjust this section
     - suggestedSnippets: array of 1-2 ready-to-use sample sentences for candidate to copy-paste directly. STRICT REQUIREMENT: These sentences MUST be strictly grounded in the candidate's actual CV data (polishing or reframing their real experience/skills). Absolutely NO inventing fake achievements, unverified certifications, or fake metrics.
4. Bullet Point Rewrite Principles (5 to 8 most impactful bullets):
   - Concise and complete.
   - Use strong action verbs and XYZ / STAR Formula: Accomplished [X], as measured by [Y], by doing [Z].
   - embeddedKeywords: Array of explicit JD terms/keywords naturally incorporated into the rewritten bullet.
   - metricPlaceholders: Array of suggested metric brackets for the candidate to fill in (e.g. ["[20-25%] efficiency", "[$50K] budget", "[Team of 6]"]).
   - CRITICAL LANGUAGE RULE FOR REWRITTEN BULLETS: Every 'rewrittenBullet' MUST be written in the SAME LANGUAGE as the original bullet point in the candidate's CV (e.g. if the original bullet in the CV is in English, write 'rewrittenBullet' in English; if in Vietnamese, write in Vietnamese). Do NOT translate bullet points to a different language!
   - If original bullet lacks sufficient context to rewrite convincingly, set rewrittenBullet to "Needs more information before rewriting." (or "Cần bổ sung thông tin trước khi viết lại." if CV is in Vietnamese) and set isLackingInfo: true.

--- FEATURE 3: 10-SECOND RECRUITER CV SCAN, SENIORITY FIT & RISK MITIGATION ---
Act as a strict, pragmatic Senior Talent Acquisition Lead and Hiring Manager reviewing the CV:
1. 10-Second Skim & Decision:
   - inviteDecision: "YES" | "NO" | "MAYBE"
   - decisionReason: Concise, candid core reason for the decision
   - firstImpression10s: Brutally honest 10-second visual & professional impression
   - immediateStrength: Strongest asset immediately visible on first glance
   - biggestDoubt: Single biggest hesitation or skepticism about this candidate
   - fastestPointLossSection: Exact CV section that causes immediate loss of confidence or points
   - top3MustFix: Array of 3 high-priority, actionable fixes to maximize interview callback rate
2. Seniority & Scope Fit Assessment (seniorityFit):
   - Evaluate whether the candidate's career stature matches the JD across 4 dimensions:
     a. dimensionKey: "level_tenure", dimensionName: "Level & Career Tenure"
     b. dimensionKey: "scale_complexity", dimensionName: "Scale & System Complexity"
     c. dimensionKey: "scope_ownership", dimensionName: "Scope of Ownership & Initiative"
     d. dimensionKey: "domain_match", dimensionName: "Domain & Business Context"
   - For each dimension, provide:
     * jdExpectation: JD baseline requirement
     * cvReality: Actual evidence demonstrated in CV
     * assessment: "under" | "match" | "over"
     * comment: Sharp, realistic evaluation comment
   - overallAssessment: "under" | "match" | "over"
   - overallAssessmentLabel: e.g. "Good Fit (Sweet Spot)", "Stretch (Under)", or "Senior / Overqualified"
   - summaryRationale: 1-2 sentences summarizing candidate's overall seniority positioning vs the JD
   - positioningAdvice: Strategic positioning advice on how to communicate seniority in interviews
3. Risk Radar & Mitigation Matrix (riskMitigationMatrix):
   - Identify 2 to 4 genuine recruiter concerns / red flags from the CV (e.g. lack of quantified outcomes, tenure gaps, frequent job hopping, domain mismatch, or seniority gap).
   - For each risk item:
     * riskType: "tenure_gap" | "job_hopping" | "domain_mismatch" | "metric_lacking" | "over_under_qualified" | "other"
     * riskTitle: Clear risk heading (e.g. "Lack of Quantified Outcome Metrics")
     * severity: "high" | "medium" | "low"
     * recruiterConcern: What the recruiter honestly worries about behind closed doors
     * cvMitigation: Specific, actionable fix directly on the CV to neutralize the concern
     * interviewDefense: Tactical talking points to address and pivot this concern smoothly in an interview

--- FEATURE 4: PRACTICAL INTERVIEW BATTLE GUIDE & STAR ANSWER BLUEPRINTS (5 TO 10 QUESTIONS) ---
Generate dynamically 5 to 10 sharp, tailored interview questions that an experienced Hiring Manager and HR Lead will realistically ask this specific candidate.
Group questions into 3 strategic categories:
1. "CV Gap Verification": Direct questions targeting unverified skills, lack of metrics, tenure jumps, or missing JD prerequisites in the CV.
2. "Deep-Dive Technical & Scenario": Complex scenarios testing troubleshooting under pressure, system trade-offs, architecture decisions, or performance tuning.
3. "Seniority & Behavioral Leadership": Behavioral probes testing team conflict resolution, cross-functional collaboration, culture fit, and the 30-60-90 day onboarding roadmap.

For each question, provide:
- question: The exact, probing question.
- category: "CV Gap Verification" | "Deep-Dive Technical & Scenario" | "Seniority & Behavioral Leadership"
- difficulty: "High Priority" | "Hard" | "Very Hard"
- sourceGapOrDoubt: The specific gap or suspicion in the CV that triggers this question.
- interviewerIntent: What the interviewers are secretly evaluating behind the question.
- starAnswerGuide: Structured answer guidance following the STAR method grounded in candidate's actual CV:
  * situationTask: Context and specific challenge from the candidate's CV background (Situation & Task).
  * action: Explicit technical actions, methodology, and tools to highlight (Action).
  * result: Quantified metric impact, business value, or lessons learned (Result).
- pitfallToAvoid: The critical blunder or dangerous answer trap the candidate must avoid.

=== LANGUAGE & FACTUAL ACCURACY RULES ===
- Write response explanations, gaps, and reasons IN ENGLISH. However, each 'rewrittenBullet' MUST strictly match the SAME LANGUAGE as the original bullet point in the candidate's CV.
- Preserve candidate's original company names, dates, tools, numbers, and facts 100% accurately.
- CRITICAL LANGUAGE CONSTRAINT: All output fields, lists, analysis summaries, gaps, doubts, standouts, and feedback (everything outside of 'rewrittenBullet') MUST be strictly written in ENGLISH. Under no circumstances should Vietnamese words or phrases appear in these explanatory fields unless they are verbatim quotes/evidence of Vietnamese text from the original CV. Under no circumstances should technical terms (such as SLA, KPI, CAB, CMDB, etc.) be translated.
`;
  }

  return `
Bạn là một Chuyên gia Tuyển dụng Cao cấp (Senior HR & Talent Acquisition Lead) kiêm Chuyên gia Viết CV / Tối ưu hồ sơ ứng tuyển.

Nhiệm vụ của bạn là phân tích, đánh giá và tối ưu CV cá nhân dựa trên Mô tả công việc (JD) được cung cấp.

=== DỮ LIỆU ĐẦU VÀO ===

1. MÔ TẢ CÔNG VIỆC (JD):
${jdText}

2. CV CỦA ỨNG VIÊN:
${cvText}

${clarifyingAnswers ? `3. CÂU TRẢ LỜI BỔ SUNG THÔNG TIN TỪ ỨNG VIÊN:\n${clarifyingAnswers}\n` : ''}

=== YÊU CẦU XỬ LÝ (BẮT BUỘC THỰC HIỆN ĐỦ CÁC MỤC) ===

--- NHẬN DIỆN ỨNG VIÊN & VỊ TRÍ TUYỂN DỤNG ---
- Trích xuất chính xác Họ và Tên đầy đủ của ứng viên (candidateName) từ phần tiêu đề, thông tin liên hệ hoặc phần đầu của CV (ví dụ: 'Nguyễn Văn A', 'Trần Thị B', 'John Smith'). TUYỆT ĐỐI KHÔNG lấy câu mô tả công việc, kỹ năng, đoạn văn hay tiêu đề mục làm tên ứng viên. Nếu không tìm thấy tên cá nhân cụ thể, hãy để chuỗi rỗng.
- Trích xuất chính xác Chức danh / Vị trí ứng tuyển (jobTitle) từ JD (ví dụ: 'Senior DevOps Engineer', 'Trưởng phòng Quản trị & Vận hành CNTT'). TUYỆT ĐỐI KHÔNG lấy từ khóa kỹ năng làm jobTitle.
- Trích xuất chính xác Tên Công ty / Tổ chức tuyển dụng (companyName) từ JD (ví dụ: 'FPT Software', 'Vietcombank', 'Tập đoàn Viettel'). Nếu trong JD không nêu tên công ty, hãy để chuỗi rỗng ''.

--- TÍNH NĂNG 1: TRÍCH XUẤT NGÔN NGỮ NHÀ TUYỂN DỤNG & ĐỐI CHIẾU CV ---
1. Trích xuất & xếp hạng từ khóa JD:
   - Phân loại từ khóa quan trọng trong JD thành 5 nhóm:
     + "Kỹ năng chuyên môn"
     + "Công cụ, phần mềm hoặc phương pháp"
     + "Kinh nghiệm mong muốn"
     + "Kết quả đầu ra hoặc kỳ vọng công việc"
     + "Phẩm chất hoặc cách làm việc"
   - Gán 1 trong 3 mức độ quan trọng: "Rất quan trọng", "Quan trọng", "Có lợi thế".
   - Gán isMustHave (boolean): true nếu đây là tiêu chí Bắt buộc / Điều kiện tiên quyết (Must-Have / Knock-out) trong JD; false nếu là Điểm cộng / Ưu tiên thêm (Nice-to-Have).
2. Tạo Bảng Đối chiếu CV với JD:
   - Mức độ quan trọng & isMustHave (boolean: true = Tiêu chí bắt buộc, false = Điểm cộng)
   - CV của tôi đã thể hiện ở đâu (trích dẫn bằng chứng cụ thể từ CV)
   - Khoảng trống cần bổ sung hoặc viết rõ hơn
   - matchStatus: "khop" | "can_bo_sung" | "thieu"
   - targetSection: Chỉ rõ vị trí cụ thể trong CV nên chèn hoặc viết sâu hơn (Ví dụ: "Mục Tóm tắt mở đầu (Executive Summary)", "Mục Kinh nghiệm tại [Tên Công ty trong CV]", hoặc "Mục Kỹ năng chuyên môn").
   - suggestedPhrasing: Với các tiêu chí đang ở mức "can_bo_sung" hoặc "thieu", hãy viết sẵn 1 câu văn mẫu / bullet point gợi ý sát ngữ cảnh (dùng CÙNG NGÔN NGỮ với CV gốc của ứng viên, có thể để ngoặc vuông [X]% hoặc [Số liệu] ở chỗ cần ứng viên điền số thực tế) để ứng viên copy chèn ngay vào targetSection. Nếu matchStatus là "khop", trả về chuỗi rỗng "".
3. Chấm điểm Mức độ Phù hợp (Thang điểm 0 - 100%) & Giải trình Điểm số (Score Breakdown & Rationale):
   - Mức độ khớp từ khóa chuyên môn (%) + keywordRationale (Giải thích rõ vì sao đạt mức điểm này, những từ khóa cốt lõi nào đã có và từ khóa nào vắng mặt làm kéo điểm xuống)
   - Mức độ khớp kỹ năng (%) + skillRationale (Giải thích rõ vì sao đạt mức điểm này, kỹ năng nào mới chỉ liệt kê tên mà thiếu bằng chứng thực thi trong dự án)
   - Mức độ khớp kinh nghiệm và kết quả đầu ra (%) + experienceRationale (Giải thích rõ vì sao đạt mức điểm này dựa trên thâm niên, quy mô dự án và mức độ định lượng kết quả KPI/SLA/ROI)
   - Mức độ phù hợp tổng thể với vai trò (%) + projectedOverallScore (Điểm tổng thể dự kiến từ 0 - 100% có thể đạt được nếu ứng viên tối ưu lại cách trình bày CV và bổ sung các khoảng trống theo hướng dẫn) + overallRationale (Giải thích tổng quan nguyên nhân trừ điểm lớn nhất và lộ trình tăng từ overallRoleScore lên projectedOverallScore)
4. Tóm tắt Phân tích:
   - Điểm mạnh lớn nhất của CV so với JD
   - Những từ khóa, kỹ năng hoặc kinh nghiệm quan trọng còn thiếu
   - Những phần trong CV đang yếu, quá chung chung hoặc chưa chứng minh được năng lực
   - 5 việc cụ thể cần sửa ngay để CV cạnh tranh hơn

--- TÍNH NĂNG 2: ĐÁNH GIÁ CẤU TRÚC TỪNG PHẦN CV, VIẾT SẴN TÓM TẮT ĐỊNH VỊ & TỐI ƯU BULLET POINT ---
1. Kiểm tra CV. Thiếu dữ liệu quan trọng (số liệu, quy mô, công cụ, kết quả), đưa ra TỐI ĐA 3 câu hỏi làm rõ ngắn gọn.
2. Viết sẵn 2 bản Tóm tắt hồ sơ định vị theo vị trí (tailoredSummaries):
   - Tự động tạo chính xác 2 phiên bản Tóm tắt hồ sơ. YÊU CẦU BẮT BUỘC VỀ ĐỘ DÀI: MỖI BẢN PHẢI DÀI TỪ 50 ĐẾN 200 TỪ (tối đa 250 từ cho hồ sơ Senior/Quản lý, tối thiểu 3–4 câu hoàn chỉnh có chiều sâu). TUYỆT ĐỐI KHÔNG VIẾT DƯỚI 50 TỪ (không viết cụt ngủn 1–2 câu):
     Áp dụng cấu trúc 4 câu chuẩn mực:
     + Câu 1 (Định vị & Thâm niên): Chức danh chuyên môn + số năm kinh nghiệm thực tế từ CV + lĩnh vực chuyên sâu.
     + Câu 2 (Năng lực cốt lõi & Thành tựu): Dự án, công nghệ hoặc thành tựu nổi bật nhất trong CV chứng minh năng lực giải quyết bài toán của JD.
     + Câu 3 (Tư duy & Phong cách làm việc): Tiêu chuẩn chất lượng, quy trình (Agile, chuẩn kỹ thuật) hoặc thế mạnh làm việc đội ngũ.
     + Câu 4 (Cam kết đóng góp): Giá trị cụ thể cam kết mang lại cho [Tên Công ty] tại vị trí [Vị trí ứng tuyển].
   - NGUYÊN TẮC TRUNG THỰC CỐT LÕI: Cả 2 bản tóm tắt BẮT BUỘC phải dựa trên thông tin thực tế từ CV của ứng viên (thâm niên, kỹ năng, dự án đã làm). TUYỆT ĐỐI KHÔNG tự ý sáng tạo hay bịa đặt kinh nghiệm không có trong CV.
   - BẮT BUỘC viết cùng ngôn ngữ chính của CV ứng viên.
3. Đánh giá Cấu trúc Từng Phần của CV (sectionAudit):
   - Đưa ra overallSectionRating (1 câu tóm lược độ hoàn thiện cấu trúc CV).
   - Đánh giá chi tiết đủ 4 phần bắt buộc:
     1. sectionKey: 'summary', sectionName: 'Tóm tắt mở đầu (Executive Summary)'
     2. sectionKey: 'experience', sectionName: 'Kinh nghiệm làm việc & Kết quả (Work Experience)'
     3. sectionKey: 'skills', sectionName: 'Cấu trúc Kỹ năng chuyên môn (Core Skills)'
     4. sectionKey: 'education_ats', sectionName: 'Học vấn/Chứng chỉ & Định dạng chuẩn ATS (Education & ATS)'
   - Với mỗi phần, cung cấp:
     - status: "tot" (Tốt - Đạt chuẩn) | "can_cai_thien" (Cần cải thiện) | "yeu_nghiem_trong" (Cần bổ sung gấp)
     - score: số nguyên từ 0 đến 100
     - comment: nhận xét thực trạng khách quan
     - actionableFix: đề xuất điều chỉnh cụ thể để tối ưu
     - suggestedSnippets: mảng 1-2 mẫu câu gợi ý sát ngữ cảnh để ứng viên sao chép chèn trực tiếp vào CV. YÊU CẦU BẮT BUỘC: Mẫu câu tham khảo cho đề xuất điều chỉnh BẮT BUỘC phải dựa trên thông tin thực tế từ CV của ứng viên, TUYỆT ĐỐI KHÔNG tự ý sáng tạo hay bịa đặt kỹ năng/kinh nghiệm/số liệu không có trong CV.
4. Nâng cấp Viết lại Bullet Point (rewrittenBullets) từ 5 đến 8 bullet quan trọng nhất:
   - Ngắn gọn và đầy đủ theo Công thức XYZ / STAR: Đạt được [X], đo lường bằng [Y], thông qua [Z].
   - Dùng động từ hành động mạnh, sát ngôn ngữ JD.
   - embeddedKeywords: Mảng các từ khóa JD cụ thể đã được lồng ghép tự nhiên vào bullet viết lại.
   - metricPlaceholders: Mảng các gợi ý điền số liệu trong ngoặc vuông (VD: ["[20-25%] hiệu suất", "[Team 5 người]", "[$50K ngân sách]"]).
   - BẮT BUỘC VỀ NGÔN NGỮ CỦA BULLET VIẾT LẠI: Phần 'rewrittenBullet' BẮT BUỘC phải dùng CÙNG NGÔN NGỮ với bullet gốc / CV gốc của ứng viên.
   - TUYỆT ĐỐI KHÔNG BỊA ĐẶT hay phóng đại. Nếu bullet gốc quá thiếu thông tin để viết lại một cách thuyết phục (kể cả sau khi đọc câu trả lời bổ sung), thì ở phần rewrittenBullet hãy ghi cụm từ phù hợp với ngôn ngữ CV: "Cần bổ sung thông tin trước khi viết lại." (nếu CV Tiếng Việt) hoặc "Needs more information before rewriting." (nếu CV Tiếng Anh) và đánh dấu isLackingInfo: true.

--- TÍNH NĂNG 3: ĐÓNG VAI NHÀ TUYỂN DỤNG ĐỌC CV 10 GIÂY, ĐỐI CHIẾU TẦM VÓC & MA TRẬN HÓA GIẢI RỦI RO ---
Hãy nhập vai một Chuyên gia Tuyển dụng Cao cấp (Senior TA Lead / Hiring Manager): đọc lướt khắt khe, ưu tiên bằng chứng thực tế hơn lời tự miêu tả, KHÔNG KHEN XÃ GIAO.
Thực hiện trọn vẹn 3 khối đánh giá:
1. Quyết định Đọc Lướt 10 Giây:
   - inviteDecision: "YES" | "NO" | "MAYBE"
   - decisionReason: Lý do chính đưa ra quyết định
   - firstImpression10s: Ấn tượng trực diện trong 10 giây đầu tiên
   - immediateStrength: Điểm mạnh đập vào mắt ngay lập tức
   - biggestDoubt: Nghi ngờ lớn nhất về ứng viên
   - fastestPointLossSection: Phần trong CV khiến ứng viên bị mất điểm nhanh nhất
   - top3MustFix: Mảng 3 việc bắt buộc phải sửa ngay để tăng tỷ lệ được gọi phỏng vấn
2. Đánh Giá Tầm Vóc & Cấp Bậc (seniorityFit):
   - So sánh trực diện kỳ vọng JD vs Thực tế CV qua 4 trục:
     a. dimensionKey: "level_tenure", dimensionName: "Cấp bậc & Thâm niên thực chiến"
     b. dimensionKey: "scale_complexity", dimensionName: "Quy mô & Độ phức tạp dự án"
     c. dimensionKey: "scope_ownership", dimensionName: "Phạm vi Tự chủ & Dẫn dắt"
     d. dimensionKey: "domain_match", dimensionName: "Độ khớp Ngành nghề & Nghiệp vụ"
   - Với mỗi trục, cung cấp:
     * jdExpectation: Kỳ vọng của JD
     * cvReality: Bằng chứng thực tế thể hiện trong CV
     * assessment: "under" (Chưa tới tầm) | "match" (Đúng tầm) | "over" (Vượt tầm)
     * comment: Nhận xét sắc bén, khách quan của HR
   - overallAssessment: "under" | "match" | "over"
   - overallAssessmentLabel: "Đúng Tầm (Sweet Spot)", "Chưa Tới Tầm (Cần Bứt Phá)", hoặc "Vượt Tầm (Overqualified)"
   - summaryRationale: 1-2 câu giải thích tổng thể về tầm vóc của ứng viên so với JD
   - positioningAdvice: Lời khuyên định vị chiến lược khi giao tiếp trong phỏng vấn
3. Ma Trận Hóa Giải Rủi Ro Hồ Sơ (riskMitigationMatrix):
   - Nhận diện 2 đến 4 điểm nghi ngại / Red Flags thực tế khi HR đọc CV (ví dụ: thiếu số liệu đo lường, nhảy việc, khoảng trống thâm niên, trái ngành, hoặc hụt cấp bậc).
   - Với mỗi rủi ro, cung cấp:
     * riskType: "tenure_gap" | "job_hopping" | "domain_mismatch" | "metric_lacking" | "over_under_qualified" | "other"
     * riskTitle: Tiêu đề rủi ro ngắn gọn, súc tích (VD: "Thiếu Số Liệu & Thành Tựu Định Lượng")
     * severity: "high" (Rủi ro cao) | "medium" (Cần chú ý) | "low" (Rủi ro thấp)
     * recruiterConcern: Nỗi e ngại thực tế của HR khi xem hồ sơ
     * cvMitigation: Hướng xử lý / viết lại cụ thể ngay trên CV
     * interviewDefense: Cách giải thích khéo léo, tự tin khi Hội đồng phỏng vấn xoáy sâu

--- TÍNH NĂNG 4: CẨM NANG PHỎNG VẤN THỰC CHIẾN & KHUNG TRẢ LỜI STAR (5 ĐẾN 10 CÂU HỎI LINH HOẠT) ---
Tạo danh sách linh động từ 5 đến 10 câu hỏi phỏng vấn xoáy sâu, sát thực tế nhất giữa CV và JD mà Hội đồng tuyển dụng / Hiring Manager chắc chắn sẽ hỏi ứng viên này.
Phân chia câu hỏi thành 3 nhóm cốt lõi:
1. "Kiểm chứng khoảng trống CV": Nhắm thẳng vào các kỹ năng chưa có số liệu, kinh nghiệm chưa đủ sâu hoặc những nghi ngại/Red Flags phát hiện từ CV so với JD.
2. "Tình huống & Chuyên môn sâu": Các tình huống xử lý sự cố thực tế, bài toán kỹ thuật hóc búa, tối ưu hóa hiệu năng, hoặc lựa chọn đánh đổi kiến trúc.
3. "Tầm vóc & Cách làm việc": Các câu hỏi hành vi đánh giá giải quyết xung đột ý kiến, phối hợp liên phòng ban, khả năng thích ứng văn hóa, và kế hoạch 30-60-90 ngày đầu tiên.

Với mỗi câu hỏi, cung cấp:
- question: Câu hỏi phỏng vấn sắc bén, đúng trọng tâm.
- category: "Kiểm chứng khoảng trống CV" | "Tình huống & Chuyên môn sâu" | "Tầm vóc & Cách làm việc"
- difficulty: "Trọng tâm" | "Khó" | "Rất khó"
- sourceGapOrDoubt: Khoảng trống hoặc điểm nghi ngờ cụ thể nào trong CV dẫn đến câu hỏi này.
- interviewerIntent: Ý đồ thực sự đằng sau câu hỏi mà Nhà tuyển dụng muốn kiểm chứng.
- starAnswerGuide: Khung trả lời gợi ý theo mô hình STAR dựa trên kinh nghiệm thực tế của ứng viên:
  * situationTask: Tóm tắt bối cảnh và thách thức thực tế từ CV (Situation & Task).
  * action: Hành động cụ thể, kỹ thuật/công cụ và phương pháp giải quyết (Action).
  * result: Kết quả định lượng, giá trị kinh doanh hoặc bài học rút ra (Result).
- pitfallToAvoid: Bẫy hoặc sai lầm nguy hiểm ứng viên tuyệt đối cần tránh khi trả lời câu hỏi này.

=== QUY TẮC RÀNH RẠCH (STRICT BOUNDARIES) ===
- Tuyệt đối trung thực với dữ liệu trong CV. KHÔNG BỊA kinh nghiệm, công cụ, thành tích.
- Tránh nhồi từ khóa máy móc.
- Thiếu thông tin phải ghi rõ "Thiếu thông tin".
- Sử dụng tiếng Việt chuẩn tuyển dụng chuyên nghiệp cho các đánh giá và nhận xét. Riêng giá trị 'rewrittenBullet' BẮT BUỘC phải dùng CÙNG NGÔN NGỮ với CV gốc.
- BẮT BUỘC VỀ NGÔN NGỮ ĐÁNH GIÁ (CRITICAL LANGUAGE CONSTRAINT): Tất cả các trường giải thích, lý do, nhận xét, điểm mạnh, điểm thiếu sót, khoảng trống, nghi ngờ, tóm tắt, khuyến nghị tuyển dụng, v.v. (tất cả các thuộc tính JSON ngoại trừ 'rewrittenBullet') BẮT BUỘC phải được viết hoàn toàn bằng TIẾNG VIỆT. Tuyệt đối không pha trộn tiếng Anh hay hiển thị đồng thời cả hai ngôn ngữ. Tuy nhiên, các thuật ngữ kỹ thuật/chuyên ngành (như SLA, KPI, CAB, CMDB, tên công nghệ...) hoặc trích dẫn/bằng chứng trực tiếp từ CV gốc (CV evidence/original CV quotations) phải được giữ nguyên văn bản gốc và KHÔNG ĐƯỢC dịch hay tự điều chỉnh.
`;
}

// JSON Schema definition for GoogleGenAI structured JSON output
const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    candidateName: {
      type: Type.STRING,
      description: 'Họ và tên đầy đủ của ứng viên trích xuất từ CV',
    },
    companyName: {
      type: Type.STRING,
      description: 'Tên công ty hoặc tổ chức tuyển dụng trích xuất từ JD (để trống nếu JD không nêu tên công ty)',
    },
    jobTitle: {
      type: Type.STRING,
      description: 'Chức danh / Vị trí ứng tuyển chính xác trích xuất từ JD (không lấy từ khóa kỹ năng)',
    },
    feature1: {
      type: Type.OBJECT,
      properties: {
        jdKeywords: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
              category: { type: Type.STRING },
              importance: { type: Type.STRING },
              isMustHave: {
                type: Type.BOOLEAN,
                description: 'true nếu là tiêu chí bắt buộc (Must-Have / Knock-out), false nếu là điểm cộng (Nice-to-Have)',
              },
            },
            required: ['keyword', 'category', 'importance', 'isMustHave'],
          },
        },
        comparisonTable: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              jdTerm: { type: Type.STRING },
              importance: { type: Type.STRING },
              isMustHave: {
                type: Type.BOOLEAN,
                description: 'true nếu là tiêu chí bắt buộc (Must-Have / Knock-out), false nếu là điểm cộng (Nice-to-Have)',
              },
              cvEvidence: { type: Type.STRING },
              gapOrClarification: { type: Type.STRING },
              matchStatus: {
                type: Type.STRING,
                enum: ['khop', 'can_bo_sung', 'thieu'],
              },
              targetSection: {
                type: Type.STRING,
                description: 'Vị trí cụ thể trong CV nên chèn hoặc làm rõ (VD: Tóm tắt mở đầu, Kinh nghiệm tại công ty X, Kỹ năng chuyên môn)',
              },
              suggestedPhrasing: {
                type: Type.STRING,
                description: 'Câu văn mẫu gợi ý sát ngữ cảnh (cùng ngôn ngữ CV gốc) để ứng viên chèn vào CV đối với tiêu chí can_bo_sung hoặc thieu',
              },
            },
            required: [
              'jdTerm',
              'importance',
              'isMustHave',
              'cvEvidence',
              'gapOrClarification',
              'matchStatus',
              'targetSection',
              'suggestedPhrasing',
            ],
          },
        },
        scores: {
          type: Type.OBJECT,
          properties: {
            keywordMatchScore: { type: Type.INTEGER },
            skillMatchScore: { type: Type.INTEGER },
            experienceOutcomeScore: { type: Type.INTEGER },
            overallRoleScore: { type: Type.INTEGER },
            projectedOverallScore: {
              type: Type.INTEGER,
              description: 'Điểm phù hợp tổng thể dự kiến (0-100) nếu ứng viên tối ưu lại cách trình bày CV hiện tại theo hướng dẫn',
            },
            keywordRationale: {
              type: Type.STRING,
              description: 'Giải trình chi tiết vì sao đạt điểm khớp từ khóa này và yếu tố nào kéo điểm xuống',
            },
            skillRationale: {
              type: Type.STRING,
              description: 'Giải trình chi tiết vì sao đạt điểm khớp kỹ năng này và yếu tố nào kéo điểm xuống',
            },
            experienceRationale: {
              type: Type.STRING,
              description: 'Giải trình chi tiết vì sao đạt điểm khớp kinh nghiệm & kết quả đầu ra này',
            },
            overallRationale: {
              type: Type.STRING,
              description: 'Giải trình tổng hợp mức độ phù hợp và cơ sở tăng điểm lên projectedOverallScore',
            },
          },
          required: [
            'keywordMatchScore',
            'skillMatchScore',
            'experienceOutcomeScore',
            'overallRoleScore',
            'projectedOverallScore',
            'keywordRationale',
            'skillRationale',
            'experienceRationale',
            'overallRationale',
          ],
        },
        summary: {
          type: Type.OBJECT,
          properties: {
            biggestStrength: { type: Type.STRING },
            missingKeywordsSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            weakOrVagueSections: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            immediateActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'biggestStrength',
            'missingKeywordsSkills',
            'weakOrVagueSections',
            'immediateActions',
          ],
        },
      },
      required: ['jdKeywords', 'comparisonTable', 'scores', 'summary'],
    },
    feature2: {
      type: Type.OBJECT,
      properties: {
        clarifyingQuestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Tối đa 3 câu hỏi làm rõ ngắn gọn',
        },
        tailoredSummaries: {
          type: Type.OBJECT,
          properties: {
            technicalFocus: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                focusType: { type: Type.STRING, enum: ['technical'] },
                pitch: {
                  type: Type.STRING,
                  description: 'Đoạn tóm tắt mở đầu dài từ 50 đến 200 từ (tối đa 250 từ cho cấp Senior/Quản lý), gồm: định vị vai trò & thâm niên từ CV, năng lực kỹ thuật nổi bật khớp JD, tiêu chuẩn làm việc, và cam kết giá trị cho công ty mục tiêu. TUYỆT ĐỐI KHÔNG viết dưới 50 từ.',
                },
                keyHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['title', 'focusType', 'pitch', 'keyHighlights'],
            },
            managementFocus: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                focusType: { type: Type.STRING, enum: ['management'] },
                pitch: {
                  type: Type.STRING,
                  description: 'Đoạn tóm tắt mở đầu dài từ 50 đến 200 từ (tối đa 250 từ cho cấp Senior/Quản lý), gồm: định vị điều phối & kết nối mục tiêu kinh doanh từ CV, thành tựu quản lý tiến độ/KPI, và cam kết giá trị cho công ty mục tiêu. TUYỆT ĐỐI KHÔNG viết dưới 50 từ.',
                },
                keyHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['title', 'focusType', 'pitch', 'keyHighlights'],
            },
          },
          required: ['technicalFocus', 'managementFocus'],
        },
        sectionAudit: {
          type: Type.OBJECT,
          properties: {
            overallSectionRating: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionKey: {
                    type: Type.STRING,
                    enum: ['summary', 'experience', 'skills', 'education_ats'],
                  },
                  sectionName: { type: Type.STRING },
                  status: {
                    type: Type.STRING,
                    enum: ['tot', 'can_cai_thien', 'yeu_nghiem_trong'],
                  },
                  score: { type: Type.INTEGER },
                  comment: { type: Type.STRING },
                  actionableFix: { type: Type.STRING },
                  suggestedSnippets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '1-2 sample sentences based strictly on candidate CV info for this section. Absolutely NO fabricated facts, fake companies, or fake metrics.',
                  },
                },
                required: [
                  'sectionKey',
                  'sectionName',
                  'status',
                  'score',
                  'comment',
                  'actionableFix',
                ],
              },
            },
          },
          required: ['sections'],
        },
        rewrittenBullets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalBullet: { type: Type.STRING },
              issueInOriginal: { type: Type.STRING },
              rewrittenBullet: { type: Type.STRING },
              reasonBetter: { type: Type.STRING },
              isLackingInfo: { type: Type.BOOLEAN },
              embeddedKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              metricPlaceholders: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'originalBullet',
              'issueInOriginal',
              'rewrittenBullet',
              'reasonBetter',
            ],
          },
        },
      },
      required: ['clarifyingQuestions', 'rewrittenBullets'],
    },
    feature3: {
      type: Type.OBJECT,
      properties: {
        inviteDecision: {
          type: Type.STRING,
          enum: ['YES', 'NO', 'MAYBE'],
        },
        decisionReason: { type: Type.STRING },
        firstImpression10s: { type: Type.STRING },
        immediateStrength: { type: Type.STRING },
        biggestDoubt: { type: Type.STRING },
        fastestPointLossSection: { type: Type.STRING },
        top3MustFix: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        seniorityFit: {
          type: Type.OBJECT,
          properties: {
            overallAssessment: {
              type: Type.STRING,
              enum: ['under', 'match', 'over'],
            },
            overallAssessmentLabel: { type: Type.STRING },
            summaryRationale: { type: Type.STRING },
            positioningAdvice: { type: Type.STRING },
            dimensions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dimensionKey: {
                    type: Type.STRING,
                    enum: [
                      'level_tenure',
                      'scale_complexity',
                      'scope_ownership',
                      'domain_match',
                    ],
                  },
                  dimensionName: { type: Type.STRING },
                  jdExpectation: { type: Type.STRING },
                  cvReality: { type: Type.STRING },
                  assessment: {
                    type: Type.STRING,
                    enum: ['under', 'match', 'over'],
                  },
                  comment: { type: Type.STRING },
                },
                required: [
                  'dimensionKey',
                  'dimensionName',
                  'jdExpectation',
                  'cvReality',
                  'assessment',
                  'comment',
                ],
              },
            },
          },
          required: [
            'overallAssessment',
            'overallAssessmentLabel',
            'summaryRationale',
            'positioningAdvice',
            'dimensions',
          ],
        },
        riskMitigationMatrix: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              riskType: {
                type: Type.STRING,
                enum: [
                  'tenure_gap',
                  'job_hopping',
                  'domain_mismatch',
                  'metric_lacking',
                  'over_under_qualified',
                  'other',
                ],
              },
              riskTitle: { type: Type.STRING },
              severity: {
                type: Type.STRING,
                enum: ['high', 'medium', 'low'],
              },
              recruiterConcern: { type: Type.STRING },
              cvMitigation: { type: Type.STRING },
              interviewDefense: { type: Type.STRING },
            },
            required: [
              'riskType',
              'riskTitle',
              'severity',
              'recruiterConcern',
              'cvMitigation',
              'interviewDefense',
            ],
          },
        },
      },
      required: [
        'inviteDecision',
        'decisionReason',
        'firstImpression10s',
        'immediateStrength',
        'biggestDoubt',
        'fastestPointLossSection',
        'top3MustFix',
      ],
    },
    feature4: {
      type: Type.OBJECT,
      properties: {
        interviewPrepSummary: {
          type: Type.STRING,
          description: 'Tóm tắt chiến lược chuẩn bị phỏng vấn tổng quan',
        },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'Câu hỏi phỏng vấn thực chiến cụ thể từ HR hoặc Hiring Manager',
              },
              category: {
                type: Type.STRING,
                description: 'Nhóm câu hỏi: "Kiểm chứng khoảng trống CV", "Tình huống & Chuyên môn sâu", hoặc "Tầm vóc & Cách làm việc"',
              },
              difficulty: {
                type: Type.STRING,
                description: 'Độ khó: "Trọng tâm", "Khó", hoặc "Rất khó"',
              },
              sourceGapOrDoubt: {
                type: Type.STRING,
                description: 'Khoảng trống hoặc điểm nghi ngờ cụ thể nào trong CV dẫn đến câu hỏi này',
              },
              interviewerIntent: {
                type: Type.STRING,
                description: 'Ý đồ thực sự của Nhà tuyển dụng khi hỏi câu này',
              },
              starAnswerGuide: {
                type: Type.OBJECT,
                properties: {
                  situationTask: {
                    type: Type.STRING,
                    description: 'Tình huống & Thách thức thực tế từ CV (Situation & Task)',
                  },
                  action: {
                    type: Type.STRING,
                    description: 'Hành động cụ thể, kỹ thuật/công cụ và phương pháp giải quyết (Action)',
                  },
                  result: {
                    type: Type.STRING,
                    description: 'Kết quả định lượng, giá trị kinh doanh hoặc bài học rút ra (Result)',
                  },
                },
                required: ['situationTask', 'action', 'result'],
              },
              pitfallToAvoid: {
                type: Type.STRING,
                description: 'Sai lầm / bẫy ứng viên tuyệt đối cần tránh khi trả lời',
              },
            },
            required: [
              'question',
              'category',
              'difficulty',
              'sourceGapOrDoubt',
              'interviewerIntent',
              'starAnswerGuide',
              'pitfallToAvoid',
            ],
          },
        },
      },
      required: ['questions'],
    },
  },
  required: ['feature1', 'feature2', 'feature3', 'feature4'],
};

const generateCvResponseSchema = {
  type: Type.OBJECT,
  properties: {
    updatedCvMarkdown: { type: Type.STRING },
    summaryOfChanges: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['updatedCvMarkdown', 'summaryOfChanges'],
};

// Model A: Sequential Verification Pipeline Helpers
async function runAuditorStep(
  ai: GoogleGenAI,
  cvText: string,
  jdText: string,
  draftAnalysis: any,
  lang: 'vi' | 'en' = 'vi'
): Promise<{ auditFeedback: string; usedOpenAi: boolean; auditorProvider?: string }> {
  const isEn = lang === 'en';

  const auditorPrompt = `You are a Senior Resume Auditor & Quality Control Specialist (Role: Quality Assurance Auditor).
Your task is to critically audit Gemini's Step 1 Draft Analysis of a Candidate's CV vs Job Description (JD).

=== INPUT DATA ===
1. JOB DESCRIPTION (JD):
${jdText}

2. CANDIDATE'S CV:
${cvText}

3. GEMINI'S STEP 1 DRAFT ANALYSIS:
${JSON.stringify(draftAnalysis, null, 2)}

=== YOUR AUDIT & QUALITY CONTROL MISSION ===
Compare the candidate CV, JD, and Gemini's draft analysis.
Identify:
1. Missing JD keywords or critical technical skills that Gemini overlooked or under-scored in the draft, and verify whether mandatory (Must-Have / Knock-out) vs bonus (Nice-to-Have) flags ('isMustHave') are accurate.
2. Inaccuracies or weak points in Gemini's comparison table ('targetSection', 'suggestedPhrasing') or score estimates ('projectedOverallScore', 'keywordRationale', 'skillRationale', 'experienceRationale', 'overallRationale').
3. Unaddressed candidate strengths or recruitment doubts in the 10-second scan.
4. Suggestions to refine rewritten bullet points for higher impact and strict accuracy.
5. Specific corrections needed for immediate actions.

Write a clear, structured auditor critique.
CRITICAL LANGUAGE CONSTRAINT: The critique MUST be written entirely in ${isEn ? 'English' : 'Vietnamese'}. Under no circumstances should you mix languages or translate technical terms/CV evidence verbatim.`;

  // 1. First attempt: OpenRouter API (if OPENROUTER_API_KEY is configured)
  const openRouterApiKey = (process.env.OPENROUTER_API_KEY || (process.env.OPENAI_API_KEY?.startsWith('sk-or-') ? process.env.OPENAI_API_KEY : '')).trim();

  if (openRouterApiKey && openRouterApiKey.length > 5) {
    const openRouterModels = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'openrouter/auto',
      'google/gemini-2.0-flash-exp:free',
      'openrouter/free',
      'nvidia/nemotron-3-ultra-550b-a55b:free'
    ];

    // Helper function to fetch with a strict timeout
    const fetchWithTimeout = async (url: string, options: any, timeoutMs = 4000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    for (const openRouterModel of openRouterModels) {
      try {
        console.log(`[Model A Step 2] Calling OpenRouter API Auditor (${openRouterModel}) with 4s timeout...`);
        const openRouterRes = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': process.env.APP_URL || 'https://ai.studio',
            'X-Title': 'CV Auditor'
          },
          body: JSON.stringify({
            model: openRouterModel,
            messages: [
              { role: 'system', content: 'You are an elite Resume & JD Quality Assurance Auditor.' },
              { role: 'user', content: auditorPrompt }
            ],
            max_tokens: 1200,
            temperature: 0.3,
          }),
        }, 4000);

        if (openRouterRes.ok) {
          const data = await openRouterRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[Model A Step 2] OpenRouter Auditor (${openRouterModel}) returned feedback successfully.`);
            return { auditFeedback: content, usedOpenAi: true, auditorProvider: `OpenRouter (${openRouterModel})` };
          }
        } else {
          const errText = await openRouterRes.text();
          console.info(`[Model A Step 2] OpenRouter API (${openRouterModel}) returned status ${openRouterRes.status}, trying next model...`);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn(`[Model A Step 2] OpenRouter model (${openRouterModel}) request timed out (exceeded 4s), trying next model...`);
        } else {
          console.info(`[Model A Step 2] Error calling OpenRouter model (${openRouterModel}), trying next model...`);
        }
      }
    }
    console.info('[Model A Step 2] OpenRouter models busy/exhausted, falling back to Gemini Auditor.');
  }

  // 2. Second attempt: Fallback to Gemini Auditor
  console.log('[Model A Step 2] Calling Gemini Auditor for Quality Control review...');
  try {
    const auditorResponse = await callGeminiWithRetry(ai, {
      contents: auditorPrompt,
    });
    return {
      auditFeedback: auditorResponse.text || (isEn ? 'Auditor review completed.' : 'Đã hoàn tất đánh giá phản biện từ Auditor.'),
      usedOpenAi: false,
      auditorProvider: 'Gemini Auditor'
    };
  } catch (e) {
    return {
      auditFeedback: isEn ? 'Auditor review completed.' : 'Đã hoàn tất kiểm định chất lượng.',
      usedOpenAi: false,
      auditorProvider: 'Gemini Auditor'
    };
  }
}

async function runSynthesizerStep(
  ai: GoogleGenAI,
  cvText: string,
  jdText: string,
  draftAnalysis: any,
  auditFeedback: string,
  clarifyingAnswers?: string,
  lang: 'vi' | 'en' = 'vi'
) {
  const isEn = lang === 'en';
  const synthesizerPrompt = `
You are the Executive Synthesizer AI (Step 3 in Model A: Sequential Verification - Draft ➔ Review ➔ Synthesize).

=== INPUT DATA ===
1. JOB DESCRIPTION (JD):
${jdText}

2. CANDIDATE'S CV:
${cvText}

${clarifyingAnswers ? `3. CANDIDATE'S CLARIFYING ANSWERS:\n${clarifyingAnswers}\n` : ''}

4. STEP 1 DRAFT ANALYSIS:
${JSON.stringify(draftAnalysis, null, 2)}

5. STEP 2 AUDITOR CRITIQUE & REVIEW (ChatGPT / Quality Checker):
${auditFeedback}

=== FINAL SYNTHESIS TASK ===
Incorporate ALL valid auditor corrections and improvements from Step 2 into the Step 1 Draft Analysis.
Specifically:
- Ensure missing JD keywords identified by the auditor are added to the comparison table and keyword extraction with accurate 'isMustHave' classification (true = Must-Have / Knock-out, false = Nice-to-Have).
- Ensure every row in 'comparisonTable' with 'matchStatus' of 'can_bo_sung' or 'thieu' includes a concrete 'targetSection' and a ready-to-use 'suggestedPhrasing' (in the same language as the candidate's CV).
- Adjust compatibility scores ('overallRoleScore', 'projectedOverallScore', and all 4 score rationales: 'keywordRationale', 'skillRationale', 'experienceRationale', 'overallRationale') to be realistic, transparent, and well-justified based on the auditor's critique.
- Refine rewritten bullet points to strictly follow the action formula (concise and complete, Action + Tool + Result).
- CRITICAL LANGUAGE MATCHING RULE FOR REWRITTEN BULLETS: Every 'rewrittenBullet' in Feature 2 MUST be written in the SAME LANGUAGE as the candidate's original CV bullet point (e.g. English CV ➔ English 'rewrittenBullet'; Vietnamese CV ➔ Vietnamese 'rewrittenBullet'). Do NOT translate candidate bullets to a different language!
- Ensure the 10-second recruiter scan reflects the auditor's findings.

Return the final synthesized JSON matching the exact output schema.
CRITICAL LANGUAGE CONSTRAINT: Write all output explanations, reasons, gaps, and text fields strictly in ${isEn ? 'ENGLISH' : 'VIETNAMESE'}. Under no circumstances should any explanations or comments be in a different language. However, each 'rewrittenBullet' MUST match the language of the candidate's original CV bullet point. Original CV quotations and technical terms (e.g. SLA, KPI, CAB, CMDB, etc.) must remain verbatim and untranslated.
`;

  const response = await callGeminiWithRetry(ai, {
    contents: synthesizerPrompt,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: analysisResponseSchema,
    },
  });

  const responseText = response.text;
  if (!responseText) throw new Error('No text returned from Synthesizer AI.');
  return parseJsonSafely(responseText);
}

// API Endpoint for Analyzing CV against JD
app.post('/api/analyze-cv', async (req, res) => {
  const startTime = Date.now();
  try {
    const { cvText: rawCvText, jdText: rawJdText, clarifyingAnswers, lang = 'vi' } = req.body;

    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: lang === 'en' ? 'Please log in.' : 'Vui lòng đăng nhập.' });
    }

    if (!rawCvText || !rawCvText.trim() || !rawJdText || !rawJdText.trim()) {
      return res.status(400).json({
        error: lang === 'en'
          ? 'Please provide both CV and Job Description (JD) text.'
          : 'Vui lòng cung cấp đầy đủ nội dung CV và Mô tả công việc (JD).',
      });
    }

    const requestId = (req.body?.requestId as string)?.trim() || (req.headers['x-request-id'] as string)?.trim() || `req_cand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const quotaRes = await reserveAiQuota(db, {
        user,
        units: 1,
        source: 'candidate',
        requestId
      });
      if (!quotaRes.allowed) {
        return res.status(429).json({
          success: false,
          code: 'DAILY_AI_LIMIT_EXCEEDED',
          dailyLimit: quotaRes.dailyLimit,
          used: quotaRes.usedBefore,
          requested: 1,
          remaining: quotaRes.remaining,
          resetAt: quotaRes.resetAt
        });
      }
    } catch (err: any) {
      console.error('[Analyze CV API Error] Unhandled error:', err);
      if (err.message === 'QUOTA_SERVICE_UNAVAILABLE') {
        return res.status(503).json({ success: false, code: 'QUOTA_SERVICE_UNAVAILABLE', error: lang === 'en' ? 'Quota service unavailable.' : 'Dịch vụ kiểm soát lượt tạm thời không khả dụng.' });
      }
      return res.status(500).json({ success: false, error: lang === 'en' ? 'An internal server error occurred.' : 'Đã có lỗi xảy ra trên máy chủ.' });
    }


    const cvText = cleanAndStructureExtractedText(rawCvText);
    const jdText = cleanAndStructureExtractedText(rawJdText);

    if (isInputOversized(cvText, jdText)) {
      return res.status(400).json({
        error: lang === 'en'
          ? 'Input text exceeds maximum allowed length (100,000 characters).'
          : 'Nội dung CV hoặc JD quá dài (vượt quá 100,000 ký tự). Vui lòng cắt bớt.',
      });
    }

    const cacheKey = getHashKey({ cvText, jdText, clarifyingAnswers, lang, analysisPromptVersion: 'phase1-step1.2-v2' });
    if (analyzeCache.has(cacheKey)) {
      console.log('[Cache Hit] Returning cached analysis response.');
      const cachedResult = analyzeCache.get(cacheKey);
      if (cachedResult) {
        cachedResult.outputLanguage = lang;
      }
      return res.json(cachedResult);
    }

    try {
      const ai = getGeminiClient();
      const isEn = lang === 'en';

      const step1Start = Date.now();
      console.log('[Model A Pipeline] Starting Step 1: Draft Analysis (Gemini)...');
      const draftPromptText = buildPrompt(cvText, jdText, clarifyingAnswers, lang as 'vi' | 'en');

      const draftResponse = await callGeminiWithRetry(ai, {
        contents: draftPromptText,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: analysisResponseSchema,
        },
      });

      const draftText = draftResponse.text;
      if (!draftText) {
        throw new Error(isEn ? 'No response received from Step 1 AI model.' : 'Không nhận được phản hồi từ mô hình AI ở Bước 1.');
      }

      const draftAnalysis = parseJsonSafely(draftText);
      const step1DurationMs = Date.now() - step1Start;

      const step2Start = Date.now();
      console.log('[Model A Pipeline] Starting Step 2: Auditor Quality Check (Gemini Auditor)...');
      const { auditFeedback, usedOpenAi, auditorProvider } = await runAuditorStep(
        ai,
        cvText,
        jdText,
        draftAnalysis,
        lang as 'vi' | 'en'
      );
      const step2DurationMs = Date.now() - step2Start;

      const step3Start = Date.now();
      console.log('[Model A Pipeline] Starting Step 3: Synthesis & Refinement (Gemini Synthesizer)...');
      let finalResult: any;
      try {
        finalResult = await runSynthesizerStep(
          ai,
          cvText,
          jdText,
          draftAnalysis,
          auditFeedback,
          clarifyingAnswers,
          lang as 'vi' | 'en'
        );
      } catch (synthErr) {
        console.warn('[Model A Pipeline] Synthesizer error, falling back to draft + audit log:', synthErr);
        finalResult = draftAnalysis;
      }
      const step3DurationMs = Date.now() - step3Start;

      // Attach Model A Sequential Verification Metadata
      finalResult.pipelineMetadata = {
        modelPattern: 'Mô hình A: Sequential Verification (Tạo bản nháp ➔ Review ➔ Hoàn thiện)',
        steps: [
          {
            step: 1,
            name: isEn ? 'Draft Analysis' : 'Bước 1: Phân tích bản nháp (Draft Analysis)',
            provider: 'Gemini 2.0 Flash',
            status: 'completed',
            durationMs: step1DurationMs,
            details: isEn ? 'Initial CV & JD keyword extraction & scoring' : 'Bóc tách từ khóa JD & trích xuất kinh nghiệm CV'
          },
          {
            step: 2,
            name: isEn ? 'Auditor Quality Check' : 'Bước 2: Phản biện chất lượng (Auditor Check)',
            provider: auditorProvider || (usedOpenAi ? 'OpenRouter Auditor' : 'Gemini 2.0 Auditor'),
            status: 'completed',
            durationMs: step2DurationMs,
            details: usedOpenAi
              ? (isEn ? `Audited using ${auditorProvider || 'OpenRouter API'}` : `Đã phản biện bằng ${auditorProvider || 'OpenRouter API'}`)
              : (isEn ? 'Audited using Gemini Quality Checker' : 'Rà soát tính chính xác & kiểm tra hallucination')
          },
          {
            step: 3,
            name: isEn ? 'Synthesizer & Refinement' : 'Bước 3: Tổng hợp & Tối ưu (Synthesizer)',
            provider: 'Gemini 2.0 Flash Synthesizer',
            status: 'completed',
            durationMs: step3DurationMs,
            details: isEn ? 'Final report synthesized with auditor feedback' : 'Tổng hợp báo cáo hoàn chỉnh & tạo đề xuất viết lại'
          }
        ],
        auditorFeedback: auditFeedback,
        usedOpenAiKey: usedOpenAi
      };

      finalResult.outputLanguage = lang;
      analyzeCache.set(cacheKey, finalResult);

      let logResult: { success: boolean; recordId: string; error?: string; item?: AnalysisRecordItem } | null = null;
      const reqRequestId = (req.body?.requestId as string)?.trim() || `req_cand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cvFileNameVal = req.body?.cvFileName || 'CV_Ứng_Viên.pdf';

      try {
        const currentUser = getUserFromRequest(req);
        const overallScore = finalResult.feature1?.scores?.overallRoleScore || 75;
        let matchLevel: 'XUAT_SAC' | 'TOT' | 'TRUNG_BINH' | 'CAN_CAI_THIEN' = 'TRUNG_BINH';
        if (overallScore >= 85) matchLevel = 'XUAT_SAC';
        else if (overallScore >= 70) matchLevel = 'TOT';
        else if (overallScore >= 50) matchLevel = 'TRUNG_BINH';
        else matchLevel = 'CAN_CAI_THIEN';

        const userEmailVal = currentUser ? currentUser.username : 'user_guest';
        const candNameVal = req.body?.candidateName || userEmailVal;
        const aiCompanyVal = typeof finalResult.companyName === 'string' ? finalResult.companyName.trim() : '';
        const aiRoleVal = typeof finalResult.jobTitle === 'string' ? finalResult.jobTitle.trim() : '';
        const rawTitleVal = req.body?.jobTitle
          || (aiCompanyVal && aiRoleVal ? `${aiCompanyVal} - ${aiRoleVal}` : (aiRoleVal || aiCompanyVal || 'Vị trí ứng tuyển'));
        const formattedJobTitle = rawTitleVal;

        logResult = await createAnalysisRecord({
          requestId: reqRequestId,
          source: 'candidate',
          userEmail: currentUser?.email || (userEmailVal.includes('@') ? userEmailVal : `${userEmailVal}@system.local`),
          actorUsername: userEmailVal,
          createdBy: userEmailVal,
          candidateName: candNameVal,
          fileName: cvFileNameVal,
          cvFileName: cvFileNameVal,
          jobTitle: formattedJobTitle,
          status: 'COMPLETED',
          overallScore,
          keywordScore: finalResult.feature1?.scores?.keywordMatchScore ?? null,
          experienceScore: finalResult.feature1?.scores?.experienceOutcomeScore ?? null,
          skillsScore: finalResult.feature1?.scores?.skillMatchScore ?? null,
          matchLevel,
          topStrengths: [
            finalResult.feature1?.summary?.biggestStrength || '',
            finalResult.feature3?.immediateStrength || '',
          ].filter(Boolean),
          missingSkills: finalResult.feature1?.summary?.missingKeywordsSkills || [],
          recommendation: finalResult.feature3?.firstImpression10s || finalResult.shortRecommendation || '',
          recruiterDecision: finalResult.feature3?.inviteDecision || 'MAYBE',
          engineUsed: usedOpenAi ? 'Gemini 2.0 + OpenRouter Auditor' : 'Gemini 2.0 Flash Sequential Pipeline',
          durationMs: Date.now() - startTime,
          cvTextLength: cvText.length,
          jdTextLength: jdText.length,
          fullAnalysis: finalResult,
        });

        if (!logResult.success) {
          const sanitizedErr = (logResult.error || 'Unknown persistence error').replace(/(api[_-]?key|token|password|secret)=[^&\s]+/gi, '$1=***');
          console.error(
            `[Candidate Analysis Audit Failed] requestId=${reqRequestId}, source=candidate, file=${cvFileNameVal}, error=${sanitizedErr}`
          );
        }
      } catch (recErr: any) {
        const rawErrMsg = recErr?.message || String(recErr);
        const sanitizedErr = rawErrMsg.replace(/(api[_-]?key|token|password|secret)=[^&\s]+/gi, '$1=***');
        console.error(
          `[Candidate Analysis Audit Error] requestId=${reqRequestId}, source=candidate, file=${cvFileNameVal}, error=${sanitizedErr}`
        );
      }

      const auditMeta = buildCandidateAuditMetadata(logResult, reqRequestId);

      return res.json({
        ...finalResult,
        audit: auditMeta,
      });
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === 'string' ? err : 'Quota or AI rate limit reached');
      console.info('API /api/analyze-cv AI models busy/quota limit, triggering fallback engine:', errMsg);

      console.log('[Fallback Engine] Triggered instant analysis fallback to guarantee response.');
      const fallbackResult = createFallbackAnalysis(cvText, jdText, (lang || 'vi') as 'vi' | 'en');
      analyzeCache.set(cacheKey, fallbackResult);

      let fbLogResult: { success: boolean; recordId: string; error?: string; item?: AnalysisRecordItem } | null = null;
      const reqRequestIdFb = (req.body?.requestId as string)?.trim() || `req_cand_fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cvFileNameFb = req.body?.cvFileName || 'CV_Uploaded.pdf';

      try {
        const currentUser = getUserFromRequest(req);
        const overallScore = fallbackResult.feature1?.scores?.overallRoleScore || 65;
        let matchLevel: 'XUAT_SAC' | 'TOT' | 'TRUNG_BINH' | 'CAN_CAI_THIEN' = 'TRUNG_BINH';
        if (overallScore >= 85) matchLevel = 'XUAT_SAC';
        else if (overallScore >= 70) matchLevel = 'TOT';
        else if (overallScore >= 50) matchLevel = 'TRUNG_BINH';
        else matchLevel = 'CAN_CAI_THIEN';

        const userEmailFb = currentUser ? currentUser.username : 'user_guest';
        const candNameFb = req.body?.candidateName || userEmailFb;
        const rawTitleFb = req.body?.jobTitle || 'Vị trí công việc (Fallback)';
        const formattedJobTitleFb = rawTitleFb.toLowerCase().includes(`- ${candNameFb.toLowerCase()}`)
          ? rawTitleFb
          : `${rawTitleFb} - ${candNameFb}`;

        fbLogResult = await createAnalysisRecord({
          requestId: reqRequestIdFb,
          source: 'candidate',
          userEmail: currentUser?.email || (userEmailFb.includes('@') ? userEmailFb : `${userEmailFb}@system.local`),
          actorUsername: userEmailFb,
          createdBy: userEmailFb,
          candidateName: candNameFb,
          fileName: cvFileNameFb,
          cvFileName: cvFileNameFb,
          jobTitle: formattedJobTitleFb,
          status: 'COMPLETED',
          overallScore,
          keywordScore: fallbackResult.feature1?.scores?.keywordMatchScore ?? null,
          experienceScore: fallbackResult.feature1?.scores?.experienceOutcomeScore ?? null,
          skillsScore: fallbackResult.feature1?.scores?.skillMatchScore ?? null,
          matchLevel,
          topStrengths: [fallbackResult.feature1?.summary?.biggestStrength || ''].filter(Boolean),
          missingSkills: fallbackResult.feature1?.summary?.missingKeywordsSkills || [],
          recommendation: fallbackResult.feature3?.firstImpression10s || (fallbackResult as any).shortRecommendation || '',
          recruiterDecision: fallbackResult.feature3?.inviteDecision || 'MAYBE',
          engineUsed: 'Fallback Local Heuristic Engine',
          durationMs: Date.now() - startTime,
          cvTextLength: cvText.length,
          jdTextLength: jdText.length,
          fullAnalysis: fallbackResult,
        });

        if (!fbLogResult.success) {
          const sanitizedErr = (fbLogResult.error || 'Unknown persistence error').replace(/(api[_-]?key|token|password|secret)=[^&\s]+/gi, '$1=***');
          console.error(
            `[Candidate Fallback Analysis Audit Failed] requestId=${reqRequestIdFb}, source=candidate, file=${cvFileNameFb}, error=${sanitizedErr}`
          );
        }
      } catch (recErr: any) {
        const rawErrMsg = recErr?.message || String(recErr);
        const sanitizedErr = rawErrMsg.replace(/(api[_-]?key|token|password|secret)=[^&\s]+/gi, '$1=***');
        console.error(
          `[Candidate Fallback Analysis Audit Error] requestId=${reqRequestIdFb}, source=candidate, file=${cvFileNameFb}, error=${sanitizedErr}`
        );
      }

      const fbAuditMeta = buildCandidateAuditMetadata(fbLogResult, reqRequestIdFb);

      return res.json({
        ...fallbackResult,
        audit: fbAuditMeta,
      });
    }
  } catch (err: any) {
    console.error('API /api/analyze-cv Error:', err);
    // Fallback safeguard
    try {
      const fallbackResult = createFallbackAnalysis(req.body?.cvText || '', req.body?.jdText || '', (req.body?.lang || 'vi') as 'vi' | 'en');
      const errRequestId = (req.body?.requestId as string)?.trim() || `req_cand_err_${Date.now()}`;
      return res.json({
        ...fallbackResult,
        audit: buildCandidateAuditMetadata(null, errRequestId),
      });
    } catch {
      return res.status(500).json({
        error: formatGeminiError(err, (req.body?.lang || 'vi') as 'vi' | 'en'),
      });
    }
  }
});

// API Endpoint for Generating Updated CV based on Section 6 recommendations
app.post('/api/generate-updated-cv', async (req, res) => {
  try {
    const { cvText, jdText, analysis, customInstruction, lang = 'vi' } = req.body;

    if (!cvText || !cvText.trim() || !jdText || !jdText.trim()) {
      return res.status(400).json({
        error: lang === 'en'
          ? 'Please provide complete original CV and JD text.'
          : 'Vui lòng cung cấp đầy đủ thông tin CV gốc và JD.',
      });
    }

    const safeCustomInstruction = (customInstruction || '').slice(0, 2000).trim();

    if (isInputOversized(cvText, jdText, safeCustomInstruction)) {
      return res.status(400).json({
        error: lang === 'en'
          ? 'Input text exceeds maximum allowed length (100,000 characters).'
          : 'Nội dung CV hoặc JD quá dài (vượt quá 100,000 ký tự). Vui lòng cắt bớt.',
      });
    }

    const cacheKey = getHashKey({ cvText, jdText, customInstruction, lang, analysisPromptVersion: 'language-consistency-v3' });
    if (updatedCvCache.has(cacheKey)) {
      console.log('[Cache Hit] Returning cached updated CV response.');
      return res.json(updatedCvCache.get(cacheKey));
    }

    try {
      const ai = getGeminiClient();
      const isEn = lang === 'en';

      const promptText = `
${isEn ? 'You are a Senior Talent Acquisition Lead & Executive Resume Optimizer.' : 'Bạn là Senior HR Lead & Chuyên gia Tối ưu CV Hàng đầu.'}
${isEn ? 'Your mission: Rewrite and update the complete candidate CV, applying all bullet point optimizations, integrating missing JD keywords, and addressing recruiter concerns.' : 'Nhiệm vụ của bạn: Viết lại và cập nhật HOÀN CHỈNH bản CV của ứng viên, ứng dụng toàn bộ các đề xuất tối ưu hóa (Bảng Viết Lại Bullet Points), kết hợp từ khóa JD còn thiếu, và khắc phục những nghi ngờ của nhà tuyển dụng.'}

=== ${isEn ? 'ORIGINAL CANDIDATE CV' : 'CV GỐC CỦA ỨNG VIÊN'} ===
${cvText}

=== ${isEn ? 'JOB DESCRIPTION (JD)' : 'MÔ TẢ CÔNG VIỆC (JD)'} ===
${jdText}

=== ${isEn ? 'ANALYSIS RESULT & REWRITTEN BULLETS' : 'KẾT QUẢ PHÂN TÍCH & ĐỀ XUẤT VIẾT LẠI BULLET POINTS'} ===
${JSON.stringify(analysis || {}, null, 2)}

${customInstruction ? `=== ${isEn ? 'ADDITIONAL CANDIDATE INSTRUCTIONS' : 'YÊU CẦU ĐIỀU CHỈNH BỔ SUNG TỪ ỨNG VIÊN'} ===\n${customInstruction}\n` : ''}

=== ${isEn ? 'OUTPUT REQUIREMENTS' : 'YÊU CẦU ĐẦU RA'} ===
${isEn ? `Generate a complete CV adhering to these standards:
1. Maintain the SAME PRIMARY LANGUAGE as the original candidate CV (English CV ➔ English updated CV, Vietnamese CV ➔ Vietnamese updated CV). Do not translate unless explicitly requested in additional instructions.
2. Ensure clean, professional, concise Markdown layout:
   - # NAME & TARGET POSITION
   - ## CONTACT INFORMATION
   - ## EXECUTIVE SUMMARY (Optimized for 10s recruiter scan)
   - ## PROFESSIONAL EXPERIENCE (Replace old bullets with rewritten bullets in the SAME LANGUAGE as the original CV, concise & complete, Action + Tool + Result)
   - ## TECHNICAL SKILLS & CORE COMPETENCIES (Seamlessly incorporating missing JD keywords)
   - ## EDUCATION & CERTIFICATIONS / PROJECTS
3. Absolute HONESTY: Do not invent false companies or metrics.
4. Output summaryOfChanges array containing 4-6 bullet lines summarizing key improvements made to this new CV.` : `Hãy tạo lại một CV hoàn chỉnh theo đúng các tiêu chuẩn sau:
1. BẮT BUỘC GIỮ NGUYÊN NGÔN NGỮ CỦA CV GỐC: Nếu CV gốc bằng Tiếng Anh, bản CV cập nhật BẮT BUỘC phải viết bằng Tiếng Anh; nếu CV gốc bằng Tiếng Việt thì viết bằng Tiếng Việt (trừ khi ứng viên yêu cầu chuyển đổi ngôn ngữ trong phần Yêu cầu bổ sung).
2. Đảm bảo cấu trúc Markdown rõ ràng, chuyên nghiệp, súc tích:
   - # HỌ VÀ TÊN & VỊ TRÍ ỨNG TUYỂN
   - ## THÔNG TIN LIÊN HỆ
   - ## TÓM TẮT NĂNG LỰC / MỤC TIÊU NGHỀ NGHIỆP (Tối ưu ấn tượng đầu tiên trong 10s)
   - ## KINH NGHIỆM LÀM VIỆC (Thay toàn bộ các bullet point cũ bằng các bullet point mới được viết lại CÙNG NGÔN NGỮ với CV gốc, ưu tiên ngắn gọn và đầy đủ Hành động + Công cụ + Kết quả)
   - ## KỸ NĂNG CHUYÊN MÔN & CÔNG CỤ (Tự động lồng ghép các từ khóa JD còn thiếu)
   - ## HỌC VẤN & CHỨNG CHỈ / DỰ ÁN
3. Tuyệt đối TRUNG THỰC: Không tự bịa đặt công ty hay số liệu vô lý.
4. Tạo ra danh sách summaryOfChanges gồm 4-6 dòng tóm tắt các điểm cải tiến cốt lõi đã được áp dụng vào bản CV mới này.`}
`;

      const response = await callGeminiWithRetry(ai, {
        contents: promptText,
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: generateCvResponseSchema,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error(isEn ? 'No response received from AI.' : 'Không nhận được phản hồi từ AI.');
      }

      const result = parseJsonSafely(responseText);
      updatedCvCache.set(cacheKey, result);
      return res.json(result);
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === 'string' ? err : 'Quota or AI rate limit reached');
      console.info('API /api/generate-updated-cv AI models busy/quota limit, triggering fallback engine:', errMsg);

      console.log('[Fallback Engine] Triggered instant updated CV fallback.');
      const fallbackResult = createFallbackUpdatedCv(cvText, customInstruction, (lang || 'vi') as 'vi' | 'en');
      updatedCvCache.set(cacheKey, fallbackResult);
      return res.json(fallbackResult);
    }
  } catch (err: any) {
    console.error('API /api/generate-updated-cv Error:', err);
    try {
      const fallbackResult = createFallbackUpdatedCv(req.body?.cvText || '', req.body?.customInstruction, (req.body?.lang || 'vi') as 'vi' | 'en');
      return res.json(fallbackResult);
    } catch {
      return res.status(500).json({
        error: formatGeminiError(err, (req.body?.lang || 'vi') as 'vi' | 'en'),
      });
    }
  }
});

// API Endpoint to test OpenRouter API connection
app.post('/api/test-openrouter', async (req, res) => {
  try {
    const providedKey = req.body?.apiKey;
    const apiKey = (providedKey || process.env.OPENROUTER_API_KEY || (process.env.OPENAI_API_KEY?.startsWith('sk-or-') ? process.env.OPENAI_API_KEY : '')).trim();

    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        error: 'Chưa cấu hình OPENROUTER_API_KEY. Vui lòng thêm OPENROUTER_API_KEY vào tệp .env hoặc Secrets.',
      });
    }

    console.log('[OpenRouter Test] Checking API connection to OpenRouter...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'https://ai.studio',
        'X-Title': 'CV Auditor Connection Check'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'OK';
      return res.json({
        ok: true,
        message: 'Kết nối API tới OpenRouter thành công',
        model: data.model || 'openrouter/auto',
        reply: reply.trim()
      });
    } else {
      const errText = await response.text();
      let parsedErr: any;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        parsedErr = errText;
      }
      return res.status(response.status).json({
        ok: false,
        error: `OpenRouter trả về lỗi HTTP ${response.status}`,
        details: parsedErr?.error?.message || parsedErr?.message || parsedErr
      });
    }
  } catch (err: any) {
    console.error('OpenRouter Test Connection Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Lỗi hệ thống khi kết nối tới OpenRouter API.',
      details: err?.message || String(err)
    });
  }
});

// API Endpoint to test OpenAI Direct API connection
app.post('/api/test-openai', async (req, res) => {
  try {
    const providedKey = req.body?.apiKey;
    const apiKey = (providedKey || process.env.OPENAI_API_KEY || (process.env.OPENROUTER_API_KEY?.startsWith('sk-proj-') ? process.env.OPENROUTER_API_KEY : '') || '').trim();

    if (!apiKey) {
      return res.status(400).json({
        ok: false,
        error: 'Chưa cấu hình OPENAI_API_KEY. Vui lòng thêm OPENAI_API_KEY vào tệp .env hoặc Secrets.',
      });
    }

    console.log('[OpenAI Test] Checking API connection to OpenAI Direct API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'OK';
      return res.json({
        ok: true,
        message: 'Kết nối API tới OpenAI Direct thành công',
        model: data.model || 'gpt-4o-mini',
        reply: reply.trim()
      });
    } else {
      const errText = await response.text();
      let parsedErr: any;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        parsedErr = errText;
      }
      return res.status(response.status).json({
        ok: false,
        error: `OpenAI trả về lỗi HTTP ${response.status}`,
        details: parsedErr?.error?.message || parsedErr?.message || parsedErr
      });
    }
  } catch (err: any) {
    console.error('OpenAI Test Connection Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Lỗi hệ thống khi kết nối tới OpenAI API.',
      details: err?.message || String(err)
    });
  }
});

// API 404 handler (prevents unmatched /api requests from falling through to Vite's index.html fallback)
app.all('/api/*', (req, res, next) => {
  if (res.headersSent) return next();
  const reqId = (req.headers['x-request-id'] as string) || (req.body?.requestId as string) || undefined;
  res.status(404).json({
    success: false,
    code: 'API_NOT_FOUND',
    error: `API route ${req.method} ${req.path} not found.`,
    requestId: reqId
  });
});

// Global API error handler (ensures JSON responses for /api/* errors)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.path.startsWith('/api') && !req.xhr && !req.headers.accept?.includes('json')) {
    return next(err);
  }
  console.error('[Global Express Error Handler]', err);
  recordLog({
    source: 'server',
    level: 'error',
    message: err?.message || 'Server API Error',
    details: err?.stack || String(err),
    endpoint: req.originalUrl || req.path,
  });
  const status = err.status || err.statusCode || 500;
  const isMulter = err instanceof multer.MulterError || err?.name === 'MulterError';
  const code = isMulter ? 'FILE_UPLOAD_ERROR' : 'INTERNAL_API_ERROR';
  const message = typeof err.message === 'string' ? err.message : 'An internal server error occurred.';
  const reqId = (req.headers['x-request-id'] as string) || (req.body?.requestId as string) || undefined;

  res.status(status).json({
    success: false,
    code,
    error: message,
    requestId: reqId
  });
});

// Explicit JSON 404 handler for API routes (prevents falling through to Vite HTML SPA handler)
app.all('/api/*', (_req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    error: 'API endpoint not found'
  });
});

// Vite & Express server bootstrap
async function startServer() {
  // Load local file-backed baseline first
  loadAllDataFromFiles();

  const distPath = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production') {
    console.log(`[Server] Serving production static files from: ${distPath}`);
    app.use(express.static(distPath, { maxAge: '1d' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application build not found.');
      }
    });
  } else {
    console.log('[Server] Mounting Vite dev middleware...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error('[Server] Failed to initialize Vite dev server, falling back to static dist if available:', err);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  }

  // Bind to port 3000 immediately so Cloud Run ingress & health checks pass right away
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] App server running on http://0.0.0.0:${PORT}`);

    // Asynchronously synchronize from Firestore after server port is bound and active
    syncFromFirestore().catch((err) => {
      console.error('[Server] Background Firestore sync error on startup:', err);
    });
  });
}

export { app, startServer };

function isDirectExecution(): boolean {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return false;
  }
  const entry = process.argv[1];
  if (!entry) return false;
  return (
    entry.endsWith('server.ts') ||
    entry.endsWith('server.js') ||
    entry.endsWith('server.cjs') ||
    entry.includes('dist/server')
  );
}

if (isDirectExecution()) {
  startServer();
}
