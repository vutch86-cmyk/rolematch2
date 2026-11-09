import {
  CompleteCVAnalysisResponse,
  ComparisonRow,
  ImportanceLevel,
  JDKeyword,
  KeywordCategory,
} from '../types';

export type MatchStatus = 'khop' | 'can_bo_sung' | 'thieu' | 'unknown';

export type MustHaveSource = 'explicit' | 'inferred_importance' | 'mixed' | 'none';

export interface EvidenceItem {
  id: string;
  term: string;
  category: KeywordCategory | 'Chưa phân loại';
  importance: ImportanceLevel;
  isMustHave: boolean;
  mustHaveSource: 'explicit' | 'inferred_importance' | 'none';
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
  unknownCount: number;
  mustHaveGapCount: number;
  mustHavePartialCount: number;
  mustHaveUnknownCount: number;
  items: EvidenceItem[];
}

export interface QuickWinAction {
  id: string;
  title: string;
  actionText: string;
  targetGroupId?: string;
  targetItemId?: string; // Chỉ có khi tìm được liên kết xác định, không suy đoán
  source: 'recruiter_fix' | 'immediate_action' | 'priority_gap';
}

export interface ExecutiveHeroViewModel {
  verdictStatement: string;
  hasMustHaveData: boolean;
  mustHaveTotal: number; // Tổng Must-Have xác định (passed + partial + gap + unknown + uncompared)
  mustHaveEvaluated: number; // Số Must-Have đã có dòng đối chiếu (passed + partial + gap + unknown)
  mustHavePassed: number; // Số Must-Have đạt
  mustHavePartial: number; // Số Must-Have đạt một phần
  mustHaveGap: number; // Số Must-Have chưa thấy bằng chứng trong bảng đối chiếu
  mustHaveUnknown: number; // Số Must-Have có trạng thái chưa xác định / lỗi
  mustHaveUncompared: number; // Số Must-Have chưa có dòng đối chiếu (từ jdKeywords đã deduplicate)
  mustHaveSource: MustHaveSource;
  explicitMustHaveCount: number;
  inferredMustHaveCount: number;
  overallScore: number;
  scoreRationale?: string;
  inviteDecision?: 'YES' | 'NO' | 'MAYBE';
  decisionReason?: string;
  quickWins: QuickWinAction[];
}

export interface UncomparedKeywordItem extends JDKeyword {
  isMustHave: boolean;
  mustHaveSource: 'explicit' | 'inferred_importance' | 'none';
}

export interface EvidenceMapSharedViewModel {
  hero: ExecutiveHeroViewModel;
  groups: CompetencyGroup[];
  uncomparedKeywords: UncomparedKeywordItem[];
  totalCriteriaCount: number;
  totalMustHaveCount: number;
  totalGapCount: number;
  totalUnknownCount: number;
  totalUncomparedCount: number;
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
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Kiểm tra xem một bộ lọc có đang thực sự che giấu mục tiêu đích hay không
 */
export function shouldUnhideFilterForTarget(
  currentFilter: 'all' | 'must_have' | 'gap',
  targetItem: EvidenceItem | undefined
): boolean {
  if (!targetItem) return false;
  if (currentFilter === 'all') return false;
  if (currentFilter === 'must_have' && !targetItem.isMustHave) return true;
  if (currentFilter === 'gap' && targetItem.matchStatus !== 'thieu') return true;
  return false;
}

/**
 * Gộp trạng thái isMustHave bảo toàn tri-state (true | false | undefined):
 * 1. Nếu bất kỳ bản ghi nào là true -> true (bảo toàn tín hiệu must-have khi có ít nhất 1 nguồn xác nhận).
 * 2. Nếu một bên false và một bên undefined -> false (ưu tiên giá trị explicit đã xác định hơn undefined).
 * 3. Nếu cả hai đều false -> false.
 * 4. Nếu cả hai đều undefined -> undefined (giữ nguyên để adapter tiếp tục suy luận từ importance).
 *
 * Hàm này có tính giao hoán: mergeIsMustHave(a, b) === mergeIsMustHave(b, a).
 */
export function mergeIsMustHave(
  a: boolean | undefined,
  b: boolean | undefined
): boolean | undefined {
  if (a === true || b === true) return true;
  if (a === false || b === false) return false;
  return undefined;
}

/**
 * Chuẩn hóa và khử trùng lặp danh sách jdKeywords.
 * Giữ nguyên cờ Must-Have nếu có xung đột trùng lặp (AWS vs aws) theo quy tắc tri-state merge.
 */
export function deduplicateKeywords(rawKeywords: JDKeyword[]): JDKeyword[] {
  const map = new Map<string, JDKeyword>();

  for (const kw of rawKeywords) {
    if (!kw || !kw.keyword || !kw.keyword.trim()) continue;
    const normKey = kw.keyword.trim().toLowerCase();

    if (!map.has(normKey)) {
      map.set(normKey, {
        ...kw,
        keyword: kw.keyword.trim(),
      });
    } else {
      const existing = map.get(normKey)!;
      // Bảo toàn tri-state (true / false / undefined)
      const isMustHave = mergeIsMustHave(existing.isMustHave, kw.isMustHave);

      // Ưu tiên độ quan trọng cao nhất
      let importance = existing.importance;
      if (kw.importance === 'Rất quan trọng' || existing.importance === 'Rất quan trọng') {
        importance = 'Rất quan trọng';
      } else if (kw.importance === 'Quan trọng' || existing.importance === 'Quan trọng') {
        importance = 'Quan trọng';
      }

      const category = existing.category || kw.category;

      map.set(normKey, {
        keyword: existing.keyword,
        category,
        importance,
        isMustHave,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Tính toán fingerprint nội dung duy nhất cho một bản phân tích.
 * Độc lập với ngôn ngữ UI; phản ánh mọi thay đổi trong comparisonTable (term, category, importance, cvEvidence, status)
 * và jdKeywords (keyword, category, importance, isMustHave).
 */
export function computeAnalysisFingerprint(
  analysis: CompleteCVAnalysisResponse | null | undefined
): string {
  if (!analysis) return 'empty';

  // 1. Ưu tiên requestId hoặc id định danh từ backend/lịch sử
  const anyAnalysis = analysis as Record<string, any>;
  const reqId =
    anyAnalysis.requestId ||
    anyAnalysis.pipelineMetadata?.requestId ||
    anyAnalysis.audit?.requestId ||
    anyAnalysis.id;

  // 2. Fingerprint chi tiết từ comparisonTable
  const tablePart = (analysis.feature1?.comparisonTable || [])
    .map((r) => [
      r.jdTerm || '',
      r.matchStatus || '',
      r.isMustHave ?? '',
      r.importance || '',
      r.cvEvidence || '',
      r.gapOrClarification || '',
      r.targetSection || '',
    ].join('~'))
    .sort()
    .join(';');

  // 3. Fingerprint từ jdKeywords
  const kwPart = (analysis.feature1?.jdKeywords || [])
    .map((k) => [
      k.keyword || '',
      k.category || '',
      k.importance || '',
      k.isMustHave ?? '',
    ].join('~'))
    .sort()
    .join(';');

  const scores = analysis.feature1?.scores;
  const scorePart = scores
    ? `${scores.overallRoleScore}_${scores.keywordMatchScore}_${scores.skillMatchScore}_${scores.experienceOutcomeScore}`
    : '0';

  const companyPart = analysis.companyName || '';
  const titlePart = analysis.jobTitle || '';

  return `${reqId ? `req:${reqId}_` : ''}${companyPart}_${titlePart}_[scores:${scorePart}]_[table:${tablePart}]_[kw:${kwPart}]`;
}

/**
 * Thoát ký tự đặc biệt cho Regex
 */
function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Kiểm tra xem một term có xuất hiện như một từ/ngữ độc lập trong text hay không.
 * Tránh lỗi "Java" khớp nhầm trong "JavaScript" hoặc "C" khớp trong "C++".
 */
export function isExactWordOrPhraseMatch(term: string, text: string): boolean {
  if (!term || !text) return false;
  const trimmedTerm = term.trim();
  const trimmedText = text.trim();
  if (!trimmedTerm || !trimmedText) return false;

  if (trimmedTerm.toLowerCase() === trimmedText.toLowerCase()) return true;

  const escaped = escapeRegex(trimmedTerm);
  const regex = new RegExp(`(^|[^a-zA-Z0-9_#+.-])${escaped}([^a-zA-Z0-9_#+.-]|$)`, 'i');
  return regex.test(trimmedText);
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
        mustHaveEvaluated: 0,
        mustHavePassed: 0,
        mustHavePartial: 0,
        mustHaveGap: 0,
        mustHaveUnknown: 0,
        mustHaveUncompared: 0,
        mustHaveSource: 'none',
        explicitMustHaveCount: 0,
        inferredMustHaveCount: 0,
        overallScore: 0,
        quickWins: [],
      },
      groups: [],
      uncomparedKeywords: [],
      totalCriteriaCount: 0,
      totalMustHaveCount: 0,
      totalGapCount: 0,
      totalUnknownCount: 0,
      totalUncomparedCount: 0,
      initialOpenGroupId: 'tech',
    };
  }

  const rawRows: ComparisonRow[] = analysis.feature1.comparisonTable || [];
  const rawKeywords: JDKeyword[] = analysis.feature1.jdKeywords || [];

  // 1. Chuẩn hóa và khử trùng lặp tập từ khóa gốc
  const normalizedKeywords = deduplicateKeywords(rawKeywords);
  const keywordLookup = new Map<string, JDKeyword>();
  for (const kw of normalizedKeywords) {
    keywordLookup.set(kw.keyword.toLowerCase(), kw);
  }

  // 2. Khử trùng lặp (Deduplication) và chuẩn hóa Comparison Rows
  const processedRowsMap = new Map<string, EvidenceItem>();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !row.jdTerm || !row.jdTerm.trim()) continue;

    const termKey = row.jdTerm.trim().toLowerCase();
    const matchedKeyword = keywordLookup.get(termKey);

    // Xác định isMustHave và nguồn gốc suy luận
    let isMustHave = false;
    let mustHaveSource: 'explicit' | 'inferred_importance' | 'none' = 'none';

    if (typeof row.isMustHave === 'boolean') {
      isMustHave = row.isMustHave;
      mustHaveSource = isMustHave ? 'explicit' : 'none';
    } else if (matchedKeyword && typeof matchedKeyword.isMustHave === 'boolean') {
      isMustHave = matchedKeyword.isMustHave;
      mustHaveSource = isMustHave ? 'explicit' : 'none';
    } else if (row.importance === 'Rất quan trọng' || matchedKeyword?.importance === 'Rất quan trọng') {
      isMustHave = true;
      mustHaveSource = 'inferred_importance';
    }

    // Xác định Category
    let category: KeywordCategory | 'Chưa phân loại' = 'Chưa phân loại';
    if (matchedKeyword?.category && CATEGORY_MAP[matchedKeyword.category]) {
      category = matchedKeyword.category;
    }

    // Xử lý MatchStatus: KHÔNG được tự ý ép trạng thái lạ thành can_bo_sung!
    let matchStatus: MatchStatus = 'unknown';
    if (row.matchStatus === 'khop' || row.matchStatus === 'can_bo_sung' || row.matchStatus === 'thieu') {
      matchStatus = row.matchStatus;
    }

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

  // 3. Tìm các Keywords chưa có dòng đối chiếu (Uncompared Keywords từ tập normalizedKeywords)
  const uncomparedKeywords: UncomparedKeywordItem[] = [];
  for (const kw of normalizedKeywords) {
    const termKey = kw.keyword.toLowerCase();
    if (!processedRowsMap.has(termKey)) {
      let isMustHave = false;
      let mustHaveSource: 'explicit' | 'inferred_importance' | 'none' = 'none';

      if (typeof kw.isMustHave === 'boolean') {
        isMustHave = kw.isMustHave;
        mustHaveSource = isMustHave ? 'explicit' : 'none';
      } else if (kw.importance === 'Rất quan trọng') {
        isMustHave = true;
        mustHaveSource = 'inferred_importance';
      }

      uncomparedKeywords.push({
        ...kw,
        isMustHave,
        mustHaveSource,
      });
    }
  }

  // 4. Nhóm vào 5 Nhóm Năng Lực Chuẩn + 1 Nhóm Chưa Phân Loại nếu có
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
    let unknownCount = 0;
    let mustHaveGapCount = 0;
    let mustHavePartialCount = 0;
    let mustHaveUnknownCount = 0;

    for (const it of bucketItems) {
      if (it.matchStatus === 'khop') {
        matchedCount++;
      } else if (it.matchStatus === 'can_bo_sung') {
        partialCount++;
        if (it.isMustHave) mustHavePartialCount++;
      } else if (it.matchStatus === 'thieu') {
        gapCount++;
        if (it.isMustHave) mustHaveGapCount++;
      } else {
        unknownCount++;
        if (it.isMustHave) mustHaveUnknownCount++;
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
      unknownCount,
      mustHaveGapCount,
      mustHavePartialCount,
      mustHaveUnknownCount,
      items: bucketItems,
    });
  }

  if (groupBuckets.unclassified.length > 0) {
    const unclassItems = groupBuckets.unclassified;
    let matchedCount = 0;
    let partialCount = 0;
    let gapCount = 0;
    let unknownCount = 0;
    let mustHaveGapCount = 0;
    let mustHavePartialCount = 0;
    let mustHaveUnknownCount = 0;

    for (const it of unclassItems) {
      if (it.matchStatus === 'khop') {
        matchedCount++;
      } else if (it.matchStatus === 'can_bo_sung') {
        partialCount++;
        if (it.isMustHave) mustHavePartialCount++;
      } else if (it.matchStatus === 'thieu') {
        gapCount++;
        if (it.isMustHave) mustHaveGapCount++;
      } else {
        unknownCount++;
        if (it.isMustHave) mustHaveUnknownCount++;
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
      unknownCount,
      mustHaveGapCount,
      mustHavePartialCount,
      mustHaveUnknownCount,
      items: unclassItems,
    });
  }

  // 5. Tổng hợp số liệu Must-Have toàn hệ thống (ĐẦY ĐỦ: passed + partial + gap + unknown + uncompared)
  let explicitMustHaveCount = 0;
  let inferredMustHaveCount = 0;

  let mustHavePassed = 0;
  let mustHavePartial = 0;
  let mustHaveGap = 0;
  let mustHaveUnknown = 0;
  let totalGapCount = 0;
  let totalUnknownCount = 0;

  for (const it of items) {
    if (it.matchStatus === 'thieu') totalGapCount++;
    if (it.matchStatus === 'unknown') totalUnknownCount++;

    if (it.isMustHave) {
      if (it.mustHaveSource === 'explicit') explicitMustHaveCount++;
      else if (it.mustHaveSource === 'inferred_importance') inferredMustHaveCount++;

      if (it.matchStatus === 'khop') mustHavePassed++;
      else if (it.matchStatus === 'can_bo_sung') mustHavePartial++;
      else if (it.matchStatus === 'thieu') mustHaveGap++;
      else if (it.matchStatus === 'unknown') mustHaveUnknown++; // KHÔNG ĐƯỢC BỎ QUÊN UNKNOWN!
    }
  }

  // Đếm Must-Have trong uncomparedKeywords (đã khử trùng lặp)
  let mustHaveUncompared = 0;
  for (const uk of uncomparedKeywords) {
    if (uk.isMustHave) {
      mustHaveUncompared++;
      if (uk.mustHaveSource === 'explicit') explicitMustHaveCount++;
      else if (uk.mustHaveSource === 'inferred_importance') inferredMustHaveCount++;
    }
  }

  // Bất biến: totalMustHaveCount = passed + partial + gap + unknown + uncompared
  const mustHaveEvaluated = mustHavePassed + mustHavePartial + mustHaveGap + mustHaveUnknown;
  const totalMustHaveCount = mustHaveEvaluated + mustHaveUncompared;
  const hasMustHaveData = totalMustHaveCount > 0;

  let primaryMustHaveSource: MustHaveSource = 'none';
  if (explicitMustHaveCount > 0 && inferredMustHaveCount > 0) {
    primaryMustHaveSource = 'mixed';
  } else if (explicitMustHaveCount > 0) {
    primaryMustHaveSource = 'explicit';
  } else if (inferredMustHaveCount > 0) {
    primaryMustHaveSource = 'inferred_importance';
  }

  // 6. Xác định nhóm ưu tiên mở lần đầu
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
      if (b.mustHaveUnknownCount !== a.mustHaveUnknownCount) {
        return b.mustHaveUnknownCount - a.mustHaveUnknownCount;
      }
      if (b.gapCount !== a.gapCount) {
        return b.gapCount - a.gapCount;
      }
      return 0;
    });

    initialOpenGroupId = sorted[0].id;
  }

  // 7. Xây dựng Verdict Statement chuẩn mực có căn cứ
  let verdictStatement = '';
  if (hasMustHaveData) {
    if (isVi) {
      verdictStatement = `CV đã thể hiện rõ ${mustHavePassed}/${totalMustHaveCount} yêu cầu được xác định là bắt buộc`;

      const extraClauses: string[] = [];
      if (mustHavePartial > 0) {
        extraClauses.push(`${mustHavePartial} yêu cầu có bằng chứng một phần`);
      }
      if (mustHaveGap > 0) {
        extraClauses.push(`${mustHaveGap} yêu cầu chưa thấy bằng chứng`);
      }
      if (mustHaveUnknown > 0) {
        extraClauses.push(`${mustHaveUnknown} yêu cầu chưa xác định được trạng thái`);
      }
      if (mustHaveUncompared > 0) {
        extraClauses.push(`${mustHaveUncompared} yêu cầu bắt buộc chưa được đối chiếu`);
      }

      if (extraClauses.length > 0) {
        verdictStatement += `; ${extraClauses.join(', ')}.`;
      } else {
        // CHỈ kết luận đầy đủ khi không còn partial, gap, unknown VÀ uncompared!
        verdictStatement += ` và đáp ứng đầy đủ tất cả các yêu cầu cốt lõi.`;
      }
    } else {
      verdictStatement = `Resume demonstrates ${mustHavePassed}/${totalMustHaveCount} mandatory requirements`;

      const extraClauses: string[] = [];
      if (mustHavePartial > 0) {
        extraClauses.push(`${mustHavePartial} partially evidenced`);
      }
      if (mustHaveGap > 0) {
        extraClauses.push(`${mustHaveGap} lacking evidence`);
      }
      if (mustHaveUnknown > 0) {
        extraClauses.push(`${mustHaveUnknown} with unknown status`);
      }
      if (mustHaveUncompared > 0) {
        extraClauses.push(`${mustHaveUncompared} mandatory requirement(s) uncompared`);
      }

      if (extraClauses.length > 0) {
        verdictStatement += `; ${extraClauses.join(', ')}.`;
      } else {
        verdictStatement += ` and fulfills all core requirements.`;
      }
    }
  } else {
    if (isVi) {
      verdictStatement = `Hệ thống ghi nhận ${items.length} tiêu chí đối chiếu (chưa xác định yêu cầu bắt buộc cụ thể trong JD); trong đó có ${totalGapCount} tiêu chí chưa thấy bằng chứng.`;
    } else {
      verdictStatement = `Identified ${items.length} evaluated criteria (no mandatory requirements explicitly marked in JD); ${totalGapCount} criteria currently lack evidence.`;
    }
  }

  // 8. Xây dựng Top Quick Wins với liên kết xác định không suy đoán
  const quickWins: QuickWinAction[] = [];
  const rawFixes = analysis.feature3?.top3MustFix || [];
  const rawImmediate = analysis.feature1?.summary?.immediateActions || [];
  const candidateFixes = rawFixes.length > 0 ? rawFixes : rawImmediate;

  const sortedGapItems = [...items]
    .filter((it) => it.matchStatus === 'thieu' || it.matchStatus === 'can_bo_sung')
    .sort((a, b) => b.term.length - a.term.length);

  for (let idx = 0; idx < Math.min(candidateFixes.length, 3); idx++) {
    const fixText = candidateFixes[idx]?.trim();
    if (!fixText) continue;

    const matchedItems: EvidenceItem[] = [];
    for (const it of sortedGapItems) {
      if (isExactWordOrPhraseMatch(it.term, fixText)) {
        matchedItems.push(it);
      }
    }

    let targetGroupId: string | undefined;
    let targetItemId: string | undefined;

    if (matchedItems.length === 1) {
      const singleMatch = matchedItems[0];
      targetItemId = singleMatch.id;
      const parentGroup = groups.find((g) => g.items.some((it) => it.id === singleMatch.id));
      targetGroupId = parentGroup?.id;
    }

    quickWins.push({
      id: `qw-${idx + 1}`,
      title: fixText,
      actionText: isVi ? 'Xem vị trí đối chiếu' : 'View requirement & evidence',
      targetGroupId,
      targetItemId,
      source: rawFixes.length > 0 ? 'recruiter_fix' : 'immediate_action',
    });
  }

  if (quickWins.length === 0 || quickWins.every((qw) => !qw.targetItemId)) {
    const mustHaveGaps = items.filter((it) => it.isMustHave && it.matchStatus === 'thieu');
    for (let k = 0; k < Math.min(mustHaveGaps.length, 3); k++) {
      const gapItem = mustHaveGaps[k];
      const parentGroup = groups.find((g) => g.items.some((it) => it.id === gapItem.id));

      quickWins.unshift({
        id: `qw-direct-${k + 1}`,
        title: isVi
          ? `Bổ sung bằng chứng cho yêu cầu bắt buộc: "${gapItem.term}"`
          : `Provide evidence for mandatory requirement: "${gapItem.term}"`,
        actionText: isVi ? 'Xem vị trí đối chiếu' : 'View requirement & evidence',
        targetGroupId: parentGroup?.id,
        targetItemId: gapItem.id,
        source: 'priority_gap',
      });
    }
  }

  const finalQuickWins = quickWins.slice(0, 3);

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
      mustHaveEvaluated,
      mustHavePassed,
      mustHavePartial,
      mustHaveGap,
      mustHaveUnknown,
      mustHaveUncompared,
      mustHaveSource: primaryMustHaveSource,
      explicitMustHaveCount,
      inferredMustHaveCount,
      overallScore,
      scoreRationale,
      inviteDecision: analysis.feature3?.inviteDecision,
      decisionReason: analysis.feature3?.decisionReason,
      quickWins: finalQuickWins,
    },
    groups,
    uncomparedKeywords,
    totalCriteriaCount: items.length,
    totalMustHaveCount,
    totalGapCount,
    totalUnknownCount,
    totalUncomparedCount: uncomparedKeywords.length,
    initialOpenGroupId,
  };
}
