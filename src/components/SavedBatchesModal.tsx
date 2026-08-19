import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Filter, Calendar, Users, AlertCircle, Loader2, Layers, RefreshCw, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecruiterBatchSummary, RecruiterBatchDetail } from '../types';

interface SavedBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEn: boolean;
  token: string | null;
  onRestoreBatch: (batchDetails: RecruiterBatchDetail) => void;
}

export const SavedBatchesModal: React.FC<SavedBatchesModalProps> = ({
  isOpen,
  onClose,
  isEn,
  token,
  onRestoreBatch,
}) => {
  const [batches, setBatches] = useState<RecruiterBatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBatchId, setLoadingBatchId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const isMountedRef = useRef(true);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch all batches
  const fetchBatches = async (abortSignal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const authToken = token || localStorage.getItem('auth_token');
      const response = await fetch('/api/recruiter/batches', {
        signal: abortSignal,
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(isEn ? 'Session expired or unauthorized. Please sign in again.' : 'Hết phiên đăng nhập hoặc không có quyền. Vui lòng đăng nhập lại.');
        }
        throw new Error(isEn ? 'Failed to fetch saved batches.' : 'Không thể tải danh sách đợt tuyển dụng.');
      }

      const data = await response.json();
      if (isMountedRef.current) {
        if (data && data.success === true && Array.isArray(data.batches)) {
          setBatches(data.batches);
        } else {
          setBatches([]);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isMountedRef.current) {
        setErrorMsg(err.message || (isEn ? 'An error occurred while loading batches.' : 'Đã xảy ra lỗi khi tải danh sách đợt tuyển dụng.'));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Load batches on open
  useEffect(() => {
    const controller = new AbortController();
    if (isOpen) {
      fetchBatches(controller.signal);
      setSearchTerm('');
      setStatusFilter('All');
      setErrorMsg('');
    }
    return () => {
      controller.abort();
    };
  }, [isOpen]);

  // Handle Escape key for Dialog Accessibility
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loadingBatchId && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [loadingBatchId, isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loadingBatchId) {
      onClose();
    }
  };

  // Select and load specific batch detail
  const handleSelectBatch = async (batchId: string, status: string) => {
    if (status !== 'READY') return; // Requirement 3: Only READY can be opened
    if (loadingBatchId) return;

    setLoadingBatchId(batchId);
    setErrorMsg('');
    try {
      const authToken = token || localStorage.getItem('auth_token');
      const response = await fetch(`/api/recruiter/batches/${batchId}`, {
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(isEn ? 'Session expired or unauthorized. Please sign in again.' : 'Hết phiên đăng nhập hoặc không có quyền. Vui lòng đăng nhập lại.');
        }
        if (response.status === 403) {
          throw new Error(isEn ? 'You do not have permission to access this batch.' : 'Bạn không có quyền truy cập đợt tuyển dụng này.');
        }
        if (response.status === 404) {
          throw new Error(isEn ? 'Saved batch not found.' : 'Không tìm thấy đợt tuyển dụng.');
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || (isEn ? `Failed to load batch (status: ${response.status}).` : `Không thể tải chi tiết đợt tuyển dụng (mã lỗi: ${response.status}).`));
      }

      const data = await response.json();
      if (isMountedRef.current) {
        if (data && data.success === true && data.batch && Array.isArray(data.batch.candidates)) {
          onRestoreBatch(data.batch);
          onClose();
        } else {
          throw new Error(isEn ? 'Invalid batch details format received.' : 'Định dạng dữ liệu đợt tuyển dụng không hợp lệ.');
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setErrorMsg(err.message || (isEn ? 'An error occurred while retrieving batch details.' : 'Đã xảy ra lỗi khi tải chi tiết đợt tuyển dụng.'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingBatchId(null);
      }
    }
  };

  // Requirement 15: Search according to batchName, roleTitle, and jdFileName
  const filteredBatches = batches.filter(b => {
    const searchLower = searchTerm.toLowerCase().trim();
    const nameMatch = !searchLower ||
                     b.batchName.toLowerCase().includes(searchLower) ||
                     b.roleTitle.toLowerCase().includes(searchLower) ||
                     (b.jdFileName && b.jdFileName.toLowerCase().includes(searchLower));
    const statusMatch = statusFilter === 'All' || b.status === statusFilter;
    return nameMatch && statusMatch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            READY
          </span>
        );
      case 'SAVING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            SAVING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            FAILED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="saved-batches-backdrop"
        onClick={handleBackdropClick}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full h-[85vh] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                  {isEn ? 'Saved Recruiter Batches' : 'Đợt Tuyển Dụng Đã Lưu'}
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  {isEn ? 'Load and restore candidate leaderboards' : 'Tải và phục hồi kết quả xếp hạng ứng viên'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="saved-batches-refresh-btn"
                onClick={() => fetchBatches()}
                disabled={isLoading}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title={isEn ? "Refresh list" : "Làm mới"}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                id="saved-batches-close-btn"
                onClick={onClose}
                disabled={!!loadingBatchId}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search and Filters Row */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row gap-3 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input
                id="saved-batches-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isEn ? "Search by batch, role or JD file..." : "Tìm kiếm theo tên đợt, vị trí hoặc tệp JD..."}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-all font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                id="saved-batches-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-bold"
              >
                <option value="All">{isEn ? 'All Status' : 'Tất cả trạng thái'}</option>
                <option value="READY">READY</option>
                <option value="SAVING">SAVING</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="m-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl font-semibold flex items-start gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Main List Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {isLoading && batches.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs text-slate-500 font-semibold">
                  {isEn ? 'Retrieving saved batches...' : 'Đang tải danh sách...' }
                </p>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 border-2 border-dashed border-slate-200 rounded-2xl p-8">
                <Layers className="w-10 h-10 text-slate-300" />
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {isEn ? 'No Saved Batches Found' : 'Không có đợt tuyển dụng đã lưu'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {isEn 
                      ? 'Analyze candidate CVs and click "Save Batch" on the leaderboard header to persist snapshots.' 
                      : 'Hãy chạy phân tích danh sách CV và chọn "Lưu đợt tuyển dụng" trong thanh công cụ xếp hạng.'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                {filteredBatches.map((batch) => {
                  const isCurrentLoading = loadingBatchId === batch.id;
                  const isReady = batch.status === 'READY';
                  const dateString = new Date(batch.createdAt).toLocaleString(isEn ? 'en-US' : 'vi-VN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <motion.div
                      key={batch.id}
                      onClick={() => isReady && !isCurrentLoading && handleSelectBatch(batch.id, batch.status)}
                      className={`group bg-white rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-3 text-left ${
                        !isReady
                          ? 'border-slate-150 bg-slate-50/50 opacity-60 cursor-not-allowed'
                          : isCurrentLoading
                          ? 'border-indigo-400 bg-indigo-50/20 cursor-wait'
                          : 'border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-pointer active:scale-[0.99]'
                      }`}
                    >
                      {/* Name & status */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-black text-slate-900 text-sm sm:text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {batch.batchName}
                          </h4>
                          <div className="shrink-0">
                            {isCurrentLoading ? (
                              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                            ) : (
                              getStatusBadge(batch.status)
                            )}
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 line-clamp-1">
                          {batch.roleTitle}
                        </p>
                        {batch.jdFileName && (
                          <p className="text-[10px] text-slate-400 font-medium italic line-clamp-1">
                            JD: {batch.jdFileName}
                          </p>
                        )}
                      </div>

                      {/* Info & Stats */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateString}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                          <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="text-slate-800 font-bold">{batch.candidateCount} {isEn ? 'CVs' : 'Hồ sơ'}</span>
                        </div>
                      </div>

                      {/* Detail metrics micro layout */}
                      {isReady && (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                            <div className="bg-emerald-50/50 border border-emerald-100 text-emerald-800 py-1 rounded">
                              {isEn ? 'Ranked:' : 'Hợp lệ:'} {batch.rankedCount}
                            </div>
                            <div className="bg-slate-50 border border-slate-100 text-slate-600 py-1 rounded">
                              {isEn ? 'No score:' : 'Không điểm:'} {batch.noScoreCount}
                            </div>
                            <div className="bg-rose-50 border border-rose-100 text-rose-800 py-1 rounded">
                              {isEn ? 'Failed:' : 'Lỗi:'} {batch.failedCount}
                            </div>
                          </div>

                          {/* Leaderboard Trigger Button */}
                          <button
                            id={`open-leaderboard-${batch.id}`}
                            disabled={isCurrentLoading}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs group-hover:bg-indigo-700"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>{isEn ? 'Open leaderboard' : 'Mở bảng xếp hạng'}</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
