import React, { useState, useEffect } from 'react';
import { X, Search, Filter, Calendar, Users, AlertCircle, Loader2, Layers, CheckCircle, RefreshCw, FolderOpen, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecruiterBatchSummary {
  id: string;
  batchName: string;
  roleTitle: string;
  jdText: string;
  jdFileName?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    userId: string;
    username: string;
    fullName: string;
  };
  status: 'SAVING' | 'READY' | 'FAILED';
  candidateCount: number;
  rankedCount: number;
  noScoreCount: number;
  failedCount: number;
}

interface SavedBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEn: boolean;
  token: string | null;
  onRestoreBatch: (batchDetails: any) => void;
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

  const fetchBatches = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const authToken = token || localStorage.getItem('auth_token');
      const response = await fetch('/api/recruiter/batches', {
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
      setBatches(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || (isEn ? 'An error occurred while loading batches.' : 'Đã xảy ra lỗi khi tải danh sách đợt tuyển dụng.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBatches();
      setSearchTerm('');
      setStatusFilter('All');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectBatch = async (batchId: string) => {
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
        throw new Error(isEn ? 'Failed to load batch details.' : 'Không thể tải chi tiết đợt tuyển dụng.');
      }

      const batchDetail = await response.json();
      if (!batchDetail) {
        throw new Error(isEn ? 'Batch data is empty.' : 'Dữ liệu đợt tuyển dụng trống.');
      }

      onRestoreBatch(batchDetail);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (isEn ? 'An error occurred while retrieving batch details.' : 'Đã xảy ra lỗi khi tải chi tiết đợt tuyển dụng.'));
    } finally {
      setLoadingBatchId(null);
    }
  };

  const filteredBatches = batches.filter(b => {
    const nameMatch = b.batchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                     b.roleTitle.toLowerCase().includes(searchTerm.toLowerCase());
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
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
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
                onClick={fetchBatches}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title={isEn ? "Refresh list" : "Làm mới"}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isEn ? "Search by batch name or role title..." : "Tìm kiếm theo tên đợt hoặc vị trí..."}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition-all font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
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
                      ? 'Analyze any set of candidate CVs against a JD and click "Save Batch" on the leaderboard header to persist snapshots.' 
                      : 'Hãy chạy phân tích danh sách CV và chọn "Lưu đợt tuyển dụng" trong thanh công cụ xếp hạng.'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBatches.map((batch) => {
                  const isCurrentLoading = loadingBatchId === batch.id;
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
                      onClick={() => !isCurrentLoading && handleSelectBatch(batch.id)}
                      className={`group bg-white rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between gap-3 text-left ${
                        isCurrentLoading
                          ? 'border-indigo-400 bg-indigo-50/20 cursor-not-allowed'
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
                      {batch.status === 'READY' && (
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
