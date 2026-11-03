/**
 * Engine xử lý logic Client-Side cho Prototype Google UX Sandbox (Đợt 0)
 * Đảm bảo:
 * 1. Stable Linking: Dùng sourceBlockId và suggestionId cố định, không dùng s-${idx}
 * 2. Phân đoạn chính xác: Hai đoạn có câu giống nhau chỉ sửa đúng blockId được chọn
 * 3. Chống ghi đè: Sửa tay hoặc xóa block nguồn -> chuyển needs_review
 * 4. Chống số liệu ảo: 'Không có số liệu' dùng câu định tính có căn cứ; chặn xuất nếu còn placeholder
 * 5. Undo/Redo: Hoàn tác đa tầng, thao tác mới xóa nhánh Redo cũ
 * 6. Điểm số: Luôn gắn với bản CV gốc đã phân tích (v1.0)
 */

export interface CvBlock {
  id: string; // ID duy nhất của đoạn (VD: 'block-exp-techcorp-1')
  section: 'summary' | 'experience' | 'skills' | 'education';
  sectionTitle: string;
  content: string; // Nội dung thực tế trong bản nháp hiện tại
  originalContent: string; // Nội dung gốc lúc nạp ban đầu
  revision: number; // Đếm số lần chỉnh sửa của block này
  isDeleted?: boolean;
}

export type SuggestionStatus = 'pending' | 'applied' | 'dismissed' | 'needs_review';

export interface Suggestion {
  id: string; // ID cố định của đề xuất (VD: 'sug-perf-web')
  title: string; // Tiêu đề ngắn gọn của Quick Win
  sourceBlockId: string; // Trỏ chính xác vào CvBlock.id
  expectedOriginalText: string; // Chuỗi văn bản dự kiến trong block
  rewrittenText: string; // Câu đề xuất hoàn chỉnh (Google XYZ)
  qualitativeFallbackText: string; // Câu thay thế trung thực khi không có số liệu
  placeholders: string[]; // Danh sách placeholder: ['[X%]', '[Số lượng]']
  userValues?: Record<string, string>; // Giá trị thật do người dùng điền
  status: SuggestionStatus;
  reviewReason?: string; // Lý do cần kiểm tra lại
  quickWinTag: string; // Nhãn: 'Kéo điểm +6', 'Bắt buộc'
}

export interface SandboxHistorySnapshot {
  blocks: CvBlock[];
  suggestions: Record<string, Suggestion>;
  actionDescription: string;
}

export interface SandboxEngineState {
  blocks: CvBlock[];
  suggestions: Record<string, Suggestion>;
  historyPast: SandboxHistorySnapshot[];
  historyFuture: SandboxHistorySnapshot[];
  lastAction: string;
  originalAnalyzedVersion: string; // 'v1.0'
  originalScore: number; // 78
}

/**
 * Khởi tạo dữ liệu mẫu ẩn danh cho Sandbox Đợt 0
 */
export function createInitialSandboxState(): SandboxEngineState {
  const duplicateSentence = 'Chịu trách nhiệm phát triển và bảo trì các module frontend của hệ thống.';

  const blocks: CvBlock[] = [
    {
      id: 'block-summary-1',
      section: 'summary',
      sectionTitle: 'Tóm Tắt Chuyên Môn',
      content: 'Kỹ sư Frontend với hơn 5 năm kinh nghiệm xây dựng ứng dụng web quy mô lớn với React và TypeScript.',
      originalContent: 'Kỹ sư Frontend với hơn 5 năm kinh nghiệm xây dựng ứng dụng web quy mô lớn với React và TypeScript.',
      revision: 0,
    },
    {
      id: 'block-exp-fintech-1',
      section: 'experience',
      sectionTitle: 'Kinh Nghiệm: Senior Frontend Engineer tại Fintech Corp (2022 - Hiện tại)',
      content: duplicateSentence, // Câu xuất hiện lần 1
      originalContent: duplicateSentence,
      revision: 0,
    },
    {
      id: 'block-exp-fintech-2',
      section: 'experience',
      sectionTitle: 'Kinh Nghiệm: Senior Frontend Engineer tại Fintech Corp (2022 - Hiện tại)',
      content: 'Tối ưu hóa hiệu năng website bán hàng, giúp trang web tải nhanh hơn và khách hàng hài lòng hơn.',
      originalContent: 'Tối ưu hóa hiệu năng website bán hàng, giúp trang web tải nhanh hơn và khách hàng hài lòng hơn.',
      revision: 0,
    },
    {
      id: 'block-exp-ecommerce-1',
      section: 'experience',
      sectionTitle: 'Kinh Nghiệm: Frontend Developer tại E-commerce Retail (2019 - 2022)',
      content: duplicateSentence, // Câu xuất hiện lần 2 (để kiểm chứng không bị replace nhầm)
      originalContent: duplicateSentence,
      revision: 0,
    },
    {
      id: 'block-exp-ecommerce-2',
      section: 'experience',
      sectionTitle: 'Kinh Nghiệm: Frontend Developer tại E-commerce Retail (2019 - 2022)',
      content: 'Làm việc cùng nhóm kỹ sư để triển khai giao diện theo thiết kế Figma.',
      originalContent: 'Làm việc cùng nhóm kỹ sư để triển khai giao diện theo thiết kế Figma.',
      revision: 0,
    },
    {
      id: 'block-skills-1',
      section: 'skills',
      sectionTitle: 'Kỹ Năng & Công Nghệ',
      content: 'JavaScript, TypeScript, React, Redux, HTML5, CSS3, TailwindCSS, Git.',
      originalContent: 'JavaScript, TypeScript, React, Redux, HTML5, CSS3, TailwindCSS, Git.',
      revision: 0,
    },
  ];

  const suggestions: Record<string, Suggestion> = {
    // Kịch bản 1: Áp dụng ngay (Không cần số liệu, kiểm chứng duplicate sentence)
    'sug-duplicate-job1': {
      id: 'sug-duplicate-job1',
      title: 'Làm rõ phạm vi kỹ thuật tại Fintech Corp',
      sourceBlockId: 'block-exp-fintech-1', // Chỉ nhắm vào Job 1, KHÔNG sửa Job 2
      expectedOriginalText: duplicateSentence,
      rewrittenText: 'Chủ trì thiết kế kiến trúc và phát triển hơn 15 module giao diện phức tạp bằng React 18, TypeScript và Webpack.',
      qualitativeFallbackText: 'Chủ trì thiết kế kiến trúc và phát triển các module giao diện phức tạp bằng React 18 và TypeScript.',
      placeholders: [],
      status: 'pending',
      quickWinTag: 'Quick Win 1 • Rõ phạm vi',
    },

    // Kịch bản 2: Cần số liệu thực tế (Google XYZ formula)
    'sug-perf-web': {
      id: 'sug-perf-web',
      title: 'Định lượng thành tích tối ưu hiệu năng',
      sourceBlockId: 'block-exp-fintech-2',
      expectedOriginalText: 'Tối ưu hóa hiệu năng website bán hàng, giúp trang web tải nhanh hơn và khách hàng hài lòng hơn.',
      rewrittenText: 'Tối ưu hóa hiệu năng website thông qua Code-Splitting và Web Workers, giúp giảm [X%] thời gian tải trang và tăng [Y%] tỷ lệ chuyển đổi.',
      qualitativeFallbackText: 'Tối ưu hóa hiệu năng website thông qua Code-Splitting và Web Workers, cải thiện rõ rệt tốc độ tải trang theo chỉ số Core Web Vitals.',
      placeholders: ['[X%]', '[Y%]'],
      status: 'pending',
      quickWinTag: 'Quick Win 2 • Kéo điểm +6',
    },

    // Kịch bản 3: Bổ sung năng lực Cloud vào phần kỹ năng
    'sug-cloud-skills': {
      id: 'sug-cloud-skills',
      title: 'Bổ sung từ khóa Cloud (AWS/Docker) còn thiếu',
      sourceBlockId: 'block-skills-1',
      expectedOriginalText: 'JavaScript, TypeScript, React, Redux, HTML5, CSS3, TailwindCSS, Git.',
      rewrittenText: 'JavaScript, TypeScript, React, Redux, HTML5, CSS3, TailwindCSS, Docker, CI/CD Pipeline, AWS (S3/CloudFront), Git.',
      qualitativeFallbackText: 'JavaScript, TypeScript, React, Redux, HTML5, CSS3, TailwindCSS, Docker, AWS cơ bản, Git.',
      placeholders: [],
      status: 'pending',
      quickWinTag: 'Quick Win 3 • Bắt buộc (Must-Have)',
    },
  };

  return {
    blocks,
    suggestions,
    historyPast: [],
    historyFuture: [],
    lastAction: 'Khởi tạo trạng thái ban đầu',
    originalAnalyzedVersion: 'v1.0 (Điểm: 78/100)',
    originalScore: 78,
  };
}

/**
 * Lưu snapshot vào history trước khi đột biến state
 */
function recordHistory(state: SandboxEngineState, description: string): SandboxEngineState {
  const snapshot: SandboxHistorySnapshot = {
    blocks: JSON.parse(JSON.stringify(state.blocks)),
    suggestions: JSON.parse(JSON.stringify(state.suggestions)),
    actionDescription: description,
  };

  return {
    ...state,
    historyPast: [...state.historyPast, snapshot],
    historyFuture: [], // Khi có action mới, xóa sạch nhánh Redo cũ
    lastAction: description,
  };
}

/**
 * Áp dụng đề xuất có điền số liệu hoặc không có placeholder
 */
export function applySuggestion(
  state: SandboxEngineState,
  suggestionId: string,
  userValues?: Record<string, string>
): { state: SandboxEngineState; success: boolean; error?: string } {
  const suggestion = state.suggestions[suggestionId];
  if (!suggestion) {
    return { state, success: false, error: 'Không tìm thấy đề xuất.' };
  }

  const targetBlockIndex = state.blocks.findIndex((b) => b.id === suggestion.sourceBlockId && !b.isDeleted);
  if (targetBlockIndex === -1) {
    // Đoạn nguồn đã bị xóa
    const updatedSuggestions = {
      ...state.suggestions,
      [suggestionId]: {
        ...suggestion,
        status: 'needs_review' as SuggestionStatus,
        reviewReason: 'Đoạn nguồn đã bị xóa khỏi bản nháp. Không thể tự động áp dụng.',
      },
    };
    return {
      state: { ...state, suggestions: updatedSuggestions },
      success: false,
      error: 'Đoạn nguồn đã bị xóa. Vui lòng khôi phục đoạn văn bản hoặc chọn vị trí mới.',
    };
  }

  const targetBlock = state.blocks[targetBlockIndex];

  // Kiểm tra xem đoạn nguồn có bị sửa tay làm mất câu kỳ vọng không
  if (!targetBlock.content.includes(suggestion.expectedOriginalText)) {
    const updatedSuggestions = {
      ...state.suggestions,
      [suggestionId]: {
        ...suggestion,
        status: 'needs_review' as SuggestionStatus,
        reviewReason: 'Nội dung đoạn nguồn đã bị người dùng sửa đổi trực tiếp. Cần kiểm tra lại trước khi áp dụng.',
      },
    };
    return {
      state: { ...state, suggestions: updatedSuggestions },
      success: false,
      error: 'Đoạn nguồn đã bị sửa tay. Đề xuất đã được chuyển sang trạng thái Cần kiểm tra lại.',
    };
  }

  // Chuẩn bị câu thay thế
  let finalSentence = suggestion.rewrittenText;
  if (suggestion.placeholders.length > 0) {
    if (!userValues) {
      return { state, success: false, error: 'Đề xuất yêu cầu điền số liệu thực tế trước khi áp dụng.' };
    }
    for (const ph of suggestion.placeholders) {
      const val = userValues[ph]?.trim();
      if (!val) {
        return { state, success: false, error: `Vui lòng điền giá trị thực tế cho trường ${ph}.` };
      }
      finalSentence = finalSentence.replace(ph, val);
    }
  }

  const stateWithHistory = recordHistory(state, `Áp dụng đề xuất: "${suggestion.title}"`);

  // CHỈ THAY THẾ TRONG ĐÚNG BLOCK ĐƯỢC CHỌN (Không replace toàn CV)
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
      status: 'applied' as SuggestionStatus,
      userValues: userValues || {},
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
 * Áp dụng phương án "Không có số liệu": Sử dụng câu định tính trung thực
 */
export function applyQualitativeFallback(
  state: SandboxEngineState,
  suggestionId: string
): { state: SandboxEngineState; success: boolean; error?: string } {
  const suggestion = state.suggestions[suggestionId];
  if (!suggestion) {
    return { state, success: false, error: 'Không tìm thấy đề xuất.' };
  }

  const targetBlockIndex = state.blocks.findIndex((b) => b.id === suggestion.sourceBlockId && !b.isDeleted);
  if (targetBlockIndex === -1) {
    return { state, success: false, error: 'Đoạn nguồn đã bị xóa.' };
  }

  const targetBlock = state.blocks[targetBlockIndex];
  if (!targetBlock.content.includes(suggestion.expectedOriginalText)) {
    return { state, success: false, error: 'Nội dung đoạn nguồn đã bị sửa tay.' };
  }

  const stateWithHistory = recordHistory(state, `Áp dụng phương án Định tính: "${suggestion.title}"`);

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
      status: 'applied' as SuggestionStatus,
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
 * Người dùng gõ sửa trực tiếp vào một block trong CV
 */
export function manualEditBlock(
  state: SandboxEngineState,
  blockId: string,
  newContent: string
): SandboxEngineState {
  const targetIndex = state.blocks.findIndex((b) => b.id === blockId && !b.isDeleted);
  if (targetIndex === -1) return state;

  const currentBlock = state.blocks[targetIndex];
  if (currentBlock.content === newContent) return state;

  const stateWithHistory = recordHistory(state, `Sửa tay đoạn: ${currentBlock.sectionTitle}`);

  const updatedBlocks = [...stateWithHistory.blocks];
  updatedBlocks[targetIndex] = {
    ...currentBlock,
    content: newContent,
    revision: currentBlock.revision + 1,
  };

  // Kiểm tra xem có đề xuất nào trỏ vào block này bị ảnh hưởng không
  const updatedSuggestions = { ...stateWithHistory.suggestions };
  for (const [id, sug] of Object.entries(updatedSuggestions)) {
    if (sug.sourceBlockId === blockId) {
      if (!newContent.includes(sug.expectedOriginalText) && sug.status === 'pending') {
        updatedSuggestions[id] = {
          ...sug,
          status: 'needs_review',
          reviewReason: 'Bạn vừa sửa tay đoạn văn bản này. Vui lòng đối chiếu lại.',
        };
      }
    }
  }

  return {
    ...stateWithHistory,
    blocks: updatedBlocks,
    suggestions: updatedSuggestions,
  };
}

/**
 * Xóa một block trong CV
 */
export function deleteBlock(state: SandboxEngineState, blockId: string): SandboxEngineState {
  const targetIndex = state.blocks.findIndex((b) => b.id === blockId && !b.isDeleted);
  if (targetIndex === -1) return state;

  const stateWithHistory = recordHistory(state, `Xóa đoạn: ${state.blocks[targetIndex].sectionTitle}`);

  const updatedBlocks = stateWithHistory.blocks.map((b) =>
    b.id === blockId ? { ...b, isDeleted: true, revision: b.revision + 1 } : b
  );

  const updatedSuggestions = { ...stateWithHistory.suggestions };
  for (const [id, sug] of Object.entries(updatedSuggestions)) {
    if (sug.sourceBlockId === blockId) {
      updatedSuggestions[id] = {
        ...sug,
        status: 'needs_review',
        reviewReason: 'Đoạn nguồn đã bị xóa khỏi bản nháp.',
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
 * Hoàn tác (Undo)
 */
export function undo(state: SandboxEngineState): SandboxEngineState {
  if (state.historyPast.length === 0) return state;

  const previousSnapshot = state.historyPast[state.historyPast.length - 1];
  const newPast = state.historyPast.slice(0, state.historyPast.length - 1);

  const currentSnapshot: SandboxHistorySnapshot = {
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
    lastAction: `Hoàn tác: ${previousSnapshot.actionDescription}`,
  };
}

/**
 * Làm lại (Redo)
 */
export function redo(state: SandboxEngineState): SandboxEngineState {
  if (state.historyFuture.length === 0) return state;

  const nextSnapshot = state.historyFuture[0];
  const newFuture = state.historyFuture.slice(1);

  const currentSnapshot: SandboxHistorySnapshot = {
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
    lastAction: `Làm lại: ${nextSnapshot.actionDescription}`,
  };
}

/**
 * Kiểm tra xem trong toàn bộ bản nháp CV còn chứa placeholder chưa xử lý không
 * Theo dõi cả trong văn bản bản nháp, không cấm ngoặc vuông hợp lệ (VD: [React, TypeScript])
 */
export function checkUnresolvedPlaceholdersInDraft(state: SandboxEngineState): string[] {
  // Tập hợp tất cả các placeholder đã được định nghĩa trong danh sách suggestions
  const registeredPlaceholders = new Set<string>();
  Object.values(state.suggestions).forEach((sug) => {
    sug.placeholders.forEach((ph) => registeredPlaceholders.add(ph));
  });

  // Tìm trong các blocks đang kích hoạt
  const foundPlaceholders: string[] = [];
  const activeBlocks = state.blocks.filter((b) => !b.isDeleted);

  for (const block of activeBlocks) {
    for (const ph of registeredPlaceholders) {
      if (block.content.includes(ph) && !foundPlaceholders.includes(ph)) {
        foundPlaceholders.push(ph);
      }
    }
  }

  return foundPlaceholders;
}

/**
 * Kiểm tra xem có đủ điều kiện xuất CV cuối cùng không
 */
export function canExportFinalCv(state: SandboxEngineState): { canExport: boolean; reason?: string } {
  const unresolved = checkUnresolvedPlaceholdersInDraft(state);
  if (unresolved.length > 0) {
    return {
      canExport: false,
      reason: `Không thể xuất CV cuối vì còn ${unresolved.length} trường chưa xử lý: ${unresolved.join(', ')}. Vui lòng điền số liệu thật hoặc chọn phương án định tính.`,
    };
  }
  return { canExport: true };
}
