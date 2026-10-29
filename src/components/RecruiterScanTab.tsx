import React, { useMemo } from 'react';
import { RecruiterScanResult } from '../types';
import { Language, translations } from '../utils/i18n';
import {
  normalizeFeature3Data,
  getSeniorityAssessmentConfig,
  getRiskSeverityConfig,
} from '../utils/recruiterScanHelpers';
import {
  UserCheck,
  UserX,
  Eye,
  Zap,
  AlertOctagon,
  TrendingDown,
  Wrench,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Layers,
  Compass,
  Target,
  ShieldCheck,
  Award,
  Lightbulb,
} from 'lucide-react';

interface RecruiterScanTabProps {
  result: RecruiterScanResult;
  lang: Language;
  cvText?: string;
  jdText?: string;
}

export const RecruiterScanTab: React.FC<RecruiterScanTabProps> = ({
  result,
  lang,
  cvText = '',
  jdText = '',
}) => {
  const t = translations[lang].recruiterScanTab;
  const isEn = lang === 'en';

  const { normalizedResult, seniorityFit, riskMitigationMatrix } = useMemo(() => {
    return normalizeFeature3Data(result, cvText, jdText, lang);
  }, [result, cvText, jdText, lang]);

  const getDecisionBadge = () => {
    switch (normalizedResult.inviteDecision) {
      case 'YES':
        return (
          <div className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wider shadow-md shadow-emerald-500/20">
            <UserCheck className="w-5 h-5 shrink-0" />
            <span>{t.inviteYes}</span>
          </div>
        );
      case 'NO':
        return (
          <div className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wider shadow-md shadow-rose-600/20">
            <UserX className="w-5 h-5 shrink-0" />
            <span>{t.inviteNo}</span>
          </div>
        );
      case 'MAYBE':
      default:
        return (
          <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wider shadow-md shadow-amber-500/20">
            <Clock className="w-5 h-5 shrink-0" />
            <span>{t.inviteMaybe}</span>
          </div>
        );
    }
  };

  const getDimensionIcon = (key: string) => {
    switch (key) {
      case 'level_tenure':
        return <Briefcase className="w-5 h-5 text-indigo-600" />;
      case 'scale_complexity':
        return <Layers className="w-5 h-5 text-blue-600" />;
      case 'scope_ownership':
        return <Compass className="w-5 h-5 text-amber-600" />;
      case 'domain_match':
      default:
        return <Target className="w-5 h-5 text-purple-600" />;
    }
  };

  const overallSeniorityConfig = getSeniorityAssessmentConfig(
    seniorityFit.overallAssessment,
    lang
  );

  return (
    <div className="space-y-8">
      {/* =========================================================================
          KHỐI 1: QUYẾT ĐỊNH 10 GIÂY CỦA NHÀ TUYỂN DỤNG (10S RECRUITER SCAN)
          ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <Eye className="w-64 h-64 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                {isEn ? '10-Second Real Recruiter Skim' : 'Đánh Giá Thực Tế 10 Giây'}
              </span>
              <span className="text-xs text-slate-400">
                {isEn ? 'Direct • Rigorous • No flattery' : 'Không khen xã giao • Trực diện • Khắt khe'}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100">
              {isEn
                ? 'Recruiter Decision After 10-Second Skim'
                : 'Quyết Định Của Nhà Tuyển Dụng Sau 10 Giây Đọc Lướt'}
            </h3>
          </div>

          <div className="shrink-0">{getDecisionBadge()}</div>
        </div>

        {/* Reason for decision */}
        <div className="mt-6 bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            {isEn ? 'Primary decision driver:' : 'Lý do chính khiến Nhà tuyển dụng đưa ra quyết định trên:'}
          </div>
          <p className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed">
            "{normalizedResult.decisionReason}"
          </p>
        </div>
      </div>

      {/* 4 Cards Grid: First Impression, Immediate Strength, Biggest Doubt, Fastest Point Loss */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: First impression in 10s */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">
                <Eye className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isEn ? '1. First Impression in 10-Second Skim?' : '1. Ấn Tượng Đầu Tiên Khi Nhìn Lướt CV Trong 10 Giây?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              {normalizedResult.firstImpression10s}
            </p>
          </div>
        </div>

        {/* Card 2: Immediate Strength */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isEn ? '2. Which Strength Immediately Stands Out?' : '2. Điểm Mạnh Nào Đập Vào Mắt Ngay Lập Tức?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
              {normalizedResult.immediateStrength}
            </p>
          </div>
        </div>

        {/* Card 3: Biggest Doubt */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isEn ? '3. Biggest Doubt About This Candidate?' : '3. Nghi Ngờ Lớn Nhất Về Ứng Viên Này?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-amber-950 leading-relaxed bg-amber-50/70 p-4 rounded-xl border border-amber-100">
              {normalizedResult.biggestDoubt}
            </p>
          </div>
        </div>

        {/* Card 4: Fastest Point Loss Section */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isEn ? '4. Which Section Causes Fastest Point Loss?' : '4. Phần Nào Trong CV Khiến Bạn Bị Mất Điểm Nhanh Nhất?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-rose-950 leading-relaxed bg-rose-50/70 p-4 rounded-xl border border-rose-100">
              {normalizedResult.fastestPointLossSection}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          KHỐI 2 (MỚI): ĐÁNH GIÁ TẦM VÓC & CẤP BẬC (SENIORITY & SCOPE FIT 4 TRỤC)
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                {isEn ? 'Seniority & Scope Matrix' : 'Đối Chiếu Tầm Vóc 4 Chiều'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {t.senioritySectionTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {t.senioritySectionSubtitle}
            </p>
          </div>

          {/* Overall Seniority Fit Badge */}
          <div className="shrink-0 flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-500 hidden md:inline">
              {t.overallSeniorityTitle}
            </span>
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-bold shadow-sm ${overallSeniorityConfig.badgeBg} ${overallSeniorityConfig.badgeText} ${overallSeniorityConfig.badgeBorder}`}
            >
              <span className={`w-2 h-2 rounded-full ${overallSeniorityConfig.dotBg} animate-pulse`} />
              <span>{seniorityFit.overallAssessmentLabel}</span>
            </div>
          </div>
        </div>

        {/* Overall Rationale & Positioning Advice Callouts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>{isEn ? 'Executive Seniority Analysis' : 'Phân Tích Chiều Sâu Tầm Vóc'}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
              {seniorityFit.summaryRationale}
            </p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 rounded-xl p-4 border border-indigo-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800 mb-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>{t.positioningAdviceTitle}</span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-950 leading-relaxed font-medium">
              {seniorityFit.positioningAdvice}
            </p>
          </div>
        </div>

        {/* 4 Dimensions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          {seniorityFit.dimensions.map((dim, idx) => {
            const dimConfig = getSeniorityAssessmentConfig(dim.assessment, lang);
            return (
              <div
                key={dim.dimensionKey || idx}
                className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors shadow-xs p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Dimension Top Row */}
                  <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        {getDimensionIcon(dim.dimensionKey)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {dim.dimensionName}
                        </h4>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${dimConfig.badgeBg} ${dimConfig.badgeText} ${dimConfig.badgeBorder}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dimConfig.dotBg}`} />
                      <span>{dimConfig.label}</span>
                    </span>
                  </div>

                  {/* Comparison Side-by-Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {/* JD Expectation */}
                    <div className="bg-slate-50/90 rounded-lg p-3 border border-slate-100">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>{t.jdExpectationLabel}</span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {dim.jdExpectation}
                      </p>
                    </div>

                    {/* CV Reality */}
                    <div className="bg-indigo-50/40 rounded-lg p-3 border border-indigo-100/70">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>{t.cvRealityLabel}</span>
                      </div>
                      <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                        {dim.cvReality}
                      </p>
                    </div>
                  </div>
                </div>

                {/* HR Comment Quote */}
                <div className="bg-slate-50/80 rounded-lg p-3 border-l-3 border-indigo-500 text-xs text-slate-700 leading-relaxed font-medium">
                  <span className="font-bold text-slate-900 mr-1">
                    {t.hrCommentLabel}:
                  </span>
                  <span>{dim.comment}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          KHỐI 3 (MỚI): MA TRẬN HÓA GIẢI RỦI RO & RED FLAGS (RISK RADAR)
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-6">
        {/* Section Header */}
        <div className="pb-5 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              {isEn ? 'Risk Radar & Mitigation' : 'Ma Trận Hóa Giải Rủi Ro'}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            {t.riskSectionTitle}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t.riskSectionSubtitle}
          </p>
        </div>

        {/* Risk Items Cards */}
        <div className="space-y-4">
          {riskMitigationMatrix.map((item, idx) => {
            const severityConfig = getRiskSeverityConfig(item.severity, lang);
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors bg-white"
              >
                {/* Risk Item Top Bar */}
                <div className="bg-slate-50/80 px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      {item.riskTitle}
                    </h4>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${severityConfig.badgeClass}`}
                  >
                    {severityConfig.label}
                  </span>
                </div>

                {/* 3 Pillars: Concern, CV Fix, Interview Defense */}
                <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Recruiter Concern */}
                  <div className="bg-rose-50/40 rounded-xl p-3.5 border border-rose-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{t.recruiterConcernLabel}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-rose-950 font-medium leading-relaxed">
                        {item.recruiterConcern}
                      </p>
                    </div>
                  </div>

                  {/* CV Actionable Mitigation */}
                  <div className="bg-emerald-50/40 rounded-xl p-3.5 border border-emerald-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{t.cvMitigationLabel}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed">
                        {item.cvMitigation}
                      </p>
                    </div>
                  </div>

                  {/* Interview Defense */}
                  <div className="bg-indigo-50/40 rounded-xl p-3.5 border border-indigo-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{t.interviewDefenseLabel}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-indigo-950 font-medium leading-relaxed">
                        {item.interviewDefense}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          KHỐI 4: TOP 3 ĐIỀU BẮT BUỘC PHẢI SỬA NGAY (MUST FIX ACTION PLAN)
          ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-slate-800">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-base sm:text-lg">
              {isEn
                ? 'Top 3 Mandatory Fixes to Maximize Interview Callback Rate'
                : '3 Điều Bắt Buộc Phải Sửa Để Tăng Khả Năng Được Gọi Phỏng Vấn'}
            </h4>
            <p className="text-xs text-slate-400">
              {isEn
                ? 'High-leverage action guidance from Senior Talent Acquisition Lead perspective:'
                : 'Chỉ dẫn hành động ưu tiên từ góc nhìn chiến lược của Senior HR Lead:'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {normalizedResult.top3MustFix.map((fixItem, idx) => (
            <div
              key={idx}
              className="bg-slate-800/80 p-4 sm:p-5 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  {idx + 1}
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  {fixItem}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
