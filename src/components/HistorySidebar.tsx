import React, { useState } from 'react';
import { HistoryItem } from '../types';
import { Language, translations } from '../utils/i18n';
import {
  History,
  X,
  Trash2,
  Search,
  ChevronRight,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: HistoryItem[];
  currentActiveId?: string;
  onSelectHistoryItem: (item: HistoryItem) => void;
  onDeleteHistoryItem: (id: string, e: React.MouseEvent) => void;
  onClearHistory: () => void;
  lang: Language;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  historyItems,
  currentActiveId,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onClearHistory,
  lang,
}) => {
  const t = translations[lang].history;
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (!isOpen) return null;

  const filteredItems = historyItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.analysis?.feature1?.jdKeywords || []).some((k) =>
        k.keyword.toLowerCase().includes(q)
      )
    );
  });

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateStr} ${timeStr}`;
  };

  const getScoreBadgeClass = (score: number = 0) => {
    if (score >= 80) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    }
    if (score >= 60) {
      return 'bg-amber-50 text-amber-700 border-amber-200/80';
    }
    return 'bg-rose-50 text-rose-700 border-rose-200/80';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <span>{t.sidebarTitle}</span>
                  {historyItems.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {historyItems.length}
                    </span>
                  )}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar */}
          {historyItems.length > 0 && (
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* List items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {historyItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-800">{t.emptyState}</h4>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    {t.emptyDesc}
                  </p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {lang === 'vi' ? 'Không tìm thấy kết quả phù hợp.' : 'No matching reports found.'}
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isCurrent = item.id === currentActiveId;
                const score = item.score || item.analysis?.feature1?.scores?.overallRoleScore || 0;

                return (
                  <div
                    key={`${item.id || 'hist'}-${idx}`}
                    onClick={() => onSelectHistoryItem(item)}
                    className={`group relative rounded-xl p-4 border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-sm ring-1 ring-indigo-500/20'
                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {item.title || (lang === 'vi' ? 'Phân Tích CV' : 'CV Analysis')}
                          </h4>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              {t.currentBadge}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatDate(item.timestamp)}</span>
                        </div>
                      </div>

                      {/* Score Badge */}
                      <div
                        className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold flex items-center gap-1 shrink-0 ${getScoreBadgeClass(
                          score
                        )}`}
                      >
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>{score}%</span>
                      </div>
                    </div>

                    {/* Preview of keywords */}
                    {(() => {
                      const keywords = item.analysis?.feature1?.jdKeywords || [];
                      if (keywords.length === 0) return null;
                      return (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                          {keywords.slice(0, 3).map((kw, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                            >
                              {kw.keyword}
                            </span>
                          ))}
                          {keywords.length > 3 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{keywords.length - 3}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Delete action button */}
                    <button
                      type="button"
                      onClick={(e) => onDeleteHistoryItem(item.id, e)}
                      className="absolute top-3 right-3 p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      title={t.deleteItem}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {historyItems.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              {showConfirmClear ? (
                <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 space-y-2.5 animate-fade-in">
                  <p className="text-xs font-semibold text-rose-800">
                    {t.confirmClear}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmClear(false)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      {lang === 'vi' ? 'Hủy' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClearHistory();
                        setShowConfirmClear(false);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      {lang === 'vi' ? 'Xác nhận xóa' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowConfirmClear(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.clearAll}</span>
                  </button>

                  <span className="text-xs text-slate-400 font-medium">
                    {historyItems.length} {t.itemsCount}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
