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

const getCaughtErrorMsg = (err: unknown, isEn: boolean): string => {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return '';
    return err.message;
  }
  if (typeof err === 'string') return err;
  return isEn ? 'An unexpected error occurred.' : 'Đã xảy ra lỗi không mong muốn.';
};

const getResponseError = async (response: Response, isEn: boolean): Promise<string> => {
  let errJson: any = null;
  try {
    errJson = await response.json();
  } catch {
    // ignore non-JSON or parsing issues
  }
  
  const rawMsg = errJson?.error || errJson?.message;
  let serverErrorStr = '';
  if (rawMsg) {
    if (typeof rawMsg === 'object') {
      serverErrorStr = JSON.stringify(rawMsg);
    } else {
      serverErrorStr = String(rawMsg);
    }
  }

  if (response.status === 401) {
    return isEn 
      ? 'Session expired or unauthorized. Please sign in again.' 
      : 'Hết phiên đăng nhập hoặc không có quyền. Vui lòng đăng nhập lại.';
  }
  if (response.status === 403) {
    return isEn 
      ? 'Access denied. You do not have permission to perform this action.' 
      : 'Truy cập bị từ chối. Bạn không có quyền thực hiện hành động này.';
  }
  if (response.status === 404) {
    return isEn 
      ? 'The requested resource could not be found.' 
      : 'Không tìm thấy tài nguyên yêu cầu.';
  }
  if (response.status === 400 || response.status === 422) {
    return serverErrorStr || (isEn 
      ? 'Invalid input or validation error. Please check your inputs.' 
      : 'Thông tin gửi đi không hợp lệ. Vui lòng kiểm tra lại.');
  }
  if (response.status >= 500) {
    return serverErrorStr || (isEn 
      ? 'Internal server error. Please try again later.' 
      : 'Lỗi hệ thống từ máy chủ. Vui lòng thử lại sau.');
  }
  return serverErrorStr || (isEn 
    ? `An unexpected error occurred (Status: ${response.status}).` 
    : `Đã xảy ra lỗi không mong muốn (Mã trạng thái: ${response.status}).`);
};

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
  const listAbortControllerRef = useRef<AbortController | null>(null);
  const detailAbortControllerRef = useRef<AbortController | null>(null);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (listAbortControllerRef.current) {
        listAbortControllerRef.current.abort();
      }
      if (detailAbortControllerRef.current) {
        detailAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Clean close aborts ongoing requests
  const handleClose = () => {
    if (listAbortControllerRef.current) {
      listAbortControllerRef.current.abort();
      listAbortControllerRef.current = null;
    }
    if (detailAbortControllerRef.current) {
      detailAbortControllerRef.current.abort();
      detailAbortControllerRef.current = null;
    }
    onClose();
  };

  // Fetch all batches with AbortController
  const fetchBatches = async () => {
    if (listAbortControllerRef.current) {
      listAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    listAbortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const authToken = token || localStorage.getItem('auth_token');
      const response = await fetch('/api/recruiter/batches', {
        signal: controller.signal,
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      if (!response.ok) {
        const errText = await getResponseError(response, isEn);
        throw new Error(errText);
      }

      const data = await response.json();
      if (isMountedRef.current && listAbortControllerRef.current === controller) {
        if (data && data.success === true && Array.isArray(data.batches)) {
          setBatches(data.batches);
        } else {
          // P1-2: Throw error and do not clear list if response format is invalid
          throw new Error(isEn ? 'Invalid list format received from server.' : 'Định dạng danh sách từ máy chủ không hợp lệ.');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (isMountedRef.current && listAbortControllerRef.current === controller) {
        setErrorMsg(getCaughtErrorMsg(err, isEn));
      }
    } finally {
      if (isMountedRef.current && listAbortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  };

  // Load batches on open
  useEffect(() => {
    if (isOpen) {
      fetchBatches();
      setSearchTerm('');
      setStatusFilter('All');
      setErrorMsg('');
    }
    return () => {
      if (listAbortControllerRef.current) {
        listAbortControllerRef.current.abort();
        listAbortControllerRef.current = null;
      }
      if (detailAbortControllerRef.current) {
        detailAbortControllerRef.current.abort();
        detailAbortControllerRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle Escape key for Dialog Accessibility
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Select and load specific batch detail
  const handleSelectBatch = async (batchId: string, status: string) => {
    if (status !== 'READY') return; // Requirement 3: Only READY can be opened
    if (loadingBatchId === batchId) return;

    if (detailAbortControllerRef.current) {
      detailAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    detailAbortControllerRef.current = controller;

    setLoadingBatchId(batchId);
    setErrorMsg('');
    try {
      const authToken = token || localStorage.getItem('auth_token');
      const response = await fetch(`/api/recruiter/batches/${batchId}`, {
        signal: controller.signal,
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      if (!response.ok) {
        const errText = await getResponseError(response, isEn);
        throw new Error(errText);
      }

      const data = await response.json();
      if (isMountedRef.current && detailAbortControllerRef.current === controller) {
        if (data && data.success === true && data.batch && Array.isArray(data.batch.candidates)) {
          onRestoreBatch(data.batch);
          onClose();
        } else {
          throw new Error(isEn ? 'Invalid batch details format received.' : 'Định dạng dữ liệu đợt tuyển dụng không hợp lệ.');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (isMountedRef.current && detailAbortControllerRef.current === controller) {
        setErrorMsg(getCaughtErrorMsg(err, isEn));
      }
    } finally {
      if (isMountedRef.current && detailAbortControllerRef.current === controller) {
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
            {isEn ? 'Ready' : 'Sẵn sàng'}
          </span>
        );
      case 'SAVING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {isEn ? 'Saving' : 'Đang lưu'}
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {isEn ? 'Failed' : 'Lỗi'}
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-batches-title"
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
                <h3 id="saved-batches-title" className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
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
                aria-label={isEn ? "Refresh list" : "Làm mới danh sách"}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title={isEn ? "Refresh list" : "Làm mới"}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                id="saved-batches-close-btn"
                onClick={handleClose}
                aria-label={isEn ? "Close dialog" : "Đóng hộp thoại"}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search and Filters Row */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row gap-3 shrink-0">
            <div className="relative flex-1">
              <label htmlFor="saved-batches-search" className="sr-only">
                {isEn ? 'Search' : 'Tìm kiếm'}
              </label>
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
              <label htmlFor="saved-batches-status-filter" className="sr-only">
                {isEn ? 'Filter by status' : 'Lọc theo trạng thái'}
              </label>
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                id="saved-batches-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-bold"
              >
                <option value="All">{isEn ? 'All Status' : 'Tất cả trạng thái'}</option>
                <option value="READY">{isEn ? 'Ready' : 'Sẵn sàng'}</option>
                <option value="SAVING">{isEn ? 'Saving' : 'Đang lưu'}</option>
                <option value="FAILED">{isEn ? 'Failed' : 'Lỗi'}</option>
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
