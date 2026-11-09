import React, { useState, useMemo, useEffect } from 'react';
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
  Sparkles,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  AlertTriangle,
  Lightbulb,
  Target,
  Trophy,
  Zap,
  BookOpen,
  Layers,
  Eye,
  EyeOff,
  Edit3,
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

  // Phase 3: Dual View Mode ('list' Quick Scan vs 'focus' Focus Practice Card)
  const [viewMode, setViewMode] = useState<'list' | 'focus'>('list');
  const [focusIndex, setFocusIndex] = useState<number>(0);

  // Progressive Reveal states in Focus Mode
  const [revealIntent, setRevealIntent] = useState<boolean>(true);
  const [revealStar, setRevealStar] = useState<boolean>(true);
  const [revealPitfall, setRevealPitfall] = useState<boolean>(true);

  // Candidate personal practice notes per question ID
  const [practiceNotes, setPracticeNotes] = useState<Record<string, string>>({});

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

  // Keep focusIndex within bounds when filteredQuestions changes
  useEffect(() => {
    if (focusIndex >= filteredQuestions.length) {
      setFocusIndex(0);
    }
  }, [filteredQuestions.length, focusIndex]);

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

  const activeFocusItem = filteredQuestions[focusIndex] || null;
  const activeFocusId = activeFocusItem
    ? activeFocusItem.id || `iq_${focusIndex + 1}`
    : '';
  const allHintsVisible = revealIntent && revealStar && revealPitfall;

  const handleToggleAllHints = () => {
    const next = !allHintsVisible;
    setRevealIntent(next);
    setRevealStar(next);
    setRevealPitfall(next);
  };

  return (
    <div className="space-y-6" data-testid="interview-prep-tab">
      {/* 1. Header Banner & Progress Strategy Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-500/20 shadow-xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.badge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 flex-wrap">
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
              <span data-testid="interview-rehearsed-counter" className="text-white font-bold">
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

      {/* 2. Filter, View Mode Switcher & Actions Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Phase 3 Dual Mode Switcher: Quick Scan List vs Focus Practice Mode */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              data-testid="interview-mode-list"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isEn ? 'Quick Scan List' : 'Chế độ Danh Sách (Đọc lướt)'}</span>
            </button>
            <button
              type="button"
              data-testid="interview-mode-focus"
              onClick={() => setViewMode('focus')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'focus'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>{isEn ? 'Focus Practice Mode' : 'Chế độ Luyện Tập Từng Câu'}</span>
            </button>
          </div>

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
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {viewMode === 'list' && (
              <>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  {t.expandAll}
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  {t.collapseAll}
                </button>
              </>
            )}
            <button
              type="button"
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
            type="button"
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
              type="button"
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
            type="button"
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
              type="button"
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

      {/* 3. Empty Filter State */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">{t.emptySearch}</p>
          <button
            type="button"
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
      ) : viewMode === 'focus' && activeFocusItem ? (
        /* ========================================================================= */
        /* PHASE 3: FOCUS PRACTICE MODE (SINGLE QUESTION INTERACTIVE FLASHCARD)     */
        /* ========================================================================= */
        <div
          data-testid="interview-focus-card"
          className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 sm:p-7 space-y-6 animate-fade-in"
        >
          {/* Top Navigation Bar: Question Stepper + Prev/Next */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              {filteredQuestions.map((q, idx) => {
                const qId = q.id || `iq_${idx + 1}`;
                const isDone = rehearsedIds.has(qId);
                const isCurrent = idx === focusIndex;
                return (
                  <button
                    key={qId}
                    type="button"
                    data-testid={`focus-step-btn-${idx + 1}`}
                    onClick={() => setFocusIndex(idx)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={`${isEn ? 'Question' : 'Câu'} #${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="focus-prev-btn"
                disabled={focusIndex === 0}
                onClick={() => setFocusIndex((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{isEn ? 'Previous' : 'Câu trước'}</span>
              </button>
              <span
                data-testid="focus-position-indicator"
                className="text-xs font-extrabold text-slate-800 px-2"
              >
                {focusIndex + 1} / {filteredQuestions.length}
              </span>
              <button
                type="button"
                data-testid="focus-next-btn"
                disabled={focusIndex >= filteredQuestions.length - 1}
                onClick={() =>
                  setFocusIndex((prev) => Math.min(filteredQuestions.length - 1, prev + 1))
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
              >
                <span>{isEn ? 'Next' : 'Câu tiếp theo'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Focus Question Hero Prompt */}
          {(() => {
            const catStyle = getCategoryBadgeColor(activeFocusItem.category);
            const diffStyle = getDifficultyBadgeColor(activeFocusItem.difficulty);
            const isRehearsed = rehearsedIds.has(activeFocusId);

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-black">
                      {isEn ? `Question #${focusIndex + 1}` : `Câu hỏi #${focusIndex + 1}`}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${catStyle.indicator}`} />
                      <span>{activeFocusItem.category}</span>
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border ${diffStyle.bg} ${diffStyle.text} ${diffStyle.border}`}
                    >
                      {activeFocusItem.difficulty}
                    </span>
                  </div>

                  {/* Progressive Hint Toggle Controls */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      data-testid="toggle-all-hints-btn"
                      onClick={handleToggleAllHints}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      {allHintsVisible ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                          <span>{isEn ? 'Hide Hints (Self-Test)' : 'Ẩn gợi ý (Tự nhẩm trả lời)'}</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{isEn ? 'Show All Hints' : 'Hiện toàn bộ gợi ý'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6">
                  <h3
                    data-testid="focus-question-title"
                    className="text-base sm:text-lg md:text-xl font-black text-slate-900 leading-relaxed"
                  >
                    "{activeFocusItem.question}"
                  </h3>
                </div>

                {/* Progressive Reveal Buttons Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    data-testid="reveal-intent-btn"
                    onClick={() => setRevealIntent((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      revealIntent
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {isEn ? '1. Recruiter Intent & CV Gap' : '1. Ý đồ HR & Điểm yếu nguồn'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="reveal-star-btn"
                    onClick={() => setRevealStar((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      revealStar
                        ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {isEn ? '2. STAR Answer Blueprint' : '2. Khung trả lời mẫu STAR'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="reveal-pitfall-btn"
                    onClick={() => setRevealPitfall((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      revealPitfall
                        ? 'bg-rose-50 text-rose-900 border-rose-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{isEn ? '3. Pitfall to Avoid' : '3. Bẫy mất điểm cần tránh'}</span>
                  </button>
                </div>

                {/* Layer 1: Recruiter Intent & Source Gap */}
                {revealIntent && (
                  <div
                    data-testid="focus-intent-section"
                    className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in"
                  >
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Target className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{t.sourceGapLabel}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                        {activeFocusItem.sourceGapOrDoubt}
                      </p>
                    </div>

                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{t.interviewerIntentLabel}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                        {activeFocusItem.interviewerIntent}
                      </p>
                    </div>
                  </div>
                )}

                {/* Layer 2: STAR Blueprint */}
                {revealStar && (
                  <div data-testid="focus-star-section" className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t.starBlueprintTitle}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        STAR (Situation/Task • Action • Result)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-sky-50/60 border border-sky-200/80 rounded-xl p-4 space-y-2">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-black uppercase">
                          {t.starSituationTask}
                        </span>
                        <p className="text-xs sm:text-sm text-sky-950 leading-relaxed font-medium">
                          {activeFocusItem.starAnswerGuide.situationTask}
                        </p>
                      </div>

                      <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-4 space-y-2">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                          {t.starAction}
                        </span>
                        <p className="text-xs sm:text-sm text-indigo-950 leading-relaxed font-medium">
                          {activeFocusItem.starAnswerGuide.action}
                        </p>
                      </div>

                      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-2">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                          {t.starResult}
                        </span>
                        <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
                          {activeFocusItem.starAnswerGuide.result}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Layer 3: Pitfall to Avoid */}
                {revealPitfall && (
                  <div
                    data-testid="focus-pitfall-section"
                    className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs sm:text-sm">
                      <span className="font-bold text-rose-900 block">{t.pitfallLabel}</span>
                      <p className="text-rose-800/90 leading-relaxed font-medium">
                        {activeFocusItem.pitfallToAvoid}
                      </p>
                    </div>
                  </div>
                )}

                {/* Candidate Personal Practice Notes Box */}
                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        {isEn
                          ? 'Your Personal Talking Points (Draft your own STAR keywords):'
                          : 'Ghi chú dàn ý trả lời của riêng bạn (Tự nháp ý chính theo STAR):'}
                      </span>
                    </label>
                  </div>
                  <textarea
                    data-testid="focus-practice-notes"
                    value={practiceNotes[activeFocusId] || ''}
                    onChange={(e) =>
                      setPracticeNotes((prev) => ({
                        ...prev,
                        [activeFocusId]: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder={
                      isEn
                        ? 'Jot down your project example, key actions, and real metrics for this question...'
                        : 'Ghi nhanh tên dự án thực tế, giải pháp bạn đã làm và con số kết quả để nhớ khi phỏng vấn...'
                    }
                    className="w-full text-xs sm:text-sm p-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <button
                    type="button"
                    data-testid="focus-rehearsed-btn"
                    onClick={() => toggleRehearsed(activeFocusId)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      isRehearsed
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    }`}
                  >
                    {isRehearsed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>{t.markedAsRehearsed}</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4 text-slate-300" />
                        <span>{t.markAsRehearsed}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCopyQuestion(activeFocusItem, focusIndex, e)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    {copiedId === activeFocusId ? (
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
            );
          })()}
        </div>
      ) : (
        /* ========================================================================= */
        /* QUICK SCAN LIST VIEW (ACCORDION LIST)                                     */
        /* ========================================================================= */
        <div className="space-y-4" data-testid="interview-list-view">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusIndex(idx);
                        setViewMode('focus');
                      }}
                      title={isEn ? 'Practice this question in Focus Mode' : 'Luyện tập câu này ở Chế độ Tập trung'}
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Target className="w-3 h-3" />
                      <span>{isEn ? 'Practice' : 'Luyện câu này'}</span>
                    </button>

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
