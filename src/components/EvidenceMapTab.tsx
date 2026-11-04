import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Layers,
} from 'lucide-react';
import {
  CompetencyGroup,
  EvidenceItem,
  EvidenceMapSharedViewModel,
} from '../utils/evidenceMapAdapter';

export type CompetencyFilterType = 'all' | 'must_have' | 'gap';

interface EvidenceMapTabProps {
  viewModel: EvidenceMapSharedViewModel;
  lang: 'vi' | 'en';
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  competencyFilter: CompetencyFilterType;
  onFilterChange: (filter: CompetencyFilterType) => void;
  highlightedItemId?: string;
}

export const EvidenceMapTab: React.FC<EvidenceMapTabProps> = ({
  viewModel,
  lang,
  expandedGroups,
  onToggleGroup,
  competencyFilter,
  onFilterChange,
  highlightedItemId,
}) => {
  const isVi = lang === 'vi';
  const { groups, uncomparedKeywords, totalCriteriaCount, totalMustHaveCount, totalGapCount } =
    viewModel;

  // Lọc items theo bộ lọc nhanh
  const filterItems = (items: EvidenceItem[]) => {
    if (competencyFilter === 'must_have') {
      return items.filter((it) => it.isMustHave);
    }
    if (competencyFilter === 'gap') {
      return items.filter((it) => it.matchStatus === 'thieu');
    }
    return items;
  };

  return (
    <div
      data-testid="evidence-map-tab"
      className="space-y-6"
      role="region"
      aria-label={isVi ? 'Bản đồ bằng chứng năng lực' : 'Evidence Map Workspace'}
    >
      {/* =========================================================================
          TẦNG 1: HEADER & FAST FILTER CHIPS
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">
              {isVi ? 'Bản Đồ Bằng Chứng Năng Lực' : 'Competency Evidence Map'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isVi
              ? 'Phân tầng 5 nhóm năng lực cốt lõi theo tiêu chí JD và đối chiếu hồ sơ thực tế'
              : 'Categorized into core competency pillars against JD requirements'}
          </p>
        </div>

        {/* Quick Filter Chips (1-Click tìm khoảng trống) */}
        <div
          role="group"
          aria-label={isVi ? 'Bộ lọc nhanh tiêu chí' : 'Quick criteria filters'}
          className="flex items-center gap-2 text-xs flex-wrap"
        >
          <button
            onClick={() => onFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 ${
              competencyFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isVi ? 'Tất cả' : 'All'} ({totalCriteriaCount})
          </button>

          <button
            onClick={() => onFilterChange('must_have')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              competencyFilter === 'must_have'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            {isVi ? 'Bắt buộc' : 'Must-Have'} ({totalMustHaveCount})
          </button>

          <button
            onClick={() => onFilterChange('gap')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400 ${
              competencyFilter === 'gap'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            {isVi ? 'Chưa có bằng chứng' : 'Missing Gaps'} ({totalGapCount})
          </button>
        </div>
      </div>

      {/* =========================================================================
          TẦNG 2 & 3: 5 NHÓM NĂNG LỰC & BẢNG ĐỐI CHIẾU CHI TIẾT
          ========================================================================= */}
      <div className="space-y-4">
        {groups.map((group: CompetencyGroup) => {
          const isOpen = expandedGroups.has(group.id);
          const visibleItems = filterItems(group.items);

          // Tính tỷ lệ thanh phân đoạn của nhóm
          const totalInGroup = group.total;
          const passedPct = totalInGroup > 0 ? (group.matchedCount / totalInGroup) * 100 : 0;
          const partialPct = totalInGroup > 0 ? (group.partialCount / totalInGroup) * 100 : 0;
          const gapPct = totalInGroup > 0 ? (group.gapCount / totalInGroup) * 100 : 0;

          return (
            <div
              key={group.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all"
            >
              {/* Accordion Group Header (Tầng 2) */}
              <button
                onClick={() => onToggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`group-content-${group.id}`}
                className="w-full p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition-colors cursor-pointer focus:outline-none focus:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {group.title}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        ({group.total} {isVi ? 'tiêu chí' : 'criteria'})
                      </span>
                    </div>
                    {group.mustHaveGapCount > 0 && (
                      <span className="text-[11px] font-bold text-rose-600">
                        ⚠ {group.mustHaveGapCount} {isVi ? 'yêu cầu bắt buộc cần bổ sung' : 'mandatory gap(s)'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Segmented Bar & Text Counters */}
                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <div
                      className="w-32 sm:w-48 h-2 rounded-full bg-slate-200 overflow-hidden flex"
                      title={`${group.matchedCount} Đủ | ${group.partialCount} Một phần | ${group.gapCount} Chưa thấy`}
                    >
                      <div className="bg-emerald-500 h-full" style={{ width: `${passedPct}%` }} />
                      <div className="bg-amber-400 h-full" style={{ width: `${partialPct}%` }} />
                      <div className="bg-rose-500 h-full" style={{ width: `${gapPct}%` }} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                      <span className="text-emerald-700 font-bold">{group.matchedCount} Đủ</span>
                      <span>•</span>
                      <span className="text-amber-700 font-bold">{group.partialCount} Một phần</span>
                      <span>•</span>
                      <span className="text-rose-600 font-bold">{group.gapCount} Chưa thấy</span>
                    </div>
                  </div>

                  <div className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </button>

              {/* Accordion Content (Tầng 3: Drilldown View) */}
              {isOpen && (
                <div
                  id={`group-content-${group.id}`}
                  className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/40"
                >
                  {visibleItems.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 italic">
                      {isVi
                        ? 'Không có tiêu chí nào phù hợp với bộ lọc hiện tại trong nhóm này.'
                        : 'No criteria matching current filter in this pillar.'}
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View (>= 768px) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                              <th className="py-2.5 px-3 w-1/4">{isVi ? 'Yêu Cầu JD' : 'JD Requirement'}</th>
                              <th className="py-2.5 px-3 w-1/3">{isVi ? 'Bằng Chứng Trong CV' : 'CV Evidence'}</th>
                              <th className="py-2.5 px-3 w-1/4">{isVi ? 'Khoảng Trống Cần Làm Rõ' : 'Identified Gap'}</th>
                              <th className="py-2.5 px-3 w-1/6">{isVi ? 'Gợi Ý Mẫu' : 'Suggested Snippet'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {visibleItems.map((item) => {
                              const isHighlighted = highlightedItemId === item.id;

                              return (
                                <tr
                                  key={item.id}
                                  id={item.id}
                                  tabIndex={-1}
                                  className={`transition-all ${
                                    isHighlighted
                                      ? 'bg-amber-100/70 ring-2 ring-amber-400 rounded-lg'
                                      : 'hover:bg-white'
                                  }`}
                                >
                                  {/* Yêu cầu JD */}
                                  <td className="py-3 px-3 align-top">
                                    <div className="space-y-1">
                                      <div className="font-bold text-slate-900 text-xs">
                                        {item.term}
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {item.isMustHave && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                            {isVi ? 'Bắt buộc' : 'Must-Have'}
                                          </span>
                                        )}
                                        <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 bg-slate-100">
                                          {item.importance}
                                        </span>
                                        {item.matchStatus === 'khop' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {isVi ? 'Đủ' : 'Met'}
                                          </span>
                                        )}
                                        {item.matchStatus === 'can_bo_sung' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            {isVi ? 'Một phần' : 'Partial'}
                                          </span>
                                        )}
                                        {item.matchStatus === 'thieu' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                                            <XCircle className="w-3.5 h-3.5" />
                                            {isVi ? 'Chưa thấy' : 'Missing'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Bằng chứng CV */}
                                  <td className="py-3 px-3 align-top">
                                    {item.cvEvidence ? (
                                      <p className="text-slate-800 leading-relaxed">
                                        {item.cvEvidence}
                                      </p>
                                    ) : (
                                      <span className="text-slate-400 italic">
                                        {isVi ? 'Chưa tìm thấy bằng chứng trong CV' : 'No direct evidence found'}
                                      </span>
                                    )}
                                  </td>

                                  {/* Khoảng trống */}
                                  <td className="py-3 px-3 align-top">
                                    {item.gapOrClarification ? (
                                      <p className="text-slate-700 leading-relaxed">
                                        {item.gapOrClarification}
                                      </p>
                                    ) : (
                                      <span className="text-emerald-700 font-semibold">
                                        {isVi ? 'Đã thể hiện tốt' : 'Well represented'}
                                      </span>
                                    )}
                                  </td>

                                  {/* Gợi ý mẫu */}
                                  <td className="py-3 px-3 align-top">
                                    {item.suggestedPhrasing ? (
                                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-2 text-[11px] text-indigo-900 leading-relaxed">
                                        <div className="font-bold flex items-center gap-1 mb-0.5 text-indigo-700 text-[10px]">
                                          <Sparkles className="w-3 h-3" />
                                          {item.targetSection || (isVi ? 'Gợi ý' : 'Suggestion')}
                                        </div>
                                        {item.suggestedPhrasing}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic text-[11px]">
                                        {isVi ? 'Không có' : 'None'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card-based View (< 768px) */}
                      <div className="md:hidden space-y-3">
                        {visibleItems.map((item) => {
                          const isHighlighted = highlightedItemId === item.id;

                          return (
                            <div
                              key={item.id}
                              id={item.id}
                              tabIndex={-1}
                              className={`bg-white rounded-xl p-3.5 border text-xs space-y-2.5 transition-all ${
                                isHighlighted
                                  ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400'
                                  : 'border-slate-200'
                              }`}
                            >
                              {/* Header Card */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-900 text-sm">
                                    {item.term}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {item.isMustHave && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                        {isVi ? 'Bắt buộc' : 'Must-Have'}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 bg-slate-100">
                                      {item.importance}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  {item.matchStatus === 'khop' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      {isVi ? 'Đủ' : 'Met'}
                                    </span>
                                  )}
                                  {item.matchStatus === 'can_bo_sung' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      {isVi ? 'Một phần' : 'Partial'}
                                    </span>
                                  )}
                                  {item.matchStatus === 'thieu' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      <XCircle className="w-3.5 h-3.5" />
                                      {isVi ? 'Chưa thấy' : 'Missing'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Bằng chứng */}
                              <div className="space-y-1 pt-1 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  {isVi ? 'Bằng chứng trong CV:' : 'CV Evidence:'}
                                </span>
                                {item.cvEvidence ? (
                                  <p className="text-slate-800 leading-relaxed">
                                    {item.cvEvidence}
                                  </p>
                                ) : (
                                  <p className="text-slate-400 italic">
                                    {isVi ? 'Chưa tìm thấy bằng chứng trong CV' : 'No direct evidence'}
                                  </p>
                                )}
                              </div>

                              {/* Khoảng trống */}
                              {item.gapOrClarification && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                                    {isVi ? 'Khoảng trống cần làm rõ:' : 'Identified Gap:'}
                                  </span>
                                  <p className="text-slate-700 leading-relaxed">
                                    {item.gapOrClarification}
                                  </p>
                                </div>
                              )}

                              {/* Gợi ý mẫu */}
                              {item.suggestedPhrasing && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 space-y-1">
                                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    {isVi ? 'Gợi ý bổ sung:' : 'Suggested Snippet:'}
                                  </span>
                                  <p className="text-indigo-950 leading-relaxed text-[11px]">
                                    {item.suggestedPhrasing}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          TỪ KHÓA CHƯA ĐỐI CHIẾU (UNCOMPARED KEYWORDS - KHÔNG COI LÀ THIẾU)
          ========================================================================= */}
      {uncomparedKeywords.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/90 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Info className="w-4 h-4 text-slate-500" />
            <span>
              {isVi
                ? 'Từ khóa bổ sung trong JD (Chưa có dòng đối chiếu trực tiếp)'
                : 'Additional JD Keywords (Uncompared in primary table)'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {isVi
              ? 'Các từ khóa dưới đây xuất hiện trong JD nhưng chưa được ghép đối chiếu trực tiếp; hệ thống giữ nguyên để tham khảo và không tự ý coi là thiếu bằng chứng.'
              : 'These keywords appear in JD but were not evaluated in detail; kept for reference and not classified as missing.'}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {uncomparedKeywords.map((kw, i) => (
              <span
                key={`uncompared-${i}`}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-[11px]"
              >
                {kw.keyword}
                <span className="text-[9px] text-slate-400 ml-1">({kw.importance})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
