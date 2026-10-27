import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Link2,
  Loader2,
  Sparkles,
  ExternalLink,
  ClipboardPaste,
  RefreshCw,
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  Globe,
  ArrowRight
} from 'lucide-react';

export interface JdUrlExtractorProps {
  lang: 'vi' | 'en';
  token?: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onExtracted: (result: { jdText: string; sourceLabel: string; jobTitle?: string; sourceUrl: string }) => void;
  onError?: (message: string) => void;
}

interface AuthModalState {
  isOpen: boolean;
  url: string;
  siteName: string;
  reason: string;
}

export const JdUrlTriggerButton: React.FC<{
  lang: 'vi' | 'en';
  isOpen: boolean;
  isExtracting?: boolean;
  onClick: () => void;
}> = ({ lang, isOpen, isExtracting, onClick }) => {
  const isEn = lang === 'en';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isExtracting}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold border transition-all cursor-pointer disabled:opacity-50 text-[11px] sm:text-xs shadow-xs ${
        isOpen
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200/80'
      }`}
      title={isEn ? 'Extract JD from job posting URL (LinkedIn, ITviec, TopCV...)' : 'Trích xuất JD từ link tuyển dụng (LinkedIn, ITviec, TopCV...)'}
    >
      {isExtracting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        <Link2 className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{isEn ? 'Import Link' : 'Dán Link JD'}</span>
    </button>
  );
};

export const JdUrlExtractor: React.FC<JdUrlExtractorProps> = ({
  lang,
  token,
  isOpen,
  onToggleOpen,
  onExtracted,
  onError,
}) => {
  const isEn = lang === 'en';
  const [urlInput, setUrlInput] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Auth Popup & Assisted Extraction Modal State
  const [authModal, setAuthModal] = useState<AuthModalState>({
    isOpen: false,
    url: '',
    siteName: 'Job Portal',
    reason: '',
  });
  const [hasOpenedPopupWindow, setHasOpenedPopupWindow] = useState<boolean>(false);
  const [isProcessingClipboard, setIsProcessingClipboard] = useState<boolean>(false);
  const [manualPasteText, setManualPasteText] = useState<string>('');
  const [showManualPasteBox, setShowManualPasteBox] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const popupWindowRef = useRef<Window | null>(null);

  const openLoginPopupWindow = (targetUrl: string) => {
    try {
      const width = Math.min(1080, Math.round(window.screen.availWidth * 0.82));
      const height = Math.min(780, Math.round(window.screen.availHeight * 0.85));
      const left = Math.max(20, Math.round((window.screen.availWidth - width) / 2));
      const top = Math.max(20, Math.round((window.screen.availHeight - height) / 2));

      const popup = window.open(
        targetUrl,
        'rolematch_jd_login_popup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );
      if (popup) {
        popupWindowRef.current = popup;
        popup.focus();
        setHasOpenedPopupWindow(true);
        return true;
      }
    } catch (e) {
      console.warn('Unable to open popup window:', e);
    }
    return false;
  };

  const handleExtractFromUrl = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? urlInput).trim();
    if (!targetUrl) {
      const msg = isEn ? 'Please paste a job posting link first.' : 'Vui lòng dán đường dẫn (link) tin tuyển dụng.';
      setLocalError(msg);
      return;
    }

    setIsExtracting(true);
    setLocalError(null);
    setModalError(null);

    try {
      const authToken = token || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`/api/extract-jd-from-url?lang=${lang}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: targetUrl, lang }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok && !data?.requiresAuth) {
        throw new Error(
          data?.error ||
            (isEn ? 'Failed to extract JD from this link.' : 'Không thể trích xuất JD từ đường dẫn này.')
        );
      }

      // Check if site requires login / browser authentication (e.g., LinkedIn, ITviec, Cloudflare)
      if (data?.requiresAuth) {
        const normalizedUrl = data.sourceUrl || (targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
        const siteName = data.siteName || 'Website';
        const reason =
          data.reason ||
          (isEn
            ? `${siteName} requires you to sign in before viewing this Job Description.`
            : `Trang ${siteName} yêu cầu đăng nhập tài khoản để xem nội dung tin tuyển dụng này.`);

        setAuthModal({
          isOpen: true,
          url: normalizedUrl,
          siteName,
          reason,
        });
        setModalError(null);
        // Automatically launch the login popup window for the user
        openLoginPopupWindow(normalizedUrl);
        return;
      }

      if (data?.success && data?.text) {
        const siteLabel = data.siteName || 'Web Link';
        const jobLabel = data.jobTitle ? `${siteLabel}: ${data.jobTitle}` : `${siteLabel} (${targetUrl})`;

        // Close popup window if it was open
        if (popupWindowRef.current && !popupWindowRef.current.closed) {
          try {
            popupWindowRef.current.close();
          } catch {
            // ignore
          }
        }

        setAuthModal(prev => ({ ...prev, isOpen: false }));
        setUrlInput('');
        onExtracted({
          jdText: data.text,
          sourceLabel: jobLabel,
          jobTitle: data.jobTitle,
          sourceUrl: data.sourceUrl || targetUrl,
        });
      } else {
        throw new Error(
          data?.error ||
            (isEn ? 'No readable JD content found at this link.' : 'Không tìm thấy nội dung JD đọc được từ đường dẫn này.')
        );
      }
    } catch (err: any) {
      const msg = err?.message || (isEn ? 'Failed to extract JD from URL.' : 'Lỗi khi trích xuất JD từ link.');
      setLocalError(msg);
      if (authModal.isOpen) {
        setModalError(msg);
      }
      if (onError) onError(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  const processRawCopiedJd = async (rawCopiedText: string) => {
    setIsProcessingClipboard(true);
    setModalError(null);
    try {
      const authToken = token || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`/api/clean-pasted-jd?lang=${lang}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rawText: rawCopiedText,
          sourceUrl: authModal.url,
          lang,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.text) {
        throw new Error(
          data?.error ||
            (isEn
              ? 'Could not extract Job Description from copied text.'
              : 'Không thể trích xuất nội dung JD từ văn bản đã sao chép.')
        );
      }

      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        try {
          popupWindowRef.current.close();
        } catch {
          // ignore
        }
      }

      const siteLabel = data.siteName || authModal.siteName || 'Web Link';
      const jobLabel = data.jobTitle ? `${siteLabel}: ${data.jobTitle}` : `${siteLabel} (${authModal.url})`;

      setAuthModal(prev => ({ ...prev, isOpen: false }));
      setManualPasteText('');
      setShowManualPasteBox(false);
      setUrlInput('');

      onExtracted({
        jdText: data.text,
        sourceLabel: jobLabel,
        jobTitle: data.jobTitle,
        sourceUrl: authModal.url,
      });
    } catch (err: any) {
      setModalError(
        err?.message ||
          (isEn
            ? 'Failed to process copied JD content.'
            : 'Lỗi khi xử lý nội dung JD vừa sao chép.')
      );
    } finally {
      setIsProcessingClipboard(false);
    }
  };

  const handleOneClickClipboardExtract = async () => {
    setModalError(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setShowManualPasteBox(true);
        setModalError(
          isEn
            ? 'Browser clipboard access is restricted. Please press Ctrl+V into the box below.'
            : 'Trình duyệt không cho phép đọc Clipboard tự động. Vui lòng nhấn Ctrl+V vào ô bên dưới.'
        );
        return;
      }

      const clipText = await navigator.clipboard.readText();
      if (!clipText || clipText.trim().length < 30) {
        setShowManualPasteBox(true);
        setModalError(
          isEn
            ? 'Clipboard is empty or only contains the URL. Please go to the login popup window, press Ctrl+A then Ctrl+C on the job page, and click again (or paste below).'
            : 'Clipboard đang trống hoặc chỉ chứa đường link. Vui lòng sang cửa sổ tin tuyển dụng vừa đăng nhập, nhấn Ctrl+A rồi Ctrl+C để sao chép trang, sau đó bấm lại nút này (hoặc dán vào ô bên dưới).'
        );
        return;
      }

      // If the user still only has the URL itself in their clipboard, remind them to copy the job page
      if (/^https?:\/\/\S+$/i.test(clipText.trim())) {
        setShowManualPasteBox(true);
        setModalError(
          isEn
            ? 'Your clipboard currently only contains the URL link. In the popup window after signing in, press Ctrl+A then Ctrl+C to copy the job posting content, then click this button again.'
            : 'Clipboard hiện chỉ chứa đường link URL. Tại cửa sổ popup sau khi đăng nhập xong, bạn hãy nhấn Ctrl+A rồi Ctrl+C để sao chép nội dung trang tuyển dụng rồi bấm lại nút này.'
        );
        return;
      }

      await processRawCopiedJd(clipText);
    } catch {
      setShowManualPasteBox(true);
      setModalError(
        isEn
          ? 'Please allow clipboard permission or press Ctrl+V directly into the text box below.'
          : 'Vui lòng cấp quyền đọc Clipboard cho trình duyệt, hoặc nhấn Ctrl+V trực tiếp vào ô văn bản bên dưới.'
      );
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-2.5 sm:p-3 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900">
                  <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>
                    {isEn
                      ? 'Extract Job Description from URL (LinkedIn, ITviec, TopCV, VietnamWorks...)'
                      : 'Trích xuất JD tự động từ Link tuyển dụng (LinkedIn, ITviec, TopCV, VietnamWorks...)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleOpen}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title={isEn ? 'Close' : 'Đóng'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      if (localError) setLocalError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleExtractFromUrl();
                      }
                    }}
                    placeholder={
                      isEn
                        ? 'Paste job link here (e.g. https://www.linkedin.com/jobs/view/... or https://itviec.com/...)'
                        : 'Dán link tuyển dụng vào đây (VD: https://www.linkedin.com/jobs/... hoặc https://itviec.com/...)'
                    }
                    disabled={isExtracting}
                    className="w-full pl-8 pr-8 py-2 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {urlInput && !isExtracting && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrlInput('');
                        setLocalError(null);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleExtractFromUrl()}
                  disabled={isExtracting || !urlInput.trim()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-xs"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isEn ? 'Extracting JD...' : 'Đang lấy JD...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Extract JD' : 'Trích xuất JD'}</span>
                    </>
                  )}
                </button>
              </div>

              {localError && !authModal.isOpen && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200/80 rounded-lg px-2.5 py-1.5 font-medium">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{localError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocalError(null)}
                    className="text-rose-400 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Required Popup Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {authModal.isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
                role="dialog"
                aria-modal="true"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 10 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 px-5 py-4 text-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
                        <Lock className="w-4 h-4 text-amber-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm sm:text-base truncate">
                            {isEn
                              ? `Sign In Required on ${authModal.siteName}`
                              : `Yêu Cầu Đăng Nhập ${authModal.siteName}`}
                          </h3>
                          <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-amber-400/20 text-amber-200 rounded-md border border-amber-300/30 shrink-0">
                            {authModal.siteName}
                          </span>
                        </div>
                        <p className="text-[11px] text-indigo-100 truncate mt-0.5">
                          {authModal.url}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                      aria-label={isEn ? 'Close' : 'Đóng'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
                    <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 leading-relaxed">
                        <p className="font-bold">{authModal.reason}</p>
                        <p className="text-[11px] text-amber-800">
                          {isEn
                            ? 'Follow the 2 quick steps below to sign in safely on the popup window and let AI extract the clean Job Description.'
                            : 'Thực hiện 2 bước nhanh bên dưới để đăng nhập an toàn trên cửa sổ Popup và để AI tự động lọc nội dung JD.'}
                        </p>
                      </div>
                    </div>

                    {/* Step 1: Open Popup Window to Sign In */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 font-black text-slate-900 text-xs sm:text-sm">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center shrink-0">
                            1
                          </span>
                          <span>
                            {isEn
                              ? `Sign in to ${authModal.siteName} in Popup Window`
                              : `Đăng nhập ${authModal.siteName} trên cửa sổ Popup`}
                          </span>
                        </div>
                        {hasOpenedPopupWindow && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {isEn ? 'Popup opened' : 'Đã mở cửa sổ'}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {isEn
                          ? `A browser popup window has been opened to ${authModal.siteName}. Sign in to your account (supports Google SSO, 2FA, Captcha) until you can see the job posting details.`
                          : `Ứng dụng đã mở một cửa sổ trình duyệt tới ${authModal.siteName}. Bạn hãy đăng nhập tài khoản (hỗ trợ Google, 2FA, Captcha) cho đến khi trang hiển thị nội dung tin tuyển dụng.`}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openLoginPopupWindow(authModal.url)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
                          <span>
                            {isEn
                              ? `Open ${authModal.siteName} Login Popup`
                              : `Mở cửa sổ đăng nhập ${authModal.siteName}`}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExtractFromUrl(authModal.url)}
                          disabled={isExtracting}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                          <span>{isEn ? 'Retry Auto-Extract' : 'Thử tự động lấy lại'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Step 2: 1-Click Extract from Logged-in Window */}
                    <div className="bg-indigo-50/50 border-2 border-indigo-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 font-black text-slate-900 text-xs sm:text-sm">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center shrink-0">
                          2
                        </span>
                        <span>
                          {isEn
                            ? 'Extract JD Content after Signing In'
                            : 'Trích xuất nội dung JD sau khi đã đăng nhập'}
                        </span>
                      </div>

                      <div className="bg-white/90 rounded-lg p-3 border border-indigo-100 text-[11px] text-slate-700 space-y-1.5 leading-relaxed">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>
                            {isEn
                              ? 'On the popup window showing the job posting:'
                              : 'Tại cửa sổ Popup đang hiển thị tin tuyển dụng:'}
                          </span>
                        </div>
                        <p className="pl-5">
                          {isEn ? (
                            <>
                              Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-[10px]">Ctrl + A</kbd> then{' '}
                              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-[10px]">Ctrl + C</kbd> (copy the entire page), then click the button below. AI will automatically strip out menus/ads and keep only the clean JD!
                            </>
                          ) : (
                            <>
                              Nhấn <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-[10px]">Ctrl + A</kbd> rồi{' '}
                              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-[10px]">Ctrl + C</kbd> (sao chép toàn bộ trang vừa mở), sau đó bấm nút bên dưới. AI sẽ tự động lọc bỏ menu/quảng cáo và lấy đúng nội dung JD!
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={handleOneClickClipboardExtract}
                          disabled={isProcessingClipboard}
                          className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800 text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-60"
                        >
                          {isProcessingClipboard ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{isEn ? 'AI is extracting JD...' : 'AI đang lọc & trích xuất JD...'}</span>
                            </>
                          ) : (
                            <>
                              <ClipboardPaste className="w-4 h-4 text-indigo-100" />
                              <span>
                                {isEn
                                  ? '1-Click Read Clipboard & Extract JD'
                                  : 'Đọc từ Clipboard & Trích xuất JD bằng AI'}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowManualPasteBox(!showManualPasteBox)}
                          className="px-3 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 transition-colors cursor-pointer shrink-0"
                        >
                          {showManualPasteBox
                            ? (isEn ? 'Hide paste box' : 'Ẩn ô dán')
                            : (isEn ? 'Or Ctrl+V manually' : 'Hoặc tự dán Ctrl+V')}
                        </button>
                      </div>

                      {/* Manual Paste Box Fallback */}
                      {showManualPasteBox && (
                        <div className="pt-2 space-y-2 animate-fade-in">
                          <textarea
                            value={manualPasteText}
                            onChange={(e) => setManualPasteText(e.target.value)}
                            placeholder={
                              isEn
                                ? 'Press Ctrl+V here to paste the copied page content from the popup window...'
                                : 'Nhấn Ctrl+V vào đây để dán nội dung trang tuyển dụng vừa copy từ cửa sổ Popup...'
                            }
                            className="w-full h-28 p-3 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => processRawCopiedJd(manualPasteText)}
                              disabled={isProcessingClipboard || manualPasteText.trim().length < 30}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
                            >
                              {isProcessingClipboard ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              <span>{isEn ? 'Clean & Extract JD' : 'Lọc & Trích xuất JD'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {modalError && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{modalError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {isEn
                        ? '🔒 Your login credentials stay directly on the job portal popup.'
                        : '🔒 Tài khoản đăng nhập của bạn được bảo mật trực tiếp trên trang tuyển dụng.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
                      className="px-3 py-1.5 font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                    >
                      {isEn ? 'Close' : 'Đóng'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
