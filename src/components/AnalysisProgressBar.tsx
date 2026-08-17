import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Loader2, FileSearch, Wand2, FileCheck, Clock, Cpu } from 'lucide-react';

interface AnalysisProgressBarProps {
  isLoading: boolean;
  lang?: 'vi' | 'en';
}

export const AnalysisProgressBar: React.FC<AnalysisProgressBarProps> = ({
  isLoading,
  lang = 'vi',
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      setProgress(0);
      return;
    }

    setElapsedSeconds(0);
    setProgress(5);

    // Timer for elapsed seconds
    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Smooth asymptotic progress calculation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Asymptotic curve: fast initially, then slows down smoothly towards ~98% over 60-120s
        if (prev < 30) return prev + Math.floor(Math.random() * 3) + 1; // 0 - 30%
        if (prev < 65) return prev + Math.floor(Math.random() * 2) + 1; // 30 - 65%
        if (prev < 88) return prev + (Math.random() > 0.4 ? 1 : 0); // 65 - 88%
        if (prev < 98) return prev + (Math.random() > 0.7 ? 1 : 0); // 88 - 98% smoothly
        return prev;
      });
    }, 600);

    return () => {
      clearInterval(timerInterval);
      clearInterval(progressInterval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  // Determine active step based on time & progress
  const activeStep = elapsedSeconds < 10 ? 1 : elapsedSeconds < 25 ? 2 : 3;

  // Real-time status sub-message based on elapsed time
  const getSubStatusMessage = () => {
    if (lang === 'vi') {
      if (elapsedSeconds < 10) return 'Trích xuất từ khóa JD, bóc tách yêu cầu bắt buộc & cấu trúc CV...';
      if (elapsedSeconds < 25) return 'Đối chiếu kinh nghiệm, tối ưu các bullet point theo công thức Action + Outcome...';
      if (elapsedSeconds < 41) return 'Mô phỏng đánh giá 10s từ Nhà tuyển dụng & chấm điểm độ khớp ATS...';
      return 'Tổng hợp báo cáo phân tích chuyên sâu & tạo các gợi ý nâng cấp...';
    } else {
      if (elapsedSeconds < 10) return 'Extracting JD keywords, essential qualifications & CV structure...';
      if (elapsedSeconds < 25) return 'Matching experience, optimizing bullet points using Action + Outcome formula...';
      if (elapsedSeconds < 41) return 'Simulating 10s Recruiter screening & calculating ATS compatibility score...';
      return 'Synthesizing comprehensive analysis report & custom enhancement recommendations...';
    }
  };

  const steps = [
    {
      id: 1,
      title: lang === 'vi' ? 'Trích xuất & Đối chiếu' : 'Extract & Match',
      subtitle:
        lang === 'vi'
          ? 'Phân tích JD, bóc tách kỹ năng chuyên môn & yêu cầu bắt buộc'
          : 'Analyzing JD & isolating essential skills and requirements',
      icon: FileSearch,
    },
    {
      id: 2,
      title: lang === 'vi' ? 'Tối ưu nội dung CV' : 'Optimize CV Content',
      subtitle:
        lang === 'vi'
          ? 'Chỉnh sửa bullet point theo chuẩn Action + Tool + Outcome'
          : 'Rewriting bullet points with Action + Tool + Outcome standard',
      icon: Wand2,
    },
    {
      id: 3,
      title: lang === 'vi' ? 'Đánh giá & Hoàn tất' : 'Evaluate & Finalize',
      subtitle:
        lang === 'vi'
          ? 'Tính điểm khớp vai trò & mô phỏng đánh giá 10s từ Recruiter'
          : 'Computing role match score & simulating 10s Recruiter screening',
      icon: FileCheck,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 p-5 sm:p-7 shadow-sm space-y-5 my-6 animate-fade-in">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 relative">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-ping" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>{lang === 'vi' ? 'Đang phân tích & tối ưu CV' : 'Analyzing & Optimizing CV'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                <span>AI Pipeline</span>
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'vi'
                ? 'Hệ thống AI đang xử lý đối chiếu và phân tích chuyên sâu'
                : 'AI engine executing multi-stage extraction, matching, and critique'}
            </p>
          </div>
        </div>

        {/* Live Elapsed Time & Progress percentage */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 bg-slate-900 text-slate-100 px-3 py-1.5 rounded-xl text-xs font-mono font-medium shadow-sm">
            <Clock className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span>{elapsedSeconds}s</span>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-indigo-600 font-medium hidden sm:inline">
              {lang === 'vi' ? 'Tiến độ:' : 'Progress:'}
            </span>
            <span className="text-sm font-black text-indigo-700 font-mono">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Main Progress Bar Container */}
      <div className="space-y-2">
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
          <div
            className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 h-2 rounded-full transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer light animation */}
            <div className="absolute inset-0 bg-white/25 animate-pulse rounded-full" />
          </div>
        </div>

        {/* Live Micro Status Message */}
        <div className="flex items-center justify-between text-xs text-slate-600 px-1 pt-0.5 font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
            <span className="truncate text-indigo-950 font-semibold">{getSubStatusMessage()}</span>
          </div>
          <span className="text-[11px] text-slate-400 shrink-0 ml-2 hidden md:inline">
            {lang === 'vi' ? 'Thời gian xử lý trung bình trong 1-2 phút' : 'Avg response time 1-2 minutes'}
          </span>
        </div>
      </div>

      {/* Steps List Visual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {steps.map((step) => {
          const isDone = activeStep > step.id;
          const isCurrent = activeStep === step.id;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border transition-all duration-300 flex items-start gap-3 ${
                isDone
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  : isCurrent
                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'bg-slate-50/50 border-slate-200/60 text-slate-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  step.id
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <StepIcon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isDone
                        ? 'text-emerald-600'
                        : isCurrent
                        ? 'text-indigo-600'
                        : 'text-slate-400'
                    }`}
                  />
                  <h4
                    className={`text-xs font-bold truncate ${
                      isDone
                        ? 'text-emerald-900'
                        : isCurrent
                        ? 'text-indigo-950'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.title}
                  </h4>
                </div>
                <p
                  className={`text-[11px] mt-1 leading-snug line-clamp-2 ${
                    isDone
                      ? 'text-emerald-700/80'
                      : isCurrent
                      ? 'text-indigo-800/80'
                      : 'text-slate-400'
                  }`}
                >
                  {step.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

