import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Terminal,
  X,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Search,
  Filter,
  AlertOctagon,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Download,
  WifiOff,
  Server,
  Smartphone,
  Upload,
  Sparkles
} from 'lucide-react';
import { LogItem } from '../types';
import { fetchAllLogs, clearAllLogs } from '../utils/logger';
import { Language } from '../utils/i18n';

interface ErrorLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const ErrorLogsModal: React.FC<ErrorLogsModalProps> = ({ isOpen, onClose, lang }) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const items = await fetchAllLogs();
      setLogs(items || []);
    } catch (err) {
      console.warn('Failed to load logs in modal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      // Auto-poll every 5 seconds while open
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleClear = async () => {
    if (
      window.confirm(
        lang === 'vi'
          ? 'Bạn có chắc chắn muốn xóa tất cả nhật ký lỗi?'
          : 'Are you sure you want to clear all log entries?'
      )
    ) {
      await clearAllLogs();
      setLogs([]);
    }
  };

  const handleCopySingle = (log: LogItem) => {
    const text = `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}\nEndpoint: ${
      log.endpoint || 'N/A'
    }\nDetails: ${log.details || 'None'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (logs.length === 0) return;
    const fullLogText = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}\nEndpoint: ${
            l.endpoint || 'N/A'
          }\nDetails:\n${l.details || 'None'}\n---`
      )
      .join('\n\n');
    navigator.clipboard.writeText(fullLogText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.endpoint && log.endpoint.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSource = selectedSource === 'all' || log.source === selectedSource;
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;

    return matchesSearch && matchesSource && matchesLevel;
  });

  const getSourceIcon = (source: LogItem['source']) => {
    switch (source) {
      case 'client':
        return <Smartphone className="w-3.5 h-3.5 text-sky-400" />;
      case 'server':
        return <Server className="w-3.5 h-3.5 text-indigo-400" />;
      case 'upload':
        return <Upload className="w-3.5 h-3.5 text-amber-400" />;
      case 'gemini':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'network':
        return <WifiOff className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getLevelBadge = (level: LogItem['level']) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            ERROR
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            WARN
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Info className="w-3 h-3 text-blue-400" />
            INFO
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-100"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-100">
                    {lang === 'vi' ? 'Nhật ký Lỗi Hệ thống' : 'System Error Logs'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-slate-800 text-indigo-300 border border-slate-700">
                    {logs.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden xs:block">
                  {lang === 'vi'
                    ? 'Kiểm tra chi tiết lỗi từ Giao diện, Máy chủ API, Upload Tệp & Dịch vụ AI'
                    : 'Inspect errors from Frontend, Server APIs, File Uploads & AI Services'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadLogs}
                disabled={isLoading}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                title={lang === 'vi' ? 'Làm mới' : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter & Toolbar */}
          <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    lang === 'vi' ? 'Tìm kiếm nhật ký lỗi...' : 'Search log entries...'
                  }
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Source Dropdown */}
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{lang === 'vi' ? 'Nguồn: Tất cả' : 'Source: All'}</option>
                <option value="client">Client (Frontend)</option>
                <option value="server">Server API</option>
                <option value="upload">Upload Tệp</option>
                <option value="gemini">Gemini AI</option>
              </select>

              {/* Level Dropdown */}
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{lang === 'vi' ? 'Mức: Tất cả' : 'Level: All'}</option>
                <option value="error">ERROR</option>
                <option value="warn">WARN</option>
                <option value="info">INFO</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyAll}
                disabled={logs.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedAll ? (lang === 'vi' ? 'Đã sao chép!' : 'Copied!') : (lang === 'vi' ? 'Sao chép hết' : 'Copy All')}</span>
              </button>

              <button
                onClick={handleClear}
                disabled={logs.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-50 text-xs font-semibold border border-rose-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{lang === 'vi' ? 'Xóa nhật ký' : 'Clear Logs'}</span>
              </button>
            </div>
          </div>

          {/* Logs List Container */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2.5 min-h-[300px]">
            {filteredLogs.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-200 mb-1">
                  {lang === 'vi' ? 'Chưa ghi nhận lỗi nào' : 'No errors logged'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md">
                  {lang === 'vi'
                    ? 'Hệ thống đang hoạt động bình thường mà không gặp sự cố kỹ thuật nào.'
                    : 'System is running smoothly without any recorded errors.'}
                </p>
              </div>
            ) : (
              filteredLogs.map((log, idx) => {
                const isExpanded = expandedLogId === log.id;
                const formattedTime = new Date(log.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }) + ' ' + new Date(log.timestamp).toLocaleDateString();

                return (
                  <div
                    key={`${log.id || 'err'}-${idx}`}
                    className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 transition-all text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getLevelBadge(log.level)}

                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] bg-slate-900 text-slate-300 border border-slate-800">
                          {getSourceIcon(log.source)}
                          <span className="capitalize">{log.source}</span>
                        </span>

                        {log.endpoint && (
                          <span className="font-mono text-[11px] text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/40">
                            {log.endpoint}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 font-mono ml-auto">
                          {formattedTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopySingle(log)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title={lang === 'vi' ? 'Sao chép lỗi này' : 'Copy this log'}
                        >
                          {copiedId === log.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {log.details && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 text-[11px]"
                          >
                            <span>{isExpanded ? (lang === 'vi' ? 'Ẩn' : 'Hide') : (lang === 'vi' ? 'Chi tiết' : 'Details')}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="font-medium text-slate-200 mt-2 break-words text-xs leading-relaxed">
                      {log.message}
                    </p>

                    {/* Expanded Stack Trace / Details */}
                    {log.details && isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 p-3 bg-slate-900/90 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed"
                      >
                        <div className="text-[10px] text-slate-500 uppercase font-sans font-bold mb-1">
                          {lang === 'vi' ? 'Chi tiết kỹ thuật / Stack Trace:' : 'Technical Details / Stack Trace:'}
                        </div>
                        {log.details}
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{lang === 'vi' ? 'Hệ thống tự động theo dõi lỗi realtime' : 'Real-time automatic error logger active'}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
            >
              {lang === 'vi' ? 'Đóng' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
