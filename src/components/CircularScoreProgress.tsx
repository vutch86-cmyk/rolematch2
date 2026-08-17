import React from 'react';
import { Language, translations } from '../utils/i18n';

interface CircularScoreProgressProps {
  score: number; // 0 - 100
  size?: number; // width & height in px (default 140)
  strokeWidth?: number; // stroke width in px (default 10)
  title?: string; // Optional label under or above score
  showBadge?: boolean; // Whether to show status badge (e.g. "Rất phù hợp")
  variant?: 'dark' | 'light'; // Theme variant (dark background vs light background)
  className?: string;
  lang?: Language;
}

export const CircularScoreProgress: React.FC<CircularScoreProgressProps> = ({
  score,
  size = 140,
  strokeWidth = 10,
  title,
  showBadge = true,
  variant = 'dark',
  className = '',
  lang = 'vi',
}) => {
  const badgeTranslations = translations[lang].scoreBadges;
  const defaultTitle = translations[lang].keywordTab.circularScoreTitle;
  const displayTitle = title || defaultTitle;

  // Clamp score between 0 and 100
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));

  // SVG calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  // Determine color theme based on score thresholds
  // >= 80%: High (Green)
  // 60% - 79%: Medium (Yellow / Amber)
  // < 60%: Low (Orange / Red)
  const getScoreTheme = (val: number) => {
    if (val >= 80) {
      return {
        gradientId: 'score-grad-green',
        stopStart: '#34d399', // Emerald-400
        stopEnd: '#059669', // Emerald-600
        textColor: variant === 'dark' ? 'text-emerald-400' : 'text-emerald-600',
        badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        badgeText: badgeTranslations.excellent,
        glowColor: 'rgba(16, 185, 129, 0.25)',
      };
    } else if (val >= 60) {
      return {
        gradientId: 'score-grad-amber',
        stopStart: '#fcd34d', // Amber-300
        stopEnd: '#d97706', // Amber-600
        textColor: variant === 'dark' ? 'text-amber-400' : 'text-amber-600',
        badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        badgeText: badgeTranslations.moderate,
        glowColor: 'rgba(245, 158, 11, 0.25)',
      };
    } else {
      return {
        gradientId: 'score-grad-rose',
        stopStart: '#fb7185', // Rose-400
        stopEnd: '#e11d48', // Rose-600
        textColor: variant === 'dark' ? 'text-rose-400' : 'text-rose-600',
        badgeBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        badgeText: badgeTranslations.needsWork,
        glowColor: 'rgba(244, 63, 94, 0.25)',
      };
    }
  };

  const theme = getScoreTheme(normalizedScore);

  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      {/* SVG Ring Container */}
      <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        {/* Optional Ambient Glow Behind Circle */}
        <div
          className="absolute inset-0 rounded-full blur-xl transition-all duration-700 pointer-events-none opacity-60"
          style={{ background: theme.glowColor }}
        />

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 relative z-10"
        >
          <defs>
            <linearGradient id={theme.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.stopStart} />
              <stop offset="100%" stopColor={theme.stopEnd} />
            </linearGradient>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={variant === 'dark' ? 'stroke-slate-800' : 'stroke-slate-200'}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Animated Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${theme.gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Text (Score percentage) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <div className="flex items-baseline justify-center">
            <span className={`text-3xl font-black tracking-tight ${theme.textColor}`}>
              {normalizedScore}
            </span>
            <span className={`text-sm font-bold ml-0.5 ${theme.textColor}`}>%</span>
          </div>
        </div>
      </div>

      {/* Title / Label below */}
      {displayTitle && (
        <div
          className={`text-xs font-bold mt-2.5 ${
            variant === 'dark' ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {displayTitle}
        </div>
      )}

      {/* Badge below */}
      {showBadge && (
        <span
          className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${theme.badgeBg}`}
        >
          {theme.badgeText}
        </span>
      )}
    </div>
  );
};

