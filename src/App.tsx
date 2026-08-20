import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { KeywordMatchTab } from './components/KeywordMatchTab';
import { BulletPointRewriteTab } from './components/BulletPointRewriteTab';
import { RecruiterScanTab } from './components/RecruiterScanTab';
import { HistorySidebar } from './components/HistorySidebar';
import { CompleteCVAnalysisResponse, HistoryItem, SamplePreset, UpdatedCvResponse } from './types';
import { AnalysisProgressBar } from './components/AnalysisProgressBar';
import { generateMarkdownReport } from './utils/exportMarkdown';
import { UpdatedCvModal } from './components/UpdatedCvModal';
import { AuditorReport } from './components/AuditorReport';
import { ErrorLogsModal } from './components/ErrorLogsModal';
import { LoginModal } from './components/LoginModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { StandaloneLoginPage } from './components/StandaloneLoginPage';
import { UserAccount } from './types';
import { initGlobalErrorLogging, fetchAllLogs } from './utils/logger';
import { Language, translations } from './utils/i18n';
import { BatchProcessingTab } from './components/BatchProcessingTab';
import {
  FileText,
  Sparkles,
  Layers,
  Zap,
  Eye,
  Download,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Printer,
  FileCheck,
  Users,
} from 'lucide-react';

const LOCAL_STORAGE_CV_KEY = 'cv_matcher_cvText';
const LOCAL_STORAGE_JD_KEY = 'cv_matcher_jdText';
const LOCAL_STORAGE_HISTORY_KEY = 'cv_matcher_history';

async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delayMs = 1200): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return res;
      }
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError || new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
}

export default function App() {
  const [lang, setLang] = useState<Language>('vi');
  const t = translations[lang];

  const [cvText, setCvText] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_CV_KEY) || '';
    } catch {
      return '';
    }
  });

  const [jdText, setJdText] = useState<string>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_JD_KEY) || '';
    } catch {
      return '';
    }
  });

  // History state from localStorage
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [currentActiveHistoryId, setCurrentActiveHistoryId] = useState<string | undefined>(undefined);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState<boolean>(false);

  // System Error Logs modal state
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [logsCount, setLogsCount] = useState<number>(0);

  // Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('auth_token') || null;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
            setToken(savedToken);
          } else {
            localStorage.removeItem('auth_token');
            setCurrentUser(null);
            setToken(null);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLoginSuccess = (user: UserAccount, authToken: string) => {
    setCurrentUser(user);
    setToken(authToken);
    try {
      localStorage.setItem('auth_token', authToken);
    } catch (e) {}
  };

  const handleLogout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }
    setCurrentUser(null);
    setToken(null);
    try {
      localStorage.removeItem('auth_token');
    } catch (e) {}
  };

  useEffect(() => {
    initGlobalErrorLogging();
    const updateLogsCount = async () => {
      try {
        const logs = await fetchAllLogs();
        setLogsCount(logs?.length || 0);
      } catch {
        // ignore
      }
    };
    updateLogsCount();
    const interval = setInterval(updateLogsCount, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      if (cvText) {
        localStorage.setItem(LOCAL_STORAGE_CV_KEY, cvText);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_CV_KEY);
      }
    } catch (err) {
      console.warn('Failed to save CV text to localStorage:', err);
    }
  }, [cvText]);

  useEffect(() => {
    try {
      if (jdText) {
        localStorage.setItem(LOCAL_STORAGE_JD_KEY, jdText);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_JD_KEY);
      }
    } catch (err) {
      console.warn('Failed to save JD text to localStorage:', err);
    }
  }, [jdText]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(historyItems));
    } catch (err) {
      console.warn('Failed to save history to localStorage:', err);
    }
  }, [historyItems]);

  const [appMode, setAppMode] = useState<'single' | 'batch'>('single');
  const [activeTab, setActiveTab] = useState<'feature1' | 'feature2' | 'feature3'>('feature3');
  const tabsHeaderRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: 'feature1' | 'feature2' | 'feature3') => {
    setActiveTab(tab);

    requestAnimationFrame(() => {
      if (tabsHeaderRef.current) {
        const rect = tabsHeaderRef.current.getBoundingClientRect();
        // The top sticky bar offset is ~80px (top-20)
        const targetHeaderOffset = 80;
        const targetY = window.scrollY + rect.top - targetHeaderOffset;

        // Smoothly scroll window to top of tab header if not already aligned
        if (Math.abs(window.scrollY - targetY) > 15) {
          window.scrollTo({
            top: Math.max(0, targetY),
            behavior: 'smooth',
          });
        }
      }
    });
  };
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompleteCVAnalysisResponse | null>(null);
  const [checkedActions, setCheckedActions] = useState<boolean[]>([false, false, false, false, false]);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [currentRoleTitle, setCurrentRoleTitle] = useState<string>('');

  // Gemini Updated CV state
  const [isUpdatedCvModalOpen, setIsUpdatedCvModalOpen] = useState<boolean>(false);
  const [updatedCvData, setUpdatedCvData] = useState<UpdatedCvResponse | null>(null);
  const [isGeneratingUpdatedCv, setIsGeneratingUpdatedCv] = useState<boolean>(false);

  const handleSelectPreset = (preset: SamplePreset) => {
    setCvText(preset.cvText);
    setJdText(preset.jdText);
    setCurrentRoleTitle(preset.title);
    setError(null);
  };

  const handleAnalyze = async (clarifyingAnswers?: string) => {
    if (!cvText.trim() || !jdText.trim()) return;

    if (clarifyingAnswers) {
      setIsRefining(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const res = await fetchWithRetry('/api/analyze-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          cvText,
          jdText,
          clarifyingAnswers,
          lang,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || data.message || (lang === 'vi' ? 'Có lỗi xảy ra khi gọi API phân tích.' : 'An error occurred while calling analysis API.'));
        throw new Error(errMsg);
      }

      setAnalysis(data);
      setCheckedActions([false, false, false, false, false]);

      if (!clarifyingAnswers) {
        setActiveTab('feature3');
      }

      // Save report to history
      let inferredTitle = currentRoleTitle.trim();
      if (!inferredTitle) {
        if (data.feature1?.jdKeywords?.[0]?.keyword) {
          inferredTitle = `Vị trí ${data.feature1.jdKeywords[0].keyword}`;
        } else {
          const firstLine = jdText.trim().split('\n')[0] || '';
          inferredTitle =
            firstLine.substring(0, 36) ||
            (lang === 'vi' ? 'Vị trí công việc' : 'CV Analysis Report');
        }
      }

      const candidateDisplayName = currentUser ? currentUser.username : 'user_guest';
      if (!inferredTitle.toLowerCase().includes(`- ${candidateDisplayName.toLowerCase()}`)) {
        inferredTitle = `${inferredTitle} - ${candidateDisplayName}`;
      }

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        title: inferredTitle,
        timestamp: Date.now(),
        cvText,
        jdText,
        analysis: data,
        score: data.feature1?.scores?.overallRoleScore || 0,
      };

      setCurrentActiveHistoryId(newHistoryItem.id);
      setHistoryItems((prev) =>
        [newHistoryItem, ...prev.filter((item) => item.id !== newHistoryItem.id)].slice(0, 30)
      );
    } catch (err: any) {
      console.error('Error analyzing CV:', err);
      const msg = typeof err?.message === 'string' ? err.message : (typeof err === 'string' ? err : (lang === 'vi' ? 'Không thể thực hiện phân tích. Vui lòng thử lại.' : 'Unable to run analysis. Please try again.'));
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefining(false);
    }
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setCvText(item.cvText);
    setJdText(item.jdText);
    setAnalysis(item.analysis);
    setCurrentRoleTitle(item.title);
    setCurrentActiveHistoryId(item.id);
    setCheckedActions([false, false, false, false, false]);
    setActiveTab('feature3');
    setAppMode('single');
    setIsHistorySidebarOpen(false);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    if (currentActiveHistoryId === id) {
      setCurrentActiveHistoryId(undefined);
    }
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
    setCurrentActiveHistoryId(undefined);
  };

  const handleSaveBatchHistoryItems = (items: HistoryItem[]) => {
    setHistoryItems((prev) => {
      const newIds = new Set(items.map((it) => it.id));
      const filteredPrev = prev.filter((it) => !newIds.has(it.id));
      return [...items, ...filteredPrev].slice(0, 50);
    });
  };

  const handleToggleAction = (index: number) => {
    setCheckedActions((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleReset = () => {
    setCvText('');
    setJdText('');
    setAnalysis(null);
    setError(null);
    setCurrentRoleTitle('');
    setCurrentActiveHistoryId(undefined);
    setCheckedActions([false, false, false, false, false]);
  };

  const handleCopyReport = () => {
    if (!analysis) return;
    const md = generateMarkdownReport(analysis, currentRoleTitle);
    navigator.clipboard.writeText(md);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!analysis) return;
    const md = generateMarkdownReport(analysis, currentRoleTitle);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Toi_Uu_CV_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateUpdatedCv = async (customInstruction?: string) => {
    if (!cvText.trim() || !jdText.trim()) return;

    setIsGeneratingUpdatedCv(true);
    setIsUpdatedCvModalOpen(true);

    try {
      const res = await fetchWithRetry('/api/generate-updated-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvText,
          jdText,
          analysis,
          customInstruction,
          lang,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || data.message || (lang === 'vi' ? 'Có lỗi xảy ra khi tạo bản CV cập nhật với Gemini.' : 'An error occurred while generating updated CV with Gemini.'));
        throw new Error(errMsg);
      }

      setUpdatedCvData(data);
    } catch (err: any) {
      console.error('Error generating updated CV:', err);
      const msg = typeof err?.message === 'string' ? err.message : (typeof err === 'string' ? err : (lang === 'vi' ? 'Không thể tạo CV cập nhật. Vui lòng thử lại.' : 'Unable to generate updated CV. Please try again.'));
      alert(msg);
    } finally {
      setIsGeneratingUpdatedCv(false);
    }
  };

  const handleApplyUpdatedCvToInput = (newCvText: string) => {
    setCvText(newCvText);
  };

  if (!currentUser) {
    return (
      <StandaloneLoginPage
        onLoginSuccess={handleLoginSuccess}
        lang={lang}
        onLangChange={setLang}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <Header
        onReset={handleReset}
        hasData={!!analysis}
        lang={lang}
        onLangChange={setLang}
        historyCount={historyItems.length}
        onOpenHistory={() => setIsHistorySidebarOpen(true)}
        onOpenLogs={() => setIsLogsModalOpen(true)}
        logsCount={logsCount}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setIsAdminModalOpen(true)}
      />


      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Mode Switcher Tabs */}
        <div className="bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => setAppMode('single')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              appMode === 'single'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{lang === 'vi' ? 'Ứng viên' : 'Candidate'}</span>
          </button>
          <button
            onClick={() => setAppMode('batch')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              appMode === 'batch'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="relative">
              {lang === 'vi' ? 'Nhà tuyển dụng' : 'Recruiter'}
              <span className="absolute -top-1 -right-2.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            </span>
          </button>
        </div>

        <div className={appMode === 'single' ? 'space-y-8 animate-fade-in' : 'hidden'}>
            {/* Top welcome banner / intro */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {lang === 'vi'
                  ? 'Chuyên Gia Tuyển Dụng AI (Senior HR Lead Persona)'
                  : 'AI Recruitment Expert (Senior HR Lead Persona)'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {lang === 'vi'
                ? 'Phân Tích JD & Tối Ưu CV Theo Tiêu Chuẩn Nhà Tuyển Dụng'
                : 'JD Analysis & CV Optimization to Recruiter Standards'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {lang === 'vi' ? (
                <>
                  Nhập CV và JD của vị trí ứng tuyển để nhận kết quả phân tích rành mạch theo 3 tính năng cốt lõi: 
                  <strong> Trích xuất từ khóa JD & đối chiếu</strong>, 
                  <strong> Viết lại bullet point chuẩn công thức Action + Tool + Outcome</strong>, và 
                  <strong> Đánh giá khắt khe trong 10 giây từ Nhà tuyển dụng</strong>.
                </>
              ) : (
                <>
                  Input your CV and Job Description (JD) to receive clear analysis across 3 core features: 
                  <strong> JD Keyword Extraction & Comparison</strong>, 
                  <strong> Bullet Point Optimization (Action + Tool + Outcome)</strong>, and 
                  <strong> Strict 10-Second Recruiter Impression Scan</strong>.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Input Form Section */}
        <InputSection
          cvText={cvText}
          setCvText={setCvText}
          jdText={jdText}
          setJdText={setJdText}
          onAnalyze={() => handleAnalyze()}
          isLoading={isLoading}
          onSelectPreset={handleSelectPreset}
          lang={lang}
          currentUser={currentUser}
        />

        {/* Error message card if any */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-rose-900 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs sm:text-sm">
              <div className="font-bold">{lang === 'vi' ? 'Đã có lỗi xảy ra' : 'An error occurred'}</div>
              <div>{error}</div>
            </div>
            <button
              onClick={() => handleAnalyze()}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer shrink-0"
            >
              {lang === 'vi' ? 'Thử lại' : 'Retry'}
            </button>
          </div>
        )}

        {/* Progress Bar Loading Section */}
        <AnalysisProgressBar isLoading={isLoading} lang={lang} />

        {/* Analysis Dashboard Output */}
        {analysis && !isLoading && (
          <div className="space-y-6">
            {analysis.isDemoFallback && (
              <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 text-amber-900 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-sm">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {lang === 'vi'
                      ? 'Hệ thống AI tạm thời quá tải hoặc đạt giới hạn lượt dùng — Đang hiển thị kết quả phân tích bằng bộ mô phỏng dữ liệu thông minh.'
                      : 'AI model rate limit reached — Displaying analysis using smart fallback simulator.'}
                  </span>
                </div>
                <button
                  onClick={() => handleAnalyze()}
                  className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors cursor-pointer shrink-0 text-xs"
                >
                  {lang === 'vi' ? 'Thử lại AI' : 'Retry AI'}
                </button>
              </div>
            )}

            {/* Model A: Sequential Verification Pipeline Output Card (Admin Only) */}
            {analysis.pipelineMetadata && currentUser?.role === 'admin' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-100 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 font-extrabold rounded-lg text-xs border border-indigo-500/30">
                      {lang === 'vi' ? 'Mô hình A' : 'Model A'}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-white">
                        Sequential Verification Pipeline Status
                      </h3>
                      <p className="text-xs text-slate-400">
                        {analysis.pipelineMetadata.modelPattern}
                      </p>
                    </div>
                  </div>
                  {analysis.pipelineMetadata.usedOpenAiKey ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      OpenRouter Auditor Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span>Gemini Engine Active</span>
                    </span>
                  )}
                </div>

                {/* Steps Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {analysis.pipelineMetadata.steps.map((st, idx) => (
                    <div
                      key={`step-${st.step}-${idx}`}
                      className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        {st.step}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-white flex items-center justify-between gap-2">
                          <span>{st.name}</span>
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            {st.provider}
                          </span>
                        </div>
                        {st.details && <p className="text-slate-400 text-[11px]">{st.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Auditor Critique / Review Details */}
                {analysis.pipelineMetadata.auditorFeedback && (
                  <AuditorReport feedbackText={analysis.pipelineMetadata.auditorFeedback} lang={lang} />
                )}
              </div>
            )}

            {/* Action Bar & Tabs Header */}
            <div ref={tabsHeaderRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 sm:p-2.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sticky top-20 z-20 max-w-full overflow-hidden">
              {/* Feature Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200/90 rounded-xl shrink min-w-0 max-w-full overflow-x-auto">
                <button
                  onClick={() => handleTabChange('feature3')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'feature3'
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-semibold'
                  }`}
                >
                  <Eye className={`w-3.5 h-3.5 ${activeTab === 'feature3' ? 'text-white' : 'text-emerald-600'}`} />
                  <span className="hidden xl:inline">{t.tabs.tab1}</span>
                  <span className="inline xl:hidden">{lang === 'vi' ? '1. Góc Nhìn HR' : '1. Recruiter View'}</span>
                </button>

                <button
                  onClick={() => handleTabChange('feature1')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'feature1'
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-semibold'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 ${activeTab === 'feature1' ? 'text-white' : 'text-indigo-600'}`} />
                  <span className="hidden xl:inline">{t.tabs.tab2}</span>
                  <span className="inline xl:hidden">{lang === 'vi' ? '2. Khớp & Từ Khóa' : '2. Keywords & JD'}</span>
                </button>

                <button
                  onClick={() => handleTabChange('feature2')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'feature2'
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-semibold'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${activeTab === 'feature2' ? 'text-white' : 'text-amber-500'}`} />
                  <span className="hidden xl:inline">{t.tabs.tab3}</span>
                  <span className="inline xl:hidden">{lang === 'vi' ? '3. Cập nhật CV' : '3. Update CV'}</span>
                </button>
              </div>

              {/* Export / Print Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end flex-wrap max-w-full">
                <button
                  onClick={() => handleGenerateUpdatedCv()}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
                  title={lang === 'vi' ? 'Cập nhật toàn bộ CV theo các đề xuất ở mục 6 bằng Gemini AI' : 'Generate full updated CV based on Section 6 via Gemini AI'}
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950 shrink-0" />
                  <span>{lang === 'vi' ? 'Cập Nhật CV' : 'Update CV'}</span>
                  <span className="hidden sm:inline text-[10px] opacity-80">(AI)</span>
                </button>

                <button
                  onClick={handleCopyReport}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title={lang === 'vi' ? 'Sao chép toàn bộ báo cáo Markdown' : 'Copy entire Markdown report'}
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{lang === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'vi' ? 'Sao Chép' : 'Copy'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold border border-indigo-200/60 transition-colors cursor-pointer"
                  title={lang === 'vi' ? 'Tải tệp .md về máy' : 'Download .md file'}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'vi' ? 'Tải .md' : 'Download .md'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title={lang === 'vi' ? 'In báo cáo' : 'Print report'}
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'vi' ? 'In Báo Cáo' : 'Print'}</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            <div key={activeTab} className="pt-2 animate-fade-in">
              {activeTab === 'feature1' && analysis.feature1 && (
                <KeywordMatchTab
                  jdKeywords={analysis.feature1?.jdKeywords || []}
                  comparisonTable={analysis.feature1?.comparisonTable || []}
                  scores={analysis.feature1?.scores || { keywordMatchScore: 0, skillMatchScore: 0, experienceOutcomeScore: 0, overallRoleScore: 0 }}
                  summary={analysis.feature1?.summary || { biggestStrength: '', missingKeywordsSkills: [], weakOrVagueSections: [], immediateActions: [] }}
                  checkedActions={checkedActions}
                  onToggleAction={handleToggleAction}
                  lang={lang}
                />
              )}

              {activeTab === 'feature2' && analysis.feature2 && (
                <BulletPointRewriteTab
                  clarifyingQuestions={analysis.feature2?.clarifyingQuestions || []}
                  rewrittenBullets={analysis.feature2?.rewrittenBullets || []}
                  onRefineWithAnswers={(ans) => handleAnalyze(ans)}
                  isRefining={isRefining}
                  onOpenGenerateUpdatedCv={() => handleGenerateUpdatedCv()}
                  lang={lang}
                />
              )}

              {activeTab === 'feature3' && analysis.feature3 && (
                <RecruiterScanTab result={analysis.feature3} lang={lang} />
              )}
            </div>
          </div>
        )}
        </div>

        <div className={appMode === 'batch' ? 'animate-fade-in' : 'hidden'}>
          <BatchProcessingTab
            lang={lang}
            token={token}
            onAddHistoryItems={handleSaveBatchHistoryItems}
            onOpenFullAnalysis={handleSelectHistoryItem}
          />
        </div>

        {/* Gemini Updated CV Modal */}
        <UpdatedCvModal
          isOpen={isUpdatedCvModalOpen}
          onClose={() => setIsUpdatedCvModalOpen(false)}
          originalCvText={cvText}
          updatedCvData={updatedCvData}
          isGenerating={isGeneratingUpdatedCv}
          onRefineCv={(customInstruction) => handleGenerateUpdatedCv(customInstruction)}
          onApplyToInputCv={(newCv) => handleApplyUpdatedCvToInput(newCv)}
          lang={lang}
        />

        {/* History Sidebar Drawer */}
        <HistorySidebar
          isOpen={isHistorySidebarOpen}
          onClose={() => setIsHistorySidebarOpen(false)}
          historyItems={historyItems}
          currentActiveId={currentActiveHistoryId}
          onSelectHistoryItem={handleSelectHistoryItem}
          onDeleteHistoryItem={handleDeleteHistoryItem}
          onClearHistory={handleClearHistory}
          lang={lang}
        />

        {/* System Error Logs Modal (ADMIN ONLY) */}
        <ErrorLogsModal
          isOpen={isLogsModalOpen && currentUser?.role === 'admin'}
          onClose={() => setIsLogsModalOpen(false)}
          lang={lang}
        />

        {/* Database Auth Login & Registration Modal */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
        />

        {/* Full Admin Dashboard Modal (ADMIN ONLY) */}
        <AdminDashboardModal
          isOpen={isAdminModalOpen && currentUser?.role === 'admin'}
          onClose={() => setIsAdminModalOpen(false)}
          currentUser={currentUser}
          token={token}
          lang={lang}
        />

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-medium text-slate-700">
            {lang === 'vi'
              ? 'RoleMatch — AI hỗ trợ phân tích CV & JD minh bạch, bảo mật và có trách nhiệm.'
              : 'RoleMatch — AI-powered CV & JD analysis with transparency, security, and accountability.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
