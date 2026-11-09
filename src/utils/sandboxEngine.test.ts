import { describe, it, expect } from 'vitest';
import {
  createInitialSandboxState,
  applySuggestion,
  applyQualitativeFallback,
  overrideWithSuggestion,
  manualEditBlock,
  deleteBlock,
  undo,
  redo,
  checkUnresolvedPlaceholdersInDraft,
  canExportFinalCv,
} from './sandboxEngine';

describe('Sandbox Engine (Google UX Prototype Đợt 0)', () => {
  it('Kịch bản 1: Hai đoạn có câu giống nhau — chỉ sửa đúng block được chọn', () => {
    const state = createInitialSandboxState();

    // Kiểm tra câu trùng nhau ở block 1 và block 3
    const duplicateSentence = 'Chịu trách nhiệm phát triển và bảo trì các module frontend của hệ thống.';
    expect(state.blocks[1].content).toBe(duplicateSentence);
    expect(state.blocks[3].content).toBe(duplicateSentence);

    // Áp dụng đề xuất chỉ nhắm vào block 1 ('block-exp-fintech-1')
    const { state: newState, success } = applySuggestion(state, 'sug-duplicate-job1');

    expect(success).toBe(true);
    // Block 1 PHẢI được cập nhật câu mới
    expect(newState.blocks[1].content).toContain('Chủ trì thiết kế kiến trúc và phát triển hơn 15 module');
    expect(newState.blocks[1].revision).toBe(1);

    // Block 3 TUYỆT ĐỐI KHÔNG BỊ ẢNH HƯỞNG (vẫn giữ nguyên câu cũ)
    expect(newState.blocks[3].content).toBe(duplicateSentence);
    expect(newState.blocks[3].revision).toBe(0);

    // Trạng thái đề xuất cập nhật thành applied
    expect(newState.suggestions['sug-duplicate-job1'].status).toBe('applied');
  });

  it('Kịch bản 2: Sửa tay block nguồn — đề xuất chuyển needs_review, không ghi đè', () => {
    let state = createInitialSandboxState();

    // Người dùng gõ tay sửa đoạn 'block-exp-fintech-2'
    state = manualEditBlock(
      state,
      'block-exp-fintech-2',
      'Đã tự tay sửa: Tôi tối ưu ứng dụng bằng SSR và giảm 50% thời gian tải.'
    );

    // Đề xuất 'sug-perf-web' trỏ vào block này phải tự động chuyển sang needs_review
    expect(state.suggestions['sug-perf-web'].status).toBe('needs_review');
    expect(state.suggestions['sug-perf-web'].reviewReason).toBeDefined();

    // Thử áp dụng đề xuất cũ lúc này phải bị chặn, không được ghi đè câu người dùng vừa sửa tay
    const result = applySuggestion(state, 'sug-perf-web', { '[X%]': '40%', '[Y%]': '15%' });
    expect(result.success).toBe(false);
    expect(result.state.blocks[2].content).toContain('Đã tự tay sửa: Tôi tối ưu ứng dụng bằng SSR');
  });

  it('Kịch bản 2b: Xóa block nguồn — đề xuất chuyển needs_review và bị chặn áp dụng', () => {
    let state = createInitialSandboxState();

    state = deleteBlock(state, 'block-skills-1');
    expect(state.suggestions['sug-cloud-skills'].status).toBe('needs_review');

    const result = applySuggestion(state, 'sug-cloud-skills');
    expect(result.success).toBe(false);
  });

  it('Kịch bản 2c: Xem lại đề xuất AI & Thay thế có chủ đích sau khi đã sửa tay', () => {
    let state = createInitialSandboxState();

    // 1. Người dùng sửa tay
    state = manualEditBlock(state, 'block-exp-fintech-2', 'Câu tôi tự sửa tay.');
    expect(state.suggestions['sug-perf-web'].status).toBe('needs_review');

    // 2. Người dùng xem lại và chủ động thay thế bằng câu định tính
    const overrideRes = overrideWithSuggestion(state, 'sug-perf-web', undefined, true);
    expect(overrideRes.success).toBe(true);
    expect(overrideRes.state.blocks[2].content).toContain('cải thiện rõ rệt tốc độ tải trang theo chỉ số Core Web Vitals');
    expect(overrideRes.state.suggestions['sug-perf-web'].status).toBe('applied');

    // 3. Hoàn tác (Undo) khôi phục lại câu người dùng vừa sửa tay trước đó!
    state = undo(overrideRes.state);
    expect(state.blocks[2].content).toBe('Câu tôi tự sửa tay.');
    expect(state.suggestions['sug-perf-web'].status).toBe('needs_review');
  });

  it('Kịch bản 3: "Không có số liệu" — dùng câu định tính có căn cứ, không có placeholder', () => {
    let state = createInitialSandboxState();

    // Áp dụng phương án không có số liệu cho 'sug-perf-web'
    const result = applyQualitativeFallback(state, 'sug-perf-web');
    expect(result.success).toBe(true);

    // Câu mới không được chứa placeholder [X%] hay [Y%]
    expect(result.state.blocks[2].content).toContain('cải thiện rõ rệt tốc độ tải trang theo chỉ số Core Web Vitals');
    expect(result.state.blocks[2].content).not.toContain('[X%]');
    expect(result.state.blocks[2].content).not.toContain('[Y%]');
  });

  it('Kịch bản 4: Theo dõi placeholder trong bản nháp — chặn xuất CV cuối nếu còn trường chưa điền', () => {
    let state = createInitialSandboxState();

    // Ban đầu không có placeholder trong bản nháp
    expect(checkUnresolvedPlaceholdersInDraft(state)).toEqual([]);
    expect(canExportFinalCv(state).canExport).toBe(true);

    // Giả sử có một đoạn văn bản vô tình chứa placeholder chưa giải quyết
    state = manualEditBlock(state, 'block-exp-fintech-2', 'Tối ưu website giảm [X%] thời gian.');
    expect(checkUnresolvedPlaceholdersInDraft(state)).toContain('[X%]');

    const exportCheck = canExportFinalCv(state);
    expect(exportCheck.canExport).toBe(false);
    expect(exportCheck.reason).toContain('Không thể xuất CV cuối vì còn 1 trường chưa xử lý: [X%]');

    // Nhưng ngoặc vuông văn bản bình thường như [React, TypeScript] KHÔNG BỊ CHẶN NHẦM
    state = manualEditBlock(state, 'block-summary-1', 'Thành thạo công nghệ [React, TypeScript].');
    // Chỉ có [X%] bị phát hiện là placeholder chưa giải quyết
    expect(checkUnresolvedPlaceholdersInDraft(state)).toEqual(['[X%]']);
  });

  it('Kịch bản 5: Undo / Redo phục hồi cả nội dung và trạng thái; thao tác mới xóa nhánh Redo cũ', () => {
    let state = createInitialSandboxState();

    // 1. Áp dụng đề xuất A
    const resA = applySuggestion(state, 'sug-duplicate-job1');
    state = resA.state;
    expect(state.suggestions['sug-duplicate-job1'].status).toBe('applied');

    // 2. Sửa tay đoạn B
    state = manualEditBlock(state, 'block-summary-1', 'Tóm tắt mới đã sửa tay.');
    expect(state.blocks[0].content).toBe('Tóm tắt mới đã sửa tay.');

    // 3. Áp dụng đề xuất C (Cloud skills)
    const resC = applySuggestion(state, 'sug-cloud-skills');
    state = resC.state;
    expect(state.suggestions['sug-cloud-skills'].status).toBe('applied');

    // Kiểm tra lịch sử Undo
    expect(state.historyPast.length).toBe(3);

    // 4. Undo lần 1 -> Đề xuất C quay về pending
    state = undo(state);
    expect(state.suggestions['sug-cloud-skills'].status).toBe('pending');
    expect(state.blocks[0].content).toBe('Tóm tắt mới đã sửa tay.');
    expect(state.historyFuture.length).toBe(1);

    // 5. Undo lần 2 -> Tóm tắt quay về nội dung gốc
    state = undo(state);
    expect(state.blocks[0].content).not.toBe('Tóm tắt mới đã sửa tay.');
    expect(state.historyFuture.length).toBe(2);

    // 6. Undo lần 3 -> Đề xuất A quay về pending
    state = undo(state);
    expect(state.suggestions['sug-duplicate-job1'].status).toBe('pending');
    expect(state.historyFuture.length).toBe(3);

    // 7. Redo lần 1 -> Đề xuất A quay lại applied
    state = redo(state);
    expect(state.suggestions['sug-duplicate-job1'].status).toBe('applied');
    expect(state.historyFuture.length).toBe(2);

    // 8. Thực hiện một thao tác mới -> Nhánh Redo tương lai PHẢI BỊ XÓA SẠCH
    state = manualEditBlock(state, 'block-summary-1', 'Nhánh chỉnh sửa mới sau Undo.');
    expect(state.historyFuture.length).toBe(0);
  });

  it('Kịch bản 6: Điểm số luôn gắn với phiên bản CV gốc đã phân tích (v1.0)', () => {
    let state = createInitialSandboxState();

    expect(state.originalScore).toBe(78);
    expect(state.originalAnalyzedVersion).toContain('v1.0');

    // Sau khi áp dụng 2 đề xuất và sửa tay
    state = applySuggestion(state, 'sug-duplicate-job1').state;
    state = manualEditBlock(state, 'block-summary-1', 'Chỉnh sửa bản nháp.');

    // Điểm số KHÔNG ĐƯỢC TỰ ĐỘNG TĂNG lên 85 hay 90
    expect(state.originalScore).toBe(78);
    expect(state.originalAnalyzedVersion).toBe('v1.0 (Điểm: 78/100)');
  });
});
