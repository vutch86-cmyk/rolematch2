import React, { useState, useMemo } from 'react';
import {
  InterviewPrepData,
  InterviewQuestionItem,
  ComparisonRow,
  RiskMitigationItem,
} from '../types';
import { Language, translations } from '../utils/i18n';
import {
  normalizeFeature4Data,
  getCategoryBadgeColor,
  getDifficultyBadgeColor,
  formatQuestionToMarkdown,
} from '../utils/interviewPrepHelpers';
import {
  HelpCircle,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  AlertTriangle,
  Lightbulb,
  Compass,
  Target,
  Trophy,
  Zap,
  BookOpen,
  Layers,
} from 'lucide-react';

interface InterviewPrepTabProps {
  data?: InterviewPrepData;
  lang: Language;
  cvText?: string;
  jdText?: string;
  comparisonGaps?: ComparisonRow[];
  risks?: RiskMitigationItem[];
}

export const InterviewPrepTab: React.FC<InterviewPrepTabProps> = ({
  data,
  lang,
  cvText = '',
  jdText = '',
  comparisonGaps,
  risks,
}) => {
  const t = translations[lang].interviewPrepTab;
  const isEn = lang === 'en';

  const normalized = useMemo(() => {
    return normalizeFeature4Data(data, cvText, jdText, lang, comparisonGaps, risks);
  }, [data, cvText, jdText, lang, comparisonGaps, risks]);

  // Expanded questions state (by default top 2 are expanded)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    normalized.questions.slice(0, 2).forEach((q, idx) => {
      initial.add(q.id || `iq_${idx + 1}`);
    });
    return initial;
  });

  // Rehearsed questions state
  const [rehearsedIds, setRehearsedIds] = useState<Set<string>>(new Set());

  // Filter and search state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    normalized.questions.forEach((q) => set.add(q.category));
    return Array.from(set);
  }, [normalized.questions]);

  // Available difficulties
  const difficulties = useMemo(() => {
    const set = new Set<string>();
    normalized.questions.forEach((q) => set.add(q.difficulty));
    return Array.from(set);
  }, [normalized.questions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return normalized.questions.filter((q) => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory) {
        return false;
      }
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuestion = q.question.toLowerCase().includes(query);
        const matchesIntent = q.interviewerIntent.toLowerCase().includes(query);
        const matchesGap = q.sourceGapOrDoubt.toLowerCase().includes(query);
        const matchesStar =
          q.starAnswerGuide.situationTask.toLowerCase().includes(query) ||
          q.starAnswerGuide.action.toLowerCase().includes(query) ||
          q.starAnswerGuide.result.toLowerCase().includes(query);
        const matchesPitfall = q.pitfallToAvoid.toLowerCase().includes(query);
        return matchesQuestion || matchesIntent || matchesGap || matchesStar || matchesPitfall;
      }
      return true;
    });
  }, [normalized.questions, selectedCategory, selectedDifficulty, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set<string>(normalized.questions.map((q, idx) => q.id || `iq_${idx + 1}`));
    setExpandedIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const toggleRehearsed = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRehearsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyQuestion = (item: InterviewQuestionItem, index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const md = formatQuestionToMarkdown(item, index, isEn);
    navigator.clipboard.writeText(md);
    const qId = item.id || `iq_${index + 1}`;
    setCopiedId(qId);
    setTimeout(() => {
      setCopiedId((curr) => (curr === qId ? null : curr));
    }, 2000);
  };

  const handleCopyAll = () => {
    const fullMd = [
      `# ${t.badge} — ${t.title}`,
      `> ${normalized.interviewPrepSummary}`,
      '',
      ...normalized.questions.map((q, idx) => formatQuestionToMarkdown(q, idx, isEn)),
    ].join('\n\n');

    navigator.clipboard.writeText(fullMd);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const rehearsedCount = rehearsedIds.size;
  const totalCount = normalized.questions.length;
  const progressPercent = totalCount > 0 ? Math.round((rehearsedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Progress Strategy Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-500/20 shadow-xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.badge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>{t.title}</span>
              <span className="text-xs sm:text-sm font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
                {totalCount} {isEn ? 'Questions' : 'Câu hỏi'}
              </span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {normalized.interviewPrepSummary}
            </p>
          </div>

          {/* Rehearsal Progress Box */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4 w-full lg:w-72 shrink-0 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{t.rehearsedProgress}</span>
              </span>
              <span className="text-white font-bold">
                {rehearsedCount}/{totalCount} ({progressPercent}%)
              </span>
            </div>

            <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <p className="text-[11px] text-slate-300">
              {progressPercent === 100
                ? isEn
                  ? '🎉 Outstanding! All interview questions rehearsed.'
                  : '🎉 Tuyệt vời! Bạn đã diễn tập toàn bộ các câu hỏi.'
                : isEn
                ? 'Check off questions as you practice your STAR talking points.'
                : 'Đánh dấu các câu hỏi bạn đã diễn tập nhuần nhuyễn để tự tin khi bước vào phòng phỏng vấn.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Filter & Actions Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExpandAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {t.expandAll}
            </button>
            <button
              onClick={handleCollapseAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {t.collapseAll}
            </button>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.copiedAll}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t.copyAll}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Category & Difficulty Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>{isEn ? 'Categories:' : 'Nhóm:'}</span>
          </span>

          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.filterAllCategories}
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}

          <span className="text-xs font-semibold text-slate-400 pl-2">|</span>

          {/* Difficulty filter */}
          <button
            onClick={() => setSelectedDifficulty('all')}
            className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              selectedDifficulty === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.filterAllDifficulties}
          </button>

          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(diff)}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                selectedDifficulty === diff
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">{t.emptySearch}</p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedDifficulty('all');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
          >
            {t.resetFilters}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((item, idx) => {
            const qId = item.id || `iq_${idx + 1}`;
            const isExpanded = expandedIds.has(qId);
            const isRehearsed = rehearsedIds.has(qId);
            const catStyle = getCategoryBadgeColor(item.category);
            const diffStyle = getDifficultyBadgeColor(item.difficulty);

            return (
              <div
                key={qId}
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? 'border-indigo-300 shadow-md ring-1 ring-indigo-200'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                } ${isRehearsed ? 'bg-slate-50/50' : 'bg-white'}`}
              >
                {/* Question Header Accordion Bar */}
                <div
                  onClick={() => toggleExpand(qId)}
                  className="p-4 sm:p-5 cursor-pointer flex items-start sm:items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    {/* Rehearsed Toggle Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleRehearsed(qId, e)}
                      title={isRehearsed ? t.markedAsRehearsed : t.markAsRehearsed}
                      className="mt-0.5 sm:mt-0 shrink-0 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                    >
                      {isRehearsed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                      ) : (
                        <Circle className="w-5 h-5 hover:text-slate-600" />
                      )}
                    </button>

                    {/* Question Number Badge */}
                    <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-black">
                      #{idx + 1}
                    </span>

                    {/* Question text & badges */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Category badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${catStyle.indicator}`}></span>
                          <span>{item.category}</span>
                        </span>

                        {/* Difficulty badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${diffStyle.bg} ${diffStyle.text} ${diffStyle.border}`}
                        >
                          {item.difficulty}
                        </span>

                        {isRehearsed && (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>{t.markedAsRehearsed}</span>
                          </span>
                        )}
                      </div>

                      <h3
                        className={`text-sm sm:text-base font-bold text-slate-900 leading-snug ${
                          isRehearsed ? 'text-slate-700' : 'text-slate-900'
                        }`}
                      >
                        {item.question}
                      </h3>
                    </div>
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopyQuestion(item, idx, e)}
                      title={t.copyThisAnswer}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedId === qId ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <div className="p-1 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Question Details */}
                {isExpanded && (
                  <div className="px-4 pb-5 sm:px-5 sm:pb-6 pt-0 border-t border-slate-100 space-y-4 animate-fade-in">
                    {/* Row 1: Source Gap & Hidden Intent */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                      {/* Source Gap */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <Target className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>{t.sourceGapLabel}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {item.sourceGapOrDoubt}
                        </p>
                      </div>

                      {/* Recruiter Intent */}
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{t.interviewerIntentLabel}</span>
                        </div>
                        <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                          {item.interviewerIntent}
                        </p>
                      </div>
                    </div>

                    {/* Row 2: STAR Blueprint */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{t.starBlueprintTitle}</span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Mô hình STAR (Situation, Action, Result)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* S/T: Situation & Task */}
                        <div className="bg-sky-50/60 border border-sky-200/80 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-black uppercase">
                              {t.starSituationTask}
                            </span>
                            <p className="text-xs text-sky-950 leading-relaxed font-medium">
                              {item.starAnswerGuide.situationTask}
                            </p>
                          </div>
                        </div>

                        {/* A: Action */}
                        <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                              {t.starAction}
                            </span>
                            <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                              {item.starAnswerGuide.action}
                            </p>
                          </div>
                        </div>

                        {/* R: Result */}
                        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                              {t.starResult}
                            </span>
                            <p className="text-xs text-emerald-950 leading-relaxed font-medium">
                              {item.starAnswerGuide.result}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Pitfall to Avoid Warning */}
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-rose-900 block">{t.pitfallLabel}</span>
                        <p className="text-rose-800/90 leading-relaxed font-medium">
                          {item.pitfallToAvoid}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleRehearsed(qId, e)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isRehearsed
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isRehearsed ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t.markedAsRehearsed}</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-3.5 h-3.5 text-slate-400" />
                            <span>{t.markAsRehearsed}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyQuestion(item, idx, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                      >
                        {copiedId === qId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{t.copiedThisAnswer}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{t.copyThisAnswer}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
