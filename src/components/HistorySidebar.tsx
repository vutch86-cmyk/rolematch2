import React, { useState } from 'react';
import { HistoryItem } from '../types';
import { Language, translations } from '../utils/i18n';
import {
  extractJobMetaFromJdText,
  formatCandidateHistoryTitle,
  enrichAndMigrateHistoryItem,
} from '../utils/jdTitleExtractor';
import {
  History,
  X,
  Trash2,
  Search,
  ChevronRight,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
  Building2,
  Briefcase,
  Edit3,
  Check,
  Plus,
  Cloud,
  RefreshCw,
  Filter
} from 'lucide-react';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  historyItems: HistoryItem[];
  currentActiveId?: string;
  onSelectHistoryItem: (item: HistoryItem) => void;
  onDeleteHistoryItem: (id: string, e: React.MouseEvent) => void;
  onRenameHistoryItem?: (id: string, updates: { companyName?: string; jobTitle?: string }) => void;
  onClearHistory: () => void;
  onSyncHistory?: () => Promise<void>;
  isSyncing?: boolean;
  lang: Language;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  historyItems,
  currentActiveId,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onRenameHistoryItem,
  onClearHistory,
  onSyncHistory,
  isSyncing,
  lang,
}) => {
  const t = translations[lang].history;
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedScoreTier, setSelectedScoreTier] = useState<'all' | 'high' | 'mid' | 'low'>('all');

  if (!isOpen) return null;

  const getItemResolvedMeta = (item: HistoryItem) => {
    const migrated = enrichAndMigrateHistoryItem(item, lang);
    const extracted = extractJobMetaFromJdText(migrated.jdText || '', migrated.jdFileName || null);
    const companyName = (migrated.companyName || extracted.companyName || '').trim();
    const jobTitle = (migrated.jobTitle || extracted.jobTitle || '').trim();
    const displayTitle = migrated.isCustomTitle && migrated.title?.trim()
      ? migrated.title.trim()
      : formatCandidateHistoryTitle(
          {
            companyName,
            jobTitle,
            fallbackTitle: migrated.title,
          },
          lang
        );
    return { companyName, jobTitle, displayTitle };
  };

  const uniqueCompanies = Array.from(
    new Set(
      historyItems
        .map((it) => getItemResolvedMeta(it).companyName)
        .filter(Boolean)
    )
  );

  const handleStartEdit = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const meta = getItemResolvedMeta(item);
    setEditingId(item.id);
    setEditCompanyName(meta.companyName);
    setEditJobTitle(meta.jobTitle || meta.displayTitle);
  };

  const handleSaveEdit = (id: string, e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.stopPropagation();
    onRenameHistoryItem?.(id, {
      companyName: editCompanyName.trim(),
      jobTitle: editJobTitle.trim(),
    });
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const filteredItems = historyItems.filter((item) => {
    const meta = getItemResolvedMeta(item);

    // 1. Company Filter
    if (selectedCompany !== 'ALL') {
      if (meta.companyName !== selectedCompany) return false;
    }

    // 2. Score Filter
    const score = typeof item.score === 'number' && Number.isFinite(item.score)
      ? item.score
      : typeof item.analysis?.feature1?.scores?.overallRoleScore === 'number' && Number.isFinite(item.analysis?.feature1?.scores?.overallRoleScore)
      ? item.analysis.feature1.scores.overallRoleScore
      : null;

    if (selectedScoreTier === 'high' && (score === null || score < 80)) return false;
    if (selectedScoreTier === 'mid' && (score === null || score < 60 || score >= 80)) return false;
    if (selectedScoreTier === 'low' && (score === null || score >= 60)) return false;

    // 3. Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      meta.displayTitle.toLowerCase().includes(q) ||
      meta.companyName.toLowerCase().includes(q) ||
      meta.jobTitle.toLowerCase().includes(q) ||
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

  const getScoreBadgeClass = (score?: number | null) => {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
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

            <div className="flex items-center gap-2">
              {onSyncHistory && (
                <button
                  type="button"
                  onClick={() => onSyncHistory()}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 transition-all cursor-pointer disabled:opacity-50"
                  title={t.syncNow}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
                  <span className="hidden sm:inline">{isSyncing ? (lang === 'vi' ? 'Đang đồng bộ...' : 'Syncing...') : t.syncNow}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search bar & Filters */}
          {historyItems.length > 0 && (
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-2.5">
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

              {/* Score Tier Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedScoreTier('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedScoreTier === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t.filterAll}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScoreTier('high')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedScoreTier === 'high'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {t.filterHighScore}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScoreTier('mid')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedScoreTier === 'mid'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  {t.filterMidScore}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedScoreTier('low')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedScoreTier === 'low'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  {t.filterLowScore}
                </button>
              </div>

              {/* Company Filter Dropdown */}
              {uniqueCompanies.length > 1 && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-500" />
                    <span>{t.filterCompany}:</span>
                  </span>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
                  >
                    <option value="ALL">{t.allCompanies} ({uniqueCompanies.length})</option>
                    {uniqueCompanies.map((comp) => (
                      <option key={comp} value={comp}>
                        {comp}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                const isEditing = editingId === item.id;
                const meta = getItemResolvedMeta(item);
                const score = typeof item.score === 'number' && Number.isFinite(item.score)
                  ? item.score
                  : typeof item.analysis?.feature1?.scores?.overallRoleScore === 'number' && Number.isFinite(item.analysis?.feature1?.scores?.overallRoleScore)
                  ? item.analysis.feature1.scores.overallRoleScore
                  : null;

                return (
                  <div
                    key={`${item.id || 'hist'}-${idx}`}
                    onClick={() => {
                      if (!isEditing) onSelectHistoryItem(item);
                    }}
                    className={`group relative rounded-xl p-4 border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-sm ring-1 ring-indigo-500/20'
                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h4
                            className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
                            title={meta.displayTitle}
                          >
                            {meta.displayTitle || (lang === 'vi' ? 'Vị trí ứng tuyển' : 'Applied Position')}
                          </h4>
                          {onRenameHistoryItem && !isEditing && (
                            <button
                              type="button"
                              onClick={(e) => handleStartEdit(item, e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer shrink-0"
                              title={lang === 'vi' ? 'Sửa tên công ty & vị trí ứng tuyển' : 'Edit company & job title'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              {t.currentBadge}
                            </span>
                          )}
                        </div>

                        {/* Company Name & Role Position Badges */}
                        <div className="flex items-center flex-wrap gap-1.5 mt-1.5 mb-2">
                          {meta.companyName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[11px] font-semibold max-w-[180px] truncate">
                              <Building2 className="w-3 h-3 shrink-0 text-indigo-600" />
                              <span className="truncate">{meta.companyName}</span>
                            </span>
                          ) : (
                            onRenameHistoryItem && !isEditing && (
                              <button
                                type="button"
                                onClick={(e) => handleStartEdit(item, e)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-300 text-[10px] font-semibold transition-colors cursor-pointer"
                                title={lang === 'vi' ? 'Bổ sung tên công ty và vị trí ứng tuyển' : 'Add company name and role title'}
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>{lang === 'vi' ? 'Thêm tên công ty' : 'Add company'}</span>
                              </button>
                            )
                          )}

                          {meta.jobTitle && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50/80 text-emerald-800 border border-emerald-200/70 text-[11px] font-medium max-w-[210px] truncate">
                              <Briefcase className="w-3 h-3 shrink-0 text-emerald-600" />
                              <span className="truncate">{meta.jobTitle}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score Badge */}
                      <div
                        className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold flex items-center gap-1 shrink-0 ${getScoreBadgeClass(
                          score
                        )}`}
                      >
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>{typeof score === 'number' && Number.isFinite(score) ? `${score}%` : '—'}</span>
                      </div>
                    </div>

                    {/* Timestamp & Cloud status & Always-Visible Edit/Delete Action Bar */}
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mt-1">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatDate(item.timestamp)}</span>
                        </span>

                        {item.isSynced && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/70"
                            title={t.cloudSyncStatus}
                          >
                            <Cloud className="w-2.5 h-2.5 text-sky-500" />
                            <span>Cloud</span>
                          </span>
                        )}

                        {item.previousAnalysis && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/70"
                            title={t.reEvaluatedBadge}
                          >
                            <span>{t.reEvaluatedBadge}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onRenameHistoryItem && !isEditing && (
                          <button
                            type="button"
                            onClick={(e) => handleStartEdit(item, e)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/70 rounded-lg transition-colors cursor-pointer"
                            title={lang === 'vi' ? 'Sửa tên công ty & vị trí ứng tuyển' : 'Edit company & job title'}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{lang === 'vi' ? 'Sửa tên' : 'Rename'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => onDeleteHistoryItem(item.id, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={t.deleteItem}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Rename Form (Company Name + Job Title) */}
                    {isEditing && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveEdit(item.id, e);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setEditingId(null);
                          }
                        }}
                        className="mt-3 p-3 rounded-xl bg-slate-50 border border-indigo-200 space-y-2.5 shadow-inner"
                      >
                        <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                          <Edit3 className="w-3 h-3 text-indigo-600" />
                          <span>
                            {lang === 'vi'
                              ? 'Cập nhật Tên công ty & Vị trí ứng tuyển'
                              : 'Update Company Name & Job Position'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              {lang === 'vi' ? 'Tên công ty (Company Name)' : 'Company Name'}
                            </label>
                            <input
                              type="text"
                              value={editCompanyName}
                              onChange={(e) => setEditCompanyName(e.target.value)}
                              placeholder={lang === 'vi' ? 'VD: FPT Software, Vietcombank, VNG...' : 'e.g. FPT Software, TechCorp...'}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                              autoFocus
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              {lang === 'vi' ? 'Vị trí ứng tuyển (Job Title)' : 'Job Title'}
                            </label>
                            <input
                              type="text"
                              value={editJobTitle}
                              onChange={(e) => setEditJobTitle(e.target.value)}
                              placeholder={lang === 'vi' ? 'VD: IT Operations & Governance Manager' : 'e.g. Senior Backend Engineer'}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            {lang === 'vi' ? 'Hủy' : 'Cancel'}
                          </button>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>{lang === 'vi' ? 'Lưu tên' : 'Save'}</span>
                          </button>
                        </div>
                      </form>
                    )}

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
