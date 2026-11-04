import {
  CompleteCVAnalysisResponse,
  ComparisonRow,
  ImportanceLevel,
  JDKeyword,
  KeywordCategory,
} from '../types';

export type MatchStatus = 'khop' | 'can_bo_sung' | 'thieu';

export type MustHaveSource = 'explicit' | 'inferred_importance' | 'none';

export interface EvidenceItem {
  id: string;
  term: string;
  category: KeywordCategory | 'Chưa phân loại';
  importance: ImportanceLevel;
  isMustHave: boolean;
  mustHaveSource: MustHaveSource;
  cvEvidence: string;
  gapOrClarification: string;
  matchStatus: MatchStatus;
  targetSection?: string;
  suggestedPhrasing?: string;
}

export interface CompetencyGroup {
  id: string;
  categoryKey: string;
  title: string;
  total: number;
  matchedCount: number;
  partialCount: number;
  gapCount: number;
  mustHaveGapCount: number;
  mustHavePartialCount: number;
  items: EvidenceItem[];
}

export interface QuickWinAction {
  id: string;
  title: string;
  actionText: string;
  targetGroupId?: string;
  targetItemId?: string; // Bắt buộc phải có để hiển thị nút 1-Click Jump
  source: 'recruiter_fix' | 'immediate_action';
}

export interface ExecutiveHeroViewModel {
  verdictStatement: string;
  hasMustHaveData: boolean;
  mustHaveTotal: number;
  mustHavePassed: number;
  mustHavePartial: number;
  mustHaveGap: number;
  mustHaveSource: MustHaveSource;
  overallScore: number;
  scoreRationale?: string;
  inviteDecision?: 'YES' | 'NO' | 'MAYBE';
  decisionReason?: string;
  quickWins: QuickWinAction[];
}

export interface EvidenceMapSharedViewModel {
  hero: ExecutiveHeroViewModel;
  groups: CompetencyGroup[];
  uncomparedKeywords: JDKeyword[];
  totalCriteriaCount: number;
  totalMustHaveCount: number;
  totalGapCount: number;
  initialOpenGroupId: string;
}

const CATEGORY_MAP: Record<
  string,
  { id: string; vi: string; en: string; order: number }
> = {
  'Kỹ năng chuyên môn': {
    id: 'tech',
    vi: 'Kỹ Năng Chuyên Môn',
    en: 'Technical Skills',
    order: 1,
  },
  'Công cụ, phần mềm hoặc phương pháp': {
    id: 'tools',
    vi: 'Công Cụ & Phương Pháp',
    en: 'Tools & Methodologies',
    order: 2,
  },
  'Kinh nghiệm mong muốn': {
    id: 'experience',
    vi: 'Kinh Nghiệm Thực Tế',
    en: 'Hands-on Experience',
    order: 3,
  },
  'Kết quả đầu ra hoặc kỳ vọng công việc': {
    id: 'outcomes',
    vi: 'Kết Quả & Đầu Ra',
    en: 'Outcomes & Deliverables',
    order: 4,
  },
  'Phẩm chất hoặc cách làm việc': {
    id: 'culture',
    vi: 'Văn Hóa & Phẩm Chất',
    en: 'Culture & Soft Skills',
    order: 5,
  },
};

/**
 * Tạo slug định danh an toàn cho từng item
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Xây dựng Shared View Model cho cả Hero Card và Evidence Map Workspace
 */
export function buildEvidenceMapViewModel(
  analysis: CompleteCVAnalysisResponse | null | undefined,
  lang: 'vi' | 'en' = 'vi'
): EvidenceMapSharedViewModel {
  const isVi = lang === 'vi';

  // Fallback an toàn nếu phân tích rỗng
  if (!analysis || !analysis.feature1) {
    return {
      hero: {
        verdictStatement: isVi
          ? 'Chưa có dữ liệu phân tích chi tiết.'
          : 'No detailed analysis data available.',
        hasMustHaveData: false,
        mustHaveTotal: 0,
        mustHavePassed: 0,
        mustHavePartial: 0,
        mustHaveGap: 0,
        mustHaveSource: 'none',
        overallScore: 0,
        quickWins: [],
      },
      groups: [],
      uncomparedKeywords: [],
      totalCriteriaCount: 0,
      totalMustHaveCount: 0,
      totalGapCount: 0,
      initialOpenGroupId: 'tech',
    };
  }

  const rawRows: ComparisonRow[] = analysis.feature1.comparisonTable || [];
  const rawKeywords: JDKeyword[] = analysis.feature1.jdKeywords || [];

  // Tạo map từ keyword để tra cứu category & isMustHave nếu comparisonRow bị thiếu
  const keywordLookup = new Map<string, JDKeyword>();
  for (const kw of rawKeywords) {
    if (kw && kw.keyword) {
      keywordLookup.set(kw.keyword.trim().toLowerCase(), kw);
    }
  }

  // 1. Khử trùng lặp (Deduplication) và chuẩn hóa Comparison Rows
  const processedRowsMap = new Map<string, EvidenceItem>();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !row.jdTerm || !row.jdTerm.trim()) continue;

    const termKey = row.jdTerm.trim().toLowerCase();
    const matchedKeyword = keywordLookup.get(termKey);

    // Xác định isMustHave và nguồn gốc suy luận
    let isMustHave = false;
    let mustHaveSource: MustHaveSource = 'none';

    if (typeof row.isMustHave === 'boolean') {
      isMustHave = row.isMustHave;
      mustHaveSource = 'explicit';
    } else if (matchedKeyword && typeof matchedKeyword.isMustHave === 'boolean') {
      isMustHave = matchedKeyword.isMustHave;
      mustHaveSource = 'explicit';
    } else if (row.importance === 'Rất quan trọng' || matchedKeyword?.importance === 'Rất quan trọng') {
      isMustHave = true;
      mustHaveSource = 'inferred_importance';
    }

    // Xác định Category
    let category: KeywordCategory | 'Chưa phân loại' = 'Chưa phân loại';
    if (matchedKeyword?.category && CATEGORY_MAP[matchedKeyword.category]) {
      category = matchedKeyword.category;
    }

    // Match status hợp lệ
    const rawStatus = row.matchStatus;
    const matchStatus: MatchStatus =
      rawStatus === 'khop' || rawStatus === 'can_bo_sung' || rawStatus === 'thieu'
        ? rawStatus
        : 'can_bo_sung';

    const item: EvidenceItem = {
      id: `item-${slugify(row.jdTerm)}-${i}`,
      term: row.jdTerm.trim(),
      category,
      importance: row.importance || matchedKeyword?.importance || 'Quan trọng',
      isMustHave,
      mustHaveSource,
      cvEvidence: row.cvEvidence?.trim() || '',
      gapOrClarification: row.gapOrClarification?.trim() || '',
      matchStatus,
      targetSection: row.targetSection?.trim(),
      suggestedPhrasing: row.suggestedPhrasing?.trim(),
    };

    // Nếu trùng termKey: giữ item có nhiều bằng chứng hơn hoặc có isMustHave
    if (processedRowsMap.has(termKey)) {
      const existing = processedRowsMap.get(termKey)!;
      if (!existing.cvEvidence && item.cvEvidence) {
        processedRowsMap.set(termKey, item);
      } else if (!existing.isMustHave && item.isMustHave) {
        processedRowsMap.set(termKey, item);
      }
    } else {
      processedRowsMap.set(termKey, item);
    }
  }

  const items = Array.from(processedRowsMap.values());

  // 2. Tìm các Keywords chưa có dòng đối chiếu (Uncompared Keywords)
  const uncomparedKeywords: JDKeyword[] = [];
  for (const kw of rawKeywords) {
    if (!kw || !kw.keyword) continue;
    const termKey = kw.keyword.trim().toLowerCase();
    if (!processedRowsMap.has(termKey)) {
      uncomparedKeywords.push(kw);
    }
  }

  // 3. Nhóm vào 5 Nhóm Năng Lực Chuẩn + 1 Nhóm Chưa Phân Loại nếu có
  const groupBuckets: Record<string, EvidenceItem[]> = {
    tech: [],
    tools: [],
    experience: [],
    outcomes: [],
    culture: [],
    unclassified: [],
  };

  for (const item of items) {
    if (item.category !== 'Chưa phân loại' && CATEGORY_MAP[item.category]) {
      const bucketKey = CATEGORY_MAP[item.category].id;
      groupBuckets[bucketKey].push(item);
    } else {
      groupBuckets.unclassified.push(item);
    }
  }

  const groups: CompetencyGroup[] = [];
  const groupOrder = ['tech', 'tools', 'experience', 'outcomes', 'culture'];

  for (const key of groupOrder) {
    const catEntry = Object.values(CATEGORY_MAP).find((c) => c.id === key)!;
    const bucketItems = groupBuckets[key];

    let matchedCount = 0;
    let partialCount = 0;
    let gapCount = 0;
    let mustHaveGapCount = 0;
    let mustHavePartialCount = 0;

    for (const it of bucketItems) {
      if (it.matchStatus === 'khop') matchedCount++;
      else if (it.matchStatus === 'can_bo_sung') {
        partialCount++;
        if (it.isMustHave) mustHavePartialCount++;
      } else if (it.matchStatus === 'thieu') {
        gapCount++;
        if (it.isMustHave) mustHaveGapCount++;
      }
    }

    groups.push({
      id: key,
      categoryKey: key,
      title: isVi ? catEntry.vi : catEntry.en,
      total: bucketItems.length,
      matchedCount,
      partialCount,
      gapCount,
      mustHaveGapCount,
      mustHavePartialCount,
      items: bucketItems,
    });
  }

  // Thêm nhóm Chưa phân loại nếu có item
  if (groupBuckets.unclassified.length > 0) {
    const unclassItems = groupBuckets.unclassified;
    let matchedCount = 0;
    let partialCount = 0;
    let gapCount = 0;
    let mustHaveGapCount = 0;
    let mustHavePartialCount = 0;

    for (const it of unclassItems) {
      if (it.matchStatus === 'khop') matchedCount++;
      else if (it.matchStatus === 'can_bo_sung') {
        partialCount++;
        if (it.isMustHave) mustHavePartialCount++;
      } else if (it.matchStatus === 'thieu') {
        gapCount++;
        if (it.isMustHave) mustHaveGapCount++;
      }
    }

    groups.push({
      id: 'unclassified',
      categoryKey: 'unclassified',
      title: isVi ? 'Chưa Phân Loại' : 'Unclassified',
      total: unclassItems.length,
      matchedCount,
      partialCount,
      gapCount,
      mustHaveGapCount,
      mustHavePartialCount,
      items: unclassItems,
    });
  }

  // 4. Tổng hợp số liệu Must-Have toàn hệ thống (Shared Single Source of Truth)
  let totalCriteriaCount = items.length;
  let totalMustHaveCount = 0;
  let mustHavePassed = 0;
  let mustHavePartial = 0;
  let mustHaveGap = 0;
  let totalGapCount = 0;
  let primaryMustHaveSource: MustHaveSource = 'none';

  for (const it of items) {
    if (it.matchStatus === 'thieu') totalGapCount++;

    if (it.isMustHave) {
      totalMustHaveCount++;
      if (it.mustHaveSource === 'explicit') primaryMustHaveSource = 'explicit';
      else if (primaryMustHaveSource !== 'explicit') primaryMustHaveSource = 'inferred_importance';

      if (it.matchStatus === 'khop') mustHavePassed++;
      else if (it.matchStatus === 'can_bo_sung') mustHavePartial++;
      else if (it.matchStatus === 'thieu') mustHaveGap++;
    }
  }

  const hasMustHaveData = totalMustHaveCount > 0;

  // 5. Xác định nhóm ưu tiên mở lần đầu (Initial Open Group Algorithm)
  // Ưu tiên:
  // 1. Nhóm có mustHaveGapCount cao nhất
  // 2. Nếu bằng nhau: mustHavePartialCount cao nhất
  // 3. Nếu bằng nhau: thứ tự nhóm chuẩn có dữ liệu
  // 4. Nếu không có gap/partial: nhóm đầu tiên có item
  let initialOpenGroupId = groups[0]?.id || 'tech';
  const groupsWithItems = groups.filter((g) => g.total > 0);

  if (groupsWithItems.length > 0) {
    const sorted = [...groupsWithItems].sort((a, b) => {
      if (b.mustHaveGapCount !== a.mustHaveGapCount) {
        return b.mustHaveGapCount - a.mustHaveGapCount;
      }
      if (b.mustHavePartialCount !== a.mustHavePartialCount) {
        return b.mustHavePartialCount - a.mustHavePartialCount;
      }
      if (b.gapCount !== a.gapCount) {
        return b.gapCount - a.gapCount;
      }
      return 0;
    });

    initialOpenGroupId = sorted[0].id;
  }

  // 6. Xây dựng Verdict Statement chuẩn mực có căn cứ
  let verdictStatement = '';
  if (hasMustHaveData) {
    if (isVi) {
      verdictStatement = `CV đã thể hiện rõ ${mustHavePassed}/${totalMustHaveCount} yêu cầu được xác định là bắt buộc`;
      if (mustHavePartial > 0 && mustHaveGap > 0) {
        verdictStatement += `; ${mustHavePartial} yêu cầu có bằng chứng một phần và ${mustHaveGap} yêu cầu chưa thấy bằng chứng trong hồ sơ.`;
      } else if (mustHavePartial > 0) {
        verdictStatement += `; ${mustHavePartial} yêu cầu có bằng chứng một phần cần làm rõ thêm.`;
      } else if (mustHaveGap > 0) {
        verdictStatement += `; còn ${mustHaveGap} yêu cầu chưa thấy bằng chứng trong hồ sơ.`;
      } else {
        verdictStatement += ` và đáp ứng đầy đủ tất cả các yêu cầu cốt lõi.`;
      }
    } else {
      verdictStatement = `Resume clearly demonstrates ${mustHavePassed}/${totalMustHaveCount} mandatory requirements`;
      if (mustHavePartial > 0 && mustHaveGap > 0) {
        verdictStatement += `; ${mustHavePartial} partially evidenced and ${mustHaveGap} without clear evidence.`;
      } else if (mustHavePartial > 0) {
        verdictStatement += `; ${mustHavePartial} partially evidenced requiring clarification.`;
      } else if (mustHaveGap > 0) {
        verdictStatement += `; ${mustHaveGap} missing evidence in current profile.`;
      } else {
        verdictStatement += ` and fulfills all core requirements.`;
      }
    }
  } else {
    // Không có Must-Have -> Trung tính, không gán 100%
    if (isVi) {
      verdictStatement = `Hệ thống ghi nhận ${items.length} tiêu chí đối chiếu (chưa xác định yêu cầu bắt buộc cụ thể trong JD); trong đó có ${totalGapCount} tiêu chí chưa thấy bằng chứng.`;
    } else {
      verdictStatement = `Identified ${items.length} evaluated criteria (no mandatory requirements explicitly marked in JD); ${totalGapCount} criteria currently lack evidence.`;
    }
  }

  // 7. Xây dựng Top 3 Quick Wins với liên kết xác định (Deterministic Linking)
  const quickWins: QuickWinAction[] = [];
  const rawFixes = analysis.feature3?.top3MustFix || [];
  const rawImmediate = analysis.feature1?.summary?.immediateActions || [];

  // Tìm các items có khoảng trống cần sửa nhất để map
  const gapItems = items.filter((it) => it.matchStatus === 'thieu' || it.matchStatus === 'can_bo_sung');

  // Ưu tiên ghép với rawFixes nếu có
  const candidateFixes = rawFixes.length > 0 ? rawFixes : rawImmediate;

  for (let idx = 0; idx < Math.min(candidateFixes.length, 3); idx++) {
    const fixText = candidateFixes[idx]?.trim();
    if (!fixText) continue;

    // Tìm xem fixText có nhắc đến term nào trong gapItems không
    const matchedItem = gapItems.find((it) => {
      const termLower = it.term.toLowerCase();
      return fixText.toLowerCase().includes(termLower);
    });

    let targetGroupId: string | undefined;
    let targetItemId: string | undefined;

    if (matchedItem) {
      targetItemId = matchedItem.id;
      // Tìm groupId chứa item này
      const parentGroup = groups.find((g) => g.items.some((it) => it.id === matchedItem.id));
      targetGroupId = parentGroup?.id;
    }

    quickWins.push({
      id: `qw-${idx + 1}`,
      title: fixText,
      actionText: isVi ? 'Xem vị trí & đối chiếu' : 'View requirement & evidence',
      targetGroupId,
      targetItemId,
      source: rawFixes.length > 0 ? 'recruiter_fix' : 'immediate_action',
    });
  }

  // Điểm số và nhận định
  const overallScore = analysis.feature1?.scores?.overallRoleScore || 0;
  const scoreRationale =
    analysis.feature1?.scores?.overallRationale ||
    analysis.feature1?.summary?.biggestStrength ||
    undefined;

  return {
    hero: {
      verdictStatement,
      hasMustHaveData,
      mustHaveTotal: totalMustHaveCount,
      mustHavePassed,
      mustHavePartial,
      mustHaveGap,
      mustHaveSource: primaryMustHaveSource,
      overallScore,
      scoreRationale,
      inviteDecision: analysis.feature3?.inviteDecision,
      decisionReason: analysis.feature3?.decisionReason,
      quickWins,
    },
    groups,
    uncomparedKeywords,
    totalCriteriaCount,
    totalMustHaveCount,
    totalGapCount,
    initialOpenGroupId,
  };
}
