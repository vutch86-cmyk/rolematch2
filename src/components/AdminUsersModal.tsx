import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, X, ShieldCheck, UserCheck, Plus, Trash2, Edit2, Key, Check, AlertCircle, Search, RefreshCw, Lock, Unlock } from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { Language } from '../utils/i18n';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  token: string | null;
  lang: Language;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  token,
  lang,
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New/Edit User Form State
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('normal');

  const formatError = (err: any, defaultMsg: string): string => {
    let msg = typeof err === 'string' ? err : err?.message || defaultMsg;
    if (
      msg.includes('Unexpected token') ||
      msg.includes('is not valid JSON') ||
      msg.includes('<!doctype') ||
      msg.includes('<!DOCTYPE') ||
      msg.includes('<html')
    ) {
      return lang === 'vi'
        ? 'Phản hồi từ máy chủ không hợp lệ. Vui lòng thử lại sau.'
        : 'Invalid response from server. Please try again later.';
    }
    return msg;
  };

  const safeFetch = async (
    url: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; data: any }> => {
    try {
      const headers = new Headers(options.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(url, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();
      let data: any = {};
      const trimmed = text.trim();
      if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: 'Lỗi định dạng dữ liệu phản hồi.' };
        }
      } else {
        if (!res.ok) {
          data = { error: `Máy chủ phản hồi mã lỗi ${res.status}. Vui lòng thử lại.` };
        } else {
          data = { error: 'Phản hồi từ máy chủ không đúng định dạng JSON.' };
        }
      }
      return { ok: res.ok && data.success !== false, data };
    } catch (err: any) {
      return { ok: false, data: { error: err.message || 'Lỗi kết nối máy chủ.' } };
    }
  };

  const fetchUsers = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { ok, data } = await safeFetch('/api/admin/users');
      if (!ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch users.');
      }
      setUsers(data.users || []);
    } catch (err: any) {
      setErrorMsg(formatError(err, 'Lỗi khi tải danh sách người dùng.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [isOpen, currentUser, token]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErrorMsg('');

    try {
      const body = {
        id: editId || undefined,
        username,
        password: password || undefined,
        fullName,
        role,
      };

      const { ok, data } = await safeFetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!ok || !data.success) {
        throw new Error(data.error || 'Failed to save user.');
      }

      // Reset form
      setIsAddingUser(false);
      setEditId(null);
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('normal');

      fetchUsers();
    } catch (err: any) {
      setErrorMsg(formatError(err, 'Lỗi khi lưu thông tin người dùng.'));
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!token) return;
    if (
      !window.confirm(
        lang === 'vi'
          ? `Bạn có chắc chắn muốn xóa tài khoản "${name}" khỏi cơ sở dữ liệu?`
          : `Are you sure you want to delete account "${name}"?`
      )
    ) {
      return;
    }

    try {
      const { ok, data } = await safeFetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      if (!ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user.');
      }
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(formatError(err, 'Lỗi khi xóa tài khoản.'));
    }
  };

  const handleLockUser = async (id: string, username: string) => {
    if (!token) return;
    if (
      !window.confirm(
        lang === 'vi'
          ? `Bạn có chắc chắn muốn KHÓA tài khoản "${username}"?`
          : `Are you sure you want to LOCK account "${username}"?`
      )
    ) {
      return;
    }

    try {
      const { ok, data } = await safeFetch(`/api/admin/users/${id}/lock`, {
        method: 'POST',
      });
      if (!ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi khóa tài khoản.');
      }
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(formatError(err, 'Lỗi khi khóa tài khoản.'));
    }
  };

  const handleUnlockUser = async (id: string, username: string) => {
    if (!token) return;
    try {
      const { ok, data } = await safeFetch(`/api/admin/users/${id}/unlock`, {
        method: 'POST',
      });
      if (!ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi mở khóa tài khoản.');
      }
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(formatError(err, 'Lỗi khi mở khóa tài khoản.'));
    }
  };

  const handleStartEdit = (user: UserAccount) => {
    setEditId(user.id);
    setUsername(user.username);
    setFullName(user.fullName);
    setRole(user.role);
    setPassword('');
    setIsAddingUser(true);
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>{lang === 'vi' ? 'Quản Lý Tài Khoản Cơ Sở Dữ Liệu' : 'Database User Management'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    ADMIN PANEL
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'vi'
                    ? 'Quản lý phân quyền tài khoản Admin và Normal User trong hệ thống'
                    : 'Manage Admin & Normal user accounts stored in the database'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                disabled={isLoading}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="m-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'vi' ? 'Tìm tài khoản...' : 'Search accounts...'}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={() => {
                setIsAddingUser(!isAddingUser);
                setEditId(null);
                setUsername('');
                setPassword('');
                setFullName('');
                setRole('normal');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 cursor-pointer transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingUser ? (lang === 'vi' ? 'Đóng form' : 'Close Form') : (lang === 'vi' ? 'Thêm tài khoản' : 'Add User')}</span>
            </button>
          </div>

          {/* Form to Add / Edit User */}
          {isAddingUser && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSaveUser}
              className="p-4 bg-slate-950 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {lang === 'vi' ? 'Tên đăng nhập' : 'Username'}
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editId}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. user2"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {lang === 'vi' ? 'Họ và tên' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Trần Thị B"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {lang === 'vi' ? 'Phân quyền Account' : 'User Role'}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
                >
                  <option value="normal">Normal Account (Người dùng)</option>
                  <option value="admin">Admin Account (Quản trị viên)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  {editId
                    ? lang === 'vi'
                      ? 'Mật khẩu mới (Để trống nếu không đổi)'
                      : 'New Password (Leave blank to keep)'
                    : lang === 'vi'
                    ? 'Mật khẩu'
                    : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editId}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {lang === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  {editId ? (lang === 'vi' ? 'Cập Nhật' : 'Update User') : (lang === 'vi' ? 'Lưu Tài Khoản' : 'Save Account')}
                </button>
              </div>
            </motion.form>
          )}

          {/* Users List */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {lang === 'vi' ? 'Không tìm thấy tài khoản nào.' : 'No accounts found.'}
              </div>
            ) : (
              filteredUsers.map((u, idx) => {
                const isAdmin = u.role === 'admin';
                const isSelf = currentUser?.id === u.id;

                return (
                  <div
                    key={`${u.id || 'usr'}-${idx}`}
                    className="p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isAdmin
                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                            : 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
                        }`}
                      >
                        {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{u.fullName}</span>
                          <span className="font-mono text-[11px] text-slate-400">(@{u.username})</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {lang === 'vi' ? 'Bạn' : 'You'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              isAdmin
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {isAdmin ? 'ADMIN' : 'NORMAL ACCOUNT'}
                          </span>

                          {u.isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              <Lock className="w-3 h-3 text-rose-400" /> BỊ KHÓA
                            </span>
                          ) : (
                            !isAdmin && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                🟢 HOẠT ĐỘNG
                              </span>
                            )
                          )}

                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {u.isLocked && (
                        <button
                          onClick={() => handleUnlockUser(u.id, u.username)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-bold text-xs transition-colors cursor-pointer"
                          title="Mở khóa tài khoản này"
                        >
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{lang === 'vi' ? 'Mở Khóa' : 'Unlock'}</span>
                        </button>
                      )}

                      {!u.isLocked && !isAdmin && !isSelf && (
                        <button
                          onClick={() => handleLockUser(u.id, u.username)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-bold text-xs transition-colors cursor-pointer"
                          title="Khóa thủ công tài khoản này"
                        >
                          <Lock className="w-3.5 h-3.5 text-rose-400" />
                          <span>{lang === 'vi' ? 'Khóa' : 'Lock'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleStartEdit(u)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
                        title={lang === 'vi' ? 'Chỉnh sửa / Đổi mật khẩu' : 'Edit / Change Password'}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                      </button>

                      {!isSelf && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                          title={lang === 'vi' ? 'Xóa tài khoản' : 'Delete Account'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>{lang === 'vi' ? 'Cơ sở dữ liệu người dùng được lưu trữ an toàn' : 'Database accounts stored securely'}</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
            >
              {lang === 'vi' ? 'Đóng' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
