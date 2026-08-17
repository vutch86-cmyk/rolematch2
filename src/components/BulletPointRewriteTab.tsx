import React, { useState } from 'react';
import { BulletRewriteItem } from '../types';
import { Language, translations } from '../utils/i18n';
import {
  HelpCircle,
  Copy,
  Check,
  Zap,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileCheck
} from 'lucide-react';

interface BulletPointRewriteTabProps {
  clarifyingQuestions: string[];
  rewrittenBullets: BulletRewriteItem[];
  onRefineWithAnswers: (answers: string) => void;
  isRefining: boolean;
  onOpenGenerateUpdatedCv?: () => void;
  lang: Language;
}

export const BulletPointRewriteTab: React.FC<BulletPointRewriteTabProps> = ({
  clarifyingQuestions,
  rewrittenBullets,
  onRefineWithAnswers,
  isRefining,
  onOpenGenerateUpdatedCv,
  lang,
}) => {
  const t = translations[lang].bulletRewriteTab;

  const [answersInput, setAnswersInput] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [isAnswerBoxOpen, setIsAnswerBoxOpen] = useState<boolean>(
    clarifyingQuestions && clarifyingQuestions.length > 0
  );

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
    <div className="space-y-8">
      {/* 1. Clarifying Questions Callout / Interactive Form */}
      {clarifyingQuestions && clarifyingQuestions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
              <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                {lang === 'vi'
                  ? 'Câu Hỏi Làm Rõ Để Tối Ưu Bullet Point Chuẩn Số Liệu'
                  : 'Clarifying Questions to Optimize Bullet Points with Metrics'}
              </span>
            </div>
            <button
              onClick={() => setIsAnswerBoxOpen(!isAnswerBoxOpen)}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              {isAnswerBoxOpen
                ? lang === 'vi'
                  ? 'Ẩn form trả lời'
                  : 'Hide answer form'
                : lang === 'vi'
                ? 'Trả lời để tối ưu thêm'
                : 'Answer to refine further'}
            </button>
          </div>

          <p className="text-xs sm:text-sm text-amber-900/80 mb-4 leading-relaxed">
            {lang === 'vi'
              ? 'Để các bullet point có kết quả đo lường thuyết phục nhất, bạn hãy cung cấp thêm một vài chi tiết thực tế (nếu có):'
              : 'To make your bullet points as measurable and convincing as possible, provide a few additional details (if available):'}
          </p>

          <div className="space-y-2 mb-4 bg-white/80 p-4 rounded-xl border border-amber-200/60">
            {clarifyingQuestions.map((q, idx) => (
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
                  lang === 'vi'
                    ? 'Nhập câu trả lời ngắn của bạn tại đây... (Ví dụ: 1. Doanh số tăng 25%, 2. Dùng công cụ GA4 và Meta Ads, 3. Team có 4 người)'
                    : 'Enter your short answers here... (e.g., 1. Increased sales by 25%, 2. Used GA4 & Meta Ads, 3. Managed 4 people)'
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
                      <span>{lang === 'vi' ? 'Đang tạo bản viết lại mới...' : 'Generating new rewrites...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Tái Tối Ưu Bullet Point Với Thông Tin Này' : 'Refine Bullet Points with This Info'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Formula Banner & Gemini AI Generator Card */}
      <div className="space-y-4">
        {onOpenGenerateUpdatedCv && (
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-700/80 relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2 max-w-2xl">
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {lang === 'vi'
                    ? 'Tự Động Cập Nhật CV Hoàn Chỉnh Với Gemini AI'
                    : 'Automatically Generate Updated CV with Gemini AI'}
                </h3>
                <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
                  {lang === 'vi'
                    ? 'Tự động ghép tất cả các bullet point, kết hợp từ khóa JD còn thiếu và xuất ra một bản CV mới hoàn chỉnh.'
                    : 'Automatically merge all rewritten bullet points, incorporate missing JD keywords, and generate a complete new CV.'}
                </p>
              </div>

              <button
                onClick={onOpenGenerateUpdatedCv}
                className="px-6 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
                <span>{lang === 'vi' ? 'Cập Nhật CV Ngay (Gemini AI)' : 'Update CV Now (Gemini AI)'}</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-indigo-950 text-white rounded-2xl p-6 shadow-md border border-indigo-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-800/80">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {lang === 'vi'
                  ? 'Các đề xuất cập nhật CV'
                  : 'CV Update Recommendations'}
              </h3>
            </div>

            <button
              onClick={handleCopyAll}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{lang === 'vi' ? 'Đã sao chép tất cả bullet!' : 'Copied all bullets!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Sao Chép Tất Cả Bullet Mới' : 'Copy All New Bullets'}</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-indigo-100">
            <div className="bg-indigo-900/60 p-3 rounded-xl border border-indigo-800/60 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                1
              </span>
              <span>
                <strong>{lang === 'vi' ? 'Ngắn gọn và đầy đủ' : 'Concise and complete'}</strong>
              </span>
            </div>
            <div className="bg-indigo-900/60 p-3 rounded-xl border border-indigo-800/60 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                2
              </span>
              <span>
                {lang === 'vi'
                  ? 'Sát từ khóa JD nhưng ngôn ngữ tự nhiên'
                  : 'Aligns with JD keywords in natural language'}
              </span>
            </div>
            <div className="bg-indigo-900/60 p-3 rounded-xl border border-indigo-800/60 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                3
              </span>
              <span>
                {lang === 'vi'
                  ? 'Chỉ dựa trên thực tế trong CV, không bịa đặt'
                  : 'Based strictly on facts in CV, no fabrication'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Rewritten Bullets Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {lang === 'vi'
                ? 'Bảng Viết Lại Bullet Point So Sánh Chi Tiết'
                : 'Detailed Bullet Point Rewrite Comparison'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'vi'
                ? 'So sánh từng câu gốc trong CV với phiên bản đã tối ưu sát với ngôn ngữ của JD.'
                : 'Compare each original sentence in your CV with the optimized version aligned with JD.'}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {rewrittenBullets.length} {lang === 'vi' ? 'bullet point' : 'bullet points'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4 w-1/4">{lang === 'vi' ? 'Bullet Gốc Trong CV' : 'Original CV Bullet'}</th>
                <th className="py-3 px-4 w-1/4">{lang === 'vi' ? 'Vấn Đề Của Bullet Gốc' : 'Issue in Original'}</th>
                <th className="py-3 px-4 w-1/3">{lang === 'vi' ? 'Bullet Được Viết Lại' : 'Rewritten Bullet'}</th>
                <th className="py-3 px-4">{lang === 'vi' ? 'Vì Sao Bản Mới Tốt Hơn' : 'Why New Version is Better'}</th>
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
                            {lang === 'vi'
                              ? 'Cần bổ sung thông tin trước khi viết lại.'
                              : 'Needs more information before rewriting.'}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xl text-emerald-950 relative group">
                          <p className="font-semibold text-xs sm:text-sm leading-relaxed pr-8">
                            • {item.rewrittenBullet}
                          </p>

                          <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800">
                            <span className="flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {wordCount} {lang === 'vi' ? 'từ (Ngắn gọn và đầy đủ)' : 'words (Concise & complete)'}
                            </span>

                            <button
                              onClick={() => handleCopySingle(item.rewrittenBullet, idx)}
                              className="flex items-center gap-1 text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer"
                              title={lang === 'vi' ? 'Sao chép bullet này' : 'Copy this bullet'}
                            >
                              {copiedIndex === idx ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>{lang === 'vi' ? 'Đã chép' : 'Copied'}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-emerald-700" />
                                  <span>{lang === 'vi' ? 'Sao chép' : 'Copy'}</span>
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
