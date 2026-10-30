import React, { useState } from 'react';
import {
  CompleteCVAnalysisResponse,
  ReEvaluationComparison,
} from '../types';
import { Language, translations } from '../utils/i18n';
import {
  Sparkles,
  X,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FileText,
  Sliders,
  Check,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Flame,
} from 'lucide-react';

interface QuickReEvaluateModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalCvText: string;
  suggestedCvText?: string;
  jdText: string;
  companyName?: string;
  jobTitle?: string;
  currentAnalysis: CompleteCVAnalysisResponse;
  comparison: ReEvaluationComparison | null;
  isReEvaluating: boolean;
  onRunReEvaluation: (newCvText: string) => Promise<void>;
  onApplyNewAnalysis: () => void;
  lang: Language;
}

export const QuickReEvaluateModal: React.FC<QuickReEvaluateModalProps> = ({
  isOpen,
  onClose,
  originalCvText,
  suggestedCvText,
  jdText,
  companyName,
  jobTitle,
  currentAnalysis,
  comparison,
  isReEvaluating,
  onRunReEvaluation,
  onApplyNewAnalysis,
  lang,
}) => {
  const t = translations[lang].quickReEvaluate;
  const [editedCv, setEditedCv] = useState<string>(suggestedCvText || originalCvText);
  const [showEditor, setShowEditor] = useState<boolean>(!comparison);

  if (!isOpen) return null;

  const handleUseSuggested = () => {
    if (suggestedCvText) {
      setEditedCv(suggestedCvText);
    }
  };

  const handleResetToOriginal = () => {
    setEditedCv(originalCvText);
  };

  const handleStartReScore = async () => {
    if (!editedCv.trim() || isReEvaluating) return;
    await onRunReEvaluation(editedCv.trim());
    setShowEditor(false);
  };

  const delta = comparison?.scoresDelta;
  const isPositive = (delta?.overallScore.delta || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-bold text-base md:text-lg text-white flex items-center gap-2">
                <span>{t.modalTitle}</span>
              </h3>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                {companyName ? `${companyName} • ` : ''}
                {jobTitle || (lang === 'vi' ? 'Vị trí ứng tuyển' : 'Job Position')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
          {/* Top Control Bar: Toggle Editor / Re-score Status */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {lang === 'vi' ? 'Nội dung CV dùng để chấm điểm:' : 'CV text for re-evaluation:'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-mono">
                {editedCv.length} {t.cvCharCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {suggestedCvText && suggestedCvText !== editedCv && (
                <button
                  type="button"
                  onClick={handleUseSuggested}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>{lang === 'vi' ? 'Nạp CV gợi ý từ AI' : 'Load AI Suggested CV'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetToOriginal}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-200/70 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                title={lang === 'vi' ? 'Khôi phục bản gốc ban đầu' : 'Reset to original'}
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>{lang === 'vi' ? 'Khôi phục gốc' : 'Reset'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEditor((prev) => !prev)}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
              >
                {showEditor ? (lang === 'vi' ? 'Thu gọn ô sửa' : 'Hide Editor') : (lang === 'vi' ? 'Sửa văn bản CV' : 'Edit CV Text')}
              </button>
            </div>
          </div>

          {/* CV Editor Area */}
          {showEditor && (
            <div className="space-y-2 animate-fade-in">
              <label className="block text-xs font-bold text-slate-700">
                {t.editCvPrompt}
              </label>
              <textarea
                value={editedCv}
                onChange={(e) => setEditedCv(e.target.value)}
                rows={9}
                placeholder={lang === 'vi' ? 'Dán hoặc chỉnh sửa nội dung CV của bạn tại đây...' : 'Paste or edit your CV text here...'}
                className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleStartReScore}
                  disabled={isReEvaluating || !editedCv.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReEvaluating ? 'animate-spin' : ''}`} />
                  <span>{isReEvaluating ? t.reScoring : t.triggerButton}</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isReEvaluating && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <div className="text-center">
                <p className="font-bold text-sm text-slate-800">{t.reScoring}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'vi' ? 'Trợ lý AI đang đối chiếu lại từng tiêu chí với JD mục tiêu...' : 'AI Assistant is re-evaluating each criterion against target JD...'}
                </p>
              </div>
            </div>
          )}

          {/* Before vs. After Results Dashboard */}
          {!isReEvaluating && comparison && delta && (
            <div className="space-y-6 animate-fade-in">
              {/* Highlight Banner */}
              <div className={`p-5 rounded-2xl border ${
                isPositive
                  ? 'bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border-emerald-300/80'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-emerald-600" />
                      <span>{t.modalTitle}</span>
                    </span>
                    <h4 className="text-xl font-black text-slate-900">
                      {isPositive
                        ? (lang === 'vi' ? `Hồ sơ đã tăng +${delta.overallScore.delta}% độ phù hợp!` : `Profile improved by +${delta.overallScore.delta}% match!`)
                        : (lang === 'vi' ? 'Đã hoàn tất chấm điểm lại' : 'Re-evaluation completed')}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {lang === 'vi'
                        ? 'Các chỉnh sửa đã giúp cải thiện độ sắc nét và giải quyết các điểm yếu trước đó.'
                        : 'Adjustments have sharpened evidence and resolved earlier doubts.'}
                    </p>
                  </div>

                  {/* Main Score Comparison Box */}
                  <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs shrink-0">
                    <div className="text-center px-2">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">{t.beforeScore}</div>
                      <div className="text-xl font-extrabold text-slate-600">{delta.overallScore.before}%</div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-indigo-500 shrink-0" />

                    <div className="text-center px-2">
                      <div className="text-[10px] font-semibold text-indigo-600 uppercase">{t.afterScore}</div>
                      <div className="text-2xl font-black text-emerald-600">{delta.overallScore.after}%</div>
                    </div>

                    <div className="ml-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1">
                      <span>{delta.overallScore.delta >= 0 ? `+${delta.overallScore.delta}%` : `${delta.overallScore.delta}%`}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Score Dimensions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* 1. Overall */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    {lang === 'vi' ? 'Tổng thể' : 'Overall'}
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="text-lg font-black text-slate-900">
                      {delta.overallScore.after}%
                    </div>
                    <span className={`text-xs font-bold ${delta.overallScore.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {delta.overallScore.delta >= 0 ? `+${delta.overallScore.delta}%` : `${delta.overallScore.delta}%`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {lang === 'vi' ? `Trước: ${delta.overallScore.before}%` : `Before: ${delta.overallScore.before}%`}
                  </div>
                </div>

                {/* 2. Keyword */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    {lang === 'vi' ? 'Từ khóa JD' : 'Keywords'}
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="text-lg font-black text-slate-900">
                      {delta.keywordScore.after}%
                    </div>
                    <span className={`text-xs font-bold ${delta.keywordScore.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {delta.keywordScore.delta >= 0 ? `+${delta.keywordScore.delta}%` : `${delta.keywordScore.delta}%`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {lang === 'vi' ? `Trước: ${delta.keywordScore.before}%` : `Before: ${delta.keywordScore.before}%`}
                  </div>
                </div>

                {/* 3. Skill */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    {lang === 'vi' ? 'Kỹ năng' : 'Skills'}
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="text-lg font-black text-slate-900">
                      {delta.skillScore.after}%
                    </div>
                    <span className={`text-xs font-bold ${delta.skillScore.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {delta.skillScore.delta >= 0 ? `+${delta.skillScore.delta}%` : `${delta.skillScore.delta}%`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {lang === 'vi' ? `Trước: ${delta.skillScore.before}%` : `Before: ${delta.skillScore.before}%`}
                  </div>
                </div>

                {/* 4. Experience */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    {lang === 'vi' ? 'Kinh nghiệm' : 'Experience'}
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="text-lg font-black text-slate-900">
                      {delta.experienceScore.after}%
                    </div>
                    <span className={`text-xs font-bold ${delta.experienceScore.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {delta.experienceScore.delta >= 0 ? `+${delta.experienceScore.delta}%` : `${delta.experienceScore.delta}%`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {lang === 'vi' ? `Trước: ${delta.experienceScore.before}%` : `Before: ${delta.experienceScore.before}%`}
                  </div>
                </div>
              </div>

              {/* Resolved Red Flags & Gaps */}
              {comparison.resolvedRedFlags.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t.redFlagsResolved} ({comparison.resolvedRedFlags.length})</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {comparison.resolvedRedFlags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                        <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Strengths */}
              {comparison.newStrengths.length > 0 && (
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{t.newStrengthsDetected} ({comparison.newStrengths.length})</span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {comparison.newStrengths.map((str, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-indigo-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                        <span>{str}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {t.keepOriginal}
          </button>

          <div className="flex items-center gap-2">
            {!showEditor && (
              <button
                type="button"
                onClick={() => setShowEditor(true)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              >
                {lang === 'vi' ? 'Sửa & Chấm lại' : 'Edit & Re-score'}
              </button>
            )}

            {comparison && (
              <button
                type="button"
                onClick={() => {
                  onApplyNewAnalysis();
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t.applyNewCv}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
