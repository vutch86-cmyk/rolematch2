import path from 'path';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { OperationType, type FirestoreErrorInfo } from '../types';

export { OperationType };
export type { FirestoreErrorInfo };

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
      providerInfo: [],
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

setLogLevel('error');

let configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  configPath = path.join(__dirname, '..', '..', 'firebase-applet-config.json');
}
if (!fs.existsSync(configPath)) {
  configPath = path.join(__dirname, 'firebase-applet-config.json');
}

export let db: any = null;
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    db = getFirestore(firebaseApp, config.firestoreDatabaseId || '(default)');
    console.log(
      'Firebase Firestore initialized successfully with database:',
      config.firestoreDatabaseId || '(default)'
    );
  } catch (err) {
    console.error('Error initializing Firebase Firestore:', err);
  }
} else {
  console.log('No firebase-applet-config.json found at paths searched. Continuing without Firebase.');
}

export function getFirestoreDb(): any {
  return db;
}

export function setFirestoreDb(newDb: any): void {
  db = newDb;
}
