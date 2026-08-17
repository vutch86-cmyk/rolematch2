import { LogItem } from '../types';

let localLogsBuffer: LogItem[] = [];

export function recordLocalLog(item: Omit<LogItem, 'id' | 'timestamp'>): LogItem {
  const logItem: LogItem = {
    id: Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    ...item,
  };
  localLogsBuffer.unshift(logItem);
  if (localLogsBuffer.length > 100) {
    localLogsBuffer.pop();
  }
  return logItem;
}

export async function sendClientLog(params: {
  source?: LogItem['source'];
  level?: LogItem['level'];
  message: string;
  details?: any;
  endpoint?: string;
}): Promise<void> {
  const source = params.source || 'client';
  const level = params.level || 'error';
  const message = params.message;
  const details = params.details
    ? typeof params.details === 'string'
      ? params.details
      : JSON.stringify(params.details, null, 2)
    : undefined;

  // Record locally first
  recordLocalLog({
    source,
    level,
    message,
    details,
    endpoint: params.endpoint,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });

  // Post to server
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        level,
        message,
        details,
        endpoint: params.endpoint,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    });
  } catch (err) {
    console.warn('Failed to dispatch client log to server:', err);
  }
}

export async function fetchAllLogs(): Promise<LogItem[]> {
  try {
    const res = await fetch('/api/logs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.logs)) {
        return data.logs;
      }
    }
  } catch (err) {
    console.warn('Could not fetch server logs:', err);
  }
  return localLogsBuffer;
}

export async function clearAllLogs(): Promise<boolean> {
  localLogsBuffer = [];
  try {
    const res = await fetch('/api/logs/clear', { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.warn('Failed to clear server logs:', err);
    return false;
  }
}

let isInitialized = false;

export function initGlobalErrorLogging(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Catch unhandled runtime errors
  window.addEventListener('error', (event) => {
    sendClientLog({
      source: 'client',
      level: 'error',
      message: event.message || 'Window Runtime Error',
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || String(event.error || ''),
      },
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    sendClientLog({
      source: 'client',
      level: 'error',
      message: `Unhandled Promise Rejection: ${reason?.message || String(reason || 'Unknown rejection')}`,
      details: {
        reason: reason?.stack || reason || String(reason),
      },
    });
  });
}
