import React from 'react';
import { Sparkles, ArrowRight, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { ExecutiveHeroViewModel, QuickWinAction } from '../utils/evidenceMapAdapter';

interface ExecutiveHeroCardProps {
  hero: ExecutiveHeroViewModel;
  lang: 'vi' | 'en';
  isStale?: boolean;
  onQuickWinClick?: (quickWin: QuickWinAction) => void;
}

export const ExecutiveHeroCard: React.FC<ExecutiveHeroCardProps> = ({
  hero,
  lang,
  isStale = false,
  onQuickWinClick,
}) => {
  const isVi = lang === 'vi';

  // Tính tỷ lệ thanh phân đoạn Must-Have
  const passedPct =
    hero.mustHaveTotal > 0 ? (hero.mustHavePassed / hero.mustHaveTotal) * 100 : 0;
  const partialPct =
    hero.mustHaveTotal > 0 ? (hero.mustHavePartial / hero.mustHaveTotal) * 100 : 0;
  const gapPct =
    hero.mustHaveTotal > 0 ? (hero.mustHaveGap / hero.mustHaveTotal) * 100 : 0;
  const uncomparedPct =
    hero.mustHaveTotal > 0 ? (hero.mustHaveUncompared / hero.mustHaveTotal) * 100 : 0;

  return (
    <section
      data-testid="executive-hero-card"
      aria-label={isVi ? 'Tổng quan đánh giá hồ sơ' : 'Executive Profile Overview'}
      className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200/90 shadow-xs space-y-6 transition-all"
    >
      {/* 1. Verdict Statement */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a73e8]/10 text-[#1a73e8] border border-[#1a73e8]/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isVi ? 'KẾT LUẬN ĐÁNH GIÁ CÓ CĂN CỨ' : 'EVIDENCED ASSESSMENT'}</span>
          </div>

          {isStale && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3 h-3" />
              {isVi ? 'Dữ liệu đầu vào đã thay đổi' : 'Input data modified'}
            </span>
          )}

          {hero.hasMustHaveData && (
            <>
              {hero.mustHaveSource === 'mixed' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-600 bg-slate-100 border border-slate-200">
                  {isVi
                    ? `Must-Have: ${hero.explicitMustHaveCount} tường minh, ${hero.inferredMustHaveCount} suy luận`
                    : `Must-Have: ${hero.explicitMustHaveCount} explicit, ${hero.inferredMustHaveCount} inferred`}
                </span>
              )}

              {hero.mustHaveSource === 'inferred_importance' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-500 bg-slate-100 border border-slate-200">
                  {isVi ? 'Must-Have suy luận từ độ quan trọng cao nhất JD' : 'Must-Have inferred from top JD importance'}
                </span>
              )}

              {hero.mustHaveSource === 'explicit' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200">
                  {isVi ? 'Must-Have xác định tường minh từ JD' : 'Must-Have explicit in JD'}
                </span>
              )}
            </>
          )}
        </div>

        <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 leading-relaxed">
          {hero.verdictStatement}
        </h2>
      </div>

      {/* 2. Metric Cards (Responsive Vertical Stack on Mobile, 3 Cols on sm/desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Metric 1: Overall Score */}
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {isVi ? 'ĐIỂM ĐÁNH GIÁ CV GỐC' : 'OVERALL ROLE FIT SCORE'}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {hero.overallScore}
            </span>
            <span className="text-sm font-semibold text-slate-600">/ 100</span>
            <span className="text-[11px] text-slate-400 font-mono">
              ({isVi ? 'v1.0 cố định' : 'v1.0 snapshot'})
            </span>
          </div>
          <div className="text-[11px] text-slate-500 line-clamp-1">
            {hero.scoreRationale || (isVi ? 'Điểm số gắn với bản CV đã phân tích' : 'Score fixed to evaluated version')}
          </div>
        </div>

        {/* Metric 2: Must-Have Criteria */}
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
            <span>{isVi ? 'YÊU CẦU BẮT BUỘC (MUST-HAVE)' : 'MANDATORY CRITERIA'}</span>
            <span className="font-extrabold text-slate-900">
              {hero.hasMustHaveData
                ? `${hero.mustHavePassed} / ${hero.mustHaveTotal} ${isVi ? 'Đạt' : 'Met'}`
                : isVi ? 'Chưa xác định' : 'Not specified'}
            </span>
          </div>

          {hero.hasMustHaveData ? (
            <>
              {/* Segmented Progress Bar */}
              <div
                className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden flex"
                role="progressbar"
                aria-valuenow={hero.mustHavePassed}
                aria-valuemin={0}
                aria-valuemax={hero.mustHaveTotal}
                aria-label={
                  isVi
                    ? `Đạt ${hero.mustHavePassed} trên ${hero.mustHaveTotal} yêu cầu bắt buộc`
                    : `${hero.mustHavePassed} of ${hero.mustHaveTotal} mandatory criteria met`
                }
              >
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${passedPct}%` }}
                  title={`${hero.mustHavePassed} ${isVi ? 'Đủ bằng chứng' : 'Evidenced'}`}
                />
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${partialPct}%` }}
                  title={`${hero.mustHavePartial} ${isVi ? 'Một phần' : 'Partial'}`}
                />
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{ width: `${gapPct}%` }}
                  title={`${hero.mustHaveGap} ${isVi ? 'Cần bổ sung' : 'Gap'}`}
                />
                {hero.mustHaveUncompared > 0 && (
                  <div
                    className="bg-slate-400 h-full transition-all"
                    style={{ width: `${uncomparedPct}%` }}
                    title={`${hero.mustHaveUncompared} ${isVi ? 'Chưa đối chiếu' : 'Uncompared'}`}
                  />
                )}
              </div>

              {/* Text Count Indicators */}
              <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold flex-wrap gap-1">
                <span className="text-emerald-700 font-bold">
                  ● {hero.mustHavePassed} {isVi ? 'Đủ bằng chứng' : 'Evidenced'}
                </span>
                {hero.mustHavePartial > 0 && (
                  <span className="text-amber-700 font-bold">
                    ● {hero.mustHavePartial} {isVi ? 'Một phần' : 'Partial'}
                  </span>
                )}
                <span className="text-rose-600 font-bold">
                  ● {hero.mustHaveGap} {isVi ? 'Cần bổ sung' : 'Gap'}
                </span>
                {hero.mustHaveUncompared > 0 && (
                  <span className="text-slate-500 font-bold">
                    ○ {hero.mustHaveUncompared} {isVi ? 'Chưa đối chiếu' : 'Uncompared'}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-500 py-1">
              {isVi
                ? 'JD không gắn nhãn yêu cầu bắt buộc. Xem bản đồ năng lực bên dưới.'
                : 'JD has no mandatory flags. Refer to evidence breakdown below.'}
            </div>
          )}
        </div>

        {/* Metric 3: System Assessment / Hiring Impression */}
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {isVi ? 'NHẬN ĐỊNH BỔ TRỢ HỆ THỐNG' : 'SYSTEM HIRING IMPRESSION'}
          </div>
          <div className="flex items-center gap-2">
            {hero.inviteDecision === 'YES' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isVi ? 'KHUYẾN NGHỊ: PHỎNG VẤN' : 'RECOMMEND: INTERVIEW'}
              </span>
            )}
            {hero.inviteDecision === 'MAYBE' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                <HelpCircle className="w-3.5 h-3.5" />
                {isVi ? 'KHUYẾN NGHỊ: CÂN NHẮC' : 'RECOMMEND: CONSIDER'}
              </span>
            )}
            {hero.inviteDecision === 'NO' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                <AlertCircle className="w-3.5 h-3.5" />
                {isVi ? 'CẦN TỐI ƯU THÊM' : 'NEEDS OPTIMIZATION'}
              </span>
            )}
            {!hero.inviteDecision && (
              <span className="text-xs text-slate-500 font-medium">
                {isVi ? 'Đang tổng hợp nhận định' : 'Aggregating'}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-600 line-clamp-2">
            {hero.decisionReason || (isVi ? 'Nhận định bổ trợ dựa trên đối chiếu ban đầu.' : 'Supplementary assessment.')}
          </div>
        </div>
      </div>

      {/* 3. Top Quick Wins (Deterministic Linking) */}
      {hero.quickWins && hero.quickWins.length > 0 && (
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-between flex-wrap gap-2">
            <span>
              ⚡ {isVi ? 'HÀNH ĐỘNG ƯU TIÊN CẦN LÀM (QUICK WINS):' : 'TOP RECOMMENDED ACTIONS (QUICK WINS):'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {isVi ? 'Bấm để định vị đúng tiêu chí trong bản đồ' : 'Click to jump to criteria in Evidence Map'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {hero.quickWins.map((qw, idx) => {
              const hasNavTarget = Boolean(qw.targetItemId);

              return (
                <div
                  key={qw.id}
                  className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between gap-3 transition-all ${
                    hasNavTarget
                      ? 'border-slate-200 bg-white hover:border-[#1a73e8]/60 hover:shadow-xs'
                      : 'border-slate-200/80 bg-slate-50/60'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#1a73e8] text-xs">
                        #{idx + 1}
                      </span>
                      {hasNavTarget ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {isVi ? 'Có vị trí đối chiếu' : 'Linked criterion'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                          {isVi ? 'Gợi ý chung' : 'General tip'}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {qw.title}
                    </p>
                  </div>

                  {hasNavTarget ? (
                    <button
                      onClick={() => onQuickWinClick && onQuickWinClick(qw)}
                      className="inline-flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#1a73e8] bg-[#1a73e8]/5 hover:bg-[#1a73e8]/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/40"
                    >
                      <span>{qw.actionText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      {isVi ? 'Checklist tham khảo' : 'Reference checklist'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
