import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Lock, User, ShieldCheck, UserCheck, AlertCircle, Sparkles, Briefcase, FileSearch, Globe, Mail } from 'lucide-react';
import { UserAccount } from '../types';
import { Language, translations } from '../utils/i18n';

interface StandaloneLoginPageProps {
  onLoginSuccess: (user: UserAccount, token: string) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
}

export const StandaloneLoginPage: React.FC<StandaloneLoginPageProps> = ({
  onLoginSuccess,
  lang,
  onLangChange,
}) => {
  const t = translations[lang].login;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLockedState, setIsLockedState] = useState<boolean>(false);
  const [isAlreadyLoggedInState, setIsAlreadyLoggedInState] = useState<boolean>(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleQuickFill = () => {
    setMode('login');
    setErrorMsg('');
    setIsLockedState(false);
    setRemainingAttempts(null);
    setUsername('user1');
    setPassword('userpassword');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLockedState(false);
    setIsAlreadyLoggedInState(false);
    setRemainingAttempts(null);
    setIsLoading(true);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body =
      mode === 'login'
        ? { username, password }
        : { username, password, fullName: fullName || username };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let text = '';
      let data: any = {};
      try {
        text = await res.text();
        if (text && text.trim().startsWith('{')) {
          data = JSON.parse(text);
        } else {
          // HTML or unparseable response
          if (res.status === 403) {
            data = {
              isLocked: true,
              error: lang === 'vi' 
                ? 'Tài khoản của bạn đã bị TỰ ĐỘNG KHÓA do nhập sai mật khẩu quá 5 lần. Vui lòng liên hệ Admin để được mở khóa.' 
                : 'Your account has been AUTOMATICALLY LOCKED due to entering incorrect password more than 5 times. Please contact Admin to unlock.',
            };
          } else {
            data = {
              error: lang === 'vi' 
                ? 'Không thể xử lý phản hồi từ máy chủ. Vui lòng thử lại sau giây lát.' 
                : 'Unable to process server response. Please try again shortly.',
            };
          }
        }
      } catch {
        data = { error: lang === 'vi' ? 'Lỗi đọc dữ liệu phản hồi từ máy chủ.' : 'Error reading server response data.' };
      }

      if (!res.ok || !data.success) {
        const isActuallyLocked = (data.isLocked === true || res.status === 403) && !data.isAlreadyLoggedIn;

        if (isActuallyLocked) {
          setIsLockedState(true);
        } else {
          setIsLockedState(false);
          if (typeof data.remainingAttempts === 'number') {
            setRemainingAttempts(data.remainingAttempts);
          }
        }

        if (data.isAlreadyLoggedIn) {
          setIsAlreadyLoggedInState(true);
        } else {
          setIsAlreadyLoggedInState(false);
        }

        let friendlyErr = data.error || (lang === 'vi' ? 'Đã có lỗi xảy ra khi xác thực.' : 'Authentication error.');
        if (friendlyErr.includes('Unexpected token') || friendlyErr.includes('is not valid JSON') || friendlyErr.includes('<html>')) {
          if (isActuallyLocked) {
            friendlyErr = lang === 'vi' ? 'Tài khoản của bạn đã bị KHÓA. Vui lòng liên hệ Admin để mở khóa.' : 'Your account has been LOCKED. Please contact Admin to unlock.';
          } else {
            friendlyErr = lang === 'vi' ? 'Hệ thống đang bận. Vui lòng thử lại sau vài giây hoặc liên hệ Admin.' : 'System busy. Please try again in a few seconds or contact Admin.';
          }
        }
        throw new Error(friendlyErr);
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      let msg = err.message || (lang === 'vi' ? 'Lỗi kết nối máy chủ.' : 'Server connection error.');
      if (msg.includes('Unexpected token') || msg.includes('is not valid JSON') || msg.includes('<html>')) {
        msg = lang === 'vi' ? 'Không thể xử lý phản hồi từ máy chủ. Vui lòng thử lại sau.' : 'Unable to process server response. Please try again later.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Bar / Brand Bar */}
      <header className="px-6 py-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-600/10">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-100 tracking-tight">
              {t.brandTitle}
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              {t.subtitle}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t.subDescription}
            </p>
          </div>
        </div>

        <button
          onClick={() => onLangChange(lang === 'vi' ? 'en' : 'vi')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{lang === 'vi' ? 'English' : 'Tiếng Việt'}</span>
        </button>
      </header>

      {/* Main Login Card Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
        >
          {/* Top Hero Accent */}
          <div className="p-6 pb-5 border-b border-slate-800/80 bg-gradient-to-b from-indigo-950/40 to-transparent">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-100">
              {t.authHeader}
            </h2>
          </div>

          {/* Quick Preset Button for Normal Account */}
          <div className="p-4 bg-slate-950/70 border-b border-slate-800/80">
            <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.quickDemo}</span>
            </div>
            <div>
              <button
                type="button"
                onClick={handleQuickFill}
                className="w-full p-2.5 rounded-2xl bg-sky-950/50 hover:bg-sky-900/60 border border-sky-500/30 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-300">
                  <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t.normalAccount}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  user1 / userpassword
                </div>
              </button>
            </div>
          </div>

          {/* Login Form or Locked Screen */}
          <div className="p-6">
            {isLockedState ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-gradient-to-br from-rose-950/90 via-slate-900 to-rose-950/80 border-2 border-rose-500/60 rounded-2xl text-slate-100 shadow-2xl shadow-rose-950/40 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400 mt-0.5 animate-bounce shadow-lg shadow-rose-500/20">
                    <Lock className="w-6 h-6 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-rose-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <span>{t.lockedTitle}</span>
                    </h3>
                    <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                      {t.lockedDesc1} <span className="font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40">@{username || 'user'}</span> {t.lockedDesc2}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-rose-500/30 text-xs space-y-1 text-slate-300">
                  <div className="font-bold text-rose-300 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>{t.lockReasonTitle}</span>
                  </div>
                  <p className="text-slate-300 pl-4 border-l-2 border-rose-500/40">
                    {t.lockReasonDesc}
                  </p>
                </div>

                <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/30 text-xs space-y-1 text-slate-300">
                  <div className="font-bold text-indigo-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t.unlockTitle}</span>
                  </div>
                  <p className="text-slate-300">
                    {t.unlockDesc}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLockedState(false);
                      setErrorMsg('');
                      setRemainingAttempts(null);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    {t.tryAgain}
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-start gap-2.5 shadow-lg shadow-amber-950/20"
                  >
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-300">{t.wrongPassword}</div>
                      <div className="text-[11px] text-amber-200/90 mt-0.5">
                        {t.attemptsWarning1} <span className="font-black text-amber-300 underline underline-offset-2">{remainingAttempts} {lang === 'vi' ? 'lần thử' : 'attempts'}</span> {t.attemptsWarning2}
                      </div>
                    </div>
                  </motion.div>
                )}

                {isAlreadyLoggedInState && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-start gap-2.5 shadow-lg shadow-amber-950/20"
                  >
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-300">{t.activeSessionTitle}</div>
                      <div className="text-[11px] text-amber-200/90 leading-relaxed">
                        {errorMsg || t.activeSessionDefault}
                      </div>
                    </div>
                  </motion.div>
                )}

                {errorMsg && !isLockedState && !isAlreadyLoggedInState && (remainingAttempts === null || remainingAttempts === 0) && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.usernameLabel}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="user1..."
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.passwordLabel}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{t.loginButton}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-900/60 text-center text-xs text-slate-500 space-y-1">
        <p className="text-slate-400 text-[11px] whitespace-nowrap overflow-x-auto px-2">{t.disclaimer}</p>
        <p className="text-slate-500">{t.footerCopyright}</p>
      </footer>
    </div>
  );
};
