import path from 'path';
import fs from 'fs';
import express from 'express';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { StoredUser } from '../types';
import { getFirestoreDb } from '../config/firebase';

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

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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

export async function loadUsersAsync(): Promise<StoredUser[]> {
  const db = getFirestoreDb();
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

  const db = getFirestoreDb();
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

const JWT_SECRET = process.env.JWT_SECRET || 'rolematch-secure-jwt-secret-key-2026';

export function generateToken(user: StoredUser): string {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `rmt_${base64}`;
}

export function verifyToken(token: string): StoredUser | null {
  try {
    if (!token || !token.startsWith('rmt_')) return null;
    const base64 = token.replace('rmt_', '');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonStr);
    if (!payload.id || !payload.username || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;

    const users = loadUsers();
    const user = users.find(u => u.id === payload.id && u.username.toLowerCase() === payload.username.toLowerCase());
    return user || null;
  } catch {
    return null;
  }
}

export interface ActiveSessionData {
  userId: string;
  username: string;
  role: 'admin' | 'normal';
  loginTime: string;
  lastActive: string;
  ipAddress?: string;
  userAgent?: string;
}

export const activeSessions = new Map<string, ActiveSessionData>();
export const SESSION_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes inactivity timeout

export function getActiveSessionForUsername(username: string): { token: string; session: ActiveSessionData } | null {
  const lowerUser = username.toLowerCase();
  for (const [token, session] of activeSessions.entries()) {
    if (session.username.toLowerCase() === lowerUser) {
      return { token, session };
    }
  }
  return null;
}

export function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Không tìm thấy Access Token. Vui lòng đăng nhập lại.' });
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Phiên làm việc không tồn tại hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  const lastActiveTime = new Date(session.lastActive).getTime();
  if (Date.now() - lastActiveTime > SESSION_INACTIVITY_TIMEOUT_MS) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Phiên làm việc đã hết hạn do không hoạt động quá 15 phút. Vui lòng đăng nhập lại.' });
  }

  session.lastActive = new Date().toISOString();
  activeSessions.set(token, session);

  const user = verifyToken(token);
  if (!user) {
    activeSessions.delete(token);
    return res.status(403).json({ error: 'Token không hợp lệ hoặc tài khoản không tồn tại.' });
  }

  (req as any).user = user;
  next();
}

export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as StoredUser | undefined;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập quản trị viên.' });
  }
  next();
}
