import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Play,
  Award,
  Search,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
  FileArchive,
  BarChart2,
  UserCheck,
  ChevronRight,
  Sparkles,
  Download,
  Flame,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

import { HistoryItem } from '../types';

interface BatchProcessingTabProps {
  lang: 'vi' | 'en';
  token: string | null;
  onAddHistoryItems?: (items: HistoryItem[]) => void;
}

interface CandidateResult {
  filename: string;
  success: boolean;
  candidateName: string;
  overallScore: number;
  matchLevel: 'Very High' | 'High' | 'Medium' | 'Low';
  keywordScore: number;
  experienceScore: number;
  skillScore: number;
  topStrengths: string[];
  keyGaps: string[];
  shortRecommendation: string;
  cvText?: string;
  fullAnalysis?: any;
}

export const BatchProcessingTab: React.FC<BatchProcessingTabProps> = ({ lang, token, onAddHistoryItems }) => {
  const isEn = lang === 'en';

  // --- State Variables ---
  const [jdText, setJdText] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);

  // Sorting and Filtering
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterLevel, setFilterLevel] = useState<string>('All');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  // JD File Upload states & ref
  const [isExtractingJd, setIsExtractingJd] = useState<boolean>(false);
  const [jdFileName, setJdFileName] = useState<string | null>(null);
  const jdFileInputRef = useRef<HTMLInputElement>(null);

  const handleJdFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg(isEn ? 'File size too large (max 15MB). Please select a smaller file.' : 'Dung lượng tệp quá lớn (tối đa 15MB). Vui lòng chọn tệp nhỏ hơn.');
      if (e.target) e.target.value = '';
      return;
    }

    setIsExtractingJd(true);
    setErrorMsg('');
    try {
      let textContent = '';
      let response: Response | null = null;
      let rawResponseText = '';

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('lang', lang);
          formData.append('type', 'jd');

          const authToken = token || localStorage.getItem('auth_token');
          const headers: Record<string, string> = {};
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
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
        throw new Error(isEn ? 'Failed to upload file to server. Please try again.' : 'Không thể tải tệp lên máy chủ. Vui lòng thử lại.');
      }

      let data: any = null;
      try {
        data = JSON.parse(rawResponseText);
      } catch {
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
          ? (isEn ? 'Failed to connect to file processing service. Please try again.' : 'Không thể kết nối với dịch vụ xử lý tệp. Vui lòng thử lại.')
          : rawResponseText);
        throw new Error(errorMessage || (isEn ? `File upload error (${response.status})` : `Lỗi tải tệp (${response.status})`));
      }

      if (!textContent || !textContent.trim()) {
        throw new Error(isEn ? 'Uploaded file contains no readable text.' : 'Tệp tải lên không chứa văn bản đọc được.');
      }

      const cleaned = textContent.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      setJdText(cleaned);
      setJdFileName(file.name);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(isEn ? `Failed to extract JD: ${err.message}` : `Lỗi trích xuất mô tả công việc: ${err.message}`);
    } finally {
      setIsExtractingJd(false);
      if (e.target) e.target.value = '';
    }
  };

  // --- Preset JDs to speed up testing ---
  const jdPresets = [
    {
      title: isEn ? 'Senior React Developer' : 'Lập trình viên React Senior',
      text: isEn 
        ? `Position: Senior React Developer\nRequirements:\n- 5+ years of experience with React, Redux, HTML5, CSS3, JavaScript/TypeScript.\n- Experience with Vite, Tailwind CSS, and modern state managers.\n- Proficient in writing Unit/Integration tests (Jest/React Testing Library).\n- Strong communication skills and agile leadership experience.`
        : `Vị trí: Lập trình viên React Senior\nYêu cầu:\n- Trên 5 năm kinh nghiệm làm việc với React, Redux, HTML5, CSS3, JavaScript/TypeScript.\n- Có kinh nghiệm với Vite, Tailwind CSS, và các thư viện quản lý trạng thái hiện đại.\n- Thành thạo viết Unit/Integration test (Jest/React Testing Library).\n- Kỹ năng giao tiếp tốt, có kinh nghiệm dẫn dắt đội ngũ theo mô hình Agile.`
    },
    {
      title: isEn ? 'AI Engineer (Gemini / Python)' : 'Kỹ sư AI (Gemini / Python)',
      text: isEn
        ? `Position: AI/LLM Integration Engineer\nRequirements:\n- 3+ years in AI/ML development, focusing on Large Language Models (LLMs).\n- Proficient in Python, LangChain, @google/genai SDK, and vector databases.\n- Experience in prompt engineering, fine-tuning, and structured JSON outputs.\n- Deep understanding of RAG (Retrieval-Augmented Generation) patterns.`
        : `Vị trí: Kỹ sư Tích hợp AI/LLM\nYêu cầu:\n- Trên 3 năm kinh nghiệm phát triển AI/ML, tập trung vào mô hình ngôn ngữ lớn (LLMs).\n- Thành thạo Python, LangChain, SDK @google/genai, và cơ sở dữ liệu vector.\n- Kinh nghiệm thiết kế prompt (Prompt Engineering), tinh chỉnh tham số, xuất chuỗi JSON cấu trúc.\n- Hiểu biết sâu sắc về các kiến trúc RAG (Retrieval-Augmented Generation).`
    }
  ];

  // --- Drag & Drop Handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validExtensions = ['.pdf', '.docx', '.doc', '.zip', '.txt', '.rtf', '.md'];
    
    // Filter by extension
    let filtered = files.filter(f => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      return validExtensions.includes(ext);
    });

    // Filter by size (max 15MB)
    const tooLarge = filtered.filter(f => f.size > 15 * 1024 * 1024);
    filtered = filtered.filter(f => f.size <= 15 * 1024 * 1024);

    if (tooLarge.length > 0) {
      setErrorMsg(isEn
        ? `Some files were skipped because they exceed the 15MB size limit.`
        : `Một số tệp đã bị bỏ qua vì vượt quá giới hạn dung lượng 15MB.`
      );
    } else if (filtered.length < files.length) {
      setErrorMsg(isEn 
        ? "Some files were skipped. Only .pdf, .docx, .doc, .zip, and .txt files are supported." 
        : "Một số tệp đã bị bỏ qua. Hệ thống chỉ hỗ trợ .pdf, .docx, .doc, .zip, .txt."
      );
    }

    setUploadedFiles(prev => {
      const existingNames = new Set(prev.map(p => p.name));
      const nonDuplicate = filtered.filter(f => !existingNames.has(f.name));
      return [...prev, ...nonDuplicate];
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
    setErrorMsg('');
  };

  // --- Run Batch Processing ---
  const handleStartBatch = async () => {
    if (!jdText.trim()) {
      setErrorMsg(isEn ? "Please enter a Job Description (JD)." : "Vui lòng nhập thông tin Mô tả công việc (JD).");
      return;
    }
    if (uploadedFiles.length === 0) {
      setErrorMsg(isEn ? "Please upload at least one CV or ZIP archive." : "Vui lòng tải lên ít nhất 1 tệp CV hoặc tệp ZIP.");
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setResults([]);
    setSelectedCandidate(null);

    // Simulated progress steps to reassure the recruiter of background processing
    const totalFiles = uploadedFiles.length;
    setProgressStep(isEn ? `Preparing ${totalFiles} file(s)...` : `Đang chuẩn bị ${totalFiles} tệp tin...`);
    setProgressPercent(10);

    try {
      const formData = new FormData();
      formData.append('jdText', jdText);
      formData.append('lang', lang);

      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Dynamic, asymptotic progress bar simulation to match reality
      let currentPercent = 10;
      const interval = setInterval(() => {
        let increment = 1.0;
        if (currentPercent < 35) {
          increment = 2.5; // Fast initial warmup/parsing
        } else if (currentPercent < 65) {
          increment = 1.2; // Parallel LLM analysis
        } else if (currentPercent < 80) {
          increment = 0.6; // Deep ranking math
        } else if (currentPercent < 92) {
          increment = 0.25; // Slower consolidation
        } else if (currentPercent < 98) {
          increment = 0.1; // Slow micro crawl so it never freezes
        } else {
          increment = 0.02; // Keeps the bar actively crawling
        }

        currentPercent = Math.min(98.8, currentPercent + increment);
        setProgressPercent(Math.floor(currentPercent));

        // Dynamically update status messages based on current percent to show continuous action
        if (currentPercent < 35) {
          setProgressStep(isEn 
            ? `Extracting documents & parsing archives (File 1 to ${totalFiles})...` 
            : `Đang trích xuất văn bản & giải nén tài liệu (1 đến ${totalFiles} tệp)...`
          );
        } else if (currentPercent >= 35 && currentPercent < 68) {
          setProgressStep(isEn 
            ? "Running parallel comparative matching..." 
            : "Đang so khớp dữ liệu song song với trí tuệ nhân tạo"
          );
        } else if (currentPercent >= 68 && currentPercent < 88) {
          setProgressStep(isEn 
            ? "Calculating multidimensional scores & compiling leaderboard..." 
            : "Đang tính toán trọng số đa chiều & thiết lập bảng xếp hạng..."
          );
        } else {
          setProgressStep(isEn 
            ? "Generating detailed feedback summaries..." 
            : "Đang tổng hợp báo cáo phản hồi chi tiết"
          );
        }
      }, 550);

      const response = await fetch('/api/batch-analyze', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      clearInterval(interval);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || (isEn ? "Batch analysis failed." : "Lỗi xử lý hàng loạt."));
      }

      setProgressPercent(100);
      setProgressStep(isEn ? "Leaderboard successfully generated!" : "Đã tạo bảng xếp hạng thành công!");
      setResults(data.results || []);

      const successfulResults = (data.results || []).filter((r: any) => r.success && r.fullAnalysis);
      if (successfulResults.length > 0 && onAddHistoryItems) {
        const newItems: HistoryItem[] = successfulResults.map((r: any, idx: number) => {
          const inferredTitle = r.candidateName || r.filename.replace(/\.[^/.]+$/, "");
          const firstLine = jdText.trim().split('\n')[0] || '';
          const jdTitle = firstLine.substring(0, 36) || (lang === 'vi' ? 'Vị trí công việc' : 'CV Analysis Report');
          const title = `${jdTitle} - ${inferredTitle}`;

          return {
            id: `batch-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 11)}`,
            title,
            timestamp: Date.now(),
            cvText: r.cvText || '',
            jdText,
            analysis: r.fullAnalysis,
            score: r.overallScore || 0,
          };
        });
        onAddHistoryItems(newItems);
      }

      setTimeout(() => {
        setIsLoading(false);
      }, 500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || (isEn ? "An unexpected error occurred during batch analysis." : "Có lỗi xảy ra trong quá trình phân tích hàng loạt."));
      setIsLoading(false);
    }
  };

  // --- Filtering & Sorting Logic ---
  const filteredResults = results
    .filter(candidate => {
      const matchesSearch = candidate.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            candidate.filename.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = filterLevel === 'All' || candidate.matchLevel === filterLevel;
      return matchesSearch && matchesLevel;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'score') {
        comparison = a.overallScore - b.overallScore;
      } else {
        comparison = a.candidateName.localeCompare(b.candidateName);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (type: 'score' | 'name') => {
    if (sortBy === type) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('desc');
    }
  };

  // Prepare chart data
  const chartData = results.map(r => ({
    name: r.candidateName.length > 15 ? r.candidateName.slice(0, 12) + '...' : r.candidateName,
    Score: r.overallScore,
    Keywords: r.keywordScore,
    Experience: r.experienceScore,
    Skills: r.skillScore,
    fullName: r.candidateName
  }));

  // --- Style Helpers ---
  const getMatchLevelColor = (level: string) => {
    switch (level) {
      case 'Very High':
        return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30';
      case 'High':
        return 'bg-teal-500/10 text-teal-500 border border-teal-500/30';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/30';
      case 'Low':
        return 'bg-rose-500/10 text-rose-500 border border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-500 border border-slate-500/30';
    }
  };

  // Export results to raw Markdown for recruiters to copy/paste
  const handleExportMarkdown = () => {
    if (results.length === 0) return;
    let md = `# Candidate Leaderboard Report\n\nGenerated on: ${new Date().toLocaleDateString()}\n\n`;
    md += `| Rank | Candidate Name | File Name | Overall Fit | Match Level |\n`;
    md += `|---|---|---|---|---|\n`;
    results.forEach((r, idx) => {
      md += `| **#${idx + 1}** | ${r.candidateName} | ${r.filename} | **${r.overallScore}%** | ${r.matchLevel} |\n`;
    });
    md += `\n\n## Deep Dive Breakdown\n\n`;
    results.forEach((r, idx) => {
      md += `### #${idx + 1} ${r.candidateName}\n`;
      md += `- **File**: ${r.filename}\n`;
      md += `- **Overall Score**: ${r.overallScore}%\n`;
      md += `- **Keyword Match**: ${r.keywordScore}%\n`;
      md += `- **Experience Fit**: ${r.experienceScore}%\n`;
      md += `- **Skills Overlap**: ${r.skillScore}%\n`;
      md += `\n#### Top Strengths:\n`;
      r.topStrengths.forEach(s => md += `  - ${s}\n`);
      md += `\n#### Areas for Improvement / Gaps:\n`;
      r.keyGaps.forEach(g => md += `  - ${g}\n`);
      md += `\n#### Recruiter Verdict:\n> ${r.shortRecommendation}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Recruiter_Leaderboard_${new Date().toISOString().split('T')[0]}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in" id="batch-processing-root">
      {/* Overview Block */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-indigo-900 pointer-events-none hidden md:block">
          <UserCheck className="w-56 h-56" />
        </div>
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Sparkles className="w-3 h-3" />
            <span>{isEn ? 'HR & RECRUITER PREMIUM MODULE' : 'MODULE CAO CẤP CHO NHÀ TUYỂN DỤNG'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {isEn ? 'Batch CV Processing & Ranker' : 'Xử Lý CV Hàng Loạt & Xếp Hạng Ứng Viên'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {isEn 
              ? 'Upload a folder of resumes (or a single ZIP archive) containing PDF, DOCX, TXT files, paste a Job Description (JD), and let Gemini instantly analyze, compare, and rank candidates on a visual leaderboard.'
              : 'Tải lên danh sách nhiều CV (hỗ trợ tệp ZIP hoặc chọn đồng thời nhiều file PDF, DOCX, TXT), nhập JD yêu cầu và để Gemini tự động phân tích, chấm điểm, xếp hạng ứng viên trực quan.'
            }
          </p>
        </div>
      </div>

      {/* Main Form Fields Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Input JD (lg:col-span-6) */}
        <div className="space-y-6 flex flex-col h-full">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  {isEn ? '1. Job Description (JD)' : '1. Mô Tả Công Việc (JD)'}
                </label>
                
                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={jdFileInputRef}
                    onChange={handleJdFileChange}
                    accept=".pdf,.docx,.doc,.txt,.md,.text,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => jdFileInputRef.current?.click()}
                    disabled={isExtractingJd}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold border border-indigo-200/80 transition-all cursor-pointer disabled:opacity-50 text-[11px] shadow-xs"
                    title={isEn ? "Upload JD file" : "Tải lên tệp JD"}
                  >
                    {isExtractingJd ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    )}
                    <span>{isEn ? 'Upload' : 'Tải tệp'}</span>
                  </button>

                  {/* Presets */}
                  <div className="flex gap-1">
                    {jdPresets.map((preset, idx) => (
                      <button
                        key={`preset-${idx}`}
                        onClick={() => {
                          setJdText(preset.text);
                          setJdFileName(null);
                        }}
                        className="px-2 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200/60"
                        title={preset.title}
                      >
                        {idx === 0 ? 'React JD' : 'AI JD'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {jdFileName && (
                <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-200/80 text-indigo-900 rounded-xl px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate font-semibold">{jdFileName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setJdFileName(null);
                      setJdText('');
                    }}
                    className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder={isEn ? "Paste or upload the job description requirements here..." : "Dán hoặc tải lên yêu cầu công việc chi tiết tại đây..."}
                className="w-full h-80 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-mono"
              />
            </div>
            
            <p className="text-[10px] text-slate-400 mt-4">
              {isEn ? 'TIP: Use precise skills and experience milestones for highly accurate candidate rankings.' : 'Mẹo: Mô tả rõ ràng mốc năm kinh nghiệm và công nghệ yêu cầu để kết quả xếp hạng tối ưu nhất.'}
            </p>
          </div>
        </div>

        {/* Right Column: CV List Upload (lg:col-span-6) */}
        <div className="space-y-6 flex flex-col h-full">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <label className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  {isEn ? '2. CV Files & Zip Folder Upload' : '2. Tải Lên Nhiều CV hoặc Tệp ZIP'}
                </span>
                {uploadedFiles.length > 0 && (
                  <button
                    onClick={clearAllFiles}
                    className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isEn ? 'Clear all' : 'Xóa tất cả'}
                  </button>
                )}
              </label>

              {/* Drag & Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                  isDragActive 
                    ? 'border-indigo-500 bg-indigo-50/50' 
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-300'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.zip,.txt,.rtf,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    {isEn ? 'Drag & drop multiple CV files or a single ZIP archive here' : 'Kéo thả nhiều tệp CV hoặc 1 tệp ZIP vào đây'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isEn ? 'Supports PDF, DOCX, DOC, ZIP, TXT up to 15MB' : 'Hỗ trợ định dạng PDF, DOCX, DOC, ZIP, TXT tối đa 15MB'}
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-50 shadow-sm"
                >
                  {isEn ? 'Browse Files' : 'Chọn tệp từ máy tính'}
                </button>
              </div>

              {/* Uploaded Files Queue */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {isEn ? `Files to process (${uploadedFiles.length}):` : `Danh sách tệp chờ xử lý (${uploadedFiles.length}):`}
                  </span>
                  
                  <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50">
                    {uploadedFiles.map((file, idx) => {
                      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                      const isZip = ext === '.zip';
                      
                      return (
                        <div key={`file-${idx}`} className="flex items-center justify-between p-2.5 px-4 text-xs hover:bg-white transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {isZip ? (
                              <FileArchive className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                            title={isEn ? "Remove" : "Gỡ bỏ"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-200 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Trigger Button */}
            <div className="pt-2">
              <button
                onClick={handleStartBatch}
                disabled={!jdText.trim() || uploadedFiles.length === 0 || isLoading}
                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer ${
                  jdText.trim() && uploadedFiles.length > 0 && !isLoading
                    ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-blue-800 shadow-indigo-500/25 active:scale-[0.99]'
                    : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isEn ? 'Analyzing Candidates...' : 'Đang Xử Lý Phân Tích...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    <span>{isEn ? 'Start Analysis' : 'Bắt Đầu Phân Tích'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Loading Indicator / Step-by-Step Progress */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl"
            >
              <div className="relative w-20 h-20 mx-auto">
                {/* Circular spin spinner */}
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-indigo-500 animate-spin"></div>
                <div className="absolute inset-4 rounded-full bg-slate-950 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-black text-white text-lg tracking-tight">
                  {isEn ? 'Processing Batch CVs' : 'Đang Xử Lý Danh Sách CV'}
                </h3>
                <p className="text-xs text-indigo-300 font-medium">
                  {progressStep}
                </p>
              </div>

              {/* Progress bar container */}
              <div className="space-y-1">
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{isEn ? 'Starting' : 'Khởi động'}</span>
                  <span>{progressPercent}%</span>
                  <span>{isEn ? 'Complete' : 'Hoàn tất'}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 italic">
                {isEn 
                  ? 'LLM system parses each CV against the JD simultaneously.'
                  : 'Hệ thống LLM phân tích song song từng CV với JD.'
                }
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Dashboard Block */}
      {results.length > 0 && (
        <div className="space-y-8 animate-fade-in" id="batch-results-view">
          
          {/* Dashboard Charts & Controls */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  {isEn ? 'Candidate Leaderboard' : 'Bảng Xếp Hạng Ứng Viên'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEn 
                    ? `Compare and analyze ${results.length} processed candidates.` 
                    : `Đối chiếu và phân tích ${results.length} hồ sơ ứng viên đã được xử lý.`
                  }
                </p>
              </div>
              <button
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {isEn ? 'Export Leaderboard (Markdown)' : 'Xuất Báo Cáo (Markdown)'}
              </button>
            </div>

            {/* Recharts Bar Chart Visualization */}
            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                {isEn ? 'Candidate Suitability Overview (%)' : 'Biểu Đồ So Sánh Mức Độ Phù Hợp (%)'}
              </h4>
              
              <div className="h-64 sm:h-80 w-full text-xs font-semibold">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                      formatter={(value: any, name: any) => [`${value}%`, name]}
                    />
                    <Bar dataKey="Score" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, index) => {
                        let color = '#3b82f6'; // Blue
                        if (index === 0) color = '#eab308'; // First gets gold
                        else if (index === 1) color = '#94a3b8'; // Second gets silver
                        else if (index === 2) color = '#b45309'; // Third gets bronze
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Filters, Search, and Sort Row */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between pt-2">
              <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-lg">
                
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isEn ? "Search candidate name..." : "Tìm kiếm tên ứng viên..."}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Match Level Filter */}
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                >
                  <option value="All">{isEn ? 'All Matches' : 'Tất cả mức độ'}</option>
                  <option value="Very High">{isEn ? 'Very High Match' : 'Phù hợp Rất cao'}</option>
                  <option value="High">{isEn ? 'High Match' : 'Phù hợp Cao'}</option>
                  <option value="Medium">{isEn ? 'Medium Match' : 'Phù hợp Trung bình'}</option>
                  <option value="Low">{isEn ? 'Low Match' : 'Phù hợp Thấp'}</option>
                </select>
              </div>

              {/* Sorters */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSort('score')}
                  className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    sortBy === 'score' 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {isEn ? 'Sort by Score' : 'Sắp xếp theo Điểm'}
                  {sortBy === 'score' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </button>
                <button
                  onClick={() => toggleSort('name')}
                  className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    sortBy === 'name' 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {isEn ? 'Sort by Name' : 'Sắp xếp theo Tên'}
                  {sortBy === 'name' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Table / Cards Leaderboard */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Left Hand: Leaders List Grid (col-span-7) */}
            <div className="md:col-span-7 space-y-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {isEn ? 'Ranked Candidates:' : 'Xếp hạng danh sách ứng viên:'}
              </span>

              {filteredResults.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs">
                  {isEn ? 'No candidates found matching filters.' : 'Không tìm thấy ứng viên nào phù hợp bộ lọc.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredResults.map((candidate, idx) => {
                    const originalIndex = results.findIndex(r => r.filename === candidate.filename);
                    const isSelected = selectedCandidate?.filename === candidate.filename;

                    // Rank indicators
                    let rankBadge = (
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                        {originalIndex + 1}
                      </div>
                    );
                    if (originalIndex === 0) {
                      rankBadge = (
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs shadow shadow-amber-500/20">
                          1
                        </div>
                      );
                    } else if (originalIndex === 1) {
                      rankBadge = (
                        <div className="w-6 h-6 rounded-full bg-slate-400 text-white font-bold flex items-center justify-center text-xs shadow shadow-slate-400/20">
                          2
                        </div>
                      );
                    } else if (originalIndex === 2) {
                      rankBadge = (
                        <div className="w-6 h-6 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-xs shadow shadow-amber-700/20">
                          3
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={`cand-${candidate.filename}`}
                        layoutId={`cand-card-${candidate.filename}`}
                        onClick={() => setSelectedCandidate(candidate)}
                        className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          isSelected 
                            ? 'border-indigo-600 ring-2 ring-indigo-500/10 shadow-md shadow-indigo-500/5' 
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {rankBadge}
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                              {candidate.candidateName}
                              {originalIndex === 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-[9px] text-amber-600 font-black tracking-wide">
                                  <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500 animate-pulse" />
                                  TOP 1
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5" title={candidate.filename}>
                              {candidate.filename}
                            </p>
                          </div>
                        </div>

                        {/* Scores & Actions block */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${getMatchLevelColor(candidate.matchLevel)}`}>
                            {candidate.matchLevel === 'Very High' && (isEn ? 'Very High' : 'Rất Cao')}
                            {candidate.matchLevel === 'High' && (isEn ? 'High' : 'Cao')}
                            {candidate.matchLevel === 'Medium' && (isEn ? 'Medium' : 'Trung Bình')}
                            {candidate.matchLevel === 'Low' && (isEn ? 'Low' : 'Thấp')}
                          </span>

                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900">{candidate.overallScore}%</span>
                            <span className="text-[9px] text-slate-400 block tracking-tight font-bold">{isEn ? 'Suitability' : 'Phù hợp'}</span>
                          </div>

                          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'translate-x-1 text-indigo-600' : ''}`} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Hand: Selected Candidate Deep Dive (col-span-5) */}
            <div className="md:col-span-5">
              <AnimatePresence mode="wait">
                {selectedCandidate ? (
                  <motion.div
                    key={`detail-${selectedCandidate.filename}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 sticky top-6"
                  >
                    {/* Detail Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-[10px] text-indigo-600 font-black uppercase tracking-wider block">
                          {isEn ? 'Candidate Breakdown' : 'Chi Tiết So Khớp Ứng Viên'}
                        </span>
                        <h3 className="text-base font-black text-slate-900 mt-0.5">
                          {selectedCandidate.candidateName}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 break-all">
                          {selectedCandidate.filename}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedCandidate(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Fit score indicators */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 text-center">
                        <span className="text-[10px] font-bold text-slate-500 block">{isEn ? 'Keywords' : 'Từ khóa'}</span>
                        <span className="text-sm font-black text-slate-800">{selectedCandidate.keywordScore}%</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 text-center">
                        <span className="text-[10px] font-bold text-slate-500 block">{isEn ? 'Experience' : 'Kinh nghiệm'}</span>
                        <span className="text-sm font-black text-slate-800">{selectedCandidate.experienceScore}%</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 text-center">
                        <span className="text-[10px] font-bold text-slate-500 block">{isEn ? 'Skills' : 'Kỹ năng'}</span>
                        <span className="text-sm font-black text-slate-800">{selectedCandidate.skillScore}%</span>
                      </div>
                    </div>

                    {/* Recommendation verdict quote */}
                    <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/60 flex items-start gap-3">
                      <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block">
                          {isEn ? 'Recruiter Verdict' : 'Nhận Định Từ AI'}
                        </span>
                        <p className="text-xs text-slate-700 italic font-medium leading-relaxed">
                          "{selectedCandidate.shortRecommendation}"
                        </p>
                      </div>
                    </div>

                    {/* Top Strengths (3 Items) */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        {isEn ? 'Top 3 Strengths' : '3 Điểm Mạnh Nổi Bật'}
                      </h4>
                      <ul className="space-y-2">
                        {selectedCandidate.topStrengths.map((str, i) => (
                          <li key={`str-${i}`} className="text-xs text-slate-700 leading-relaxed bg-emerald-50/20 p-2.5 rounded-xl border border-emerald-500/10 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Key Gaps (3 Items) */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        {isEn ? 'Core Gaps & Gaps to Fill' : '3 Điểm Cần Cải Thiện / Thiếu Hụt'}
                      </h4>
                      <ul className="space-y-2">
                        {selectedCandidate.keyGaps.map((gap, i) => (
                          <li key={`gap-${i}`} className="text-xs text-slate-700 leading-relaxed bg-amber-50/30 p-2.5 rounded-xl border border-amber-500/10 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </motion.div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-8 text-center text-slate-500 text-xs py-20 flex flex-col items-center justify-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">
                        {isEn ? 'No Candidate Selected' : 'Chưa Chọn Ứng Viên'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {isEn 
                          ? 'Click on any candidate card on the leaderboard list to deep dive into their scores, strengths, and areas for growth.' 
                          : 'Bấm chọn ứng viên từ bảng xếp hạng bên trái để xem phân tích chi tiết thế mạnh, điểm yếu và nhận định từ AI.'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
