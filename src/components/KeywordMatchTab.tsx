import React, { useState } from 'react';
import {
  JDKeyword,
  ComparisonRow,
  CompatibilityScores,
  AnalysisSummary,
  ImportanceLevel,
} from '../types';
import { Language, translations } from '../utils/i18n';
import { CircularScoreProgress } from './CircularScoreProgress';
import { normalizeFeature1Data } from '../utils/keywordMatchHelpers';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  Search,
  CheckSquare,
  Square,
  Award,
  TrendingUp,
  Sparkles,
  Layers,
  ArrowRight,
  Flame,
  Copy,
  Check,
  MapPin,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface KeywordMatchTabProps {
  jdKeywords: JDKeyword[];
  comparisonTable: ComparisonRow[];
  scores: CompatibilityScores;
  summary: AnalysisSummary;
  checkedActions: boolean[];
  onToggleAction: (index: number) => void;
  lang: Language;
}

export const KeywordMatchTab: React.FC<KeywordMatchTabProps> = ({
  jdKeywords = [],
  comparisonTable = [],
  scores,
  summary,
  checkedActions = [],
  onToggleAction,
  lang,
}) => {
  const t = translations[lang].keywordTab;

  const {
    normalizedKeywords,
    normalizedComparisonTable,
    enrichedScores,
    mustHaveStats,
  } = normalizeFeature1Data(jdKeywords || [], comparisonTable || [], scores, lang);

  const allText = lang === 'vi' ? 'Tất cả' : 'All';
  const [selectedCategory, setSelectedCategory] = useState<string>(allText);
  const [selectedImportance, setSelectedImportance] = useState<string>(allText);
  const [requirementFilter, setRequirementFilter] = useState<'all' | 'must_have' | 'nice_to_have'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(allText);
  const [copiedRowIdx, setCopiedRowIdx] = useState<number | null>(null);

  const handleCopySnippet = async (text: string, idx: number) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRowIdx(idx);
      setTimeout(() => {
        setCopiedRowIdx((prev) => (prev === idx ? null : prev));
      }, 2000);
    } catch {
      // Fallback copy if clipboard permission is restricted
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedRowIdx(idx);
      setTimeout(() => {
        setCopiedRowIdx((prev) => (prev === idx ? null : prev));
      }, 2000);
    }
  };

  const categories =
    lang === 'vi'
      ? [
          'Tất cả',
          'Kỹ năng chuyên môn',
          'Công cụ, phần mềm hoặc phương pháp',
          'Kinh nghiệm mong muốn',
          'Kết quả đầu ra hoặc kỳ vọng công việc',
          'Phẩm chất hoặc cách làm việc',
        ]
      : [
          'All',
          'Technical Skills',
          'Tools, Software or Methodologies',
          'Desired Experience',
          'Outputs or Work Expectations',
          'Qualities or Work Style',
        ];

  // Helper badge styles for importance
  const getImportanceBadge = (importance: ImportanceLevel | string) => {
    const isHigh =
      importance === 'Rất quan trọng' ||
      importance === 'High Priority' ||
      importance === 'Very Important';
    const isMedium =
      importance === 'Quan trọng' ||
      importance === 'Important' ||
      importance === 'Medium Priority';
    const isAdvantage =
      importance === 'Có lợi thế' ||
      importance === 'Advantageous' ||
      importance === 'Nice to Have';

    if (isHigh) return 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
    if (isMedium) return 'bg-amber-100 text-amber-800 border-amber-200 font-semibold';
    if (isAdvantage) return 'bg-blue-100 text-blue-800 border-blue-200 font-medium';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getRequirementBadge = (isMustHave?: boolean) => {
    if (isMustHave) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white shadow-2xs">
          <Flame className="w-3 h-3 fill-amber-200 text-amber-200" />
          {t.mustHaveBadge}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
        {t.niceToHaveBadge}
      </span>
    );
  };

  const getStatusBadge = (status: 'khop' | 'can_bo_sung' | 'thieu') => {
    switch (status) {
      case 'khop':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {t.statusMatched}
          </span>
        );
      case 'can_bo_sung':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            {t.statusNeedsWork}
          </span>
        );
      case 'thieu':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            {t.statusMissing}
          </span>
        );
    }
  };

  // Filter comparison table
  const filteredRows = normalizedComparisonTable.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (row.jdTerm || '').toLowerCase().includes(q) ||
      (row.cvEvidence || '').toLowerCase().includes(q) ||
      (row.gapOrClarification || '').toLowerCase().includes(q) ||
      (row.targetSection || '').toLowerCase().includes(q) ||
      (row.suggestedPhrasing || '').toLowerCase().includes(q);

    const matchesImportance =
      selectedImportance === allText ||
      selectedImportance === 'Tất cả' ||
      selectedImportance === 'All' ||
      row.importance === selectedImportance;

    const matchesRequirement =
      requirementFilter === 'all' ||
      (requirementFilter === 'must_have' && row.isMustHave) ||
      (requirementFilter === 'nice_to_have' && !row.isMustHave);

    const matchesStatus =
      statusFilter === allText ||
      statusFilter === 'Tất cả' ||
      statusFilter === 'All' ||
      ((statusFilter === 'Khớp' || statusFilter === 'Matched' || statusFilter === 'Đã thể hiện rõ') &&
        row.matchStatus === 'khop') ||
      ((statusFilter === 'Cần bổ sung' || statusFilter === 'Needs Work') &&
        row.matchStatus === 'can_bo_sung') ||
      ((statusFilter === 'Thiếu' || statusFilter === 'Missing' || statusFilter === 'Còn thiếu') &&
        row.matchStatus === 'thieu');

    return matchesSearch && matchesImportance && matchesRequirement && matchesStatus;
  });

  // Filter keywords list
  const filteredKeywords = normalizedKeywords.filter((kw) => {
    const matchesCategory =
      selectedCategory === allText ||
      selectedCategory === 'Tất cả' ||
      selectedCategory === 'All' ||
      kw.category === selectedCategory;
    const matchesImportance =
      selectedImportance === allText ||
      selectedImportance === 'Tất cả' ||
      selectedImportance === 'All' ||
      kw.importance === selectedImportance;
    const matchesRequirement =
      requirementFilter === 'all' ||
      (requirementFilter === 'must_have' && kw.isMustHave) ||
      (requirementFilter === 'nice_to_have' && !kw.isMustHave);
    return matchesCategory && matchesImportance && matchesRequirement;
  });

  const scoreGain = Math.max(
    0,
    enrichedScores.projectedOverallScore - enrichedScores.overallRoleScore
  );

  return (
    <div className="space-y-8">
      {/* 1. Multi-Dimensional Score Breakdown & Rationale Card */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {t.matchingScoreTag}
              </span>
              {scoreGain > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {t.projectedScoreLabel}: {enrichedScores.overallRoleScore}%{' '}
                  <ArrowRight className="w-3.5 h-3.5" /> {enrichedScores.projectedOverallScore}% (+
                  {scoreGain}%)
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              {t.overallFitTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {enrichedScores.overallRationale || t.overallFitDesc}
            </p>
          </div>

          {/* Circular Progress + Projected Score Box */}
          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <div className="bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-slate-700/60 shadow-inner flex flex-col items-center justify-center">
              <CircularScoreProgress
                score={enrichedScores.overallRoleScore}
                size={130}
                strokeWidth={10}
                title={t.circularScoreTitle}
                showBadge={true}
                variant="dark"
                lang={lang}
              />
            </div>

            <div className="bg-gradient-to-br from-emerald-950/90 via-slate-800/90 to-indigo-950/90 p-4 sm:p-5 rounded-2xl border border-emerald-500/30 shadow-inner max-w-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  {t.projectedScoreLabel}
                </span>
                {scoreGain > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    +{scoreGain}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-slate-400 text-lg font-bold line-through">
                  {enrichedScores.overallRoleScore}%
                </span>
                <ArrowRight className="w-4 h-4 text-emerald-400" />
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {enrichedScores.projectedOverallScore}%
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {t.projectedScoreDesc}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Score Meters with Detailed Rationales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Meter 1: Keyword Match */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-200 font-semibold">{t.scoreSub1}</span>
                <span className="font-bold text-indigo-400 text-sm">
                  {enrichedScores.keywordMatchScore}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${enrichedScores.keywordMatchScore}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-700/60 pt-2.5">
              <span className="font-semibold text-indigo-300 block mb-0.5">
                {t.rationaleTitle}
              </span>
              {enrichedScores.keywordRationale}
            </p>
          </div>

          {/* Meter 2: Skill Match */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-200 font-semibold">{t.scoreSub2}</span>
                <span className="font-bold text-blue-400 text-sm">
                  {enrichedScores.skillMatchScore}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${enrichedScores.skillMatchScore}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-700/60 pt-2.5">
              <span className="font-semibold text-blue-300 block mb-0.5">
                {t.rationaleTitle}
              </span>
              {enrichedScores.skillRationale}
            </p>
          </div>

          {/* Meter 3: Experience & Outcome */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-200 font-semibold">{t.scoreSub3}</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {enrichedScores.experienceOutcomeScore}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${enrichedScores.experienceOutcomeScore}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-700/60 pt-2.5">
              <span className="font-semibold text-emerald-300 block mb-0.5">
                {t.rationaleTitle}
              </span>
              {enrichedScores.experienceRationale}
            </p>
          </div>

          {/* Meter 4: Overall Role Fit */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-200 font-semibold">{t.circularScoreTitle}</span>
                <span className="font-bold text-amber-400 text-sm">
                  {enrichedScores.overallRoleScore}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${enrichedScores.overallRoleScore}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-700/60 pt-2.5">
              <span className="font-semibold text-amber-300 block mb-0.5">
                {t.rationaleTitle}
              </span>
              {enrichedScores.overallRationale}
            </p>
          </div>
        </div>

        {/* Must-Have (Knock-out) vs Nice-to-Have Summary Strip */}
        {mustHaveStats.totalMustHave > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {t.mustHaveTrackerTitle}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {mustHaveStats.matchedMustHave}/{mustHaveStats.totalMustHave}{' '}
                    {lang === 'vi' ? 'Đạt chuẩn' : 'Matched'} ({mustHaveStats.mustHavePassRate}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {lang === 'vi'
                    ? `Trong ${mustHaveStats.totalMustHave} tiêu chí Bắt buộc (Must-Have): ${mustHaveStats.matchedMustHave} đã khớp, ${mustHaveStats.needsWorkMustHave} cần bổ sung chi tiết, ${mustHaveStats.missingMustHave} đang thiếu. Nhóm Điểm cộng (Nice-to-Have): khớp ${mustHaveStats.matchedNiceToHave}/${mustHaveStats.totalNiceToHave}.`
                    : `Among ${mustHaveStats.totalMustHave} Must-Have criteria: ${mustHaveStats.matchedMustHave} matched, ${mustHaveStats.needsWorkMustHave} need work, ${mustHaveStats.missingMustHave} missing. Nice-to-Have: ${mustHaveStats.matchedNiceToHave}/${mustHaveStats.totalNiceToHave} matched.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setRequirementFilter((prev) => (prev === 'must_have' ? 'all' : 'must_have'))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  requirementFilter === 'must_have'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-slate-800 text-rose-300 border-slate-700 hover:border-rose-500/50'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                {t.mustHaveFilterOnly} ({mustHaveStats.totalMustHave})
              </button>
              <button
                type="button"
                onClick={() =>
                  setRequirementFilter((prev) => (prev === 'nice_to_have' ? 'all' : 'nice_to_have'))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  requirementFilter === 'nice_to_have'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-indigo-500/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t.niceToHaveFilterOnly} ({mustHaveStats.totalNiceToHave})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Top Summary & 5 Immediate Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Strengths & Gaps */}
        <div className="lg:col-span-7 space-y-4">
          {/* Greatest Strength */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>
                {lang === 'vi'
                  ? 'Điểm Mạnh Lớn Nhất Của CV So Với JD'
                  : 'Biggest CV Strength Relative to JD'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
              {summary.biggestStrength}
            </p>
          </div>

          {/* Missing Keywords & Skills */}
          <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-sm mb-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>
                {lang === 'vi'
                  ? 'Từ Khóa / Kỹ Năng / Kinh Nghiệm Quan Trọng Còn Thiếu'
                  : 'Key Missing Keywords / Skills / Experience'}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-rose-950">
              {summary.missingKeywordsSkills.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Vague Sections */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span>
                {lang === 'vi'
                  ? 'Những Phần Trong CV Đang Yếu HOẶC Quá Chung Chung'
                  : 'Weak or Overly Vague Sections in CV'}
              </span>
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm text-amber-950">
              {summary.weakOrVagueSections.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right column: 5 Immediate Action Checklist */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  5
                </div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {lang === 'vi'
                    ? 'Việc Cần Sửa Ngay Để CV Cạnh Tranh Hơn'
                    : 'Immediate Actions to Boost CV Competitiveness'}
                </h4>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {checkedActions.filter(Boolean).length}/5{' '}
                {lang === 'vi' ? 'Đã hoàn thành' : 'Completed'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              {lang === 'vi'
                ? 'Tick chọn vào danh sách bên dưới sau khi bạn chỉnh sửa trực tiếp trong bản CV của mình:'
                : 'Check items off below as you revise your CV:'}
            </p>

            <div className="space-y-2.5">
              {summary.immediateActions.map((action, idx) => {
                const isChecked = checkedActions[idx];
                return (
                  <button
                    key={idx}
                    onClick={() => onToggleAction(idx)}
                    className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-3 transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-50/80 border-emerald-300 text-slate-500 line-through'
                        : 'bg-slate-50 hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-300 text-slate-800'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <span className="leading-relaxed">{action}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
            {lang === 'vi'
              ? 'Mẹo: Sửa 5 việc này trước khi nộp để tăng ngay 40% cơ hội qua vòng gửi xe!'
              : 'Tip: Fix these 5 items before applying to boost interview callbacks by ~40%!'}
          </div>
        </div>
      </div>

      {/* 3. Classified JD Keywords Chips */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">
                {lang === 'vi'
                  ? `Từ Khóa Trích Xuất & Xếp Hạng Từ JD (${filteredKeywords.length})`
                  : `Extracted & Ranked JD Keywords (${filteredKeywords.length})`}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'vi'
                ? 'Các cụm từ quan trọng được AI phân loại theo 5 nhóm, tách rõ Tiêu chí Bắt buộc (Must-Have) và Điểm cộng (Nice-to-Have).'
                : 'Key phrases classified by AI into 5 categories, distinguishing Must-Have (Knock-out) vs Nice-to-Have criteria.'}
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> {lang === 'vi' ? 'Phân loại:' : 'Category:'}
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Keywords grid */}
        <div className="flex flex-wrap gap-2">
          {filteredKeywords.map((kw, idx) => (
            <div
              key={`kw-${kw.keyword || 'kw'}-${idx}`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors border ${
                kw.isMustHave
                  ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                  : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <span className="font-semibold text-slate-800">{kw.keyword}</span>
              <span className="text-[10px] text-slate-400 font-normal">({kw.category})</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md border ${getImportanceBadge(
                  kw.importance
                )}`}
              >
                {kw.importance}
              </span>
              {getRequirementBadge(kw.isMustHave)}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Enhanced Actionable Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {lang === 'vi'
                ? 'Bảng Đối Chiếu CV Thực Chiến & Gợi Ý Câu Mẫu Chèn Ngay'
                : 'Actionable CV vs JD Comparison Table & Ready-to-Use Snippets'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'vi'
                ? 'Đối chiếu từng yêu cầu JD (Bắt buộc vs Điểm cộng), chỉ rõ khoảng trống, vị trí cần chèn và câu văn mẫu gợi ý.'
                : 'Compare each JD requirement (Must-Have vs Nice-to-Have), highlighting gaps, target CV sections, and ready-to-use snippets.'}
            </p>
          </div>

          {/* Table Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'vi' ? 'Tìm từ khóa, câu mẫu...' : 'Search keyword, snippet...'}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 w-40 sm:w-48"
              />
            </div>

            <select
              value={requirementFilter}
              onChange={(e) =>
                setRequirementFilter(e.target.value as 'all' | 'must_have' | 'nice_to_have')
              }
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">{t.mustHaveFilterAll}</option>
              <option value="must_have">{t.mustHaveFilterOnly}</option>
              <option value="nice_to_have">{t.niceToHaveFilterOnly}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={allText}>{lang === 'vi' ? 'Tất cả trạng thái' : 'All Statuses'}</option>
              <option value={lang === 'vi' ? 'Khớp' : 'Matched'}>
                {lang === 'vi' ? 'Đã thể hiện rõ' : 'Clearly Evidenced'}
              </option>
              <option value={lang === 'vi' ? 'Cần bổ sung' : 'Needs Work'}>
                {lang === 'vi' ? 'Cần bổ sung' : 'Needs Work'}
              </option>
              <option value={lang === 'vi' ? 'Thiếu' : 'Missing'}>
                {lang === 'vi' ? 'Còn thiếu' : 'Missing'}
              </option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4 w-1/5">
                  {lang === 'vi' ? 'Cụm Từ Trong JD & Phân Loại' : 'JD Requirement & Type'}
                </th>
                <th className="py-3 px-4 w-32">
                  {lang === 'vi' ? 'Mức Độ Ưu Tiên' : 'Priority Level'}
                </th>
                <th className="py-3 px-4 w-1/4">
                  {lang === 'vi' ? 'CV Đã Thể Hiện Ở Đâu' : 'CV Evidence'}
                </th>
                <th className="py-3 px-4">
                  {lang === 'vi'
                    ? 'Khoảng Trống, Vị Trí Chèn & Câu Mẫu Gợi Ý'
                    : 'Gap, Target Section & Suggested CV Snippet'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                    {lang === 'vi'
                      ? 'Không tìm thấy từ khóa đối chiếu phù hợp với bộ lọc.'
                      : 'No keywords found matching the filter.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={`row-${row.jdTerm || 'term'}-${idx}`}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      row.isMustHave && row.matchStatus !== 'khop' ? 'bg-rose-50/15' : ''
                    }`}
                  >
                    <td className="py-4 px-4 font-semibold text-slate-900 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-slate-900 font-bold">{row.jdTerm}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {getStatusBadge(row.matchStatus)}
                          {getRequirementBadge(row.isMustHave)}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <span
                        className={`inline-block text-[11px] px-2 py-0.5 rounded border ${getImportanceBadge(
                          row.importance
                        )}`}
                      >
                        {row.importance}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-700 leading-relaxed align-top">
                      {row.cvEvidence &&
                      row.cvEvidence !== 'Thiếu thông tin' &&
                      row.cvEvidence !== 'Missing' ? (
                        <div className="bg-emerald-50/40 border border-emerald-100 p-2.5 rounded-xl text-emerald-950 font-medium text-xs">
                          {row.cvEvidence}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">
                          {lang === 'vi' ? 'Chưa có thông tin trong CV' : 'No information in CV'}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-slate-700 leading-relaxed align-top">
                      <div className="space-y-2.5">
                        {/* Gap explanation */}
                        {row.gapOrClarification ? (
                          <div className="bg-amber-50/50 border border-amber-200/70 p-2.5 rounded-xl text-amber-950 text-xs">
                            <span className="font-bold text-amber-800 mr-1">
                              {lang === 'vi' ? 'Nhận xét:' : 'Note:'}
                            </span>
                            {row.gapOrClarification}
                          </div>
                        ) : (
                          <span className="text-emerald-600 text-xs font-medium">
                            {lang === 'vi'
                              ? 'Đã khớp tốt, không cần làm rõ thêm.'
                              : 'Matched well, no further clarification needed.'}
                          </span>
                        )}

                        {/* Target Section Badge */}
                        {row.targetSection && row.matchStatus !== 'khop' && (
                          <div className="flex items-center gap-1.5 text-xs text-indigo-900 bg-indigo-50/70 border border-indigo-200/70 px-2.5 py-1.5 rounded-lg">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="font-semibold text-indigo-700">
                              {t.targetSectionLabel}
                            </span>
                            <span className="font-bold">{row.targetSection}</span>
                          </div>
                        )}

                        {/* Suggested Phrasing Box + Copy Button */}
                        {row.suggestedPhrasing && row.matchStatus !== 'khop' && (
                          <div className="bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                {t.suggestedPhrasingLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopySnippet(row.suggestedPhrasing || '', idx)
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                              >
                                {copiedRowIdx === idx ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-300">{t.copiedSnippetBtn}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-300" />
                                    <span>{t.copySnippetBtn}</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-slate-200 italic leading-relaxed">
                              "{row.suggestedPhrasing}"
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
