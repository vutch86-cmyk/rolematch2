import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecruiterBatchDetail } from '../types';

interface CandidateResult {
  filename: string;
  success: boolean;
  candidateName: string;
  overallScore: number | null;
  matchLevel: 'Very High' | 'High' | 'Medium' | 'Low' | 'NOT_AVAILABLE';
  keywordScore: number | null;
  experienceScore: number | null;
  skillScore: number | null;
  topStrengths: string[];
  keyGaps: string[];
  shortRecommendation: string;
  errorMessage?: string;
  cvText?: string;
  fullAnalysis?: any;
}

interface SaveBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEn: boolean;
  token: string | null;
  batchId?: string | null;
  jdText: string;
  jdFileName: string | null;
  results: CandidateResult[];
  onSaveSuccess: (savedBatch: RecruiterBatchDetail) => void;
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

const guessRoleTitle = (jdText: string, jdFileName: string | null): string => {
  if (jdFileName) {
    let cleanName = jdFileName.replace(/\.[^/.]+$/, "").replace(/[\-_]+/g, " ");
    cleanName = cleanName.replace(/^(cv|resume|jd|profile|hosocanhan|hoso|job description)[\s_\-\.]+/i, "");
    if (cleanName.trim().length > 3) return cleanName.trim();
  }
  const lines = jdText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 15)) {
    const clean = line.replace(/^[\#\*\:\-\>\s]+/, '').replace(/[\#\*\:\-\,\.]+$/, '').trim();
    const matchRole = clean.match(/^(?:vị\s*trí|chức\s*danh|tuyển\s*dụng|job\s*title|position|role)\s*[:\-]\s*(.+)$/i);
    if (matchRole && matchRole[1] && matchRole[1].trim().length < 60) {
      return matchRole[1].trim();
    }
  }
  return "";
};

export const SaveBatchModal: React.FC<SaveBatchModalProps> = ({
  isOpen,
  onClose,
  isEn,
  token,
  batchId,
  jdText,
  jdFileName,
  results,
  onSaveSuccess,
}) => {
  const [batchName, setBatchName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle Escape key for Dialog Accessibility
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isLoading, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setBatchName('');
      setRoleTitle(guessRoleTitle(jdText, jdFileName));
    }
  }, [isOpen, jdText, jdFileName]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName.trim()) {
      setErrorMsg(isEn ? 'Batch Name is required.' : 'Vui lòng nhập tên đợt tuyển dụng.');
      return;
    }
    if (!roleTitle.trim()) {
      setErrorMsg(isEn ? 'Role Title is required.' : 'Vui lòng nhập tên vai trò cần tuyển.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // P1-1: No || fallback for errorMessage, cvText, fullAnalysis. Preserve empty string, null, and undefined as-is.
      const preparedCandidates = results.map(c => ({
        filename: c.filename,
        candidateName: c.candidateName || '',
        success: c.success !== false,
        overallScore: c.overallScore,
        matchLevel: c.matchLevel || 'NOT_AVAILABLE',
        keywordScore: c.keywordScore,
        experienceScore: c.experienceScore,
        skillScore: c.skillScore,
        topStrengths: c.topStrengths || [],
        keyGaps: c.keyGaps || [],
        shortRecommendation: c.shortRecommendation,
        errorMessage: c.errorMessage,
        cvText: c.cvText,
        fullAnalysis: c.fullAnalysis,
      }));

      const payload = {
        batchId: batchId || undefined,
        batchName: batchName.trim(),
        roleTitle: roleTitle.trim(),
        jdText,
        jdFileName: jdFileName || undefined,
        candidates: preparedCandidates,
      };

      const authToken = token || localStorage.getItem('auth_token');
      const response = await fetch('/api/recruiter/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await getResponseError(response, isEn);
        throw new Error(errText);
      }

      const data = await response.json();
      // P1-4: Validate save response properties exactly
      if (data && data.success === true && data.batch && Array.isArray(data.batch.candidates)) {
        onSaveSuccess(data.batch);
        onClose();
      } else {
        throw new Error(isEn 
          ? 'Failed to parse batch response: candidates list is missing or invalid.' 
          : 'Lưu đợt thất bại: danh sách hồ sơ ứng viên phản hồi từ máy chủ không hợp lệ.'
        );
      }
    } catch (err: unknown) {
      setErrorMsg(getCaughtErrorMsg(err, isEn));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="save-batch-backdrop"
        onClick={handleBackdropClick}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-batch-title"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 id="save-batch-title" className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                  {isEn ? 'Save Recruiter Batch' : 'Lưu Đợt Tuyển Dụng'}
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  {isEn ? `${results.length} Profiles snapshot` : `Ảnh chụp ${results.length} hồ sơ`}
                </p>
              </div>
            </div>
            <button
              id="save-batch-close-btn"
              onClick={onClose}
              disabled={isLoading}
              aria-label={isEn ? "Close dialog" : "Đóng hộp thoại"}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-4">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl font-semibold flex items-start gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Batch Name */}
            <div className="space-y-1.5">
              <label htmlFor="save-batch-name-input" className="text-xs font-bold text-slate-700 block">
                {isEn ? 'Batch Name' : 'Tên đợt tuyển dụng'} <span className="text-rose-500">*</span>
              </label>
              <input
                id="save-batch-name-input"
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder={isEn ? "e.g., Frontend Dev Batch Q3" : "Ví dụ: Đợt tuyển Frontend Dev Q3"}
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium disabled:opacity-60"
              />
            </div>

            {/* Role Title */}
            <div className="space-y-1.5">
              <label htmlFor="save-role-title-input" className="text-xs font-bold text-slate-700 block">
                {isEn ? 'Role Title' : 'Vị trí / Vai trò tuyển dụng'} <span className="text-rose-500">*</span>
              </label>
              <input
                id="save-role-title-input"
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder={isEn ? "e.g., Senior React Engineer" : "Ví dụ: Lập trình viên React Senior"}
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium disabled:opacity-60"
              />
            </div>

            {/* Information Banner */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-900 leading-relaxed space-y-1">
              <p className="font-bold">{isEn ? 'What gets saved?' : 'Thông tin sẽ được lưu giữ:'}</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 font-medium">
                <li>{isEn ? 'All candidate ranks, scores, and match levels' : 'Toàn bộ xếp hạng, điểm số và mức độ phù hợp'}</li>
                <li>{isEn ? 'Gemini deep analysis results, strengths, and recommendations' : 'Kết quả phân tích chi tiết, điểm mạnh/yếu từ Gemini'}</li>
                <li>{isEn ? 'Job description (JD) and CV raw texts' : 'Nội dung văn bản gốc của JD và CV'}</li>
                <li>{isEn ? 'Any processing errors or unranked profiles' : 'Bao gồm cả hồ sơ lỗi hoặc chưa có điểm số'}</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                id="save-batch-cancel-btn"
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEn ? 'Cancel' : 'Hủy bỏ'}
              </button>
              <button
                id="save-batch-submit-btn"
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isEn ? 'Saving...' : 'Đang lưu...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Save Snapshots' : 'Lưu Kết Quả'}</span>
                  </>
                )
              }
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
