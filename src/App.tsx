import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { KeywordMatchTab } from './components/KeywordMatchTab';
import { BulletPointRewriteTab } from './components/BulletPointRewriteTab';
import { RecruiterScanTab } from './components/RecruiterScanTab';
import { InterviewPrepTab } from './components/InterviewPrepTab';
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
import { CandidateGuideDrawer } from './components/CandidateGuideDrawer';
import { parseApiResponseSafely } from './utils/apiResponse';
import {
  extractJobMetaFromJdText,
  formatCandidateHistoryTitle,
  enrichAndMigrateHistoryItem,
  isLegacyKeywordHistoryTitle,
} from './utils/jdTitleExtractor';
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
  BookOpen,
} from 'lucide-react';

const LOCAL_STORAGE_CV_KEY = 'cv_matcher_cvText';
const LOCAL_STORAGE_JD_KEY = 'cv_matcher_jdText';
const LOCAL_STORAGE_HISTORY_KEY = 'cv_matcher_history';

async function fetchWithRetry(url: string, options: RequestInit, requestId?: string, retries = 2, delayMs = 1200): Promise<Response> {
  let lastError: any = null;
  const headers = new Headers(options.headers || {});
  if (requestId && !headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', requestId);
  }
  const updatedOptions = { ...options, headers };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, updatedOptions);
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

  // History state from localStorage (automatically migrates legacy titles like "Vị trí <keyword> - <user>")
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed)
        ? parsed.map((item: HistoryItem) => enrichAndMigrateHistoryItem(item, 'vi'))
        : [];
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
  const [isCandidateGuideOpen, setIsCandidateGuideOpen] = useState<boolean>(false);

  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const lastActivity = localStorage.getItem('role_match_last_activity');
    if (savedToken) {
      if (lastActivity && Date.now() - Number(lastActivity) > SESSION_TIMEOUT_MS) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('role_match_last_activity');
        setCurrentUser(null);
        setToken(null);
        setError(lang === 'vi' ? 'Phiên làm việc đã hết hạn sau 30 phút không hoạt động.' : 'Session expired after 30 minutes of inactivity.');
        setIsLoginModalOpen(true);
        return;
      }
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
            setToken(savedToken);
            if (!localStorage.getItem('role_match_last_activity')) {
              localStorage.setItem('role_match_last_activity', String(Date.now()));
            }
          } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('role_match_last_activity');
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
      localStorage.setItem('role_match_last_activity', String(Date.now()));
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
      localStorage.removeItem('role_match_last_activity');
    } catch (e) {}
  };

  // Activity tracker & inactivity auto logout (30 minutes for all users including admins)
  useEffect(() => {
    if (!token) return;

    if (!localStorage.getItem('role_match_last_activity')) {
      localStorage.setItem('role_match_last_activity', String(Date.now()));
    }

    let lastThrottle = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottle > 10000) {
        lastThrottle = now;
        try {
          localStorage.setItem('role_match_last_activity', String(now));
        } catch (e) {}
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, handleUserActivity));

    const interval = setInterval(() => {
      const lastAct = localStorage.getItem('role_match_last_activity');
      if (lastAct && Date.now() - Number(lastAct) > SESSION_TIMEOUT_MS) {
        handleLogout();
        setError(lang === 'vi' ? 'Phiên làm việc đã tự động đăng xuất sau 30 phút không có tương tác.' : 'Session automatically signed out after 30 minutes of inactivity.');
        setIsLoginModalOpen(true);
      }
    }, 15000);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
      clearInterval(interval);
    };
  }, [token, lang]);

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

  // Re-normalize any legacy history items when currentUser or lang changes
  useEffect(() => {
    setHistoryItems((prev) =>
      prev.map((item) =>
        enrichAndMigrateHistoryItem(item, lang, currentUser?.username || null)
      )
    );
  }, [currentUser?.username, lang]);

  const [appMode, setAppMode] = useState<'single' | 'batch'>('single');
  const [activeTab, setActiveTab] = useState<'feature1' | 'feature2' | 'feature3' | 'feature4'>('feature3');
  const tabsHeaderRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: 'feature1' | 'feature2' | 'feature3' | 'feature4') => {
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
  const [jdSourceLabel, setJdSourceLabel] = useState<string | null>(null);

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

    const requestId = 'req_cand_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    try {
      const res = await fetchWithRetry('/api/analyze-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          cvText,
          jdText,
          clarifyingAnswers,
          lang,
          requestId,
        }),
      }, requestId);

      const data = await parseApiResponseSafely<CompleteCVAnalysisResponse>(res, lang as 'vi' | 'en', requestId);

      setAnalysis(data as any);
      setCheckedActions([false, false, false, false, false]);

      if (!clarifyingAnswers) {
        setActiveTab('feature3');
      }

      // Save report to history with "[Company Name] - [Job Title]" format
      const safePresetRoleTitle = !isLegacyKeywordHistoryTitle(currentRoleTitle)
        ? currentRoleTitle.trim()
        : '';
      const extractedMeta = extractJobMetaFromJdText(
        jdText,
        jdSourceLabel || safePresetRoleTitle || null
      );
      const aiCompanyName = typeof (data as any)?.companyName === 'string'
        ? (data as any).companyName.trim()
        : '';
      const aiJobTitle = typeof (data as any)?.jobTitle === 'string' && !isLegacyKeywordHistoryTitle((data as any).jobTitle)
        ? (data as any).jobTitle.trim()
        : '';

      const companyName = aiCompanyName || extractedMeta.companyName;
      const jobTitle = aiJobTitle || extractedMeta.jobTitle || safePresetRoleTitle;

      const inferredTitle = formatCandidateHistoryTitle(
        {
          companyName,
          jobTitle,
          fallbackTitle: safePresetRoleTitle,
          currentUsername: currentUser?.username || null,
        },
        lang
      );

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        title: inferredTitle,
        companyName: companyName || undefined,
        jobTitle: jobTitle || undefined,
        jdFileName: jdSourceLabel || undefined,
        timestamp: Date.now(),
        cvText,
        jdText,
        analysis: data as unknown as CompleteCVAnalysisResponse,
        score: (data as any).feature1?.scores?.overallRoleScore || 0,
      };

      setCurrentActiveHistoryId(newHistoryItem.id);
      setHistoryItems((prev) =>
        [newHistoryItem, ...prev.filter((item) => item.id !== newHistoryItem.id)].slice(0, 30)
      );
    } catch (err: any) {
      console.error('Error analyzing CV:', err);
      if (err?.code === 'AUTH_REQUIRED') {
        setIsLoginModalOpen(true);
      }
      const msg = typeof err?.message === 'string' ? err.message : (typeof err === 'string' ? err : (lang === 'vi' ? 'Không thể thực hiện phân tích. Vui lòng thử lại.' : 'Unable to run analysis. Please try again.'));
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefining(false);
    }
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
    const migrated = enrichAndMigrateHistoryItem(item, lang, currentUser?.username || null);
    setCvText(migrated.cvText);
    setJdText(migrated.jdText);
    setAnalysis(migrated.analysis);
    setCurrentRoleTitle(migrated.title);
    setCurrentActiveHistoryId(migrated.id);
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

  const handleRenameHistoryItem = (
    id: string,
    updates: { companyName?: string; jobTitle?: string }
  ) => {
    setHistoryItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextCompany = (updates.companyName ?? item.companyName ?? '').trim();
        const nextRole = (updates.jobTitle ?? item.jobTitle ?? '').trim();
        const nextTitle = formatCandidateHistoryTitle(
          {
            companyName: nextCompany,
            jobTitle: nextRole,
            fallbackTitle: item.title,
            currentUsername: currentUser?.username || null,
          },
          lang
        );
        if (currentActiveHistoryId === id) {
          setCurrentRoleTitle(nextTitle);
        }
        return {
          ...item,
          title: nextTitle,
          companyName: nextCompany || undefined,
          jobTitle: nextRole || undefined,
          isCustomTitle: true,
        };
      })
    );
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
          : (data.error?.message || data.message || (lang === 'vi' ? 'Có lỗi xảy ra khi tạo bản CV cập nhật với Trợ lý AI.' : 'An error occurred while generating updated CV with AI Assistant.'));
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
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-8 space-y-8">

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
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-indigo-900 pointer-events-none hidden md:block">
                <Users className="w-56 h-56" />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                <div className="max-w-3xl space-y-2">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Sparkles className="w-3 h-3" />
                    <span>
                      {lang === 'vi'
                        ? 'CÔNG CỤ PHÂN TÍCH DÀNH CHO ỨNG VIÊN'
                        : 'AI-POWERED CANDIDATE TOOLKIT'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {lang === 'vi'
                      ? 'Phân Tích CV & Tối Ưu Hồ Sơ Ứng Tuyển'
                      : 'CV Analysis & Application Optimization'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                    {lang === 'vi'
                      ? 'So sánh CV với JD, nhận diện điểm mạnh và cơ hội cải thiện.'
                      : 'Compare your CV with the job description and identify areas for improvement.'}
                  </p>
                </div>
                <div className="shrink-0">
                  <button
                    onClick={() => setIsCandidateGuideOpen(true)}
                    title={lang === 'vi' ? "Hướng dẫn sử dụng" : "User Guide"}
                    aria-label={lang === 'vi' ? "Hướng dẫn sử dụng" : "User Guide"}
                    className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer border border-indigo-200/90 whitespace-nowrap"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{lang === 'vi' ? 'Hướng dẫn sử dụng' : 'User Guide'}</span>
                  </button>
                </div>
              </div>
            </div>

        {/* Input Form Section */}
        <InputSection
          cvText={cvText}
          setCvText={setCvText}
          jdText={jdText}
          setJdText={(val) => {
            if (val !== jdText) {
              setCurrentRoleTitle('');
            }
            setJdText(val);
          }}
          onAnalyze={() => handleAnalyze()}
          isLoading={isLoading}
          onSelectPreset={handleSelectPreset}
          lang={lang}
          currentUser={currentUser}
          onJdSourceChange={setJdSourceLabel}
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

                <button
                  onClick={() => handleTabChange('feature4')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'feature4'
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-semibold'
                  }`}
                >
                  <BookOpen className={`w-3.5 h-3.5 ${activeTab === 'feature4' ? 'text-white' : 'text-purple-600'}`} />
                  <span className="hidden xl:inline">{t.tabs.tab4}</span>
                  <span className="inline xl:hidden">{lang === 'vi' ? '4. Phỏng Vấn' : '4. Interview'}</span>
                </button>
              </div>

              {/* Export / Print Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end flex-wrap max-w-full">
                <button
                  onClick={() => handleGenerateUpdatedCv()}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
                  title={lang === 'vi' ? 'Cập nhật toàn bộ CV theo các đề xuất ở mục 6 bằng Trợ lý AI' : 'Generate full updated CV based on Section 6 via AI Assistant'}
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
                  tailoredSummaries={analysis.feature2?.tailoredSummaries}
                  sectionAudit={analysis.feature2?.sectionAudit}
                  companyName={analysis.companyName}
                  jobTitle={analysis.jobTitle}
                  cvText={cvText}
                  jdText={jdText}
                  onRefineWithAnswers={(ans) => handleAnalyze(ans)}
                  isRefining={isRefining}
                  onOpenGenerateUpdatedCv={() => handleGenerateUpdatedCv()}
                  lang={lang}
                />
              )}

              {activeTab === 'feature3' && analysis.feature3 && (
                <RecruiterScanTab result={analysis.feature3} lang={lang} cvText={cvText} jdText={jdText} />
              )}

              {activeTab === 'feature4' && (
                <InterviewPrepTab
                  data={analysis.feature4}
                  lang={lang}
                  cvText={cvText}
                  jdText={jdText}
                  comparisonGaps={analysis.feature1?.comparisonTable}
                  risks={analysis.feature3?.riskMitigationMatrix}
                />
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
            onRequireLogin={() => setIsLoginModalOpen(true)}
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
          onRenameHistoryItem={handleRenameHistoryItem}
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

        {/* Candidate User Guide Drawer */}
        <CandidateGuideDrawer
          isOpen={isCandidateGuideOpen}
          onClose={() => setIsCandidateGuideOpen(false)}
          lang={lang}
        />

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <p className="font-medium text-slate-700">
            {translations[lang].login.disclaimer}
          </p>
        </div>
      </footer>
    </div>
  );
}
