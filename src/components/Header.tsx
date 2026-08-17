import React from 'react';
import { Briefcase, FileSearch, Sparkles, RefreshCw, Globe, History, ShieldCheck, Terminal, LogIn, LogOut, User, Users } from 'lucide-react';
import { Language, translations } from '../utils/i18n';
import { UserAccount } from '../types';

interface HeaderProps {
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
}

export const Header: React.FC<HeaderProps> = ({
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
}) => {
  const t = translations[lang].header;
  const tHistory = translations[lang].history;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-emerald-500 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-100 tracking-tight">
                {t.title}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {t.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* USER AUTH STATUS / LOGIN BUTTON */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 p-1 pl-2.5 rounded-xl text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${currentUser.role === 'admin' ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'}`} />
                <span className="font-bold text-slate-200 hidden xs:inline max-w-[100px] truncate">{currentUser.fullName}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'ADMIN' : 'USER'}
                </span>
              </div>

              {/* Admin Dashboard Button if admin */}
              {currentUser.role === 'admin' && onOpenAdminPanel && (
                <button
                  onClick={onOpenAdminPanel}
                  className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg font-bold text-[11px] border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-500/10"
                  title={lang === 'vi' ? 'Mở Bảng Quản Trị Admin Dashboard' : 'Open Admin Dashboard'}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">{lang === 'vi' ? 'Admin Dashboard' : 'Admin Dashboard'}</span>
                </button>
              )}

              <button
                onClick={onLogout}
                className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer ml-1"
                title={lang === 'vi' ? 'Đăng xuất' : 'Log Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đăng Nhập' : 'Log In'}</span>
            </button>
          )}



          {/* History Drawer Trigger Button */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer relative"
              title={tHistory.openHistory}
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xs:inline">{tHistory.buttonLabel}</span>
              {historyCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white">
                  {historyCount}
                </span>
              )}
            </button>
          )}

          {/* Language Switcher Toggle */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/80 shadow-inner">
            <div className="px-2 text-slate-400 flex items-center gap-1 text-xs font-medium hidden xs:flex">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <button
              onClick={() => onLangChange('vi')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                lang === 'vi'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tiếng Việt"
            >
              VN
            </button>
            <button
              onClick={() => onLangChange('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                lang === 'en'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="English"
            >
              EN
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.tagline}</span>
          </div>

          {hasData && onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer"
              title={t.reanalyze}
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">{t.reanalyze}</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
};



