import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { UpdatedCvResponse } from '../types';
import { Language, translations } from '../utils/i18n';
import { exportToDocx, exportToPdf } from '../utils/exportCvFiles';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Download,
  CheckCircle2,
  Columns,
  FileText,
  Send,
  Loader2,
  ArrowRight,
  RefreshCw,
  Zap,
  FileType,
  Printer,
  FileDown
} from 'lucide-react';

interface UpdatedCvModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalCvText: string;
  updatedCvData: UpdatedCvResponse | null;
  isGenerating: boolean;
  onRefineCv: (customInstruction: string) => void;
  onApplyToInputCv: (newCvText: string) => void;
  lang: Language;
}

export const UpdatedCvModal: React.FC<UpdatedCvModalProps> = ({
  isOpen,
  onClose,
  originalCvText,
  updatedCvData,
  isGenerating,
  onRefineCv,
  onApplyToInputCv,
  lang,
}) => {
  const t = translations[lang].updatedCvModal;

  const [viewMode, setViewMode] = useState<'preview' | 'compare' | 'raw'>('preview');
  const [customInstruction, setCustomInstruction] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!updatedCvData?.updatedCvMarkdown) return;
    navigator.clipboard.writeText(updatedCvData.updatedCvMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!updatedCvData?.updatedCvMarkdown) return;
    const blob = new Blob([updatedCvData.updatedCvMarkdown], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CV_Toi_Uu_Gemini_AI_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDocxClick = () => {
    if (!updatedCvData?.updatedCvMarkdown) return;
    exportToDocx(
      updatedCvData.updatedCvMarkdown,
      `CV_Toi_Uu_Gemini_${new Date().toISOString().slice(0, 10)}.docx`
    );
  };

  const handleExportPdfClick = () => {
    if (!updatedCvData?.updatedCvMarkdown) return;
    exportToPdf(
      updatedCvData.updatedCvMarkdown,
      `CV_Toi_Uu_Gemini_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  const handleApply = () => {
    if (!updatedCvData?.updatedCvMarkdown) return;
    onApplyToInputCv(updatedCvData.updatedCvMarkdown);
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onClose();
    }, 1500);
  };

  const handleSendRefine = (instructionText?: string) => {
    const textToSend = instructionText || customInstruction;
    if (!textToSend.trim() || isGenerating) return;
    onRefineCv(textToSend);
    if (!instructionText) setCustomInstruction('');
  };

  const quickPills =
    lang === 'vi'
      ? [
          'Ngắn gọn và đầy đủ hơn',
          'Nhấn mạnh kỹ năng quản lý & lãnh đạo',
          'Chuyển toàn bộ CV sang Tiếng Anh',
          'Thêm phần Dự Án Cá Nhân nổi bật',
        ]
      : [
          'Make concise & complete',
          'Emphasize management & leadership skills',
          'Translate entire CV to English',
          'Add key Personal Projects section',
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-indigo-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-indigo-500 flex items-center justify-center shadow-lg text-slate-950 font-bold shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  {lang === 'vi'
                    ? 'Bản CV Đã Cập Nhật Theo Đề Xuất'
                    : 'Updated CV via Recommendations'}
                </h3>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Gemini Intelligence
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5 hidden sm:block">
                {lang === 'vi'
                  ? 'Đã thay thế các bullet point yếu, lồng ghép từ khóa JD và khắc phục điểm yếu tuyển dụng.'
                  : 'Replaced weak bullet points, integrated JD keywords, and addressed recruiter doubts.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
          {/* Summary of Changes */}
          {updatedCvData?.summaryOfChanges && updatedCvData.summaryOfChanges.length > 0 && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {lang === 'vi'
                    ? 'Các Điểm Cải Tiến Đã Được Gemini Tự Động Áp Dụng:'
                    : 'Improvements Automatically Applied by Gemini:'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-emerald-900">
                {updatedCvData.summaryOfChanges.map((change, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-white/90 p-2.5 rounded-lg border border-emerald-100">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode Selector */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>{lang === 'vi' ? 'Xem CV Mới (Định dạng)' : 'Preview New CV (Formatted)'}</span>
              </button>

              <button
                onClick={() => setViewMode('compare')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'compare'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5 text-amber-500" />
                <span>{lang === 'vi' ? 'So Sánh Song Song (Gốc vs Mới)' : 'Side-by-Side Comparison (Original vs New)'}</span>
              </button>

              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{lang === 'vi' ? 'Văn Bản Gốc (Markdown)' : 'Raw Text (Markdown)'}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 hidden md:block">
              {lang === 'vi'
                ? '*Bạn có thể chỉnh sửa tiếp bằng AI bên dưới hoặc Áp dụng ngay vào CV đầu vào.'
                : '*Refine further with AI below or apply directly to your input CV.'}
            </div>
          </div>

          {/* Content Loading State */}
          {isGenerating ? (
            <div className="bg-white rounded-xl p-12 border border-slate-200 shadow-sm text-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                {lang === 'vi'
                  ? 'Gemini đang nghiên cứu các bullet point và đang biên soạn bản CV mới...'
                  : 'Gemini is analyzing bullet points and compiling your new CV...'}
              </p>
              <p className="text-xs text-slate-500">
                {lang === 'vi'
                  ? 'Quá trình này tối ưu hóa cấu trúc, chèn từ khóa JD và định dạng lại chuẩn Markdown chuyên nghiệp.'
                  : 'This process optimizes structure, integrates JD keywords, and formats in professional Markdown.'}
              </p>
            </div>
          ) : (
            <>
              {/* VIEW MODE 1: Preview formatted markdown */}
              {viewMode === 'preview' && updatedCvData && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[350px] text-xs sm:text-sm text-slate-800 leading-relaxed overflow-x-auto">
                  <div className="markdown-body space-y-4">
                    <Markdown>{updatedCvData.updatedCvMarkdown}</Markdown>
                  </div>
                </div>
              )}

              {/* VIEW MODE 2: Compare Side-by-side */}
              {viewMode === 'compare' && updatedCvData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Original CV */}
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col h-[400px]">
                    <div className="font-bold text-xs text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>{lang === 'vi' ? 'CV Gốc Của Bạn' : 'Your Original CV'}</span>
                      <span className="text-[10px] text-slate-400">{lang === 'vi' ? 'Chưa tối ưu' : 'Unoptimized'}</span>
                    </div>
                    <textarea
                      readOnly
                      value={originalCvText}
                      className="flex-1 w-full p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 resize-none focus:outline-none"
                    />
                  </div>

                  {/* Gemini Updated CV */}
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 flex flex-col h-[400px]">
                    <div className="font-bold text-xs text-indigo-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{lang === 'vi' ? 'CV Mới Đã Cập Nhật (Gemini)' : 'Updated CV (Gemini)'}</span>
                      </span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                        {lang === 'vi' ? 'Đã áp dụng đề xuất' : 'Applied'}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 leading-relaxed font-sans">
                      <div className="markdown-body">
                        <Markdown>{updatedCvData.updatedCvMarkdown}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW MODE 3: Raw Markdown Text */}
              {viewMode === 'raw' && updatedCvData && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <textarea
                    readOnly
                    value={updatedCvData.updatedCvMarkdown}
                    className="w-full h-[350px] p-4 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white leading-relaxed resize-y"
                  />
                </div>
              )}

              {/* Refinement Prompt Bar */}
              <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>
                      {lang === 'vi'
                        ? 'Chỉnh Sửa Thêm Bản CV Này Bằng Yêu Cầu Riêng (Gemini Prompt):'
                        : 'Refine This CV with Custom Instructions (Gemini):'}
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {lang === 'vi' ? 'Nhập yêu cầu để Gemini tinh chỉnh lại' : 'Enter prompt to refine'}
                  </span>
                </div>

                {/* Quick instruction chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {quickPills.map((pill, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendRefine(pill)}
                      disabled={isGenerating}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
                    >
                      + {pill}
                    </button>
                  ))}
                </div>

                {/* Input & Send button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendRefine();
                    }}
                    placeholder={
                      lang === 'vi'
                        ? 'Ví dụ: Thêm kỹ năng Tiếng Anh B2 và kinh nghiệm quản lý nhóm 3 người...'
                        : 'e.g., Add B2 English level and 3-person team leadership experience...'
                    }
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  />
                  <button
                    onClick={() => handleSendRefine()}
                    disabled={!customInstruction.trim() || isGenerating}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                      customInstruction.trim() && !isGenerating
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{lang === 'vi' ? 'Tái Tạo Bản Mới' : 'Regenerate'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleApply}
              disabled={!updatedCvData || isGenerating}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                applied
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
              } disabled:opacity-50`}
            >
              {applied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{lang === 'vi' ? 'Đã áp dụng vào ô CV đầu vào!' : 'Applied to input CV!'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{lang === 'vi' ? 'Áp Dụng Trực Tiếp Vào Ô CV Đầu Vào' : 'Apply Directly to Input CV'}</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              onClick={handleExportDocxClick}
              disabled={!updatedCvData || isGenerating}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 border border-blue-500 disabled:opacity-50"
              title={lang === 'vi' ? 'Tải tệp Word (.docx)' : 'Download Word file (.docx)'}
            >
              <FileType className="w-3.5 h-3.5 text-blue-100" />
              <span>{lang === 'vi' ? 'Xuất Word (.docx)' : 'Export Word (.docx)'}</span>
            </button>

            <button
              onClick={handleExportPdfClick}
              disabled={!updatedCvData || isGenerating}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 border border-rose-500 disabled:opacity-50"
              title={lang === 'vi' ? 'Xuất bản in PDF' : 'Export PDF'}
            >
              <Printer className="w-3.5 h-3.5 text-rose-100" />
              <span>{lang === 'vi' ? 'Xuất PDF (.pdf)' : 'Export PDF (.pdf)'}</span>
            </button>

            <button
              onClick={handleCopy}
              disabled={!updatedCvData || isGenerating}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{lang === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Sao Chép' : 'Copy'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!updatedCvData || isGenerating}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200"
              title={lang === 'vi' ? 'Tải bản Markdown (.md)' : 'Download Markdown (.md)'}
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>{lang === 'vi' ? 'Tải .md' : 'Download .md'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {lang === 'vi' ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
