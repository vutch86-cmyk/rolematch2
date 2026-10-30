import { HistoryItem, UserAccount } from '../types';

/**
 * Merges local and cloud history lists, resolving duplicates by ID
 * and favoring the record with the newer updatedAt or timestamp.
 */
export function mergeHistoryLists(
  localList: HistoryItem[],
  cloudList: HistoryItem[]
): HistoryItem[] {
  const map = new Map<string, HistoryItem>();

  // Add all cloud items (marked as synced)
  for (const item of cloudList) {
    if (!item || !item.id) continue;
    map.set(item.id, {
      ...item,
      isSynced: true,
    });
  }

  // Merge local items
  for (const localItem of localList) {
    if (!localItem || !localItem.id) continue;
    const existing = map.get(localItem.id);
    if (!existing) {
      // Local item not yet on cloud
      map.set(localItem.id, {
        ...localItem,
        isSynced: false,
      });
    } else {
      // Compare timestamps to choose the fresher version
      const existingTime = existing.updatedAt || existing.timestamp || 0;
      const localTime = localItem.updatedAt || localItem.timestamp || 0;
      if (localTime > existingTime) {
        map.set(localItem.id, {
          ...existing,
          ...localItem,
          isSynced: false, // Updated locally, needs re-sync
        });
      }
    }
  }

  // Sort descending by timestamp / updatedAt
  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = a.updatedAt || a.timestamp || 0;
    const timeB = b.updatedAt || b.timestamp || 0;
    return timeB - timeA;
  });

  return merged;
}

/**
 * Filter items that need to be uploaded to cloud (isSynced !== true)
 */
export function getUnsyncedHistoryItems(items: HistoryItem[]): HistoryItem[] {
  return items.filter((item) => item.isSynced === false || item.isSynced === undefined);
}

/**
 * Fetch candidate history items from cloud backend
 */
export async function fetchCloudCandidateHistory(
  token?: string
): Promise<{ success: boolean; items: HistoryItem[]; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/candidate/history', {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        items: [],
        error: errData.error || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      items: Array.isArray(data.items) ? data.items : [],
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: err?.message || 'Network error fetching cloud history',
    };
  }
}

/**
 * Push unsynced candidate history items to cloud backend
 */
export async function pushCandidateHistoryToCloud(
  items: HistoryItem[],
  token?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  if (items.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/candidate/history', {
      method: 'POST',
      headers,
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        count: 0,
        error: errData.error || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      count: data.count || items.length,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      error: err?.message || 'Network error pushing candidate history',
    };
  }
}

/**
 * Delete a candidate history item on cloud
 */
export async function deleteCloudCandidateHistoryItem(
  id: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`/api/candidate/history/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `HTTP ${res.status}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error deleting candidate history',
    };
  }
}

/**
 * Rename or update metadata of a candidate history item on cloud
 */
export async function renameCloudCandidateHistoryItem(
  id: string,
  updates: { companyName?: string; jobTitle?: string; title?: string },
  token?: string
): Promise<{ success: boolean; item?: HistoryItem; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`/api/candidate/history/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      item: data.item,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error renaming candidate history',
    };
  }
}

/**
 * Clear all candidate history of current user on cloud
 */
export async function clearAllCloudCandidateHistory(
  token?: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/candidate/history', {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      deletedCount: data.deletedCount,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error clearing cloud candidate history',
    };
  }
}
