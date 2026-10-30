import React, { useState } from 'react';
import { CompleteCVAnalysisResponse, UpdatedCvResponse } from '../types';
import { Language, translations } from '../utils/i18n';
import { generateMarkdownReport } from '../utils/exportMarkdown';
import { exportToDocx, exportToPdf, exportToTxt } from '../utils/exportCvFiles';
import {
  Download,
  X,
  FileText,
  FileType,
  Printer,
  Sparkles,
  CheckCircle2,
  FileDown,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: CompleteCVAnalysisResponse | null;
  currentRoleTitle?: string;
  updatedCvData: UpdatedCvResponse | null;
  onOpenUpdatedCvModal?: () => void;
  lang: Language;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  analysis,
  currentRoleTitle = 'Ứng viên',
  updatedCvData,
  onOpenUpdatedCvModal,
  lang,
}) => {
  const t = translations[lang].exportReportModal;
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingCvDocx, setDownloadingCvDocx] = useState(false);

  if (!isOpen || !analysis) return null;

  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanTitle = (currentRoleTitle || 'RoleMatch')
    .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
    .slice(0, 40);

  // 1. Export Full Report Handlers
  const handleExportFullReportDocx = async () => {
    try {
      setDownloadingDocx(true);
      const md = generateMarkdownReport(analysis, currentRoleTitle);
      const filename = `Bao_Cao_Phan_Tich_CV_${cleanTitle}_${dateStr}.docx`;
      await exportToDocx(md, filename);
    } catch (err) {
      console.error('Error exporting report to docx:', err);
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handleExportFullReportPdf = () => {
    const md = generateMarkdownReport(analysis, currentRoleTitle);
    const filename = `Bao_Cao_Phan_Tich_CV_${cleanTitle}_${dateStr}.pdf`;
    exportToPdf(md, filename);
  };

  const handleExportFullReportMd = () => {
    const md = generateMarkdownReport(analysis, currentRoleTitle);
    const filename = `Bao_Cao_Phan_Tich_CV_${cleanTitle}_${dateStr}.md`;
    exportToTxt(md, filename);
  };

  // 2. Export CV Draft Handlers
  const cvMarkdown = updatedCvData?.updatedCvMarkdown || '';

  const handleExportCvDocx = async () => {
    if (!cvMarkdown) return;
    try {
      setDownloadingCvDocx(true);
      const filename = `CV_Toi_Uu_ATS_${cleanTitle}_${dateStr}.docx`;
      await exportToDocx(cvMarkdown, filename);
    } catch (err) {
      console.error('Error exporting CV to docx:', err);
    } finally {
      setDownloadingCvDocx(false);
    }
  };

  const handleExportCvPdf = () => {
    if (!cvMarkdown) return;
    const filename = `CV_Toi_Uu_ATS_${cleanTitle}_${dateStr}.pdf`;
    exportToPdf(cvMarkdown, filename);
  };

  const handleExportCvTxt = () => {
    if (!cvMarkdown) return;
    const filename = `CV_Toi_Uu_ATS_${cleanTitle}_${dateStr}.txt`;
    exportToTxt(cvMarkdown, filename);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 md:p-6 animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-bold text-base md:text-lg text-white">
                {t.title}
              </h3>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                {t.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 space-y-6">
          {/* Card 1: Comprehensive Senior HR Analysis Report */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 shadow-sm transition-all space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 uppercase">
                  <Layers className="w-3 h-3 text-indigo-600" />
                  <span>{lang === 'vi' ? 'Đầy đủ 4 Tabs' : 'All 4 Tabs Included'}</span>
                </span>
                <h4 className="text-base font-bold text-slate-900">
                  {t.optionFullReportTitle}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t.optionFullReportDesc}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Word Button */}
              <button
                type="button"
                onClick={handleExportFullReportDocx}
                disabled={downloadingDocx}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FileType className="w-4 h-4 shrink-0" />
                <span>{downloadingDocx ? (lang === 'vi' ? 'Đang tạo...' : 'Creating...') : t.downloadDocx}</span>
              </button>

              {/* PDF Button */}
              <button
                type="button"
                onClick={handleExportFullReportPdf}
                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{t.downloadPdf}</span>
              </button>

              {/* Markdown Button */}
              <button
                type="button"
                onClick={handleExportFullReportMd}
                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>{t.downloadMd}</span>
              </button>
            </div>
          </div>

          {/* Card 2: ATS-Optimized CV Draft */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 shadow-sm transition-all space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 uppercase">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>{lang === 'vi' ? 'Chuẩn ATS 1 Cột' : 'ATS 1-Column Format'}</span>
                </span>
                <h4 className="text-base font-bold text-slate-900">
                  {t.optionCvTitle}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t.optionCvDesc}
                </p>
              </div>
            </div>

            {cvMarkdown ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {/* Word Button */}
                <button
                  type="button"
                  onClick={handleExportCvDocx}
                  disabled={downloadingCvDocx}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FileType className="w-4 h-4 shrink-0" />
                  <span>{downloadingCvDocx ? (lang === 'vi' ? 'Đang tạo...' : 'Creating...') : t.downloadDocx}</span>
                </button>

                {/* PDF Button */}
                <button
                  type="button"
                  onClick={handleExportCvPdf}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t.downloadPdf}</span>
                </button>

                {/* Txt Button */}
                <button
                  type="button"
                  onClick={handleExportCvTxt}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{t.downloadTxt}</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-slate-600">
                  {lang === 'vi'
                    ? 'Bản nháp CV tối ưu chưa được tạo. Bấm nút bên để yêu cầu Trợ lý AI tạo bản CV viết lại.'
                    : 'Optimized CV draft not generated yet. Click to generate with AI Assistant.'}
                </span>
                {onOpenUpdatedCvModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUpdatedCvModal();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Tạo CV với Trợ lý AI' : 'Generate with AI'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
