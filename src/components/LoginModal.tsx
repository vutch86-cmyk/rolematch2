import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, X, Lock, User, ShieldCheck, UserCheck, Key, AlertCircle, Sparkles, Mail } from 'lucide-react';
import { UserAccount } from '../types';
import { Language } from '../utils/i18n';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserAccount, token: string) => void;
  lang: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  lang,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLockedState, setIsLockedState] = useState<boolean>(false);
  const [isAlreadyLoggedInState, setIsAlreadyLoggedInState] = useState<boolean>(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  if (!isOpen) return null;

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
              error: 'Tài khoản của bạn đã bị TỰ ĐỘNG KHÓA do nhập sai mật khẩu quá 5 lần. Vui lòng liên hệ Admin để được mở khóa.',
            };
          } else {
            data = {
              error: 'Không thể xử lý phản hồi từ máy chủ. Vui lòng thử lại sau giây lát.',
            };
          }
        }
      } catch {
        data = { error: 'Lỗi đọc dữ liệu phản hồi từ máy chủ.' };
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

        let friendlyErr = data.error || (lang === 'vi' ? 'Đã có lỗi xảy ra.' : 'An error occurred.');
        if (friendlyErr.includes('Unexpected token') || friendlyErr.includes('is not valid JSON') || friendlyErr.includes('<html>')) {
          if (isActuallyLocked) {
            friendlyErr = 'Tài khoản của bạn đã bị KHÓA. Vui lòng liên hệ Admin để mở khóa.';
          } else {
            friendlyErr = 'Hệ thống đang bận. Vui lòng thử lại sau vài giây hoặc liên hệ Admin.';
          }
        }
        throw new Error(friendlyErr);
      }

      onLoginSuccess(data.user, data.token);
      onClose();
      // Reset form
      setUsername('');
      setPassword('');
      setFullName('');
      setIsLockedState(false);
      setRemainingAttempts(null);
    } catch (err: any) {
      let msg = err.message || 'Lỗi kết nối máy chủ.';
      if (msg.includes('Unexpected token') || msg.includes('is not valid JSON') || msg.includes('<html>')) {
        msg = 'Không thể xử lý phản hồi từ máy chủ. Vui lòng thử lại sau.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  {lang === 'vi' ? 'Đăng Nhập System' : 'Account Login'}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Demo Credentials */}
          <div className="p-4 bg-slate-950/60 border-b border-slate-800/80">
            <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'vi' ? 'Tài khoản thử nghiệm nhanh:' : 'Quick test account:'}</span>
            </div>
            <div>
              <button
                type="button"
                onClick={handleQuickFill}
                className="w-full p-2.5 rounded-xl bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Normal Account</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  user1 / userpassword
                </div>
              </button>
            </div>
          </div>

          {/* Locked Account Prominent UI vs Normal Form */}
          <div className="p-6">
            {isLockedState ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-gradient-to-br from-rose-950/90 via-slate-900 to-rose-950/80 border-2 border-rose-500/60 rounded-2xl text-slate-100 shadow-2xl shadow-rose-950/40 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400 mt-0.5 animate-bounce">
                    <Lock className="w-6 h-6 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-rose-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <span>🔒 TÀI KHOẢN ĐÃ BỊ KHÓA BẢO MẬT</span>
                    </h3>
                    <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                      Tài khoản <span className="font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40">@{username || 'user'}</span> hiện đã bị khóa quyền đăng nhập.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-rose-500/30 text-xs space-y-1 text-slate-300">
                  <div className="font-bold text-rose-300 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Lý do tài khoản bị khóa:</span>
                  </div>
                  <p className="text-slate-300 pl-4 border-l-2 border-rose-500/40">
                    Nhập sai mật khẩu 5 lần liên tiếp hoặc do Quản trị viên (Admin) chủ động khóa bảo vệ.
                  </p>
                </div>

                <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/30 text-xs space-y-1 text-slate-300">
                  <div className="font-bold text-indigo-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Cách mở khóa tài khoản:</span>
                  </div>
                  <p className="text-slate-300">
                    Vui lòng liên hệ với <strong>Quản trị viên (Admin)</strong> để thực hiện mở khóa tài khoản.
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
                    ← Thử lại / Đổi tài khoản
                  </button>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start gap-2.5 shadow-lg shadow-amber-950/20"
                  >
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-300">⚠️ Mật khẩu không chính xác!</div>
                      <div className="text-[11px] text-amber-200/90 mt-0.5">
                        Cảnh báo: Bạn còn <span className="font-black text-amber-300 underline underline-offset-2">{remainingAttempts} lần thử</span> trước khi tài khoản bị KHÓA tự động.
                      </div>
                    </div>
                  </motion.div>
                )}

                {isAlreadyLoggedInState && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start gap-2.5 shadow-lg shadow-amber-950/20"
                  >
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-300">⚠️ ĐANG CÓ PHIÊN ĐĂNG NHẬP HOẠT ĐỘNG!</div>
                      <div className="text-[11px] text-amber-200/90 leading-relaxed">
                        {errorMsg || 'Tài khoản này hiện đang đăng nhập ở một thiết bị hoặc trình duyệt khác. Để bảo mật, mỗi tài khoản chỉ được phép đăng nhập tại 1 thời điểm.'}
                      </div>
                    </div>
                  </motion.div>
                )}

                {errorMsg && !isLockedState && !isAlreadyLoggedInState && (remainingAttempts === null || remainingAttempts === 0) && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {lang === 'vi' ? 'Tên đăng nhập (Username)' : 'Username'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="user1..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {lang === 'vi' ? 'Mật khẩu' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : mode === 'login' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Đăng Nhập' : 'Log In'}</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>{lang === 'vi' ? 'Đăng Ký Tài Khoản' : 'Register Account'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
