import React, { useState, useRef } from 'react';
import Markdown from 'react-markdown';
import { SAMPLE_PRESETS } from '../data/samplePresets';
import { SamplePreset, UserAccount } from '../types';
import { Language, translations } from '../utils/i18n';
import { JdUrlExtractor, JdUrlTriggerButton } from './JdUrlExtractor';
import {
  FileText,
  Briefcase,
  Upload,
  Sparkles,
  Trash2,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Loader2,
  X,
  Eye,
  Edit3,
  Wand2,
  Save
} from 'lucide-react';

interface InputSectionProps {
  cvText: string;
  setCvText: (val: string) => void;
  jdText: string;
  setJdText: (val: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  onSelectPreset: (preset: SamplePreset) => void;
  lang: Language;
  currentUser?: UserAccount | null;
  onJdSourceChange?: (sourceLabel: string | null) => void;
}

export const InputSection: React.FC<InputSectionProps> = ({
  cvText,
  setCvText,
  jdText,
  setJdText,
  onAnalyze,
  isLoading,
  onSelectPreset,
  lang,
  currentUser,
  onJdSourceChange,
}) => {
  const t = translations[lang].input;
  const isAdmin = currentUser?.role === 'admin';

  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isExtractingJd, setIsExtractingJd] = useState<boolean>(false);
  const [isExtractingCv, setIsExtractingCv] = useState<boolean>(false);
  const [jdFileName, setJdFileName] = useState<string | null>(null);

  React.useEffect(() => {
    onJdSourceChange?.(jdFileName);
  }, [jdFileName, onJdSourceChange]);
  const [isJdUrlBarOpen, setIsJdUrlBarOpen] = useState<boolean>(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [isDraggingJd, setIsDraggingJd] = useState<boolean>(false);
  const [isDraggingCv, setIsDraggingCv] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [jdViewMode, setJdViewMode] = useState<'raw' | 'preview'>('raw');
  const [cvViewMode, setCvViewMode] = useState<'raw' | 'preview'>('raw');
  const [isFormattingCv, setIsFormattingCv] = useState<boolean>(false);
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState<boolean>(false);
  const [openRouterTestResult, setOpenRouterTestResult] = useState<{ ok: boolean; message: string; details?: string } | null>(null);

  const handleTestOpenRouter = async () => {
    setIsTestingOpenRouter(true);
    setOpenRouterTestResult(null);
    try {
      const res = await fetch('/api/test-openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setOpenRouterTestResult({
          ok: true,
          message: data.message || (lang === 'vi' ? 'Kết nối API tới OpenRouter thành công' : 'OpenRouter API connection successful'),
        });
      } else {
        setOpenRouterTestResult({
          ok: false,
          message: data.error || (lang === 'vi' ? 'Không thể kết nối OpenRouter API.' : 'Unable to connect to OpenRouter API.'),
          details: data.details ? (typeof data.details === 'object' ? JSON.stringify(data.details) : String(data.details)) : undefined,
        });
      }
    } catch (err: any) {
      setOpenRouterTestResult({
        ok: false,
        message: lang === 'vi' ? 'Lỗi mạng khi kiểm tra kết nối OpenRouter.' : 'Network error when testing OpenRouter connection.',
        details: err?.message || String(err),
      });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const jdFileInputRef = useRef<HTMLInputElement>(null);

  const handleFormatCvWithAi = async () => {
    if (!cvText.trim() || isFormattingCv) return;
    setIsFormattingCv(true);
    setExtractError(null);
    try {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch('/api/format-cv-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawCvText: cvText, lang }),
          });
          if (response.ok) break;
        } catch (e) {
          if (attempt === 1) throw e;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (!response) {
        throw new Error(lang === 'vi' ? 'Không thể định dạng lại CV.' : 'Failed to reformat CV.');
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (lang === 'vi' ? 'Không thể định dạng lại CV.' : 'Failed to reformat CV.'));
      }
      setCvText(data.formattedText);
      setCvViewMode('preview');
    } catch (err: any) {
      console.error('Error formatting CV:', err);
      setExtractError(err.message || (lang === 'vi' ? 'Không thể định dạng lại CV bằng AI.' : 'Failed to reformat CV using AI.'));
    } finally {
      setIsFormattingCv(false);
    }
  };

  const extractFileText = async (file: File, target: 'jd' | 'cv') => {
    setExtractError(null);

    if (file.size > 15 * 1024 * 1024) {
      setExtractError(lang === 'vi' ? 'Dung lượng tệp quá lớn (tối đa 15MB). Vui lòng chọn tệp nhỏ hơn.' : 'File size too large (max 15MB). Please select a smaller file.');
      return;
    }

    if (target === 'jd') {
      setIsExtractingJd(true);
    } else {
      setIsExtractingCv(true);
    }

    try {
      let textContent = '';

      let response: Response | null = null;
      let rawResponseText = '';

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('lang', lang);
          formData.append('type', target);

          const token = localStorage.getItem('auth_token');
          const headers: Record<string, string> = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          response = await fetch(`/api/extract-text?lang=${lang}`, {
            method: 'POST',
            headers,
            body: formData,
          });
          rawResponseText = await response.text();
          if (response.ok) break;
          if (attempt === 0 && response.status >= 500) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        } catch (err) {
          if (attempt === 1) throw err;
          await new Promise((r) => setTimeout(r, 1200));
        }
      }

      if (!response) {
        throw new Error(lang === 'vi' ? 'Không thể tải tệp lên máy chủ. Vui lòng thử lại.' : 'Failed to upload file to server. Please try again.');
      }

      let data: any = null;

      try {
        data = JSON.parse(rawResponseText);
      } catch {
        // If server returned status 200 with raw text instead of JSON
        if (response.ok && rawResponseText && !rawResponseText.trim().startsWith('<')) {
          data = { text: rawResponseText };
        }
      }

      if (response.ok) {
        textContent = data?.text || data?.rawText || (typeof data === 'string' ? data : '');
        if (!textContent && rawResponseText && !rawResponseText.trim().startsWith('<')) {
          textContent = rawResponseText;
        }
      } else {
        const errorMessage = data?.error || (rawResponseText.startsWith('<')
          ? (lang === 'vi' ? 'Không thể kết nối với dịch vụ xử lý tệp. Vui lòng thử lại.' : 'Failed to connect to file processing service. Please try again.')
          : rawResponseText);
        throw new Error(errorMessage || (lang === 'vi' ? `Lỗi tải tệp (${response.status})` : `File upload error (${response.status})`));
      }

      if (!textContent || !textContent.trim()) {
        throw new Error(lang === 'vi' ? 'Tệp tải lên không chứa văn bản đọc được. Bạn có thể dán nội dung trực tiếp vào ô bên dưới.' : 'Uploaded file contains no readable text. You can paste the content directly into the box below.');
      }

      const cleaned = textContent.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      if (target === 'jd') {
        setJdText(cleaned);
        setJdFileName(file.name);
      } else {
        setCvText(cleaned);
        setCvFileName(file.name);
      }
      if (selectedPresetId) setSelectedPresetId('');
    } catch (err: any) {
      console.error('[File Upload Error Details]:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: err,
      });

      let rawMsg = err?.message || String(err || '');
      if (rawMsg === 'Failed to fetch' || rawMsg.includes('NetworkError') || rawMsg.includes('Network Error')) {
        rawMsg = lang === 'vi'
          ? 'Không thể kết nối với máy chủ (Lỗi mạng hoặc gián đoạn kết nối). Vui lòng thử lại hoặc dán nội dung trực tiếp.'
          : 'Unable to connect to server (Network error). Please try again or paste content directly.';
      }

      setExtractError(lang === 'vi' ? `Tệp "${file.name}": ${rawMsg}` : `File "${file.name}": ${rawMsg}`);
    } finally {
      if (target === 'jd') {
        setIsExtractingJd(false);
      } else {
        setIsExtractingCv(false);
      }
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'jd' | 'cv'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    extractFileText(file, target);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, target: 'jd' | 'cv') => {
    e.preventDefault();
    if (target === 'jd') setIsDraggingJd(false);
    if (target === 'cv') setIsDraggingCv(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      extractFileText(file, target);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, target: 'jd' | 'cv') => {
    e.preventDefault();
    if (target === 'jd') setIsDraggingJd(true);
    if (target === 'cv') setIsDraggingCv(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, target: 'jd' | 'cv') => {
    e.preventDefault();
    if (target === 'jd') setIsDraggingJd(false);
    if (target === 'cv') setIsDraggingCv(false);
  };

  const handlePresetChange = (preset: SamplePreset) => {
    setSelectedPresetId(preset.id);
    setJdFileName(null);
    setCvFileName(null);
    setExtractError(null);
    onSelectPreset(preset);
  };

  const handleClear = () => {
    setCvText('');
    setJdText('');
    setJdFileName(null);
    setCvFileName(null);
    setSelectedPresetId('');
    setExtractError(null);
  };

  const isReady = cvText.trim().length > 20 && jdText.trim().length > 20;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
      {/* Sample presets bar */}
      <div className="mb-6 pb-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {t.presetLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {SAMPLE_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset)}
                className={`text-left p-3 rounded-xl border text-xs transition-all duration-200 cursor-pointer flex items-start gap-2.5 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-sm text-indigo-950 font-medium'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                </div>
                <div className="overflow-hidden">
                  <div className="font-semibold truncate">{preset.title}</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{preset.role}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Extract error notice */}
      {extractError && (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{extractError}</span>
          </div>
          <button
            onClick={() => setExtractError(null)}
            className="text-rose-500 hover:text-rose-700 p-1 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main input textareas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* JD Input */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2.5 min-h-[38px] flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span className="w-6.5 h-6.5 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shadow-xs">
                1
              </span>
              <span>{t.jdLabel}</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>

            <div className="flex items-center gap-2 text-xs flex-wrap">
              <JdUrlTriggerButton
                lang={lang}
                isOpen={isJdUrlBarOpen}
                isExtracting={isExtractingJd}
                onClick={() => setIsJdUrlBarOpen((prev) => !prev)}
              />
              <input
                type="file"
                ref={jdFileInputRef}
                onChange={(e) => handleFileChange(e, 'jd')}
                accept=".pdf,.docx,.doc,.txt,.md,.text,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => jdFileInputRef.current?.click()}
                disabled={isExtractingJd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold border border-indigo-200/80 transition-all cursor-pointer disabled:opacity-50 text-xs shadow-xs"
                title={t.uploadButton}
              >
                {isExtractingJd ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>{t.uploadButton}</span>
              </button>
            </div>
          </div>

          <JdUrlExtractor
            lang={lang}
            token={currentUser?.token || null}
            isOpen={isJdUrlBarOpen}
            onToggleOpen={() => setIsJdUrlBarOpen((prev) => !prev)}
            onExtracted={({ jdText: extractedJd, sourceLabel }) => {
              setJdText(extractedJd);
              setJdFileName(sourceLabel);
              if (selectedPresetId) setSelectedPresetId('');
              setIsJdUrlBarOpen(false);
              setExtractError(null);
            }}
            onError={(msg) => setExtractError(msg)}
          />

          {jdFileName && (
            <div className="mb-2.5 flex items-center justify-between bg-indigo-50/80 border border-indigo-200/80 text-indigo-900 rounded-lg px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <FileCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-semibold truncate">File: {jdFileName}</span>
              </div>
              <button
                onClick={() => setJdFileName(null)}
                className="text-slate-400 hover:text-slate-600 ml-2 cursor-pointer"
                title={t.clearFile}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div
            onDrop={(e) => handleDrop(e, 'jd')}
            onDragOver={(e) => handleDragOver(e, 'jd')}
            onDragLeave={(e) => handleDragLeave(e, 'jd')}
            className={`relative flex-1 rounded-2xl border border-slate-200 bg-slate-50/80 shadow-xs overflow-hidden transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600 ${
              isDraggingJd ? 'ring-2 ring-indigo-500 bg-indigo-50/30' : ''
            }`}
          >
            {isExtractingJd && (
              <div className="absolute inset-0 bg-white/85 backdrop-blur-[1px] z-10 rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-xs font-semibold text-indigo-900">
                  {t.extracting}
                </span>
              </div>
            )}

            {/* Integrated Card Header Toolbar */}
            <div className="bg-slate-100/90 border-b border-slate-200/80 px-3.5 py-2 flex items-center justify-between text-xs min-h-[42px] flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-600 font-semibold">
                <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{lang === 'vi' ? 'Nội dung Mô Tả Công Việc (JD)' : 'Job Description Content'}</span>
              </div>

              <div className="flex items-center gap-2">
                {jdText.trim().length > 10 && (
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setJdViewMode('raw')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                        jdViewMode === 'raw'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{t.rawTextTab}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setJdViewMode('preview')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                        jdViewMode === 'preview'
                          ? 'bg-white text-indigo-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3 h-3 text-indigo-600" />
                      <span>{t.previewTab}</span>
                    </button>
                  </div>
                )}
                <div className="text-[11px] font-mono text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200/60">
                  {jdText.length.toLocaleString()} {t.chars}
                </div>
              </div>
            </div>

            {jdViewMode === 'raw' ? (
              <textarea
                value={jdText}
                onChange={(e) => {
                  setJdText(e.target.value);
                  if (selectedPresetId) setSelectedPresetId('');
                }}
                placeholder={t.jdPlaceholder}
                className="w-full h-[340px] p-4 text-xs sm:text-sm text-slate-800 bg-transparent focus:outline-none transition-all resize-y font-mono leading-relaxed"
              />
            ) : (
              <div className="w-full h-[340px] p-4 text-xs sm:text-sm text-slate-800 bg-white overflow-y-auto leading-relaxed">
                {jdText.trim() ? (
                  <div className="markdown-body space-y-2">
                    <Markdown>{jdText}</Markdown>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">No JD content...</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CV Input */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2.5 min-h-[38px] flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span className="w-6.5 h-6.5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shadow-xs">
                2
              </span>
              <span>{t.cvLabel}</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>

            <div className="flex items-center gap-2 text-xs">
              <input
                type="file"
                ref={cvFileInputRef}
                onChange={(e) => handleFileChange(e, 'cv')}
                accept=".pdf,.docx,.doc,.txt,.md,.text,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => cvFileInputRef.current?.click()}
                disabled={isExtractingCv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-semibold border border-emerald-200/80 transition-all cursor-pointer disabled:opacity-50 text-xs shadow-xs"
                title={t.uploadButton}
              >
                {isExtractingCv ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{t.uploadButton}</span>
              </button>
            </div>
          </div>

          {cvFileName && (
            <div className="mb-2.5 flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 rounded-lg px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold truncate">CV: {cvFileName}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  {t.cleanBadge}
                </span>
              </div>
              <button
                onClick={() => setCvFileName(null)}
                className="text-slate-400 hover:text-slate-600 ml-2 cursor-pointer"
                title={t.clearFile}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div
            onDrop={(e) => handleDrop(e, 'cv')}
            onDragOver={(e) => handleDragOver(e, 'cv')}
            onDragLeave={(e) => handleDragLeave(e, 'cv')}
            className={`relative flex-1 rounded-2xl border border-slate-200 bg-slate-50/80 shadow-xs overflow-hidden transition-all focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-600 ${
              isDraggingCv ? 'ring-2 ring-emerald-500 bg-emerald-50/30' : ''
            }`}
          >
            {(isExtractingCv || isFormattingCv) && (
              <div className="absolute inset-0 bg-white/85 backdrop-blur-[1px] z-10 rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="text-xs font-semibold text-emerald-900">
                  {isExtractingCv
                    ? t.extracting
                    : t.aiFormatting}
                </span>
              </div>
            )}

            {/* Integrated Card Header Toolbar */}
            <div className="bg-slate-100/90 border-b border-slate-200/80 px-3.5 py-2 flex items-center justify-between text-xs min-h-[42px] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-600 font-semibold hidden sm:inline">
                  {lang === 'vi' ? 'Nội dung CV' : 'CV Content'}
                </span>

                {cvText.trim().length > 10 && (
                  <button
                    type="button"
                    onClick={handleFormatCvWithAi}
                    disabled={isFormattingCv || isExtractingCv}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold border border-amber-300 transition-colors cursor-pointer disabled:opacity-50 text-[11px] shadow-2xs"
                    title={t.aiFormatButton}
                  >
                    {isFormattingCv ? (
                      <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                    ) : (
                      <Wand2 className="w-3 h-3 text-amber-600" />
                    )}
                    <span>{t.aiFormatButton}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {cvText.trim().length > 10 && (
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setCvViewMode('raw')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                        cvViewMode === 'raw'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{t.rawTextTab}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCvViewMode('preview')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                        cvViewMode === 'preview'
                          ? 'bg-white text-indigo-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3 h-3 text-indigo-600" />
                      <span>{t.previewTab}</span>
                    </button>
                  </div>
                )}
                <div className="text-[11px] font-mono text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200/60">
                  {cvText.length.toLocaleString()} {t.chars}
                </div>
              </div>
            </div>

            {cvViewMode === 'raw' ? (
              <textarea
                value={cvText}
                onChange={(e) => {
                  setCvText(e.target.value);
                  if (selectedPresetId) setSelectedPresetId('');
                }}
                placeholder={t.cvPlaceholder}
                className="w-full h-[340px] p-4 text-xs sm:text-sm text-slate-800 bg-transparent focus:outline-none transition-all resize-y font-mono leading-relaxed"
              />
            ) : (
              <div className="w-full h-[340px] p-4 text-xs sm:text-sm text-slate-800 bg-white overflow-y-auto leading-relaxed">
                {cvText.trim() ? (
                  <div className="markdown-body space-y-2">
                    <Markdown>{cvText}</Markdown>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">No CV content...</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Model A: Sequential Verification Banner (Admin Only) */}
      {isAdmin && (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 text-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold rounded text-xs border border-indigo-500/30">
                {lang === 'vi' ? 'Mô hình A' : 'Model A'}
              </span>
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>Sequential Verification Pipeline</span>
                <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                  {lang === 'vi' ? '(Tạo bản nháp ➔ Review ➔ Hoàn thiện)' : '(Drafting ➔ Review ➔ Synthesis)'}
                </span>
              </h4>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>{lang === 'vi' ? 'Độ chính xác cao & Kiểm định chéo chất lượng AI' : 'High Accuracy & AI Quality Cross-Validation'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2.5 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
              <div>
                <div className="font-bold text-slate-200 flex items-center gap-1">
                  <span>{lang === 'vi' ? 'Bước 1: Draft Analysis' : 'Step 1: Draft Analysis'}</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono">Gemini</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {lang === 'vi'
                    ? 'Phân tích ban đầu CV & JD, tạo báo cáo nháp, trích xuất từ khóa và điểm số.'
                    : 'Initial analysis of CV & JD, generate draft report, extract keywords & scores.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2.5 flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-300 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                <div className="flex-1">
                  <div className="font-bold text-slate-200 flex items-center justify-between gap-1 flex-wrap">
                    <span>{lang === 'vi' ? 'Bước 2: Review & Phản biện' : 'Step 2: Review & Critique'}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">OpenRouter / Gemini Auditor</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {lang === 'vi'
                      ? 'Role Quality Checker rà soát bản nháp, tìm điểm thiếu sót, sai sót hoặc từ khóa bị bỏ lỡ.'
                      : 'Quality Checker audits draft, identifies missing points, errors, or omitted keywords.'}
                  </p>
                </div>
              </div>

              <div className="mt-1 pt-2 border-t border-slate-700/50 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleTestOpenRouter}
                    disabled={isTestingOpenRouter}
                    className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 px-2 py-0.5 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isTestingOpenRouter ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{lang === 'vi' ? 'Đang kiểm tra...' : 'Testing...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>{lang === 'vi' ? 'Kiểm tra kết nối OpenRouter API' : 'Test OpenRouter API Connection'}</span>
                      </>
                    )}
                  </button>
                </div>

                {openRouterTestResult && (
                  <div className={`text-[11px] p-2 rounded flex flex-col gap-1 ${
                    openRouterTestResult.ok
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                  }`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      {openRouterTestResult.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span>{openRouterTestResult.message}</span>
                    </div>
                    {openRouterTestResult.details && (
                      <p className="text-[10px] opacity-80 font-mono break-all leading-tight">
                        {openRouterTestResult.details}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2.5 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
              <div>
                <div className="font-bold text-slate-200 flex items-center gap-1">
                  <span>{lang === 'vi' ? 'Bước 3: Synthesizer' : 'Step 3: Synthesizer'}</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">Gemini</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {lang === 'vi'
                    ? 'Tổng hợp nhận xét phản biện từ Auditor, điều chỉnh điểm số và xuất kết quả hoàn thiện.'
                    : 'Synthesize Auditor critique feedback, adjust scores, and output final report.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer controls & Action button */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {(cvText.trim() || jdText.trim()) && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer px-1 py-1"
              title={t.clearAll}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearAll}</span>
            </button>
          )}

          {!isReady && (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{t.requiredWarning}</span>
            </div>
          )}
          {isReady && (
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'vi' ? 'Sẵn sàng phân tích' : 'Ready for Analysis'}</span>
            </div>
          )}
        </div>

        <button
          onClick={onAnalyze}
          disabled={!isReady || isLoading || isExtractingCv || isExtractingJd}
          className={`w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer ${
            isReady && !isLoading && !isExtractingCv && !isExtractingJd
              ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-blue-800 shadow-indigo-500/25 active:scale-[0.99]'
              : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t.analyzing}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>{t.analyzeButton}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
