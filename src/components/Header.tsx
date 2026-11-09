import React from 'react';
import { FileSearch, Sparkles, RefreshCw, Globe, History, ShieldCheck, LogOut, User, Users, Layers } from 'lucide-react';
import { Language, translations } from '../utils/i18n';
import { UserAccount } from '../types';

export interface HeaderProps {
  onReset?: () => void;
  hasData?: boolean;
  lang: Language;
  onLangChange: (lang: Language) => void;
  historyCount?: number;
  onOpenHistory?: () => void;
  onOpenLogs?: () => void;
  logsCount?: number;
  currentUser: UserAccount | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
  appMode?: 'single' | 'batch';
  onAppModeChange?: (mode: 'single' | 'batch') => void;
}

export const Header = React.forwardRef<HTMLElement, HeaderProps>(({
  onReset,
  hasData,
  lang,
  onLangChange,
  historyCount = 0,
  onOpenHistory,
  onOpenLogs,
  logsCount = 0,
  currentUser,
  onOpenLogin,
  onLogout,
  onOpenAdminPanel,
  appMode = 'single',
  onAppModeChange,
}, ref) => {
  const t = translations[lang].header;
  const tHistory = translations[lang].history;

  return (
    <header ref={ref} className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-900 sticky top-0 z-30 shadow-xs transition-all">
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 min-h-[4rem] py-2 sm:py-0 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-xs shadow-blue-500/20 shrink-0">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                {t.title}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Sparkles className="w-3 h-3 text-blue-600" />
                {t.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden lg:block">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Center Pill Switch: Candidate vs Recruiter */}
        {onAppModeChange && (
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200/90 flex items-center text-xs shadow-inner">
            <button
              onClick={() => onAppModeChange('single')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                appMode === 'single'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Ứng viên' : 'Candidate'}</span>
            </button>
            <button
              onClick={() => onAppModeChange('batch')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                appMode === 'batch'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="relative">
                {lang === 'vi' ? 'Nhà tuyển dụng' : 'Recruiter'}
                <span className="absolute -top-1 -right-2.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              </span>
            </button>
          </div>
        )}

        {/* Right Actions Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Reset App State Button */}
          {hasData && onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
              title={t.resetTooltip}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.reset}</span>
            </button>
          )}

          {/* Candidate History Drawer Trigger */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all cursor-pointer"
              title={tHistory.title}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tHistory.title}</span>
              {historyCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                  {historyCount}
                </span>
              )}
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => onLangChange(lang === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
            title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-bold">{lang.toUpperCase()}</span>
          </button>

          {/* User Account / Admin Badge / Login */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 p-1 pl-2.5 rounded-xl text-xs shadow-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-slate-900 text-xs max-w-[100px] sm:max-w-[140px] truncate" title={currentUser.fullName || currentUser.username}>
                  {currentUser.fullName || currentUser.username}
                </span>
                {currentUser.role === 'admin' && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                    ADMIN
                  </span>
                )}
              </div>

              {currentUser.role === 'admin' && onOpenAdminPanel && (
                <button
                  onClick={onOpenAdminPanel}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-xs border border-amber-200 transition-all flex items-center gap-1 cursor-pointer shadow-xs ml-1"
                  title={lang === 'vi' ? 'Mở Bảng Quản Trị Admin Dashboard' : 'Open Admin Dashboard'}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden md:inline">Admin</span>
                </button>
              )}

              <button
                onClick={onLogout}
                className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-1"
                title={lang === 'vi' ? 'Đăng xuất' : 'Log Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#1a73e8] hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đăng Nhập' : 'Log In'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
