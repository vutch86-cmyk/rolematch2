import React from 'react';
import { FileText, Briefcase, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { Language } from '../utils/i18n';

interface CompactContextBarProps {
  jdTitle?: string | null;
  jdSourceLabel?: string | null;
  cvFileName?: string | null;
  cvTextLength: number;
  overallScore?: number;
  isInputCollapsed: boolean;
  onToggleCollapse: () => void;
  isInputDirty: boolean;
  onReAnalyze: () => void;
  isLoading: boolean;
  lang: Language;
}

export const CompactContextBar: React.FC<CompactContextBarProps> = ({
  jdTitle,
  jdSourceLabel,
  cvFileName,
  cvTextLength,
  overallScore,
  isInputCollapsed,
  onToggleCollapse,
  isInputDirty,
  onReAnalyze,
  isLoading,
  lang,
}) => {
  const displayJd = jdTitle || jdSourceLabel || (lang === 'vi' ? 'Mô tả công việc (JD)' : 'Job Description (JD)');
  const displayCv = cvFileName
    ? cvFileName
    : cvTextLength > 0
    ? (lang === 'vi' ? `Văn bản CV đã dán (${cvTextLength.toLocaleString()} ký tự)` : `Pasted CV (${cvTextLength.toLocaleString()} chars)`)
    : (lang === 'vi' ? 'Chưa có CV' : 'No CV');

  return (
    <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs px-4 sm:px-6 lg:px-8 py-2.5 transition-all">
      <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between gap-3 flex-wrap min-h-[38px]">
        {/* Left: Input Source Metadata */}
        <div className="flex items-center gap-3 text-xs sm:text-sm flex-wrap text-slate-700">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="max-w-[200px] sm:max-w-[320px] md:max-w-[420px] truncate" title={displayJd}>
                {displayJd}
              </span>
            </div>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="max-w-[180px] sm:max-w-[280px] truncate" title={displayCv}>
              {displayCv}
            </span>
          </div>

          {/* Pegged Score indicator if available */}
          {overallScore !== undefined && !isInputDirty && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{lang === 'vi' ? 'Điểm gốc' : 'Original Score'}: {overallScore}/100</span>
            </span>
          )}
        </div>

        {/* Right: Actions (Dirty Indicator & Expand/Collapse) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Stale Input Notice if user modified inputs after analysis */}
          {isInputDirty && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-xs font-bold text-amber-900 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="hidden md:inline">
                {lang === 'vi' ? 'Đã sửa đầu vào • Chưa chấm lại' : 'Input edited • Not re-analyzed'}
              </span>
              <button
                onClick={onReAnalyze}
                disabled={isLoading}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ml-1"
                title={lang === 'vi' ? 'Chấm điểm lại theo nội dung mới' : 'Re-analyze with new input'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{lang === 'vi' ? 'Chấm điểm lại' : 'Re-analyze'}</span>
              </button>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={onToggleCollapse}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              isInputCollapsed
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/90'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
            }`}
            title={
              isInputCollapsed
                ? (lang === 'vi' ? 'Mở lại form nhập liệu để sửa' : 'Expand input form')
                : (lang === 'vi' ? 'Thu gọn form để xem kết quả' : 'Collapse input form')
            }
          >
            {isInputCollapsed ? (
              <>
                <span>{lang === 'vi' ? '✏️ Thay đổi nội dung' : '✏️ Edit Input'}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </>
            ) : (
              <>
                <span>{lang === 'vi' ? '🔼 Thu gọn form' : '🔼 Collapse Form'}</span>
                <ChevronUp className="w-4 h-4 text-blue-600" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
