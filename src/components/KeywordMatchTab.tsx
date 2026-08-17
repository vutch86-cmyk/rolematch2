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
  Target,
  Sparkles,
  Layers,
  ArrowRight
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

  const safeJdKeywords = jdKeywords || [];
  const safeComparisonTable = comparisonTable || [];

  const allText = lang === 'vi' ? 'Tất cả' : 'All';
  const [selectedCategory, setSelectedCategory] = useState<string>(allText);
  const [selectedImportance, setSelectedImportance] = useState<string>(allText);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>(allText);

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
  const filteredRows = safeComparisonTable.filter((row) => {
    const matchesSearch =
      (row.jdTerm || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.cvEvidence || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.gapOrClarification || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesImportance =
      selectedImportance === allText ||
      selectedImportance === 'Tất cả' ||
      selectedImportance === 'All' ||
      row.importance === selectedImportance;

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

    return matchesSearch && matchesImportance && matchesStatus;
  });

  // Filter keywords list
  const filteredKeywords = safeJdKeywords.filter((kw) => {
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
    return matchesCategory && matchesImportance;
  });

  return (
    <div className="space-y-8">
      {/* 1. Score Overview Cards */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {t.matchingScoreTag}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              {t.overallFitTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
              {t.overallFitDesc}
            </p>
          </div>

          {/* Circular Progress Indicator Component */}
          <div className="bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-slate-700/60 shadow-inner flex flex-col items-center justify-center shrink-0">
            <CircularScoreProgress
              score={scores.overallRoleScore}
              size={130}
              strokeWidth={10}
              title={t.circularScoreTitle}
              showBadge={true}
              variant="dark"
              lang={lang}
            />
          </div>
        </div>

        {/* 4 Score Meters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">{t.scoreSub1}</span>
              <span className="font-bold text-indigo-400">{scores.keywordMatchScore}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${scores.keywordMatchScore}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">{t.scoreSub2}</span>
              <span className="font-bold text-blue-400">{scores.skillMatchScore}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${scores.skillMatchScore}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">{t.scoreSub3}</span>
              <span className="font-bold text-emerald-400">{scores.experienceOutcomeScore}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${scores.experienceOutcomeScore}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">{t.circularScoreTitle}</span>
              <span className="font-bold text-amber-400">{scores.overallRoleScore}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${scores.overallRoleScore}%` }}
              />
            </div>
          </div>
        </div>
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
                ? 'Các cụm từ quan trọng được AI phân loại theo 5 nhóm và 3 mức độ ưu tiên tuyển dụng.'
                : 'Key phrases classified by AI into 5 categories and 3 priority levels.'}
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
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs hover:border-indigo-300 transition-colors"
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
            </div>
          ))}
        </div>
      </div>

      {/* 4. Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {lang === 'vi' ? 'Bảng Đối Chiếu CV Chi Tiết Với JD' : 'Detailed CV vs JD Comparison Table'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'vi'
                ? 'So sánh từng yêu cầu trong JD với bằng chứng tương ứng trong CV hiện tại của bạn.'
                : 'Compare each JD requirement against corresponding evidence in your current CV.'}
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
                placeholder={lang === 'vi' ? 'Tìm từ khóa...' : 'Search keyword...'}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 w-36 sm:w-48"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={allText}>{lang === 'vi' ? 'Tất cả trạng thái' : 'All Statuses'}</option>
              <option value={lang === 'vi' ? 'Khớp' : 'Matched'}>{lang === 'vi' ? 'Đã thể hiện rõ' : 'Clearly Evidenced'}</option>
              <option value={lang === 'vi' ? 'Cần bổ sung' : 'Needs Work'}>{lang === 'vi' ? 'Cần bổ sung' : 'Needs Work'}</option>
              <option value={lang === 'vi' ? 'Thiếu' : 'Missing'}>{lang === 'vi' ? 'Còn thiếu' : 'Missing'}</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4 w-1/4">{lang === 'vi' ? 'Cụm Từ Trong JD' : 'JD Term / Keyword'}</th>
                <th className="py-3 px-4 w-32">{lang === 'vi' ? 'Mức Độ Quan Trọng' : 'Importance Level'}</th>
                <th className="py-3 px-4 w-1/3">{lang === 'vi' ? 'CV Đã Thể Hiện Ở Đâu' : 'CV Evidence'}</th>
                <th className="py-3 px-4">{lang === 'vi' ? 'Khoảng Trống Cần Bổ Sung / Làm Rõ' : 'Gap / Recommendation'}</th>
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
                  <tr key={`row-${row.jdTerm || 'term'}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 align-top">
                      <div className="flex flex-col gap-1">
                        <span>{row.jdTerm}</span>
                        <div>{getStatusBadge(row.matchStatus)}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 align-top">
                      <span
                        className={`inline-block text-[11px] px-2 py-0.5 rounded border ${getImportanceBadge(
                          row.importance
                        )}`}
                      >
                        {row.importance}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 leading-relaxed align-top">
                      {row.cvEvidence && row.cvEvidence !== 'Thiếu thông tin' && row.cvEvidence !== 'Missing' ? (
                        <div className="bg-emerald-50/40 border border-emerald-100 p-2 rounded-lg text-emerald-950 font-medium">
                          {row.cvEvidence}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">
                          {lang === 'vi' ? 'Chưa có thông tin trong CV' : 'No information in CV'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 leading-relaxed align-top">
                      {row.gapOrClarification ? (
                        <div className="bg-amber-50/40 border border-amber-100 p-2 rounded-lg text-amber-950">
                          {row.gapOrClarification}
                        </div>
                      ) : (
                        <span className="text-emerald-600 text-xs">
                          {lang === 'vi'
                            ? 'Đã khớp tốt, không cần làm rõ thêm.'
                            : 'Matched well, no further clarification needed.'}
                        </span>
                      )}
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
