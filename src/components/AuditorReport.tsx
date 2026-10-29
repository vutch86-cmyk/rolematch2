import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileCheck, ChevronDown, ChevronUp, Copy, Check, Sparkles } from 'lucide-react';

interface AuditorReportProps {
  feedbackText: string;
  lang?: 'vi' | 'en';
}

export const AuditorReport: React.FC<AuditorReportProps> = ({ feedbackText, lang = 'vi' }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(feedbackText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!feedbackText || !feedbackText.trim()) return null;

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5 text-xs font-bold text-amber-400">
          <div className="p-1 rounded bg-amber-400/10 border border-amber-400/20 text-amber-400">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <span>{lang === 'vi' ? 'Báo cáo phản biện của Auditor (Bước 2: Quality Checker Review)' : 'Auditor Quality Review Report (Step 2)'}</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-medium border border-amber-400/30">
              {lang === 'vi' ? 'Đã kiểm định chất lượng' : 'Quality Audited'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer"
            title={lang === 'vi' ? 'Sao chép báo cáo' : 'Copy report'}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{lang === 'vi' ? 'Đã chép' : 'Copied'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>{lang === 'vi' ? 'Sao chép' : 'Copy'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 p-1"
            aria-label="Toggle Auditor Report"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Content Area */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800/90 max-h-[420px] overflow-y-auto text-xs text-slate-200 font-sans leading-relaxed">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-sm sm:text-base font-extrabold text-amber-400 mt-4 mb-2 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xs sm:text-sm font-bold text-amber-300 mt-3 mb-1.5 border-b border-slate-800/60 pb-1">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xs font-bold text-indigo-300 mt-2.5 mb-1">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-xs text-slate-300 leading-relaxed my-1.5">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-amber-200">
                    {children}
                  </strong>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2 text-xs text-slate-300 pl-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2 text-xs text-slate-300 pl-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-xs text-slate-300 leading-relaxed">
                    {children}
                  </li>
                ),
                code: ({ children }) => (
                  <code className="px-1.5 py-0.5 rounded bg-slate-800/90 text-indigo-300 font-mono text-[11px] border border-slate-700/80">
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-amber-400 pl-3 italic text-slate-400 my-2 bg-slate-800/30 py-1.5 rounded-r">
                    {children}
                  </blockquote>
                ),
                // Custom table container & rendering for Markdown tables
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-lg border border-slate-800 bg-slate-950/60 shadow-sm">
                    <table className="w-full text-xs text-left text-slate-200 border-collapse min-w-[500px]">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-800/90 text-amber-300 font-bold uppercase text-[10px] sm:text-[11px] tracking-wider border-b border-slate-700">
                    {children}
                  </thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-slate-800/80">
                    {children}
                  </tbody>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-slate-800/50 transition-colors odd:bg-slate-900/40 even:bg-slate-900/80">
                    {children}
                  </tr>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2.5 border-r border-slate-700/60 font-semibold text-amber-300 whitespace-nowrap">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 border-r border-slate-800/60 text-slate-200 leading-relaxed text-xs">
                    {children}
                  </td>
                ),
              }}
            >
              {feedbackText}
            </Markdown>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-800/60">
            <span className="text-amber-400 font-bold shrink-0">✨ Note:</span>
            <span>
              {lang === 'vi'
                ? 'Báo cáo phản biện trên đã được Bước 3 (Trợ lý AI Synthesizer) tổng hợp và điều chỉnh hoàn thiện vào các bảng kết quả bên dưới.'
                : 'The above auditor critique report has been synthesized and refined into the final result tables below by Step 3 (AI Synthesizer).'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
