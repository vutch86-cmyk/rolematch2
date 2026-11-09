import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  extractBracketPlaceholders,
  buildQualitativeFallbackText,
  createInitialStudioState,
  applyStudioSuggestion,
  applyStudioQualitativeFallback,
  manualEditStudioBlock,
  overrideStudioBlockWithSuggestion,
  undoStudio,
  redoStudio,
  checkUnresolvedPlaceholdersInStudioDraft,
  compileStudioDraftText,
} from './utils/cvDiffStudioEngine';
import { BulletPointRewriteTab } from './components/BulletPointRewriteTab';
import { InterviewPrepTab } from './components/InterviewPrepTab';
import { BulletRewriteItem } from './types';

describe('Phase 3 Verification — CV Diff Studio & Interview Prep Kit', () => {
  const sampleBullets: BulletRewriteItem[] = [
    {
      originalBullet: 'Tối ưu hóa hiệu năng website bán hàng.',
      issueInOriginal: 'Thiếu số liệu định lượng cụ thể.',
      rewrittenBullet:
        'Tối ưu hóa hiệu năng website bằng Code-Splitting, giúp giảm [X%] thời gian tải trang và tăng [Y%] tỷ lệ chuyển đổi.',
      reasonBetter: 'Áp dụng công thức Google XYZ rõ kết quả và phương pháp.',
      isLackingInfo: false,
      embeddedKeywords: ['Code-Splitting', 'Performance'],
      metricPlaceholders: ['[X%]', '[Y%]'],
    },
    {
      originalBullet: 'Phát triển các module giao diện React.',
      issueInOriginal: 'Mô tả chung chung.',
      rewrittenBullet:
        'Chủ trì thiết kế kiến trúc và triển khai các module giao diện bằng React 18 và TypeScript.',
      reasonBetter: 'Nêu rõ công nghệ cốt lõi.',
      isLackingInfo: false,
      embeddedKeywords: ['React 18', 'TypeScript'],
      metricPlaceholders: [],
    },
  ];

  const sampleCvText = [
    'Kỹ sư Frontend với 5 năm kinh nghiệm phát triển ứng dụng web.',
    '• Tối ưu hóa hiệu năng website bán hàng.',
    '• Phát triển các module giao diện React.',
  ].join('\n');

  it('1. Anti-Hallucination Guardrail: blocks applying suggestion with unresolved [X%] placeholders', () => {
    const state = createInitialStudioState(sampleCvText, sampleBullets, undefined, false);
    const sugId = 'studio-sug-exp-1';
    const sug = state.suggestions[sugId];

    expect(sug.placeholders).toEqual(['[X%]', '[Y%]']);

    // Attempt to apply without userValues -> MUST fail
    const resEmpty = applyStudioSuggestion(state, sugId, undefined, false);
    expect(resEmpty.success).toBe(false);
    expect(resEmpty.state.suggestions[sugId].status).toBe('pending');

    // Attempt to apply with only 1 of 2 placeholders filled -> MUST fail
    const resPartial = applyStudioSuggestion(state, sugId, { '[X%]': '35%' }, false);
    expect(resPartial.success).toBe(false);

    // Attempt to apply with bracketed value '[35%]' -> MUST fail
    const resBracketed = applyStudioSuggestion(
      state,
      sugId,
      { '[X%]': '[35%]', '[Y%]': '15%' },
      false
    );
    expect(resBracketed.success).toBe(false);

    // Apply with valid real metrics -> MUST succeed and contain 0 brackets
    const resValid = applyStudioSuggestion(
      state,
      sugId,
      { '[X%]': '35%', '[Y%]': '18%' },
      false
    );
    expect(resValid.success).toBe(true);
    expect(resValid.state.suggestions[sugId].status).toBe('applied');

    const updatedBlock = resValid.state.blocks.find((b) => b.id === sug.sourceBlockId)!;
    expect(updatedBlock.content).toContain('giúp giảm 35% thời gian tải trang và tăng 18% tỷ lệ chuyển đổi.');
    expect(updatedBlock.content).not.toContain('[X%]');
    expect(updatedBlock.content).not.toContain('[Y%]');
    expect(checkUnresolvedPlaceholdersInStudioDraft(resValid.state)).toEqual([]);
  });

  it('2. Qualitative Fallback: allows inserting honest qualitative sentence when user has no exact metrics', () => {
    const state = createInitialStudioState(sampleCvText, sampleBullets, undefined, false);
    const sugId = 'studio-sug-exp-1';
    const sug = state.suggestions[sugId];

    expect(sug.qualitativeFallbackText).not.toMatch(/\[[^\]]+\]/);

    const res = applyStudioQualitativeFallback(state, sugId, false);
    expect(res.success).toBe(true);
    expect(res.state.suggestions[sugId].status).toBe('applied');

    const updatedBlock = res.state.blocks.find((b) => b.id === sug.sourceBlockId)!;
    expect(updatedBlock.content).not.toMatch(/\[[^\]]+\]/);
  });

  it('3. Manual Edit Protection & Override: transitions affected pending suggestion to needs_review', () => {
    const state = createInitialStudioState(sampleCvText, sampleBullets, undefined, false);
    const sugId = 'studio-sug-exp-2';
    const blockId = state.suggestions[sugId].sourceBlockId;

    const editedState = manualEditStudioBlock(
      state,
      blockId,
      'Tôi đã tự viết lại câu kinh nghiệm React theo ý mình.',
      false
    );

    expect(editedState.suggestions[sugId].status).toBe('needs_review');

    // Direct apply must be blocked while in needs_review
    const directApply = applyStudioSuggestion(editedState, sugId, {}, false);
    expect(directApply.success).toBe(false);

    // Explicit override after comparison succeeds
    const overridden = overrideStudioBlockWithSuggestion(editedState, sugId, {}, false, false);
    expect(overridden.success).toBe(true);
    expect(overridden.state.suggestions[sugId].status).toBe('applied');
  });

  it('4. Multi-level Undo & Redo restores blocks and suggestion statuses accurately', () => {
    const state0 = createInitialStudioState(sampleCvText, sampleBullets, undefined, false);
    const sug2Id = 'studio-sug-exp-2';
    const block2Id = state0.suggestions[sug2Id].sourceBlockId;
    const origContent = state0.blocks.find((b) => b.id === block2Id)!.content;

    const res1 = applyStudioSuggestion(state0, sug2Id, {}, false);
    expect(res1.success).toBe(true);
    const state1 = res1.state;
    expect(state1.historyPast.length).toBe(1);
    expect(state1.suggestions[sug2Id].status).toBe('applied');

    const undone = undoStudio(state1, false);
    expect(undone.historyPast.length).toBe(0);
    expect(undone.historyFuture.length).toBe(1);
    expect(undone.suggestions[sug2Id].status).toBe('pending');
    expect(undone.blocks.find((b) => b.id === block2Id)!.content).toBe(origContent);

    const redone = redoStudio(undone, false);
    expect(redone.historyPast.length).toBe(1);
    expect(redone.suggestions[sug2Id].status).toBe('applied');
  });

  it('5. Renders BulletPointRewriteTab with CV Diff Studio and InterviewPrepTab with Dual Modes', () => {
    const studioHtml = renderToString(
      React.createElement(BulletPointRewriteTab, {
        clarifyingQuestions: ['Dự án có bao nhiêu người dùng?'],
        rewrittenBullets: sampleBullets,
        cvText: sampleCvText,
        jdText: 'Senior Frontend React TypeScript Performance',
        onRefineWithAnswers: () => {},
        isRefining: false,
        lang: 'vi',
      })
    );

    expect(studioHtml).toContain('data-testid="cv-diff-studio-tab"');
    expect(studioHtml).toContain('data-testid="studio-document-canvas"');
    expect(studioHtml).toContain('data-testid="studio-sidebar-card"');
    expect(studioHtml).toContain('Chống số liệu ảo');

    const interviewHtml = renderToString(
      React.createElement(InterviewPrepTab, {
        lang: 'vi',
        cvText: sampleCvText,
        jdText: 'Senior Frontend React TypeScript',
      })
    );

    expect(interviewHtml).toContain('data-testid="interview-prep-tab"');
    expect(interviewHtml).toContain('data-testid="interview-mode-list"');
    expect(interviewHtml).toContain('data-testid="interview-mode-focus"');
    expect(interviewHtml).toContain('Chế độ Luyện Tập Từng Câu');
  });
});
