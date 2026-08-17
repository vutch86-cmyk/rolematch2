import React from 'react';
import { RecruiterScanResult } from '../types';
import { Language, translations } from '../utils/i18n';
import {
  UserCheck,
  UserX,
  Eye,
  Zap,
  AlertOctagon,
  TrendingDown,
  Wrench,
  Clock,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface RecruiterScanTabProps {
  result: RecruiterScanResult;
  lang: Language;
}

export const RecruiterScanTab: React.FC<RecruiterScanTabProps> = ({ result, lang }) => {
  const t = translations[lang].recruiterScanTab;

  const getDecisionBadge = () => {
    switch (result.inviteDecision) {
      case 'YES':
        return (
          <div className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wider shadow-md shadow-emerald-500/20">
            <UserCheck className="w-5 h-5" />
            <span>{t.inviteYes}</span>
          </div>
        );
      case 'NO':
        return (
          <div className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wider shadow-md shadow-rose-600/20">
            <UserX className="w-5 h-5" />
            <span>{t.inviteNo}</span>
          </div>
        );
      case 'MAYBE':
      default:
        return (
          <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wider shadow-md shadow-amber-500/20">
            <Clock className="w-5 h-5" />
            <span>{t.inviteMaybe}</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Recruiter Persona Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <Eye className="w-64 h-64 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <Clock className="w-3 h-3 text-rose-400" />
                {lang === 'vi' ? 'Đánh Giá Thực Tế 10 Giây' : 'Real 10-Second Assessment'}
              </span>
              <span className="text-xs text-slate-400">
                {lang === 'vi' ? 'Không khen xã giao - Trực diện - Khắt khe' : 'No flattery - Direct - Strict'}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100">
              {lang === 'vi'
                ? 'Quyết Định Của Nhà Tuyển Dụng Sau 10 Giây Đọc Lướt'
                : 'Recruiter Decision After 10-Second Skim'}
            </h3>
          </div>

          <div className="shrink-0">{getDecisionBadge()}</div>
        </div>

        {/* Reason for decision */}
        <div className="mt-6 bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            {lang === 'vi'
              ? 'Lý do chính khiến Nhà tuyển dụng đưa ra quyết định trên:'
              : 'Main reason for recruiter decision:'}
          </div>
          <p className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed">
            "{result.decisionReason}"
          </p>
        </div>
      </div>

      {/* 6 Questions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Q2: First impression in 10s */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">
                <Eye className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                2. {lang === 'vi' ? 'Ấn Tượng Đầu Tiên Khi Nhìn Lướt CV Trong 10 Giây?' : 'First Impression in 10-Second Skim?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              {result.firstImpression10s}
            </p>
          </div>
        </div>

        {/* Q3: Immediate Strength */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                3. {lang === 'vi' ? 'Điểm Mạnh Nào Đập Vào Mắt Ngay Lập Tức?' : 'Which Strength Immediately Stands Out?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
              {result.immediateStrength}
            </p>
          </div>
        </div>

        {/* Q4: Biggest Doubt */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                4. {lang === 'vi' ? 'Nghi Ngờ Lớn Nhất Về Ứng Viên Này Là Gì?' : 'Biggest Doubt About This Candidate?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-amber-950 leading-relaxed bg-amber-50/70 p-4 rounded-xl border border-amber-100">
              {result.biggestDoubt}
            </p>
          </div>
        </div>

        {/* Q5: Fastest Point Loss Section */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                5. {lang === 'vi' ? 'Phần Nào Trong CV Khiến Bạn Bị Mất Điểm Nhanh Nhất?' : 'Which Section Loses Points the Fastest?'}
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-rose-950 leading-relaxed bg-rose-50/70 p-4 rounded-xl border border-rose-100">
              {result.fastestPointLossSection}
            </p>
          </div>
        </div>
      </div>

      {/* Q6: Top 3 Must Fix Immediately */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-base">
              6. {lang === 'vi' ? '3 Điều Bắt Buộc Phải Sửa Để Tăng Khả Năng Được Gọi Phỏng Vấn' : '3 Must-Fixes to Increase Interview Callbacks'}
            </h4>
            <p className="text-xs text-slate-400">
              {lang === 'vi'
                ? 'Chỉ dẫn hành động từ góc nhìn chiến lược của Senior HR Lead:'
                : 'Actionable guidance from a Senior HR Lead perspective:'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {result.top3MustFix.map((fixItem, idx) => (
            <div
              key={idx}
              className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                  {fixItem}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
