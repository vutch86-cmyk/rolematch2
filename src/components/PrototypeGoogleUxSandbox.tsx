import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  createInitialSandboxState,
  applySuggestion,
  applyQualitativeFallback,
  manualEditBlock,
  deleteBlock,
  undo,
  redo,
  checkUnresolvedPlaceholdersInDraft,
  canExportFinalCv,
  CvBlock,
  Suggestion,
  SandboxEngineState,
} from '../utils/sandboxEngine';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RotateCw,
  FileText,
  Download,
  Smartphone,
  Monitor,
  Edit3,
  X,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  HelpCircle,
} from 'lucide-react';

interface PrototypeGoogleUxSandboxProps {
  onExit?: () => void;
}

export const PrototypeGoogleUxSandbox: React.FC<PrototypeGoogleUxSandboxProps> = ({ onExit }) => {
  const [engineState, setEngineState] = useState<SandboxEngineState>(() => createInitialSandboxState());
  const [activeSuggestionId, setActiveSuggestionId] = useState<string>('sug-duplicate-job1');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({ '[X%]': '40%', '[Y%]': '15%' });
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [manualTextBuffer, setManualTextBuffer] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [activeCompetencyGroup, setActiveCompetencyGroup] = useState<string>('tech');
  const [competencyFilter, setCompetencyFilter] = useState<'all' | 'must_have' | 'gap'>('all');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'warn' | 'error'; message: string } | null>(null);

  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const headerRef = useRef<HTMLDivElement | null>(null);
  const contextBarRef = useRef<HTMLDivElement | null>(null);

  // Active suggestion
  const activeSuggestion = engineState.suggestions[activeSuggestionId] || null;

  // Unresolved placeholders check
  const unresolvedPlaceholders = useMemo(() => {
    return checkUnresolvedPlaceholdersInDraft(engineState);
  }, [engineState]);

  const exportStatus = useMemo(() => {
    return canExportFinalCv(engineState);
  }, [engineState]);

  // Luồng Quick Win: Tính toán dynamic scroll offset
  const handleSelectQuickWin = (sugId: string) => {
    setActiveSuggestionId(sugId);
    const sug = engineState.suggestions[sugId];
    if (!sug) return;

    if (viewMode === 'mobile') {
      setIsMobileSheetOpen(true);
    }

    const targetEl = blockRefs.current[sug.sourceBlockId];
    if (targetEl) {
      // Đo chiều cao thực tế của header và context bar động
      const headerHeight = headerRef.current?.getBoundingClientRect().height || 64;
      const contextBarHeight = contextBarRef.current?.getBoundingClientRect().height || 48;
      const totalOffset = headerHeight + contextBarHeight + 24;

      const elementPosition = targetEl.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - totalOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    }
  };

  const handleApplyWithMetrics = () => {
    if (!activeSuggestion) return;
    const res = applySuggestion(engineState, activeSuggestion.id, metricInputs);
    if (res.success) {
      setEngineState(res.state);
      setNotification({ type: 'success', message: `Đã cập nhật bản nháp cho đề xuất "${activeSuggestion.title}".` });
      if (viewMode === 'mobile') setIsMobileSheetOpen(false);
    } else {
      setNotification({ type: 'error', message: res.error || 'Không thể áp dụng.' });
    }
  };

  const handleApplyQualitative = () => {
    if (!activeSuggestion) return;
    const res = applyQualitativeFallback(engineState, activeSuggestion.id);
    if (res.success) {
      setEngineState(res.state);
      setNotification({ type: 'success', message: 'Đã áp dụng phương án định tính trung thực không có số liệu.' });
      if (viewMode === 'mobile') setIsMobileSheetOpen(false);
    } else {
      setNotification({ type: 'error', message: res.error || 'Không thể áp dụng.' });
    }
  };

  const handleStartManualEdit = (block: CvBlock) => {
    setEditingBlockId(block.id);
    setManualTextBuffer(block.content);
  };

  const handleSaveManualEdit = (blockId: string) => {
    const updated = manualEditBlock(engineState, blockId, manualTextBuffer);
    setEngineState(updated);
    setEditingBlockId(null);
    setNotification({ type: 'warn', message: 'Đã lưu sửa tay. Các đề xuất liên quan được chuyển sang Cần kiểm tra lại.' });
  };

  const handleDeleteBlock = (blockId: string) => {
    const updated = deleteBlock(engineState, blockId);
    setEngineState(updated);
    setNotification({ type: 'warn', message: 'Đã xóa đoạn văn bản khỏi bản nháp.' });
  };

  const handleUndo = () => {
    if (engineState.historyPast.length === 0) return;
    const updated = undo(engineState);
    setEngineState(updated);
    setNotification({ type: 'info' as any, message: updated.lastAction });
  };

  const handleRedo = () => {
    if (engineState.historyFuture.length === 0) return;
    const updated = redo(engineState);
    setEngineState(updated);
    setNotification({ type: 'info' as any, message: updated.lastAction });
  };

  const handleReset = () => {
    setEngineState(createInitialSandboxState());
    setActiveSuggestionId('sug-duplicate-job1');
    setNotification({ type: 'info' as any, message: 'Đã khôi phục trạng thái Sandbox về ban đầu.' });
  };

  // Keyboard shortcut Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engineState]);

  // Dismiss notification auto
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col antialiased">
      {/* =========================================================================
          TOP SANDBOX CONTROLLER & MODE SWITCHER
          ========================================================================= */}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 shadow-xs"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1a73e8] text-white flex items-center justify-center font-black text-sm shadow-xs">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base">RoleMatch • Prototype Sandbox</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  Đợt 0: Client State
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Thử nghiệm tương tác: Hero → Quick Win → Đoạn CV → Card Đề xuất → Undo/Redo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle View Mode: Desktop vs Mobile */}
            <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex items-center text-xs">
              <button
                onClick={() => {
                  setViewMode('desktop');
                  setIsMobileSheetOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'desktop' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Desktop</span>
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'mobile' ? 'bg-white text-[#1a73e8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Mobile (375px)</span>
              </button>
            </div>

            {/* Undo / Redo controls */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={handleUndo}
                disabled={engineState.historyPast.length === 0}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                title={`Hoàn tác (${engineState.historyPast.length}) [Ctrl+Z]`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-400 px-1">{engineState.historyPast.length}</span>
              <button
                onClick={handleRedo}
                disabled={engineState.historyFuture.length === 0}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                title={`Làm lại (${engineState.historyFuture.length}) [Ctrl+Y]`}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Khôi phục trạng thái ban đầu"
            >
              Reset
            </button>

            {onExit && (
              <button
                onClick={onExit}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Đóng Sandbox
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          DYNAMIC CONTEXT BAR (THU GỌN INPUT)
          ========================================================================= */}
      <div
        ref={contextBarRef}
        className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2 sticky top-[57px] z-30 shadow-xs"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-900">JD: Senior Frontend Engineer • FinTech</span>
            <span className="text-slate-300">|</span>
            <span>CV: NguyenVanA_Senior_FE.pdf</span>
          </div>

          {/* Pegged Score Indicator */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Điểm gốc: <strong className="text-[#1a73e8]">78/100</strong> (Gắn với bản v1.0)
            </span>
            {engineState.historyPast.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Bản nháp v1.{engineState.historyPast.length} (Chưa chấm lại)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold ${
              notification.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : notification.type === 'warn'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN WRAPPER (Responsive Container)
          ========================================================================= */}
      <main
        className={`flex-1 mx-auto py-6 px-4 space-y-6 transition-all ${
          viewMode === 'mobile' ? 'max-w-[400px] border-x border-slate-200 bg-white shadow-md' : 'max-w-7xl'
        }`}
      >
        {/* =========================================================================
            1. EXECUTIVE HERO CARD (Overarching Summary)
            ========================================================================= */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
          {/* Verdict Statement */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1a73e8]/10 text-[#1a73e8]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>KẾT LUẬN ĐÁNH GIÁ CHÍNH XÁC</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              Hồ sơ <span className="text-emerald-700 font-extrabold">RẤT PHÙ HỢP</span> với vị trí Senior Frontend.
              Đã tìm thấy bằng chứng cho 7/9 yêu cầu bắt buộc; còn 2 yêu cầu về Cloud Architecture chưa được thể hiện rõ trong CV.
            </h2>
          </div>

          {/* Metric Segmented Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">ĐIỂM ĐÁNH GIÁ CV GỐC</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">78</span>
                <span className="text-xs text-slate-500">/ 100</span>
                <span className="text-[10px] text-slate-400 font-mono">(v1.0 cố định)</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>TIÊU CHÍ BẮT BUỘC (MUST-HAVE)</span>
                <span className="font-bold text-slate-800">7 / 9 Đạt</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                <div className="bg-emerald-500 h-full w-[78%]" title="7 Đủ bằng chứng"></div>
                <div className="bg-rose-500 h-full w-[22%]" title="2 Chưa có bằng chứng"></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span className="text-emerald-700 font-semibold">● 7 Đủ bằng chứng</span>
                <span className="text-rose-600 font-semibold">● 2 Cần bổ sung</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">ĐỘ VƯỢT QUA LỌC TỰ ĐỘNG (ATS)</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">Cao</span>
                <span className="text-xs text-slate-500">(Top 15% hồ sơ ứng tuyển)</span>
              </div>
            </div>
          </div>

          {/* Top 3 Quick Wins with 1-click smooth jump */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>⚡ 3 HÀNH ĐỘNG ƯU TIÊN HÀNG ĐẦU (QUICK WINS):</span>
              <span className="text-[11px] text-slate-400 font-normal">Bấm để nhảy đến đúng đoạn CV</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {(Object.values(engineState.suggestions) as Suggestion[]).map((sug, idx) => (
                <button
                  key={sug.id}
                  onClick={() => handleSelectQuickWin(sug.id)}
                  className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    activeSuggestionId === sug.id
                      ? 'border-[#1a73e8] bg-[#1a73e8]/5 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#1a73e8]">#{idx + 1}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          sug.status === 'applied'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sug.status === 'needs_review'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sug.status === 'applied'
                          ? 'Đã áp dụng'
                          : sug.status === 'needs_review'
                          ? 'Cần kiểm tra lại'
                          : 'Chờ duyệt'}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900">{sug.title}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#1a73e8] font-bold">
                    <span>Sửa đoạn này</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. EVIDENCE MAP (BẢN ĐỒ BẰNG CHỨNG)
            ========================================================================= */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Bản Đồ Bằng Chứng Năng Lực (Evidence Map)</h3>
              <p className="text-xs text-slate-500">Phân 5 nhóm năng lực cốt lõi theo tiêu chí JD</p>
            </div>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setCompetencyFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  competencyFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả (18)
              </button>
              <button
                onClick={() => setCompetencyFilter('must_have')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  competencyFilter === 'must_have'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Bắt buộc (9)
              </button>
              <button
                onClick={() => setCompetencyFilter('gap')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  competencyFilter === 'gap'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Chưa thấy (2)
              </button>
            </div>
          </div>

          {/* 5 Competency Group Overview Rows */}
          <div className="space-y-2">
            {[
              { id: 'tech', name: 'Kỹ Năng Chuyên Môn', total: 6, verified: 5, gap: 1 },
              { id: 'tools', name: 'Công Cụ & Phương Pháp', total: 4, verified: 4, gap: 0 },
              { id: 'experience', name: 'Kinh Nghiệm Thực Tế', total: 3, verified: 2, gap: 1 },
              { id: 'outcomes', name: 'Kết Quả & Đầu Ra', total: 3, verified: 2, gap: 1 },
              { id: 'culture', name: 'Văn Hóa & Làm Việc Nhóm', total: 2, verified: 2, gap: 0 },
            ].map((group) => (
              <div
                key={group.id}
                onClick={() => setActiveCompetencyGroup(group.id)}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-4 transition-all cursor-pointer ${
                  activeCompetencyGroup === group.id
                    ? 'border-[#1a73e8] bg-[#1a73e8]/5'
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8]"></span>
                  <span>{group.name}</span>
                  <span className="text-[11px] text-slate-400 font-normal">({group.total} tiêu chí)</span>
                </div>

                {/* Segmented bar for this group */}
                <div className="flex items-center gap-3">
                  <div className="w-24 sm:w-36 h-2 rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${(group.verified / group.total) * 100}%` }}
                    ></div>
                    <div
                      className="bg-rose-500 h-full"
                      style={{ width: `${(group.gap / group.total) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 min-w-[50px] text-right">
                    {group.verified}/{group.total} Đạt
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================================
            3. CV DIFF STUDIO (1-COLUMN CLEAN DOCUMENT + SIDEBAR SUGGESTION)
            ========================================================================= */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">CV Studio • Bản Nháp Hiện Tại</h3>
              <p className="text-xs text-slate-500">
                1 Cột văn bản sạch sẽ. Thẻ đề xuất gắn neo theo từng đoạn bên lề phải.
              </p>
            </div>

            {/* Export CV check */}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Bản CV Cuối</span>
            </button>
          </div>

          {/* Grid Layout: Desktop 2 Columns / Mobile 1 Column */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Document View (1 Column Clean Canvas) */}
            <div className={`space-y-3 ${viewMode === 'mobile' ? 'lg:col-span-12' : 'lg:col-span-7'}`}>
              {engineState.blocks.map((block) => {
                const isTargetOfActiveSuggestion = activeSuggestion?.sourceBlockId === block.id;
                const isEditingThisBlock = editingBlockId === block.id;

                if (block.isDeleted) {
                  return (
                    <div
                      key={block.id}
                      className="p-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/50 text-xs text-rose-600 flex items-center justify-between"
                    >
                      <span>Đoạn đã bị xóa: {block.sectionTitle}</span>
                      <button
                        onClick={handleUndo}
                        className="text-xs font-bold underline cursor-pointer"
                      >
                        Khôi phục
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={block.id}
                    ref={(el) => (blockRefs.current[block.id] = el)}
                    className={`rounded-xl border p-4 transition-all relative ${
                      isTargetOfActiveSuggestion
                        ? 'border-[#1a73e8] ring-2 ring-[#1a73e8]/20 bg-blue-50/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Block Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 font-mono">[{block.id}]</span>
                        <span className="text-xs font-extrabold text-slate-700">{block.sectionTitle}</span>
                        {block.revision > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Sửa {block.revision} lần
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        {isEditingThisBlock ? (
                          <>
                            <button
                              onClick={() => handleSaveManualEdit(block.id)}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setEditingBlockId(null)}
                              className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold hover:bg-slate-300"
                            >
                              Hủy
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartManualEdit(block)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                              title="Sửa tay trực tiếp đoạn này"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBlock(block.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                              title="Xóa đoạn này để kiểm chứng needs_review"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Block Content (Either static text or inline textarea) */}
                    {isEditingThisBlock ? (
                      <textarea
                        value={manualTextBuffer}
                        onChange={(e) => setManualTextBuffer(e.target.value)}
                        rows={3}
                        className="w-full text-xs font-mono p-2 border border-[#1a73e8] rounded-lg focus:outline-hidden"
                      />
                    ) : (
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {block.content}
                      </p>
                    )}

                    {/* Highlight notice if target */}
                    {isTargetOfActiveSuggestion && (
                      <div className="mt-2.5 pt-2 border-t border-[#1a73e8]/20 flex items-center justify-between text-[11px] text-[#1a73e8] font-bold">
                        <span>Đang chọn cho đề xuất: "{activeSuggestion?.title}"</span>
                        <span className="text-[10px] bg-blue-100/80 px-1.5 py-0.5 rounded">Target Block</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right: Suggestion Card (Desktop Sidebar) */}
            {viewMode === 'desktop' && (
              <div className="lg:col-span-5 sticky top-32 space-y-4">
                {activeSuggestion ? (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1a73e8]/10 text-[#1a73e8]">
                        {activeSuggestion.quickWinTag}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          activeSuggestion.status === 'applied'
                            ? 'bg-emerald-100 text-emerald-800'
                            : activeSuggestion.status === 'needs_review'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {activeSuggestion.status === 'applied'
                          ? 'Đã áp dụng'
                          : activeSuggestion.status === 'needs_review'
                          ? 'Cần kiểm tra lại'
                          : 'Chờ xử lý'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{activeSuggestion.title}</h4>
                      <p className="text-xs text-slate-500 mt-1">Trỏ vào block: [{activeSuggestion.sourceBlockId}]</p>
                    </div>

                    {/* Needs Review Alert if manual edit broke it */}
                    {activeSuggestion.status === 'needs_review' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Cảnh báo an toàn dữ liệu:</strong> {activeSuggestion.reviewReason}
                        </div>
                      </div>
                    )}

                    {/* Expected original sentence */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">CÂU GỐC TRONG CV:</div>
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 line-through">
                        {activeSuggestion.expectedOriginalText}
                      </div>
                    </div>

                    {/* Rewritten (Google XYZ formula) */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-700">ĐỀ XUẤT VIẾT LẠI (GOOGLE XYZ):</div>
                      <div className="text-xs text-slate-900 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200/80 leading-relaxed">
                        {activeSuggestion.rewrittenText}
                      </div>
                    </div>

                    {/* In-Card Form for Metrics if placeholders exist */}
                    {activeSuggestion.placeholders.length > 0 && (
                      <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2.5">
                        <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-[#1a73e8]" />
                          <span>CẦN SỐ LIỆU THỰC TẾ CỦA BẠN:</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {activeSuggestion.placeholders.map((ph) => (
                            <div key={ph} className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-600">{ph}</label>
                              <input
                                type="text"
                                value={metricInputs[ph] || ''}
                                onChange={(e) =>
                                  setMetricInputs((prev) => ({ ...prev, [ph]: e.target.value }))
                                }
                                placeholder="VD: 35%"
                                className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-[#1a73e8] focus:outline-hidden"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={handleApplyWithMetrics}
                        disabled={activeSuggestion.status === 'needs_review'}
                        className="w-full py-2 bg-[#1a73e8] hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        ✅ Chèn câu hoàn chỉnh vào CV
                      </button>

                      {/* Qualitative fallback button (Không có số liệu) */}
                      {activeSuggestion.placeholders.length > 0 && (
                        <button
                          onClick={handleApplyQualitative}
                          disabled={activeSuggestion.status === 'needs_review'}
                          className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-200"
                        >
                          🛡️ Tôi không có số liệu (Dùng câu định tính)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                    Chọn một đoạn văn bản hoặc Quick Win để xem đề xuất.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* =========================================================================
            MOBILE BOTTOM SHEET (For Mobile View Mode)
            ========================================================================= */}
        {viewMode === 'mobile' && isMobileSheetOpen && activeSuggestion && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end justify-center">
            <div className="bg-white rounded-t-2xl w-full max-w-[400px] max-h-[80vh] overflow-y-auto p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-sm text-slate-900">{activeSuggestion.title}</span>
                <button
                  onClick={() => setIsMobileSheetOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                {activeSuggestion.rewrittenText}
              </div>

              {activeSuggestion.placeholders.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-600">Nhập số liệu thực tế:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeSuggestion.placeholders.map((ph) => (
                      <input
                        key={ph}
                        type="text"
                        value={metricInputs[ph] || ''}
                        onChange={(e) => setMetricInputs((prev) => ({ ...prev, [ph]: e.target.value }))}
                        placeholder={ph}
                        className="text-xs p-2 border rounded"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={handleApplyWithMetrics}
                  className="w-full py-2.5 bg-[#1a73e8] text-white rounded-xl text-xs font-bold"
                >
                  Áp dụng đề xuất
                </button>
                {activeSuggestion.placeholders.length > 0 && (
                  <button
                    onClick={handleApplyQualitative}
                    className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Không có số liệu (Dùng câu định tính)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            EXPORT FINAL CV MODAL (KIỂM CHỨNG CHẶN PLACEHOLDER)
            ========================================================================= */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-base">Kiểm tra trước khi xuất bản CV</h4>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {exportStatus.canExport ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>CV hợp lệ 100% — Không còn placeholder nào!</span>
                  </div>
                  <p>
                    Bản nháp CV đã xử lý sạch sẽ mọi trường số liệu. Bạn có thể tự tin xuất bản sang PDF/Word mà không sợ nộp nhầm văn bản dở dang.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Phát hiện placeholder chưa xử lý!</span>
                  </div>
                  <p>{exportStatus.reason}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Đóng
                </button>
                <button
                  disabled={!exportStatus.canExport}
                  onClick={() => {
                    alert('Thành công! Đang tải file CV hoàn chỉnh...');
                    setShowExportModal(false);
                  }}
                  className="px-4 py-1.5 bg-[#1a73e8] hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Tải CV Hoàn Chỉnh (.docx)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
