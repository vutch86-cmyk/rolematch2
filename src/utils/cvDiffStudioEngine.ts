import { BulletRewriteItem, TailoredSummaryPitch } from '../types';

export interface CvStudioBlock {
  id: string;
  section: 'summary' | 'experience' | 'skills' | 'other';
  sectionTitle: string;
  content: string;
  originalContent: string;
  revision: number;
  isDeleted?: boolean;
}

export type StudioSuggestionStatus = 'pending' | 'applied' | 'dismissed' | 'needs_review';

export interface StudioSuggestion {
  id: string;
  title: string;
  sourceBlockId: string;
  expectedOriginalText: string;
  issueInOriginal: string;
  rewrittenText: string;
  qualitativeFallbackText: string;
  reasonBetter: string;
  placeholders: string[];
  embeddedKeywords: string[];
  userValues?: Record<string, string>;
  status: StudioSuggestionStatus;
  reviewReason?: string;
  isLackingInfo?: boolean;
}

export interface StudioHistorySnapshot {
  blocks: CvStudioBlock[];
  suggestions: Record<string, StudioSuggestion>;
  actionDescription: string;
}

export interface CvStudioEngineState {
  blocks: CvStudioBlock[];
  suggestions: Record<string, StudioSuggestion>;
  suggestionOrder: string[];
  historyPast: StudioHistorySnapshot[];
  historyFuture: StudioHistorySnapshot[];
  lastAction: string;
}

/**
 * Extracts bracketed metric placeholders from a rewritten bullet string.
 * Matches patterns like [X%], [20-25]%, [N], [Số lượng], [Doanh thu], etc.
 */
export function extractBracketPlaceholders(text: string, declaredPlaceholders?: string[]): string[] {
  if (!text) return [];
  const found = new Set<string>();

  // 1. Direct regex match for [anything] or [anything]% in rewrittenText
  const bracketRegex = /\[[^\]]+\]%?/g;
  const matches = text.match(bracketRegex);
  if (matches) {
    matches.forEach((m) => found.add(m.trim()));
  }

  // 2. Also check declared metricPlaceholders if their bracket token appears in text
  if (Array.isArray(declaredPlaceholders)) {
    for (const dp of declaredPlaceholders) {
      if (!dp) continue;
      const trimmed = dp.trim();
      if (text.includes(trimmed)) {
        found.add(trimmed);
      } else {
        const innerBracket = trimmed.match(/\[[^\]]+\]%?/);
        if (innerBracket && text.includes(innerBracket[0])) {
          found.add(innerBracket[0]);
        }
      }
    }
  }

  return Array.from(found);
}

/**
 * Synthesizes an honest qualitative fallback sentence without any bracket placeholders.
 */
export function buildQualitativeFallbackText(
  rewrittenText: string,
  placeholders: string[],
  isEn: boolean = false
): string {
  if (!rewrittenText) return '';
  if (placeholders.length === 0 && !/\[[^\]]+\]/.test(rewrittenText)) {
    return rewrittenText;
  }

  let cleaned = rewrittenText;

  // Replace common Vietnamese/English metric phrases containing brackets with honest qualitative equivalents
  cleaned = cleaned
    .replace(/giúp\s+(tăng|giảm|nâng cao|rút ngắn|cải thiện|tiết kiệm)\s+\[[^\]]+\]%?\s*/gi, (_, verb) => {
      return `giúp ${verb.toLowerCase()} đáng kể `;
    })
    .replace(/(tăng|giảm|nâng cao|rút ngắn|cải thiện|tiết kiệm)\s+\[[^\]]+\]%?\s*/gi, (_, verb) => {
      return `${verb} rõ rệt `;
    })
    .replace(/by\s+\[[^\]]+\]%?\s*/gi, 'measurably ')
    .replace(/achieving\s+\[[^\]]+\]%?\s*/gi, 'achieving significant ')
    .replace(/\[[^\]]+\]%?/g, isEn ? 'measurable' : 'đáng kể')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

  return cleaned;
}

/**
 * Builds the initial CV Diff Studio state from raw cvText and normalized rewrittenBullets.
 */
export function createInitialStudioState(
  cvText: string,
  rewrittenBullets: BulletRewriteItem[],
  tailoredSummaries?: TailoredSummaryPitch,
  isEn: boolean = false
): CvStudioEngineState {
  const blocks: CvStudioBlock[] = [];
  const suggestions: Record<string, StudioSuggestion> = {};
  const suggestionOrder: string[] = [];

  const rawLines = (cvText || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const usedLineIndices = new Set<number>();

  // Optional Summary Pitch Suggestion at top if tailoredSummaries is provided
  if (tailoredSummaries?.technicalFocus?.pitch) {
    const summaryBlockId = 'studio-block-summary-0';
    const existingSummaryIdx = rawLines.findIndex(
      (l) => l.length > 40 && /summary|tóm tắt|mục tiêu|giới thiệu|profile|kỹ sư|chuyên viên|developer|engineer|manager/i.test(l)
    );

    const origSummaryText =
      existingSummaryIdx !== -1
        ? rawLines[existingSummaryIdx]
        : isEn
        ? 'Current CV opening summary (or add a targeted executive summary at the top of your CV).'
        : 'Đoạn tóm tắt mở đầu hiện tại trong CV (hoặc bổ sung mới lên đầu CV).';

    if (existingSummaryIdx !== -1) {
      usedLineIndices.add(existingSummaryIdx);
    }

    blocks.push({
      id: summaryBlockId,
      section: 'summary',
      sectionTitle: isEn ? 'Executive Summary (Top of CV)' : 'Tóm Tắt Chuyên Môn (Mở Đầu CV)',
      content: origSummaryText,
      originalContent: origSummaryText,
      revision: 0,
    });

    const summarySugId = 'studio-sug-summary-0';
    suggestions[summarySugId] = {
      id: summarySugId,
      title: isEn
        ? 'Upgrade Executive Summary for Target Role'
        : 'Tối ưu Tóm tắt mở đầu khớp vị trí ứng tuyển',
      sourceBlockId: summaryBlockId,
      expectedOriginalText: origSummaryText,
      issueInOriginal: isEn
        ? 'Generic opening lacks immediate 10-second positioning for the target role.'
        : 'Mở đầu còn chung chung, chưa làm nổi bật định vị cốt lõi trong 10 giây đọc lướt.',
      rewrittenText: tailoredSummaries.technicalFocus.pitch,
      qualitativeFallbackText: tailoredSummaries.technicalFocus.pitch,
      reasonBetter: isEn
        ? 'Highlights core JD competencies and value proposition right at the top of the CV.'
        : 'Làm bật ngay từ khóa cốt lõi của JD và cam kết giá trị ở ngay đầu hồ sơ.',
      placeholders: extractBracketPlaceholders(tailoredSummaries.technicalFocus.pitch),
      embeddedKeywords: tailoredSummaries.technicalFocus.keyHighlights?.slice(0, 2) || [],
      status: 'pending',
    };
    suggestionOrder.push(summarySugId);
  }

  // Map each rewrittenBullet to a distinct CvStudioBlock
  rewrittenBullets.forEach((bullet, idx) => {
    const cleanOrig = (bullet.originalBullet || '').trim().replace(/^[•\-*]\s*/, '');
    const blockId = `studio-block-exp-${idx + 1}`;
    const sugId = `studio-sug-exp-${idx + 1}`;

    // Try to locate matching line in cvText that hasn't been claimed yet
    let matchedLineIdx = -1;
    if (cleanOrig) {
      matchedLineIdx = rawLines.findIndex(
        (line, lIdx) =>
          !usedLineIndices.has(lIdx) &&
          (line.includes(cleanOrig) || cleanOrig.includes(line.replace(/^[•\-*]\s*/, '')))
      );
    }

    if (matchedLineIdx !== -1) {
      usedLineIndices.add(matchedLineIdx);
    }

    const blockContent = cleanOrig || (isEn ? `Experience Bullet #${idx + 1}` : `Đoạn kinh nghiệm #${idx + 1}`);
    const placeholders = extractBracketPlaceholders(bullet.rewrittenBullet, bullet.metricPlaceholders);
    const qualitativeFallback = buildQualitativeFallbackText(bullet.rewrittenBullet, placeholders, isEn);

    blocks.push({
      id: blockId,
      section: 'experience',
      sectionTitle: isEn
        ? `Work Experience • Bullet #${idx + 1}`
        : `Kinh Nghiệm Làm Việc • Đoạn #${idx + 1}`,
      content: blockContent,
      originalContent: blockContent,
      revision: 0,
    });

    const isLacking =
      Boolean(bullet.isLackingInfo) ||
      bullet.rewrittenBullet === 'Cần bổ sung thông tin trước khi viết lại.' ||
      bullet.rewrittenBullet === 'Needs more information before rewriting.';

    suggestions[sugId] = {
      id: sugId,
      title:
        bullet.embeddedKeywords && bullet.embeddedKeywords.length > 0
          ? isEn
            ? `Strengthen impact & add: ${bullet.embeddedKeywords.slice(0, 2).join(', ')}`
            : `Định lượng kết quả & lồng ghép: ${bullet.embeddedKeywords.slice(0, 2).join(', ')}`
          : isEn
          ? `Rewrite Bullet #${idx + 1} (Google XYZ Formula)`
          : `Viết lại Đoạn #${idx + 1} (Công thức Google XYZ)`,
      sourceBlockId: blockId,
      expectedOriginalText: blockContent,
      issueInOriginal: bullet.issueInOriginal,
      rewrittenText: bullet.rewrittenBullet,
      qualitativeFallbackText: qualitativeFallback,
      reasonBetter: bullet.reasonBetter,
      placeholders,
      embeddedKeywords: bullet.embeddedKeywords || [],
      status: 'pending',
      isLackingInfo: isLacking,
    };
    suggestionOrder.push(sugId);
  });

  // Append remaining significant CV lines as context blocks (up to 6 extra blocks to keep canvas clean)
  let extraCount = 0;
  rawLines.forEach((line, lIdx) => {
    if (usedLineIndices.has(lIdx)) return;
    if (line.length < 15 || extraCount >= 6) return;
    extraCount++;
    blocks.push({
      id: `studio-block-extra-${extraCount}`,
      section: /skill|kỹ năng|công cụ|tool/i.test(line) ? 'skills' : 'other',
      sectionTitle: isEn ? `CV Section • Block #${extraCount}` : `Nội Dung CV Khác • Đoạn #${extraCount}`,
      content: line.replace(/^[•\-*]\s*/, ''),
      originalContent: line.replace(/^[•\-*]\s*/, ''),
      revision: 0,
    });
  });

  return {
    blocks,
    suggestions,
    suggestionOrder,
    historyPast: [],
    historyFuture: [],
    lastAction: isEn ? 'Initialized CV Diff Studio' : 'Khởi tạo CV Diff Studio',
  };
}

function recordStudioHistory(state: CvStudioEngineState, description: string): CvStudioEngineState {
  const snapshot: StudioHistorySnapshot = {
    blocks: JSON.parse(JSON.stringify(state.blocks)),
    suggestions: JSON.parse(JSON.stringify(state.suggestions)),
    actionDescription: description,
  };
  return {
    ...state,
    historyPast: [...state.historyPast, snapshot],
    historyFuture: [],
    lastAction: description,
  };
}

/**
 * Applies a suggestion to its target block.
 * Strictly blocks inserting any unresolved bracketed placeholders ([X%], [N], etc.).
 */
export function applyStudioSuggestion(
  state: CvStudioEngineState,
  suggestionId: string,
  userValues?: Record<string, string>,
  isEn: boolean = false
): { state: CvStudioEngineState; success: boolean; error?: string } {
  const suggestion = state.suggestions[suggestionId];
  if (!suggestion) {
    return { state, success: false, error: isEn ? 'Suggestion not found.' : 'Không tìm thấy đề xuất.' };
  }

  if (suggestion.status === 'applied') {
    return {
      state,
      success: false,
      error: isEn
        ? 'This suggestion is already applied to the draft.'
        : 'Đề xuất này đã được áp dụng vào bản nháp.',
    };
  }

  if (suggestion.isLackingInfo) {
    return {
      state,
      success: false,
      error: isEn
        ? 'This bullet requires clarifying information first, or manual editing.'
        : 'Đoạn này cần trả lời câu hỏi làm rõ hoặc tự chỉnh sửa trực tiếp.',
    };
  }

  const targetBlockIndex = state.blocks.findIndex(
    (b) => b.id === suggestion.sourceBlockId && !b.isDeleted
  );
  if (targetBlockIndex === -1) {
    const updatedSuggestions = {
      ...state.suggestions,
      [suggestionId]: {
        ...suggestion,
        status: 'needs_review' as StudioSuggestionStatus,
        reviewReason: isEn
          ? 'Target block was removed from draft.'
          : 'Đoạn nguồn đã bị xóa khỏi bản nháp.',
      },
    };
    return {
      state: { ...state, suggestions: updatedSuggestions },
      success: false,
      error: isEn ? 'Target block was removed.' : 'Đoạn nguồn đã bị xóa.',
    };
  }

  const targetBlock = state.blocks[targetBlockIndex];

  if (!targetBlock.content.includes(suggestion.expectedOriginalText)) {
    const updatedSuggestions = {
      ...state.suggestions,
      [suggestionId]: {
        ...suggestion,
        status: 'needs_review' as StudioSuggestionStatus,
        reviewReason: isEn
          ? 'You manually edited this block. Please review before replacing.'
          : 'Nội dung đoạn nguồn đã được sửa tay. Vui lòng đối chiếu trước khi thay thế.',
      },
    };
    return {
      state: { ...state, suggestions: updatedSuggestions },
      success: false,
      error: isEn
        ? 'Block was manually modified. Moved to Needs Review.'
        : 'Đoạn nguồn đã được sửa tay. Đề xuất chuyển sang trạng thái Cần kiểm tra lại.',
    };
  }

  let finalSentence = suggestion.rewrittenText;

  // Anti-Hallucination Guardrail: Verify every placeholder is filled with a non-empty, non-bracketed value
  if (suggestion.placeholders.length > 0) {
    if (!userValues) {
      return {
        state,
        success: false,
        error: isEn
          ? 'Please enter your real metrics before inserting, or choose the qualitative option.'
          : 'Vui lòng nhập số liệu thực tế trước khi chèn, hoặc chọn phương án câu định tính.',
      };
    }

    for (const ph of suggestion.placeholders) {
      const rawVal = userValues[ph]?.trim();
      if (!rawVal) {
        return {
          state,
          success: false,
          error: isEn
            ? `Please provide a real value for ${ph}.`
            : `Vui lòng nhập số liệu thực tế cho trường ${ph}.`,
        };
      }
      if (/\[[^\]]*\]/.test(rawVal)) {
        return {
          state,
          success: false,
          error: isEn
            ? `Value for ${ph} cannot contain unresolved brackets.`
            : `Giá trị của ${ph} không được chứa thẻ ngoặc vuông chưa điền.`,
        };
      }
      finalSentence = finalSentence.split(ph).join(rawVal);
    }
  }

  // Final safety scan for any remaining bracketed placeholder tokens
  if (/\[[^\]]+\]/.test(finalSentence)) {
    return {
      state,
      success: false,
      error: isEn
        ? 'Cannot insert text containing unresolved [...] placeholders into CV.'
        : 'Chặn an toàn dữ liệu: Không thể chèn câu còn chứa placeholder [...] vào CV.',
    };
  }

  const stateWithHistory = recordStudioHistory(
    state,
    isEn ? `Applied: "${suggestion.title}"` : `Áp dụng đề xuất: "${suggestion.title}"`
  );

  const newContent = targetBlock.content.replace(suggestion.expectedOriginalText, finalSentence);
  const updatedBlocks = [...stateWithHistory.blocks];
  updatedBlocks[targetBlockIndex] = {
    ...targetBlock,
    content: newContent,
    revision: targetBlock.revision + 1,
  };

  const updatedSuggestions = {
    ...stateWithHistory.suggestions,
    [suggestionId]: {
      ...suggestion,
      status: 'applied' as StudioSuggestionStatus,
      userValues: userValues ? { ...userValues } : {},
      reviewReason: undefined,
    },
  };

  return {
    state: {
      ...stateWithHistory,
      blocks: updatedBlocks,
      suggestions: updatedSuggestions,
    },
    success: true,
  };
}

/**
 * Applies the honest qualitative fallback (when candidate does not have exact metrics).
 */
export function applyStudioQualitativeFallback(
  state: CvStudioEngineState,
  suggestionId: string,
  isEn: boolean = false
): { state: CvStudioEngineState; success: boolean; error?: string } {
  const suggestion = state.suggestions[suggestionId];
  if (!suggestion) {
    return { state, success: false, error: isEn ? 'Suggestion not found.' : 'Không tìm thấy đề xuất.' };
  }

  if (suggestion.status === 'applied') {
    return {
      state,
      success: false,
      error: isEn ? 'Already applied.' : 'Đề xuất này đã được áp dụng.',
    };
  }

  const targetBlockIndex = state.blocks.findIndex(
    (b) => b.id === suggestion.sourceBlockId && !b.isDeleted
  );
  if (targetBlockIndex === -1) {
    return { state, success: false, error: isEn ? 'Target block not found.' : 'Không tìm thấy đoạn nguồn.' };
  }

  const targetBlock = state.blocks[targetBlockIndex];
  if (!targetBlock.content.includes(suggestion.expectedOriginalText)) {
    const updatedSuggestions = {
      ...state.suggestions,
      [suggestionId]: {
        ...suggestion,
        status: 'needs_review' as StudioSuggestionStatus,
        reviewReason: isEn
          ? 'Block was manually modified. Please review before replacing.'
          : 'Đoạn nguồn đã được sửa tay. Vui lòng đối chiếu trước khi thay thế.',
      },
    };
    return {
      state: { ...state, suggestions: updatedSuggestions },
      success: false,
      error: isEn ? 'Block was manually modified.' : 'Nội dung đoạn nguồn đã bị sửa tay.',
    };
  }

  const stateWithHistory = recordStudioHistory(
    state,
    isEn ? `Applied qualitative version: "${suggestion.title}"` : `Áp dụng câu định tính: "${suggestion.title}"`
  );

  const newContent = targetBlock.content.replace(
    suggestion.expectedOriginalText,
    suggestion.qualitativeFallbackText
  );

  const updatedBlocks = [...stateWithHistory.blocks];
  updatedBlocks[targetBlockIndex] = {
    ...targetBlock,
    content: newContent,
    revision: targetBlock.revision + 1,
  };

  const updatedSuggestions = {
    ...stateWithHistory.suggestions,
    [suggestionId]: {
      ...suggestion,
      status: 'applied' as StudioSuggestionStatus,
      reviewReason: undefined,
    },
  };

  return {
    state: {
      ...stateWithHistory,
      blocks: updatedBlocks,
      suggestions: updatedSuggestions,
    },
    success: true,
  };
}

/**
 * Overrides a manually edited block with the AI suggestion after user confirmation.
 */
export function overrideStudioBlockWithSuggestion(
  state: CvStudioEngineState,
  suggestionId: string,
  userValues?: Record<string, string>,
  useQualitative: boolean = false,
  isEn: boolean = false
): { state: CvStudioEngineState; success: boolean; error?: string } {
  const suggestion = state.suggestions[suggestionId];
  if (!suggestion) {
    return { state, success: false, error: isEn ? 'Suggestion not found.' : 'Không tìm thấy đề xuất.' };
  }

  const targetBlockIndex = state.blocks.findIndex(
    (b) => b.id === suggestion.sourceBlockId && !b.isDeleted
  );
  if (targetBlockIndex === -1) {
    return { state, success: false, error: isEn ? 'Target block not found.' : 'Không tìm thấy đoạn nguồn.' };
  }

  let finalSentence = useQualitative ? suggestion.qualitativeFallbackText : suggestion.rewrittenText;

  if (!useQualitative && suggestion.placeholders.length > 0) {
    if (!userValues) {
      return {
        state,
        success: false,
        error: isEn ? 'Please fill in all metric fields first.' : 'Vui lòng điền đầy đủ số liệu thực tế trước.',
      };
    }
    for (const ph of suggestion.placeholders) {
      const val = userValues[ph]?.trim();
      if (!val || /\[[^\]]*\]/.test(val)) {
        return {
          state,
          success: false,
          error: isEn ? `Please provide a valid value for ${ph}.` : `Vui lòng điền giá trị hợp lệ cho ${ph}.`,
        };
      }
      finalSentence = finalSentence.split(ph).join(val);
    }
  }

  const stateWithHistory = recordStudioHistory(
    state,
    isEn ? `Replaced block with suggestion: "${suggestion.title}"` : `Thay thế đoạn sửa tay bằng đề xuất: "${suggestion.title}"`
  );

  const targetBlock = state.blocks[targetBlockIndex];
  const updatedBlocks = [...stateWithHistory.blocks];
  updatedBlocks[targetBlockIndex] = {
    ...targetBlock,
    content: finalSentence,
    revision: targetBlock.revision + 1,
  };

  const updatedSuggestions = {
    ...stateWithHistory.suggestions,
    [suggestionId]: {
      ...suggestion,
      status: 'applied' as StudioSuggestionStatus,
      userValues: userValues ? { ...userValues } : {},
      reviewReason: undefined,
    },
  };

  return {
    state: {
      ...stateWithHistory,
      blocks: updatedBlocks,
      suggestions: updatedSuggestions,
    },
    success: true,
  };
}

/**
 * Manually edits a block and transitions any affected pending suggestion to 'needs_review'.
 */
export function manualEditStudioBlock(
  state: CvStudioEngineState,
  blockId: string,
  newContent: string,
  isEn: boolean = false
): CvStudioEngineState {
  const targetIndex = state.blocks.findIndex((b) => b.id === blockId && !b.isDeleted);
  if (targetIndex === -1) return state;

  const currentBlock = state.blocks[targetIndex];
  if (currentBlock.content === newContent) return state;

  const stateWithHistory = recordStudioHistory(
    state,
    isEn ? `Manually edited: ${currentBlock.sectionTitle}` : `Sửa tay: ${currentBlock.sectionTitle}`
  );

  const updatedBlocks = [...stateWithHistory.blocks];
  updatedBlocks[targetIndex] = {
    ...currentBlock,
    content: newContent,
    revision: currentBlock.revision + 1,
  };

  const updatedSuggestions = { ...stateWithHistory.suggestions };
  for (const [id, sug] of Object.entries(updatedSuggestions)) {
    if (sug.sourceBlockId === blockId && !newContent.includes(sug.expectedOriginalText) && sug.status === 'pending') {
      updatedSuggestions[id] = {
        ...sug,
        status: 'needs_review',
        reviewReason: isEn
          ? 'You manually edited this block. Compare before applying AI rewrite.'
          : 'Bạn vừa sửa tay đoạn văn bản này. Vui lòng đối chiếu trước khi áp dụng câu AI.',
      };
    }
  }

  return {
    ...stateWithHistory,
    blocks: updatedBlocks,
    suggestions: updatedSuggestions,
  };
}

/**
 * Dismisses or restores a suggestion.
 */
export function toggleDismissStudioSuggestion(
  state: CvStudioEngineState,
  suggestionId: string,
  isEn: boolean = false
): CvStudioEngineState {
  const sug = state.suggestions[suggestionId];
  if (!sug) return state;

  const nextStatus: StudioSuggestionStatus = sug.status === 'dismissed' ? 'pending' : 'dismissed';
  const stateWithHistory = recordStudioHistory(
    state,
    nextStatus === 'dismissed'
      ? isEn
        ? `Skipped suggestion: "${sug.title}"`
        : `Bỏ qua đề xuất: "${sug.title}"`
      : isEn
      ? `Restored suggestion: "${sug.title}"`
      : `Khôi phục đề xuất: "${sug.title}"`
  );

  return {
    ...stateWithHistory,
    suggestions: {
      ...stateWithHistory.suggestions,
      [suggestionId]: {
        ...sug,
        status: nextStatus,
      },
    },
  };
}

/**
 * Undo last action
 */
export function undoStudio(state: CvStudioEngineState, isEn: boolean = false): CvStudioEngineState {
  if (state.historyPast.length === 0) return state;

  const previousSnapshot = state.historyPast[state.historyPast.length - 1];
  const newPast = state.historyPast.slice(0, state.historyPast.length - 1);

  const currentSnapshot: StudioHistorySnapshot = {
    blocks: JSON.parse(JSON.stringify(state.blocks)),
    suggestions: JSON.parse(JSON.stringify(state.suggestions)),
    actionDescription: state.lastAction,
  };

  return {
    ...state,
    blocks: previousSnapshot.blocks,
    suggestions: previousSnapshot.suggestions,
    historyPast: newPast,
    historyFuture: [currentSnapshot, ...state.historyFuture],
    lastAction: `${isEn ? 'Undo' : 'Hoàn tác'}: ${previousSnapshot.actionDescription}`,
  };
}

/**
 * Redo previously undone action
 */
export function redoStudio(state: CvStudioEngineState, isEn: boolean = false): CvStudioEngineState {
  if (state.historyFuture.length === 0) return state;

  const nextSnapshot = state.historyFuture[0];
  const newFuture = state.historyFuture.slice(1);

  const currentSnapshot: StudioHistorySnapshot = {
    blocks: JSON.parse(JSON.stringify(state.blocks)),
    suggestions: JSON.parse(JSON.stringify(state.suggestions)),
    actionDescription: state.lastAction,
  };

  return {
    ...state,
    blocks: nextSnapshot.blocks,
    suggestions: nextSnapshot.suggestions,
    historyPast: [...state.historyPast, currentSnapshot],
    historyFuture: newFuture,
    lastAction: `${isEn ? 'Redo' : 'Làm lại'}: ${nextSnapshot.actionDescription}`,
  };
}

/**
 * Checks if any unresolved placeholders from suggestions remain in the active CV draft blocks.
 */
export function checkUnresolvedPlaceholdersInStudioDraft(state: CvStudioEngineState): string[] {
  const registeredPlaceholders = new Set<string>();
  Object.values(state.suggestions).forEach((sug) => {
    sug.placeholders.forEach((ph) => registeredPlaceholders.add(ph));
  });

  const found: string[] = [];
  const activeBlocks = state.blocks.filter((b) => !b.isDeleted);

  for (const block of activeBlocks) {
    for (const ph of registeredPlaceholders) {
      if (block.content.includes(ph) && !found.includes(ph)) {
        found.push(ph);
      }
    }
  }
  return found;
}

/**
 * Compiles the current CV draft blocks into a clean text string.
 */
export function compileStudioDraftText(state: CvStudioEngineState): string {
  return state.blocks
    .filter((b) => !b.isDeleted)
    .map((b) => (b.section === 'experience' ? `• ${b.content}` : b.content))
    .join('\n\n');
}
