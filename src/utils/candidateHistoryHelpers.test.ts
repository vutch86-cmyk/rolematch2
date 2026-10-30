import { describe, it, expect } from 'vitest';
import {
  mergeHistoryLists,
  getUnsyncedHistoryItems,
} from './candidateHistoryHelpers';
import { HistoryItem } from '../types';

describe('candidateHistoryHelpers', () => {
  const dummyAnalysis: any = {
    feature1: { scores: { overallRoleScore: 80 } },
  };

  it('1. mergeHistoryLists merges local and cloud lists without duplicates', () => {
    const localList: HistoryItem[] = [
      {
        id: 'item_1',
        title: 'Local Item 1',
        timestamp: 1000,
        cvText: 'cv 1',
        jdText: 'jd 1',
        analysis: dummyAnalysis,
      },
      {
        id: 'item_2',
        title: 'Local Item 2',
        timestamp: 2000,
        cvText: 'cv 2',
        jdText: 'jd 2',
        analysis: dummyAnalysis,
      },
    ];

    const cloudList: HistoryItem[] = [
      {
        id: 'item_2',
        title: 'Cloud Item 2 Updated',
        timestamp: 2500,
        updatedAt: 2500,
        cvText: 'cv 2',
        jdText: 'jd 2',
        analysis: dummyAnalysis,
      },
      {
        id: 'item_3',
        title: 'Cloud Item 3',
        timestamp: 3000,
        cvText: 'cv 3',
        jdText: 'jd 3',
        analysis: dummyAnalysis,
      },
    ];

    const merged = mergeHistoryLists(localList, cloudList);

    expect(merged).toHaveLength(3);
    // Ordered descending by timestamp: item_3 (3000), item_2 (2500), item_1 (1000)
    expect(merged[0].id).toBe('item_3');
    expect(merged[0].isSynced).toBe(true);

    expect(merged[1].id).toBe('item_2');
    expect(merged[1].title).toBe('Cloud Item 2 Updated');
    expect(merged[1].isSynced).toBe(true);

    expect(merged[2].id).toBe('item_1');
    expect(merged[2].isSynced).toBe(false);
  });

  it('2. getUnsyncedHistoryItems returns items where isSynced is false or undefined', () => {
    const items: HistoryItem[] = [
      {
        id: '1',
        title: 'Synced',
        timestamp: 1,
        cvText: '',
        jdText: '',
        analysis: dummyAnalysis,
        isSynced: true,
      },
      {
        id: '2',
        title: 'Unsynced False',
        timestamp: 2,
        cvText: '',
        jdText: '',
        analysis: dummyAnalysis,
        isSynced: false,
      },
      {
        id: '3',
        title: 'Unsynced Undefined',
        timestamp: 3,
        cvText: '',
        jdText: '',
        analysis: dummyAnalysis,
      },
    ];

    const unsynced = getUnsyncedHistoryItems(items);
    expect(unsynced.map((i) => i.id)).toEqual(['2', '3']);
  });

  it('3. mergeHistoryLists handles empty arrays gracefully', () => {
    expect(mergeHistoryLists([], [])).toEqual([]);
    const local = [{ id: '1', title: 'A', timestamp: 1, cvText: '', jdText: '', analysis: dummyAnalysis }];
    expect(mergeHistoryLists(local, [])).toHaveLength(1);
    expect(mergeHistoryLists([], local)).toHaveLength(1);
  });
});
