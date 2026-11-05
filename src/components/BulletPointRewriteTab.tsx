import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BulletRewriteItem,
  TailoredSummaryPitch,
  SectionBySectionAudit,
} from '../types';
import { Language, translations } from '../utils/i18n';
import {
  normalizeFeature2Data,
  getSectionStatusConfig,
} from '../utils/bulletRewriteHelpers';
import {
  createInitialStudioState,
  applyStudioSuggestion,
  applyStudioQualitativeFallback,
  overrideStudioBlockWithSuggestion,
  manualEditStudioBlock,
  toggleDismissStudioSuggestion,
  undoStudio,
  redoStudio,
  checkUnresolvedPlaceholdersInStudioDraft,
  compileStudioDraftText,
  CvStudioBlock,
  StudioSuggestion,
  CvStudioEngineState,
} from '../utils/cvDiffStudioEngine';
import {
  HelpCircle,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Code2,
  FileCheck2,
  Lightbulb,
  Building2,
  Hash,
  RotateCcw,
  RotateCw,
  Edit3,
  FileText,
  ShieldCheck,
  Layers,
  Table,
  RefreshCw,
} from 'lucide-react';

interface BulletPointRewriteTabProps {
  clarifyingQuestions: string[];
  rewrittenBullets: BulletRewriteItem[];
  tailoredSummaries?: TailoredSummaryPitch;
  sectionAudit?: SectionBySectionAudit;
  companyName?: string;
  jobTitle?: string;
  cvText?: string;
  jdText?: string;
  onRefineWithAnswers: (answers: string) => void;
  isRefining: boolean;
  onOpenGenerateUpdatedCv?: () => void;
  onApplyDraftToMainCv?: (newCvText: string) => void;
  lang: Language;
}

export const BulletPointRewriteTab: React.FC<BulletPointRewriteTabProps> = ({
  clarifyingQuestions,
  rewrittenBullets: rawBullets,
  tailoredSummaries: rawSummaries,
  sectionAudit: rawAudit,
  companyName,
  jobTitle,
  cvText,
  jdText,
  onRefineWithAnswers,
  isRefining,
  onOpenGenerateUpdatedCv,
  onApplyDraftToMainCv,
  lang,
}) => {
  const isEn = lang === 'en';
  const t = translations[lang].bulletRewriteTab;

  // Normalize data with resilient fallbacks
  const normalized = useMemo(
    () =>
      normalizeFeature2Data(
        {
          clarifyingQuestions,
          rewrittenBullets: rawBullets,
          tailoredSummaries: rawSummaries,
          sectionAudit: rawAudit,
        },
        cvText || '',
        jdText || '',
        companyName || '',
        jobTitle || '',
        isEn
      ),
    [clarifyingQuestions, rawBullets, rawSummaries, rawAudit, cvText, jdText, companyName, jobTitle, isEn]
  );

  const {
    clarifyingQuestions: questions,
    rewrittenBullets,
    tailoredSummaries,
    sectionAudit,
  } = normalized;

  // Phase 3: CV Diff Studio State
  const [studioState, setStudioState] = useState<CvStudioEngineState>(() =>
    createInitialStudioState(cvText || '', rewrittenBullets, tailoredSummaries, isEn)
  );
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>(() => {
    const firstExp = studioState.suggestionOrder.find((id) => id.startsWith('studio-sug-exp-'));
    return firstExp || studioState.suggestionOrder[0] || '';
  });
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({});
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [manualTextBuffer, setManualTextBuffer] = useState<string>('');
  const [isReviewingOverride, setIsReviewingOverride] = useState<boolean>(false);
  const [studioNotice, setStudioNotice] = useState<{
    type: 'success' | 'warn' | 'error';
    message: string;
  } | null>(null);
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);
  const [syncedToMainCv, setSyncedToMainCv] = useState<boolean>(false);
  const [workspaceView, setWorkspaceView] = useState<'studio_and_all' | 'classic_table'>('studio_and_all');

  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Re-initialize studio state when rewrittenBullets or language changes significantly
  const studioSourceKey = useMemo(() => {
    const bulletKey = rewrittenBullets.map((b) => `${b.originalBullet}:${b.rewrittenBullet}`).join('|');
    return `${lang}::${bulletKey}`;
  }, [rewrittenBullets, lang]);

  const prevStudioSourceKeyRef = useRef<string>(studioSourceKey);
  useEffect(() => {
    if (prevStudioSourceKeyRef.current !== studioSourceKey) {
      prevStudioSourceKeyRef.current = studioSourceKey;
      const freshState = createInitialStudioState(cvText || '', rewrittenBullets, tailoredSummaries, isEn);
      setStudioState(freshState);
      const firstExp = freshState.suggestionOrder.find((id) => id.startsWith('studio-sug-exp-'));
      setActiveSuggestionId(firstExp || freshState.suggestionOrder[0] || '');
      setEditingBlockId(null);
      setIsReviewingOverride(false);
    }
  }, [studioSourceKey, cvText, rewrittenBullets, tailoredSummaries, isEn]);

  const activeSuggestion: StudioSuggestion | null =
    studioState.suggestions[activeSuggestionId] || null;

  const unresolvedPlaceholders = useMemo(
    () => checkUnresolvedPlaceholdersInStudioDraft(studioState),
    [studioState]
  );

  const appliedCount = useMemo(
    () =>
      (Object.values(studioState.suggestions) as StudioSuggestion[]).filter((s) => s.status === 'applied').length,
    [studioState.suggestions]
  );

  // Active pitch version tab: 'technical' or 'management'
  const [activePitchType, setActivePitchType] = useState<'technical' | 'management'>('technical');
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false);
  const [copiedSnippetKey, setCopiedSnippetKey] = useState<string | null>(null);

  // Clarifying answers form state
  const [answersInput, setAnswersInput] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [isAnswerBoxOpen, setIsAnswerBoxOpen] = useState<boolean>(
    questions && questions.length > 0
  );

  const activePitch =
    activePitchType === 'technical'
      ? tailoredSummaries.technicalFocus
      : tailoredSummaries.managementFocus;

  const handleSelectSuggestion = (sugId: string, scrollBlock: boolean = true) => {
    setActiveSuggestionId(sugId);
    setIsReviewingOverride(false);
    const sug = studioState.suggestions[sugId];
    if (!sug || !scrollBlock) return;

    const targetEl = blockRefs.current[sug.sourceBlockId];
    if (targetEl && typeof window !== 'undefined') {
      const rect = targetEl.getBoundingClientRect();
      const offsetPosition = rect.top + window.scrollY - 160;
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  };

  const handleApplyStudioWithMetrics = () => {
    if (!activeSuggestion) return;
    const res = applyStudioSuggestion(studioState, activeSuggestion.id, metricInputs, isEn);
    if (res.success) {
      setStudioState(res.state);
      setStudioNotice({
        type: 'success',
        message: isEn
          ? `Applied rewrite to draft: "${activeSuggestion.title}"`
          : `Đã chèn câu hoàn chỉnh vào bản nháp: "${activeSuggestion.title}"`,
      });
    } else {
      setStudioNotice({
        type: 'error',
        message:
          res.error ||
          (isEn ? 'Could not apply suggestion.' : 'Không thể chèn đề xuất. Vui lòng điền số liệu thực tế.'),
      });
    }
  };

  const handleApplyStudioQualitative = () => {
    if (!activeSuggestion) return;
    const res = applyStudioQualitativeFallback(studioState, activeSuggestion.id, isEn);
    if (res.success) {
      setStudioState(res.state);
      setStudioNotice({
        type: 'success',
        message: isEn
          ? 'Applied honest qualitative version (without unverified numbers).'
          : 'Đã áp dụng câu định tính trung thực (không chèn số liệu giả định).',
      });
    } else {
      setStudioNotice({
        type: 'error',
        message: res.error || (isEn ? 'Could not apply qualitative fallback.' : 'Không thể áp dụng.'),
      });
    }
  };

  const handleOverrideStudioBlock = (useQualitative: boolean = false) => {
    if (!activeSuggestion) return;
    const res = overrideStudioBlockWithSuggestion(
      studioState,
      activeSuggestion.id,
      metricInputs,
      useQualitative,
      isEn
    );
    if (res.success) {
      setStudioState(res.state);
      setIsReviewingOverride(false);
      setStudioNotice({
        type: 'success',
        message: isEn
          ? 'Replaced manually edited block with AI suggestion.'
          : 'Đã thay thế đoạn sửa tay bằng đề xuất AI.',
      });
    } else {
      setStudioNotice({
        type: 'error',
        message: res.error || (isEn ? 'Could not replace block.' : 'Không thể thay thế đoạn văn bản.'),
      });
    }
  };

  const handleStartManualEdit = (block: CvStudioBlock) => {
    setEditingBlockId(block.id);
    setManualTextBuffer(block.content);
  };

  const handleSaveManualEdit = (blockId: string) => {
    const updated = manualEditStudioBlock(studioState, blockId, manualTextBuffer, isEn);
    setStudioState(updated);
    setEditingBlockId(null);
    setStudioNotice({
      type: 'warn',
      message: isEn
        ? 'Saved manual edit. Linked suggestions moved to Needs Review to prevent accidental overwrite.'
        : 'Đã lưu sửa tay. Đề xuất liên quan chuyển sang "Cần kiểm tra lại" để chống ghi đè.',
    });
  };

  const handleToggleDismiss = (sugId: string) => {
    const updated = toggleDismissStudioSuggestion(studioState, sugId, isEn);
    setStudioState(updated);
  };

  const handleUndoStudio = () => {
    if (studioState.historyPast.length === 0) return;
    setStudioState((prev) => undoStudio(prev, isEn));
  };

  const handleRedoStudio = () => {
    if (studioState.historyFuture.length === 0) return;
    setStudioState((prev) => redoStudio(prev, isEn));
  };

  const handleCopyStudioDraft = () => {
    if (unresolvedPlaceholders.length > 0) {
      setStudioNotice({
        type: 'error',
        message: isEn
          ? `Cannot copy final draft while unresolved placeholders remain: ${unresolvedPlaceholders.join(', ')}`
          : `Chặn xuất CV: Còn trường số liệu chưa điền (${unresolvedPlaceholders.join(', ')}).`,
      });
      return;
    }
    const text = compileStudioDraftText(studioState);
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const handleSyncToMainCv = () => {
    if (unresolvedPlaceholders.length > 0) {
      setStudioNotice({
        type: 'error',
        message: isEn
          ? `Cannot apply to main CV while unresolved placeholders remain: ${unresolvedPlaceholders.join(', ')}`
          : `Chặn an toàn dữ liệu: Không thể cập nhật vào CV chính khi còn placeholder ${unresolvedPlaceholders.join(', ')}.`,
      });
      return;
    }
    const text = compileStudioDraftText(studioState);
    if (onApplyDraftToMainCv) {
      onApplyDraftToMainCv(text);
      setSyncedToMainCv(true);
      setStudioNotice({
        type: 'success',
        message: isEn
          ? 'Draft synced to main CV input! Click "Re-analyze" on the top Context Bar whenever you want AI to re-score.'
          : 'Đã đồng bộ bản nháp vào CV chính! Bạn có thể bấm "Chấm điểm lại" trên thanh Context Bar khi muốn tính điểm mới.',
      });
      setTimeout(() => setSyncedToMainCv(false), 3500);
    }
  };

  const handleCopyPitch = () => {
    if (activePitch?.pitch) {
      navigator.clipboard.writeText(activePitch.pitch);
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2000);
    }
  };

  const handleCopySnippet = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippetKey(key);
    setTimeout(() => setCopiedSnippetKey(null), 2000);
  };

  const handleCopySingle = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    const validBullets = rewrittenBullets
      .filter(
        (b) =>
          !b.isLackingInfo &&
          b.rewrittenBullet !== 'Cần bổ sung thông tin trước khi viết lại.' &&
          b.rewrittenBullet !== 'Needs more information before rewriting.'
      )
      .map((b) => `• ${b.rewrittenBullet}`)
      .join('\n');

    if (validBullets) {
      navigator.clipboard.writeText(validBullets);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const countWords = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  };

  return (
    <div className="space-y-8" data-testid="cv-diff-studio-tab">
      {/* ========================================================================= */}
      {/* PHASE 3 WORKSPACE HEADER & MODE SWITCHER (CV DIFF STUDIO + FULL PILLARS)   */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isEn ? 'CV Diff Studio • Google Docs Sidebar' : 'CV Diff Studio • Biên Tập Bản Nháp & Đề Xuất Bên Lề'}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {isEn
                    ? 'Anti-Hallucination Guardrail Active (0% [X%] allowed)'
                    : 'Chống số liệu ảo (Chặn 100% placeholder [X%] chưa điền)'}
                </span>
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {isEn
                ? 'Interactive CV Draft Studio & Real-Metric Assistant'
                : 'Biên Tập Bản Nháp CV 1 Cột & Thẻ Đề Xuất Bên Lề'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              {isEn
                ? 'Click any block or suggestion to inspect the Google XYZ rewrite, enter real metrics, undo/redo freely, and sync to your CV without consuming AI quota.'
                : 'Nhấp vào từng đoạn CV để xem gợi ý viết lại theo công thức Google XYZ ở lề phải, điền số liệu thật hoặc dùng câu định tính. Chỉnh sửa bản nháp hoàn toàn miễn phí, không tốn lượt chấm AI.'}
            </p>
          </div>

          {/* Toolbar: View Switcher + Undo/Redo + Sync Draft */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center text-xs">
              <button
                type="button"
                data-testid="studio-mode-btn"
                onClick={() => setWorkspaceView('studio_and_all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  workspaceView === 'studio_and_all'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isEn ? 'CV Diff Studio' : 'CV Diff Studio'}</span>
              </button>
              <button
                type="button"
                data-testid="table-mode-btn"
                onClick={() => setWorkspaceView('classic_table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  workspaceView === 'classic_table'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>{isEn ? 'Table Only' : 'Chỉ xem Bảng'}</span>
              </button>
            </div>

            {/* Undo / Redo */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                data-testid="studio-undo-btn"
                onClick={handleUndoStudio}
                disabled={studioState.historyPast.length === 0}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 transition-all cursor-pointer"
                title={isEn ? `Undo (${studioState.historyPast.length})` : `Hoàn tác (${studioState.historyPast.length})`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span
                data-testid="studio-history-count"
                className="text-xs font-mono font-bold text-slate-700 px-1.5"
              >
                {studioState.historyPast.length}
              </span>
              <button
                type="button"
                data-testid="studio-redo-btn"
                onClick={handleRedoStudio}
                disabled={studioState.historyFuture.length === 0}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 transition-all cursor-pointer"
                title={isEn ? `Redo (${studioState.historyFuture.length})` : `Làm lại (${studioState.historyFuture.length})`}
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Copy Draft */}
            <button
              type="button"
              onClick={handleCopyStudioDraft}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
            >
              {copiedDraft ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isEn ? 'Copied Draft' : 'Đã chép bản nháp'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Copy Draft' : 'Chép Bản Nháp'}</span>
                </>
              )}
            </button>

            {/* Sync Draft to Main CV */}
            {onApplyDraftToMainCv && (
              <button
                type="button"
                data-testid="sync-draft-to-cv-btn"
                onClick={handleSyncToMainCv}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {syncedToMainCv ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{isEn ? 'Synced to Main CV!' : 'Đã cập nhật vào CV chính!'}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Apply Draft to Main CV' : 'Đưa Bản Nháp Vào CV Chính'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Studio Feedback Banner */}
        {studioNotice && (
          <div
            data-testid="studio-notice-banner"
            className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
              studioNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : studioNotice.type === 'warn'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {studioNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{studioNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStudioNotice(null)}
              className="text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
            >
              {isEn ? 'Dismiss' : 'Đóng'}
            </button>
          </div>
        )}

        {/* Interactive 2-Column Google Docs Studio (Shown when workspaceView === 'studio_and_all') */}
        {workspaceView === 'studio_and_all' && (
          <div className="space-y-4">
            {/* Quick Suggestion Selector Pills */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {isEn ? 'Suggestions:' : 'Danh sách đề xuất:'}
                </span>
                {studioState.suggestionOrder.map((sugId, idx) => {
                  const sug = studioState.suggestions[sugId];
                  if (!sug) return null;
                  const isActive = activeSuggestionId === sugId;
                  return (
                    <button
                      key={sugId}
                      type="button"
                      data-testid={`studio-sug-pill-${idx + 1}`}
                      onClick={() => handleSelectSuggestion(sugId, true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : sug.status === 'applied'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : sug.status === 'needs_review'
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <span>#{idx + 1}</span>
                      <span className="max-w-[180px] truncate">{sug.title}</span>
                      {sug.status === 'applied' && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs font-bold text-slate-600">
                {isEn
                  ? `Applied: ${appliedCount}/${studioState.suggestionOrder.length}`
                  : `Đã áp dụng: ${appliedCount}/${studioState.suggestionOrder.length} đề xuất`}
              </div>
            </div>

            {/* 1-Column Clean Document (Left 7 Cols) + Sticky Suggestion Sidebar (Right 5 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 1-Column Clean Document Canvas */}
              <div className="lg:col-span-7 space-y-3" data-testid="studio-document-canvas">
                {studioState.blocks.map((block) => {
                  const linkedSuggestion = (Object.values(studioState.suggestions) as StudioSuggestion[]).find(
                    (s) => s.sourceBlockId === block.id
                  );
                  const isTargetOfActive = activeSuggestion?.sourceBlockId === block.id;
                  const isEditingThis = editingBlockId === block.id;

                  return (
                    <div
                      key={block.id}
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                      }}
                      data-testid={`studio-block-${block.id}`}
                      onClick={() => {
                        if (linkedSuggestion && !isEditingThis) {
                          handleSelectSuggestion(linkedSuggestion.id, false);
                        }
                      }}
                      className={`rounded-xl border p-4 sm:p-5 transition-all ${
                        isTargetOfActive
                          ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      } ${linkedSuggestion && !isEditingThis ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-900">{block.sectionTitle}</span>
                          {block.revision > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {isEn ? `Edited (${block.revision}x)` : `Đã cập nhật (${block.revision} lần)`}
                            </span>
                          )}
                          {linkedSuggestion?.status === 'needs_review' && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              {isEn ? 'Needs Review' : 'Cần kiểm tra lại'}
                            </span>
                          )}
                        </div>

                        <div
                          className="flex items-center gap-1.5 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isEditingThis ? (
                            <>
                              <button
                                type="button"
                                data-testid={`save-manual-edit-${block.id}`}
                                onClick={() => handleSaveManualEdit(block.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                              >
                                {isEn ? 'Save' : 'Lưu'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBlockId(null)}
                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold cursor-pointer"
                              >
                                {isEn ? 'Cancel' : 'Hủy'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              data-testid={`start-manual-edit-${block.id}`}
                              onClick={() => handleStartManualEdit(block)}
                              className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg font-semibold transition-colors cursor-pointer"
                              title={isEn ? 'Manually edit this block' : 'Tự chỉnh sửa trực tiếp đoạn này'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Edit' : 'Tự sửa'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditingThis ? (
                        <textarea
                          data-testid={`manual-edit-textarea-${block.id}`}
                          value={manualTextBuffer}
                          onChange={(e) => setManualTextBuffer(e.target.value)}
                          rows={3}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs sm:text-sm font-mono p-3 bg-white border-2 border-indigo-500 rounded-xl focus:outline-none leading-relaxed text-slate-900"
                        />
                      ) : (
                        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {block.content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Sticky Google Docs Style Suggestion Card */}
              <div className="lg:col-span-5 sticky top-36 space-y-4" data-testid="studio-sidebar-card">
                {activeSuggestion ? (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {isEn ? 'Google XYZ Suggestion' : 'Thẻ Đề Xuất Bên Lề (Google XYZ)'}
                      </span>
                      <span
                        data-testid="active-suggestion-status"
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          activeSuggestion.status === 'applied'
                            ? 'bg-emerald-100 text-emerald-800'
                            : activeSuggestion.status === 'needs_review'
                            ? 'bg-amber-100 text-amber-900'
                            : activeSuggestion.status === 'dismissed'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {activeSuggestion.status === 'applied'
                          ? isEn
                            ? 'Applied'
                            : 'Đã áp dụng'
                          : activeSuggestion.status === 'needs_review'
                          ? isEn
                            ? 'Needs Review'
                            : 'Cần kiểm tra lại'
                          : activeSuggestion.status === 'dismissed'
                          ? isEn
                            ? 'Skipped'
                            : 'Đã bỏ qua'
                          : isEn
                          ? 'Pending'
                          : 'Chờ duyệt'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-base text-slate-900 leading-snug">
                        {activeSuggestion.title}
                      </h4>
                      <p className="text-xs text-rose-700 bg-rose-50/70 border border-rose-100 rounded-lg p-2.5 mt-2 leading-relaxed">
                        <strong className="font-bold">
                          {isEn ? 'Issue in original: ' : 'Vấn đề câu gốc: '}
                        </strong>
                        {activeSuggestion.issueInOriginal}
                      </p>
                    </div>

                    {/* Needs review protection banner if user manually edited the block */}
                    {activeSuggestion.status === 'needs_review' && (
                      <div
                        data-testid="needs-review-alert"
                        className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2.5"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold">
                              {isEn ? 'Manual Edit Protection: ' : 'Bảo vệ nội dung sửa tay: '}
                            </strong>
                            {activeSuggestion.reviewReason}
                          </div>
                        </div>
                        {!isReviewingOverride ? (
                          <button
                            type="button"
                            data-testid="review-override-btn"
                            onClick={() => setIsReviewingOverride(true)}
                            className="w-full py-2 bg-white hover:bg-amber-100/70 text-amber-950 border border-amber-300 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            {isEn ? 'Compare & Decide Override' : 'Đối chiếu & Quyết định thay thế'}
                          </button>
                        ) : (
                          <div className="space-y-2 pt-1 border-t border-amber-200">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                data-testid="confirm-override-btn"
                                onClick={() =>
                                  handleOverrideStudioBlock(activeSuggestion.placeholders.length > 0 && Object.keys(metricInputs).length === 0)
                                }
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                {isEn ? 'Replace with AI Rewrite' : 'Thay bằng câu đề xuất AI'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsReviewingOverride(false)}
                                className="px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                {isEn ? 'Keep Mine' : 'Giữ bản của tôi'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Original sentence */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {isEn ? 'Original Sentence in CV:' : 'Câu gốc trong CV:'}
                      </div>
                      <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 line-through leading-relaxed">
                        {activeSuggestion.expectedOriginalText}
                      </div>
                    </div>

                    {/* Rewritten sentence */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        {isEn ? 'Suggested Rewrite (Google XYZ):' : 'Câu viết lại đề xuất (Google XYZ):'}
                      </div>
                      <div className="text-xs sm:text-sm text-emerald-950 bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-300 leading-relaxed font-semibold">
                        {activeSuggestion.rewrittenText}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        <strong className="text-slate-800">
                          {isEn ? 'Why better: ' : 'Vì sao tốt hơn: '}
                        </strong>
                        {activeSuggestion.reasonBetter}
                      </p>
                    </div>

                    {/* Anti-Hallucination Metric Inputs when placeholders exist */}
                    {activeSuggestion.placeholders.length > 0 && activeSuggestion.status !== 'applied' && (
                      <div
                        data-testid="metric-placeholder-form"
                        className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5"
                      >
                        <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>
                            {isEn
                              ? 'Enter your real metrics before inserting (Anti-Hallucination):'
                              : 'Nhập số liệu thực tế của bạn trước khi chèn (Chống bịa số liệu):'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {activeSuggestion.placeholders.map((ph, pIdx) => (
                            <div key={ph} className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-700 font-mono block">
                                {ph}
                              </label>
                              <input
                                type="text"
                                data-testid={`metric-input-${pIdx}`}
                                value={metricInputs[ph] || ''}
                                onChange={(e) =>
                                  setMetricInputs((prev) => ({ ...prev, [ph]: e.target.value }))
                                }
                                placeholder={isEn ? 'e.g. 25%' : 'VD: 25%'}
                                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 font-semibold"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {activeSuggestion.status === 'applied' ? (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              {isEn
                                ? 'Applied to CV draft.'
                                : 'Đề xuất này đã được áp dụng vào bản nháp.'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleUndoStudio}
                            className="w-full py-2 bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Undo this change' : 'Hoàn tác (Undo) thay đổi này'}</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid="apply-suggestion-btn"
                            onClick={handleApplyStudioWithMetrics}
                            disabled={activeSuggestion.status === 'needs_review'}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs"
                          >
                            {activeSuggestion.placeholders.length > 0
                              ? isEn
                                ? '✅ Confirm Real Metrics & Insert into CV'
                                : '✅ Xác nhận số liệu thật & Chèn vào CV'
                              : isEn
                              ? '✅ Accept & Insert into CV Draft'
                              : '✅ Chấp nhận & Chèn vào bản nháp CV'}
                          </button>

                          {activeSuggestion.placeholders.length > 0 && (
                            <button
                              type="button"
                              data-testid="apply-qualitative-btn"
                              onClick={handleApplyStudioQualitative}
                              disabled={activeSuggestion.status === 'needs_review'}
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
                            >
                              {isEn
                                ? '🛡️ I have no exact metrics (Use honest qualitative sentence)'
                                : '🛡️ Tôi không có số liệu (Dùng câu định tính trung thực)'}
                            </button>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const targetBlock = studioState.blocks.find(
                                  (b) => b.id === activeSuggestion.sourceBlockId
                                );
                                if (targetBlock) handleStartManualEdit(targetBlock);
                              }}
                              className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              {isEn ? '✏️ Edit Manually' : '✏️ Tự chỉnh sửa'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleDismiss(activeSuggestion.id)}
                              className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              {activeSuggestion.status === 'dismissed'
                                ? isEn
                                  ? 'Restore'
                                  : 'Khôi phục'
                                : isEn
                                ? 'Skip'
                                : 'Bỏ qua'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. PILLAR 1: TAILORED EXECUTIVE SUMMARIES (PITCH MAY ĐO)                  */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-indigo-800/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-800/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {isEn ? 'Pillar 1 • Targeted Summary' : 'Hạng mục 1 • Tóm tắt Định vị theo Vị trí'}
                </span>
                {(companyName || jobTitle) && (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {jobTitle || (isEn ? 'Target Role' : 'Vị trí ứng tuyển')}
                      {companyName ? ` @ ${companyName}` : ''}
                    </span>
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1">
                {t.tailoredSummaryTitle}
              </h3>
              <p className="text-xs sm:text-sm text-indigo-200/80 mt-1 max-w-3xl leading-relaxed">
                {t.tailoredSummaryDesc}
              </p>
            </div>

            <button
              onClick={handleCopyPitch}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer shrink-0 self-start sm:self-auto hover:scale-[1.02] active:scale-[0.98]"
            >
              {copiedPitch ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>{t.copiedPitchBtn}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-950" />
                  <span>{t.copyPitchBtn}</span>
                </>
              )}
            </button>
          </div>

          {/* Version Switcher Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-indigo-900/50 p-1.5 rounded-xl border border-indigo-800/80">
            <button
              onClick={() => setActivePitchType('technical')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePitchType === 'technical'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40'
              }`}
            >
              <Code2 className="w-4 h-4 text-indigo-300" />
              <span>{t.techFocusTab}</span>
            </button>

            <button
              onClick={() => setActivePitchType('management')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePitchType === 'management'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-indigo-800/40'
              }`}
            >
              <Briefcase className="w-4 h-4 text-indigo-300" />
              <span>{t.mgmtFocusTab}</span>
            </button>
          </div>

          {/* Active Pitch Content Card */}
          <div className="bg-slate-950/70 rounded-xl p-5 border border-indigo-800/60 space-y-4">
            <div className="flex items-center justify-between gap-3 text-xs text-indigo-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                {activePitch?.title}
              </span>
              {(() => {
                const wCount = countWords(activePitch?.pitch || '');
                if (wCount < 50) {
                  return (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-amber-950/60 text-amber-300 border-amber-500/40">
                      {wCount} {isEn ? 'words • Short (<50 words)' : 'từ • Hơi ngắn (<50 từ)'}
                    </span>
                  );
                }
                if (wCount <= 180) {
                  return (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-300 border-emerald-500/40">
                      {wCount} {isEn ? 'words • Ideal length (50–180)' : 'từ • Độ dài lý tưởng (50–180 từ)'}
                    </span>
                  );
                }
                if (wCount <= 250) {
                  return (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-cyan-950/60 text-cyan-300 border-cyan-500/40">
                      {wCount} {isEn ? 'words • Suitable for Senior/Lead (181–250)' : 'từ • Phù hợp Quản lý / Senior (181–250 từ)'}
                    </span>
                  );
                }
                return (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-amber-950/60 text-amber-300 border-amber-500/40">
                    {wCount} {isEn ? 'words • A bit long (>250 words)' : 'từ • Hơi dài (>250 từ)'}
                  </span>
                );
              })()}
            </div>

            <blockquote className="text-xs sm:text-sm text-indigo-100 font-normal leading-relaxed italic border-l-2 border-amber-400/80 pl-4 py-1 bg-indigo-950/40 rounded-r-lg">
              "{activePitch?.pitch}"
            </blockquote>

            {activePitch?.keyHighlights && activePitch.keyHighlights.length > 0 && (
              <div className="pt-2 border-t border-indigo-900/80 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                  {isEn ? 'Highlights:' : 'Điểm sáng:'}
                </span>
                {activePitch.keyHighlights.map((hl, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-900/60 text-indigo-200 border border-indigo-700/50"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{hl}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PILLAR 2: SECTION-BY-SECTION RESUME AUDIT (KHÁM BỆNH TỪNG PHẦN)        */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {isEn ? 'Pillar 2 • Structural Review' : 'Hạng mục 2 • Đánh giá Cấu trúc từng phần'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              {t.sectionAuditTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              {t.sectionAuditDesc}
            </p>
          </div>

          {sectionAudit.overallSectionRating && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl max-w-md text-xs text-slate-700">
              <span className="font-bold text-slate-900 block mb-0.5">
                {isEn ? 'Overall Diagnosis:' : 'Đánh giá chung cấu trúc:'}
              </span>
              <span>{sectionAudit.overallSectionRating}</span>
            </div>
          )}
        </div>

        {/* 4 Section Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sectionAudit.sections.map((section, idx) => {
            const statusConfig = getSectionStatusConfig(section.status, isEn);

            return (
              <div
                key={section.sectionKey || idx}
                className="bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 rounded-xl p-5 space-y-3.5 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <FileCheck2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{section.sectionName}</span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${statusConfig.badgeBg} ${statusConfig.badgeBorder}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Score Progress Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                      <span>{t.healthScoreLabel || (isEn ? 'Completeness Score' : 'Độ hoàn thiện')}</span>
                      <span className="font-mono text-slate-800">{section.score}/100</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusConfig.progressColor}`}
                        style={{ width: `${Math.min(100, Math.max(10, section.score))}%` }}
                      />
                    </div>
                  </div>

                  {/* Diagnosis Comment */}
                  <p className="text-xs text-slate-700 leading-relaxed mt-3">
                    {section.comment}
                  </p>
                </div>

                {/* Actionable Fix & Grounded Suggested Snippets */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 text-xs text-slate-800 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide block">
                        {t.actionableFixLabel}
                      </span>
                      <span className="text-slate-600 leading-relaxed">
                        {section.actionableFix}
                      </span>
                    </div>
                  </div>

                  {section.suggestedSnippets && section.suggestedSnippets.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="font-semibold text-slate-700 text-[11px] block">
                        {t.suggestedSnippetsLabel}
                      </span>
                      <div className="space-y-1.5">
                        {section.suggestedSnippets.map((snippet, sIdx) => {
                          const snippetKey = `${section.sectionKey}-${sIdx}`;
                          const isCopied = copiedSnippetKey === snippetKey;
                          return (
                            <div
                              key={sIdx}
                              className="group flex items-start justify-between gap-2 p-2 rounded-md bg-slate-50 border border-slate-200/70 hover:border-indigo-300 text-[11.5px] text-slate-800 transition-colors"
                            >
                              <span className="leading-relaxed font-normal italic text-slate-700">
                                "{snippet}"
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopySnippet(snippet, snippetKey)}
                                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition-all cursor-pointer"
                                title={t.copySnippetBtn}
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">{t.copiedSnippetBtn}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-indigo-600" />
                                    <span>{t.copySnippetBtn}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PILLAR 3: REWRITE CV BULLET POINTS (STAR / XYZ FORMULA)               */}
      {/* ========================================================================= */}

      {/* 3.1 Clarifying Questions Callout / Interactive Form */}
      {questions && questions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
              <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                {isEn
                  ? 'Clarifying Questions to Optimize Bullet Points with Metrics'
                  : 'Câu Hỏi Làm Rõ Để Tối Ưu Bullet Point Chuẩn Số Liệu'}
              </span>
            </div>
            <button
              onClick={() => setIsAnswerBoxOpen(!isAnswerBoxOpen)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              {isAnswerBoxOpen
                ? isEn
                  ? 'Hide answer form'
                  : 'Ẩn form trả lời'
                : isEn
                ? 'Answer to refine further'
                : 'Trả lời để tối ưu thêm'}
            </button>
          </div>

          <p className="text-xs sm:text-sm text-amber-900/80 mb-4 leading-relaxed">
            {isEn
              ? 'To make your bullet points as measurable and convincing as possible, provide a few additional details (if available):'
              : 'Để các bullet point có kết quả đo lường thuyết phục nhất, bạn hãy cung cấp thêm một vài chi tiết thực tế (nếu có):'}
          </p>

          <div className="space-y-2 mb-4 bg-white/80 p-4 rounded-xl border border-amber-200/60">
            {questions.map((q, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-amber-950">
                <span className="font-bold text-amber-600 min-w-[20px]">
                  {idx + 1}.
                </span>
                <span className="font-medium">{q}</span>
              </div>
            ))}
          </div>

          {isAnswerBoxOpen && (
            <div className="space-y-3 pt-2">
              <textarea
                value={answersInput}
                onChange={(e) => setAnswersInput(e.target.value)}
                placeholder={
                  isEn
                    ? 'Enter your short answers here... (e.g., 1. Increased sales by 25%, 2. Used GA4 & Meta Ads, 3. Managed 4 people)'
                    : 'Nhập câu trả lời ngắn của bạn tại đây... (Ví dụ: 1. Doanh số tăng 25%, 2. Dùng công cụ GA4 và Meta Ads, 3. Team có 4 người)'
                }
                className="w-full h-24 p-3 text-xs sm:text-sm bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => onRefineWithAnswers(answersInput)}
                  disabled={!answersInput.trim() || isRefining}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    answersInput.trim() && !isRefining
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isRefining ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{isEn ? 'Generating new rewrites...' : 'Đang tạo bản viết lại mới...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Refine Bullet Points with This Info' : 'Tái Tối Ưu Bullet Point Với Thông Tin Này'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3.2 Full Updated CV Generation Banner */}
      {onOpenGenerateUpdatedCv && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-700/80 relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {isEn
                  ? 'Automatically Generate Updated CV with AI Assistant'
                  : 'Tự Động Cập Nhật CV Hoàn Chỉnh Với Trợ Lý AI'}
              </h3>
              <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
                {isEn
                  ? 'Automatically merge all rewritten bullet points, incorporate missing JD keywords, and generate a complete new CV.'
                  : 'Tự động ghép tất cả các bullet point, kết hợp từ khóa JD còn thiếu và xuất ra một bản CV mới hoàn chỉnh.'}
              </p>
            </div>

            <button
              onClick={onOpenGenerateUpdatedCv}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>{isEn ? 'Update CV with AI Assistant' : 'Cập Nhật CV Bằng Trợ Lý AI'}</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        </div>
      )}

      {/* 3.3 Rewritten Bullets Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                {isEn ? 'Pillar 3 • Bullet Rewrite (XYZ / STAR)' : 'Hạng mục 3 • Viết lại Bullet Point'}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-base mt-1">
              {isEn
                ? 'Detailed Bullet Point Rewrite Comparison'
                : 'Bảng Viết Lại Bullet Point So Sánh Chi Tiết'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEn
                ? 'Compare each original sentence in your CV with the optimized version aligned with JD keywords and quantifiable metrics.'
                : 'So sánh từng câu gốc trong CV với phiên bản đã tối ưu hóa theo công thức XYZ / STAR và lồng ghép từ khóa JD.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              {rewrittenBullets.length} {isEn ? 'bullet points' : 'bullet points'}
            </span>

            <button
              onClick={handleCopyAll}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{isEn ? 'Copied all bullets!' : 'Đã sao chép tất cả bullet!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Copy All New Bullets' : 'Sao Chép Tất Cả Bullet Mới'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4 w-[22%]">{isEn ? 'Original CV Bullet' : 'Bullet Gốc Trong CV'}</th>
                <th className="py-3 px-4 w-[20%]">{isEn ? 'Issue in Original' : 'Vấn Đề Của Bullet Gốc'}</th>
                <th className="py-3 px-4 w-[38%]">{isEn ? 'Rewritten Bullet (STAR / XYZ)' : 'Bullet Được Viết Lại (STAR / XYZ)'}</th>
                <th className="py-3 px-4 w-[20%]">{isEn ? 'Why New Version is Better' : 'Vì Sao Bản Mới Tốt Hơn'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {rewrittenBullets.map((item, idx) => {
                const isLacking =
                  item.isLackingInfo ||
                  item.rewrittenBullet === 'Cần bổ sung thông tin trước khi viết lại.' ||
                  item.rewrittenBullet === 'Needs more information before rewriting.';
                const wordCount = countWords(item.rewrittenBullet);

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    {/* Original bullet */}
                    <td className="py-4 px-4 text-slate-700 align-top">
                      <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200/60 text-slate-800 leading-relaxed font-mono text-xs">
                        {item.originalBullet}
                      </div>
                    </td>

                    {/* Issue in original */}
                    <td className="py-4 px-4 align-top">
                      <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100 text-rose-950 text-xs leading-relaxed">
                        {item.issueInOriginal}
                      </div>
                    </td>

                    {/* Rewritten bullet */}
                    <td className="py-4 px-4 align-top">
                      {isLacking ? (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            {isEn
                              ? 'Needs more information before rewriting.'
                              : 'Cần bổ sung thông tin trước khi viết lại.'}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl text-emerald-950 space-y-2.5">
                          <p className="font-semibold text-xs sm:text-sm leading-relaxed text-emerald-950">
                            • {item.rewrittenBullet}
                          </p>

                          {/* Embedded keywords & Metric slots */}
                          {((item.embeddedKeywords && item.embeddedKeywords.length > 0) ||
                            (item.metricPlaceholders && item.metricPlaceholders.length > 0)) && (
                            <div className="pt-2 border-t border-emerald-200/70 flex flex-col gap-1.5 text-[11px]">
                              {item.embeddedKeywords && item.embeddedKeywords.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-emerald-800 font-bold flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    {t.embeddedKeywordsLabel}
                                  </span>
                                  {item.embeddedKeywords.map((kw, ki) => (
                                    <span
                                      key={ki}
                                      className="px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 font-medium border border-emerald-300/50"
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {item.metricPlaceholders && item.metricPlaceholders.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-amber-800 font-bold flex items-center gap-1">
                                    <Hash className="w-3 h-3 text-amber-600" />
                                    {t.metricPlaceholdersLabel}
                                  </span>
                                  {item.metricPlaceholders.map((mp, mi) => (
                                    <span
                                      key={mi}
                                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-mono font-semibold border border-amber-300/60"
                                    >
                                      {mp}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800">
                            <span className="flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {wordCount} {isEn ? 'words (Concise & complete)' : 'từ (Ngắn gọn và đầy đủ)'}
                            </span>

                            <button
                              onClick={() => handleCopySingle(item.rewrittenBullet, idx)}
                              className="flex items-center gap-1 text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer"
                              title={isEn ? 'Copy this bullet' : 'Sao chép bullet này'}
                            >
                              {copiedIndex === idx ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>{isEn ? 'Copied' : 'Đã chép'}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-emerald-700" />
                                  <span>{isEn ? 'Copy' : 'Sao chép'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Why better */}
                    <td className="py-4 px-4 text-slate-700 leading-relaxed align-top">
                      <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 text-indigo-950 text-xs">
                        {item.reasonBetter}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
