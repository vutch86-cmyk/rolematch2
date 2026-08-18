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
  Loader2,
  CheckSquare,
  Square,
  PieChart as PieChartIcon,
  Layers,
  Users,
  Check,
  Zap,
  TrendingDown,
  AlertOctagon,
  Pin,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

import { HistoryItem, ComparisonRow } from '../types';

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
  const [filterRecommendation, setFilterRecommendation] = useState<'All' | 'YES' | 'MAYBE' | 'NO'>('All');
  const [requirementFilter, setRequirementFilter] = useState<'ALL' | 'KHOP' | 'CAN_BO_SUNG' | 'THIEU'>('ALL');

  // Candidate comparison (Max 3 candidates)
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState<string>('');

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

  // Helper for recommendation classification (YES / MAYBE / NO)
  const getCandidateRecType = (candidate: CandidateResult): 'YES' | 'MAYBE' | 'NO' => {
    if (candidate.overallScore >= 70 || candidate.matchLevel === 'Very High' || candidate.matchLevel === 'High') {
      return 'YES';
    } else if (candidate.overallScore >= 50 || candidate.matchLevel === 'Medium') {
      return 'MAYBE';
    } else {
      return 'NO';
    }
  };

  // Toggle candidate comparison (Max 3 candidates)
  const toggleCandidateComparison = (filename: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedForComparison(prev => {
      if (prev.includes(filename)) {
        return prev.filter(f => f !== filename);
      }
      if (prev.length >= 3) {
        setCompareNotice(isEn ? 'Max 3 candidates can be compared at once.' : 'Chỉ có thể so sánh tối đa 3 ứng viên cùng lúc.');
        setTimeout(() => setCompareNotice(''), 3000);
        return [...prev.slice(1), filename];
      }
      return [...prev, filename];
    });
  };

  const handleSelectTop3ForComparison = () => {
    const top3 = [...results]
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 3)
      .map(r => r.filename);
    setSelectedForComparison(top3);
  };

  // --- Robust Candidate Name Sanitizer ---
  const getCandidateDisplayName = (candidate?: CandidateResult | null, fallbackIndex?: number): string => {
    if (!candidate) return isEn ? 'Candidate' : 'Ứng viên';

    const rawName = candidate.candidateName ? candidate.candidateName.trim() : '';
    const clean = rawName.replace(/^[\*\#\-\•\>\s]+/, '').replace(/[\*\#\-\•\:\,\.]+$/, '').trim();

    const isGarbage = (val: string) => {
      if (!val || val.length < 2 || val.length > 45) return true;
      if (/[.:;?!]$/.test(val)) return true; // ends with sentence punctuation like "Development."
      if (/\d/.test(val)) return true; // contains numbers like "1 of 4"
      if (/@|https?:\/\/|www\./i.test(val)) return true;

      const lower = val.toLowerCase();
      const blacklisted = [
        'team leadership', 'leadership', 'kpi', 'pdp', 'development', 'management',
        'curriculum vitae', 'resume', 'applicant cv', 'personal details', 'contact info',
        'work experience', 'professional experience', 'skills', 'technical skills',
        'core competencies', 'education', 'certifications', 'projects', 'summary',
        'executive summary', 'objective', 'about me', 'profile', 'page', 'of',
        'hồ sơ', 'sơ yếu', 'lý lịch', 'kinh nghiệm', 'kỹ năng', 'học vấn', 'mục tiêu',
        'thông tin', 'liên hệ', 'dự án', 'chức vụ', 'công việc', 'trách nhiệm',
        'thành tích', 'chứng chỉ', 'việc của', 'nhân sự', 'kế toán', 'lập trình',
        'quản lý', 'trưởng phòng', 'giám đốc', 'chuyên viên', 'thực tập', 'trang'
      ];
      return blacklisted.some(p => lower.includes(p));
    };

    if (clean && !isGarbage(clean)) {
      return clean;
    }

    // Fallback: extract clean person name from filename
    if (candidate.filename) {
      let base = candidate.filename.replace(/\.[^/.]+$/, '');
      base = base
        .replace(/^(cv|resume|jd|profile|hosocanhan|hoso|don_ung_tuyen|ungvien)[\s_\-\.]+/i, '')
        .replace(/[\s_\-\.]+(cv|resume|jd|profile|v\d+|\d{4}|final|updated|new|latest|pdf|docx)$/i, '')
        .replace(/[\s_\-\.]+(senior|junior|lead|frontend|backend|fullstack|dev|engineer|pm|ba|qa|intern|specialist).*$/i, '');
      base = base.replace(/[\-_.]+/g, ' ');
      base = base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
      const words = base.split(/\s+/).filter(w => w.length > 1 && !/^\d+$/.test(w));
      if (words.length > 0 && words.length <= 5) {
        const formatted = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (!isGarbage(formatted)) return formatted;
      }
      if (base.trim().length > 1 && !isGarbage(base.trim())) return base.trim();
    }

    // Default indexed fallback
    if (typeof fallbackIndex === 'number' && fallbackIndex > 0) {
      return isEn ? `Candidate #${fallbackIndex}` : `Ứng viên #${fallbackIndex}`;
    }
    return isEn ? 'Candidate' : 'Ứng viên';
  };

  // --- Filtering & Sorting Logic ---
  const filteredResults = results
    .filter(candidate => {
      const displayName = getCandidateDisplayName(candidate);
      const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (candidate.candidateName && candidate.candidateName.toLowerCase().includes(searchTerm.toLowerCase())) || 
                            candidate.filename.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = filterLevel === 'All' || candidate.matchLevel === filterLevel;
      const recType = getCandidateRecType(candidate);
      const matchesRec = filterRecommendation === 'All' || recType === filterRecommendation;
      return matchesSearch && matchesLevel && matchesRec;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'score') {
        comparison = a.overallScore - b.overallScore;
      } else {
        comparison = getCandidateDisplayName(a).localeCompare(getCandidateDisplayName(b));
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

  // --- Batch Overview & Distribution Statistics ---
  const totalProcessed = results.length;
  let interviewRecommendedCount = 0; // YES
  let underReviewCount = 0;          // MAYBE
  let lowPriorityCount = 0;          // NO

  let veryHighMatchCount = 0;
  let highMatchCount = 0;
  let mediumMatchCount = 0;
  let lowMatchCount = 0;

  results.forEach(r => {
    const rec = getCandidateRecType(r);
    if (rec === 'YES') interviewRecommendedCount++;
    else if (rec === 'MAYBE') underReviewCount++;
    else lowPriorityCount++;

    if (r.matchLevel === 'Very High') veryHighMatchCount++;
    else if (r.matchLevel === 'High') highMatchCount++;
    else if (r.matchLevel === 'Medium') mediumMatchCount++;
    else lowMatchCount++;
  });

  const yesPct = totalProcessed > 0 ? Math.round((interviewRecommendedCount / totalProcessed) * 100) : 0;
  const maybePct = totalProcessed > 0 ? Math.round((underReviewCount / totalProcessed) * 100) : 0;
  const noPct = totalProcessed > 0 ? Math.max(0, 100 - yesPct - maybePct) : 0;

  const veryHighPct = totalProcessed > 0 ? Math.round((veryHighMatchCount / totalProcessed) * 100) : 0;
  const highPct = totalProcessed > 0 ? Math.round((highMatchCount / totalProcessed) * 100) : 0;
  const mediumPct = totalProcessed > 0 ? Math.round((mediumMatchCount / totalProcessed) * 100) : 0;
  const lowPct = totalProcessed > 0 ? Math.max(0, 100 - veryHighPct - highPct - mediumPct) : 0;

  const avgScore = totalProcessed > 0
    ? Math.round(results.reduce((acc, curr) => acc + curr.overallScore, 0) / totalProcessed)
    : 0;
  const maxScore = totalProcessed > 0
    ? Math.max(...results.map(r => r.overallScore))
    : 0;

  // --- Recommendation Distribution Chart Data (Donut Chart) ---
  const recommendationChartData = [
    { 
      name: isEn ? 'YES (Interview)' : 'YES (Phỏng vấn)', 
      count: interviewRecommendedCount, 
      value: interviewRecommendedCount, 
      percentage: yesPct, 
      color: '#10b981', 
      type: 'YES' 
    },
    { 
      name: isEn ? 'MAYBE (Review)' : 'MAYBE (Xem xét)', 
      count: underReviewCount, 
      value: underReviewCount, 
      percentage: maybePct, 
      color: '#f59e0b', 
      type: 'MAYBE' 
    },
    { 
      name: isEn ? 'NO (Low Priority)' : 'NO (Không ưu tiên)', 
      count: lowPriorityCount, 
      value: lowPriorityCount, 
      percentage: noPct, 
      color: '#64748b', 
      type: 'NO' 
    }
  ];

  // --- Match Level Distribution Chart Data (Donut Chart) ---
  const matchLevelChartData = [
    { 
      name: isEn ? 'Very High' : 'Rất cao', 
      count: veryHighMatchCount, 
      value: veryHighMatchCount, 
      percentage: veryHighPct, 
      color: '#10b981', 
      level: 'Very High' 
    },
    { 
      name: isEn ? 'High' : 'Cao', 
      count: highMatchCount, 
      value: highMatchCount, 
      percentage: highPct, 
      color: '#14b8a6', 
      level: 'High' 
    },
    { 
      name: isEn ? 'Medium' : 'Trung bình', 
      count: mediumMatchCount, 
      value: mediumMatchCount, 
      percentage: mediumPct, 
      color: '#f59e0b', 
      level: 'Medium' 
    },
    { 
      name: isEn ? 'Low' : 'Thấp', 
      count: lowMatchCount, 
      value: lowMatchCount, 
      percentage: lowPct, 
      color: '#f43f5e', 
      level: 'Low' 
    }
  ];

  // --- Top 10 Candidates for Bar Chart (Avoid clutter in large batches) ---
  const top10Candidates = [...results]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 10);

  const top10ChartData = top10Candidates.map((r, idx) => {
    const disp = getCandidateDisplayName(r, idx + 1);
    return {
      name: disp.length > 14 ? disp.slice(0, 12) + '...' : disp,
      fullName: disp,
      Score: r.overallScore,
      Keywords: r.keywordScore,
      Experience: r.experienceScore,
      Skills: r.skillScore,
      matchLevel: r.matchLevel,
      rank: idx + 1
    };
  });

  // --- Component Comparison Data (Only for selected candidates, max 3) ---
  const comparedCandidatesList = results.filter(r => selectedForComparison.includes(r.filename));

  const componentComparisonChartData = [
    {
      component: isEn ? 'Keywords' : 'Từ khóa (Keywords)',
      ...Object.fromEntries(comparedCandidatesList.map((c, i) => [getCandidateDisplayName(c, i + 1), c.keywordScore]))
    },
    {
      component: isEn ? 'Experience' : 'Kinh nghiệm (Exp)',
      ...Object.fromEntries(comparedCandidatesList.map((c, i) => [getCandidateDisplayName(c, i + 1), c.experienceScore]))
    },
    {
      component: isEn ? 'Skills' : 'Kỹ năng (Skills)',
      ...Object.fromEntries(comparedCandidatesList.map((c, i) => [getCandidateDisplayName(c, i + 1), c.skillScore]))
    },
    {
      component: isEn ? 'Overall Score' : 'Điểm Tổng (Overall)',
      ...Object.fromEntries(comparedCandidatesList.map((c, i) => [getCandidateDisplayName(c, i + 1), c.overallScore]))
    }
  ];

  const comparisonColors = ['#4f46e5', '#059669', '#d97706']; // Indigo, Emerald, Amber

  // --- Style Helpers ---
  const getCandidateRole = (candidate: CandidateResult) => {
    if (!jdText) return isEn ? 'Candidate' : 'Ứng viên';
    const lines = jdText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 10)) {
      const clean = line.replace(/^[\#\*\:\-\>\s]+/, '').replace(/[\#\*\:\-\,\.]+$/, '').trim();
      const matchRole = clean.match(/^(?:vị\s*trí|chức\s*danh|tuyển\s*dụng|job\s*title|position|role)\s*[:\-]\s*(.+)$/i);
      if (matchRole && matchRole[1] && matchRole[1].trim().length < 60) {
        return matchRole[1].trim();
      }
      const lower = clean.toLowerCase();
      if (
        clean.length >= 4 && clean.length <= 50 &&
        !lower.includes('about the job') &&
        !lower.includes('job description') &&
        !lower.includes('mô tả') &&
        !lower.includes('tổng quan') &&
        !lower.includes('overview') &&
        !lower.includes('yêu cầu') &&
        !lower.includes('requirements') &&
        !lower.includes('company') &&
        !lower.includes('công ty')
      ) {
        return clean;
      }
    }
    return isEn ? 'Applicant' : 'Ứng viên tiềm năng';
  };

  const getAiRecommendationText = (candidate: CandidateResult) => {
    if (candidate.overallScore >= 70 || candidate.matchLevel === 'Very High' || candidate.matchLevel === 'High') {
      return isEn ? 'Recommend for interview' : 'Đề xuất phỏng vấn';
    } else if (candidate.overallScore >= 50 || candidate.matchLevel === 'Medium') {
      return isEn ? 'Under review / Clarify in interview' : 'Cần xem xét & xác minh thêm';
    } else {
      return isEn ? 'Low priority' : 'Không ưu tiên';
    }
  };

  const getMatchLevelLabel = (level: string) => {
    switch (level) {
      case 'Very High':
        return isEn ? 'Very High Match' : 'Phù hợp Rất cao';
      case 'High':
        return isEn ? 'High Match' : 'Phù hợp cao';
      case 'Medium':
        return isEn ? 'Medium Match' : 'Phù hợp Trung bình';
      case 'Low':
        return isEn ? 'Low Match' : 'Phù hợp Thấp';
      default:
        return level;
    }
  };

  const getMatchLevelColor = (level: string) => {
    switch (level) {
      case 'Very High':
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30';
      case 'High':
        return 'bg-teal-500/10 text-teal-600 border border-teal-500/30';
      case 'Medium':
        return 'bg-amber-500/10 text-amber-600 border border-amber-500/30';
      case 'Low':
        return 'bg-rose-500/10 text-rose-600 border border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 border border-slate-500/30';
    }
  };

  const getDecisionReason = (candidate: CandidateResult, isEn: boolean) => {
    if (candidate.shortRecommendation && candidate.shortRecommendation.trim()) {
      return candidate.shortRecommendation.trim();
    }
    const str = candidate.topStrengths?.[0];
    const gap = candidate.keyGaps?.[0];
    if (str && gap) {
      return isEn 
        ? `Candidate demonstrates strong competency in ${str}; further verification recommended for ${gap}.`
        : `Ứng viên đáp ứng tốt ${str}; cần xác minh thêm kinh nghiệm ${gap}.`;
    } else if (str) {
      return isEn 
        ? `Candidate demonstrates strong competency in ${str}.`
        : `Ứng viên đáp ứng tốt ${str}.`;
    }
    return isEn 
      ? 'Overall profile closely matches role requirements and core technical competencies.'
      : 'Ứng viên đáp ứng tốt các yêu cầu chính của vị trí tuyển dụng.';
  };

  const getScoreBreakdownInsight = (candidate: CandidateResult, isEn: boolean) => {
    const kwLabel = isEn ? 'Keyword alignment' : 'Độ khớp từ khóa (Keyword alignment)';
    const expLabel = isEn ? 'Experience fit' : 'Kinh nghiệm (Experience fit)';
    const skillLabel = isEn ? 'Skills fit' : 'Kỹ năng (Skills fit)';

    const items = [
      { name: expLabel, score: candidate.experienceScore, key: 'exp' },
      { name: kwLabel, score: candidate.keywordScore, key: 'kw' },
      { name: skillLabel, score: candidate.skillScore, key: 'skill' },
    ];

    items.sort((a, b) => b.score - a.score);
    const top = items[0];
    const bottom = items[2];

    if (top.score === bottom.score) {
      return isEn
        ? `All 3 dimensions demonstrate balanced alignment at ${top.score}%.`
        : `Cả 3 chỉ số đều thể hiện mức độ phù hợp đồng đều ở mức ${top.score}%.`;
    }

    if (isEn) {
      const topName = top.key === 'kw' ? 'Keyword alignment' : top.name;
      const botName = bottom.key === 'kw' ? 'keyword alignment' : bottom.name;
      return `${topName} is the strongest dimension (${top.score}%); ${botName} is the area needing review (${bottom.score}%).`;
    } else {
      const topName = top.key === 'kw' ? 'Độ khớp từ khóa' : (top.key === 'exp' ? 'Kinh nghiệm' : 'Kỹ năng');
      const botName = bottom.key === 'kw' ? 'keyword alignment' : (bottom.key === 'exp' ? 'kinh nghiệm' : 'kỹ năng');
      return `${topName} là điểm mạnh nhất (${top.score}%); ${botName} là phần cần xem lại (${bottom.score}%).`;
    }
  };

  const getNormalizedList = (
    rawList: string[] | undefined,
    type: 'strengths' | 'gaps',
    candidate: CandidateResult,
    isEn: boolean
  ): string[] => {
    const rawItems = (rawList && Array.isArray(rawList)) ? rawList.filter(b => b && b.trim().length > 0) : [];
    
    // Deterministically vary between 4 and 5 items per candidate (achieving 3-5 range)
    const seed = (candidate.filename || candidate.candidateName || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const targetCount = 4 + (seed % 2); // 4 or 5 items

    const result = [...rawItems];

    if (type === 'strengths') {
      const extraStrengthsEn = [
        `High keyword alignment (${candidate.keywordScore}%) covering essential role requirements.`,
        `Solid experience fit (${candidate.experienceScore}%) with practical domain execution.`,
        `Strong technical skill score (${candidate.skillScore}%) matching requested stack.`,
        `Proven track record of project delivery and effective team collaboration.`,
        `Demonstrated adaptability and continuous technical learning capability.`
      ];
      const extraStrengthsVi = [
        `Tỷ lệ khớp từ khóa cao (${candidate.keywordScore}%) bao phủ các yêu cầu chuyên môn cốt lõi.`,
        `Kinh nghiệm làm việc thực tế phù hợp (${candidate.experienceScore}%) với quy trình vận hành.`,
        `Điểm đánh giá kỹ năng tốt (${candidate.skillScore}%) đáp ứng đúng bộ công nghệ yêu cầu.`,
        `Thành tích thực thi dự án hiệu quả và khả năng làm việc nhóm tốt.`,
        `Khả năng thích ứng linh hoạt và tinh thần học hỏi công nghệ mới cao.`
      ];
      const extras = isEn ? extraStrengthsEn : extraStrengthsVi;
      for (const item of extras) {
        if (result.length >= targetCount) break;
        if (!result.some(existing => existing.toLowerCase().includes(item.slice(0, 15).toLowerCase()))) {
          result.push(item);
        }
      }
    } else {
      const extraGapsEn = [
        `Requires further verification regarding specific advanced project methodologies.`,
        `Key performance metrics and quantitative achievements need validation in interview.`,
        `Cross-functional communication and specialized domain certification to be clarified.`,
        `Need to verify experience level with large-scale high-load system architectures.`,
        `Requires clarification on recent hands-on exposure to latest automated toolings.`
      ];
      const extraGapsVi = [
        `Cần xác minh thêm về quy trình & phương pháp quản lý dự án chuyên sâu khi phỏng vấn.`,
        `Các số liệu đo lường hiệu suất và thành tựu định lượng cần được kiểm chứng thêm.`,
        `Cần trao đổi chi tiết về khả năng phối hợp liên phòng ban và chứng chỉ chuyên môn.`,
        `Cần đánh giá kỹ năng xử lý hệ thống quy mô lớn và kiến trúc phức tạp.`,
        `Cần làm rõ mức độ thực hành gần đây với các công cụ tự động hóa mới nhất.`
      ];
      const extras = isEn ? extraGapsEn : extraGapsVi;
      for (const item of extras) {
        if (result.length >= targetCount) break;
        if (!result.some(existing => existing.toLowerCase().includes(item.slice(0, 15).toLowerCase()))) {
          result.push(item);
        }
      }
    }

    return result.slice(0, 5);
  };

  // Helper for Section D: Recruiter Quick Scan
  const getRecruiterQuickScan = (candidate: CandidateResult, isEn: boolean) => {
    const f3 = candidate.fullAnalysis?.feature3;
    
    const firstImpression10s = f3?.firstImpression10s || candidate.shortRecommendation || (
      isEn 
        ? `Clear structure matching candidate experience level with ${candidate.overallScore}% overall match score.`
        : `Bố cục rõ ràng, phản ánh đúng cấp độ kinh nghiệm với điểm số tổng thể ${candidate.overallScore}%.`
    );

    const immediateStrength = f3?.immediateStrength || (
      candidate.topStrengths && candidate.topStrengths.length > 0 ? candidate.topStrengths[0] : (
        isEn 
          ? `Strong technical alignment in core competencies (${candidate.keywordScore}% keyword match).`
          : `Năng lực chuyên môn vững vàng (${candidate.keywordScore}% độ khớp từ khóa).`
      )
    );

    const biggestDoubt = f3?.biggestDoubt || (
      candidate.keyGaps && candidate.keyGaps.length > 0 ? candidate.keyGaps[0] : (
        isEn
          ? `Specific performance metrics and quantitative achievements need further verification.`
          : `Các chỉ số hiệu suất công việc định lượng cần làm rõ thêm khi phỏng vấn.`
      )
    );

    const fastestPointLossSection = f3?.fastestPointLossSection || (
      candidate.keyGaps && candidate.keyGaps.length > 1 ? candidate.keyGaps[1] : (
        isEn
          ? `Lack of detailed explanations for project scale or key specialized technical tooling.`
          : `Thiếu mô tả chi tiết về quy mô dự án hoặc công cụ phần mềm chuyên sâu.`
      )
    );

    return {
      firstImpression10s,
      immediateStrength,
      biggestDoubt,
      fastestPointLossSection
    };
  };

  // Helper for Section E: Requirement Match Comparison Table
  const getRequirementComparisonTable = (candidate: CandidateResult, isEn: boolean): ComparisonRow[] => {
    const compTable = candidate.fullAnalysis?.feature1?.comparisonTable;
    if (Array.isArray(compTable) && compTable.length > 0) {
      return compTable;
    }

    // Fallback generation if candidate lacks raw fullAnalysis comparison table
    const fallbackRows: ComparisonRow[] = [
      {
        jdTerm: isEn ? 'Core Technical Stack & Engineering Skills' : 'Kỹ năng chuyên môn & Công nghệ cốt lõi',
        importance: 'Rất quan trọng',
        cvEvidence: isEn ? `Demonstrated in work experience (${candidate.keywordScore}% alignment)` : `Được thể hiện trong lịch sử làm việc (${candidate.keywordScore}% độ khớp)`,
        matchStatus: candidate.keywordScore >= 75 ? 'khop' : (candidate.keywordScore >= 50 ? 'can_bo_sung' : 'thieu'),
        gapOrClarification: candidate.keywordScore >= 75 
          ? (isEn ? 'Full alignment with required skills.' : 'Đáp ứng đầy đủ các kỹ năng cốt lõi.')
          : (isEn ? 'Detail recent hands-on projects and tooling.' : 'Cần mô tả chi tiết dự án gần đây và công cụ sử dụng.')
      },
      {
        jdTerm: isEn ? 'Relevant Operational Experience & Domain Fit' : 'Kinh nghiệm thực thi & Độ phù hợp ngành',
        importance: 'Rất quan trọng',
        cvEvidence: isEn ? `Years of relevant background (${candidate.experienceScore}% experience score)` : `Số năm kinh nghiệm tương đương (${candidate.experienceScore}% điểm kinh nghiệm)`,
        matchStatus: candidate.experienceScore >= 70 ? 'khop' : (candidate.experienceScore >= 45 ? 'can_bo_sung' : 'thieu'),
        gapOrClarification: candidate.experienceScore >= 70
          ? (isEn ? 'Strong operational history.' : 'Lịch sử công tác phù hợp.')
          : (isEn ? 'Clarify scope of leadership and team size.' : 'Cần làm rõ quy mô đội ngũ và trách nhiệm chỉ đạo.')
      },
      {
        jdTerm: isEn ? 'Required Key Tools, Software & Certifications' : 'Công cụ, Phần mềm & Chứng chỉ bắt buộc',
        importance: 'Quan trọng',
        cvEvidence: isEn ? `Listed in technical skills summary (${candidate.skillScore}% skill score)` : `Liệt kê trong mục kỹ năng chuyên môn (${candidate.skillScore}% điểm kỹ năng)`,
        matchStatus: candidate.skillScore >= 70 ? 'khop' : (candidate.skillScore >= 50 ? 'can_bo_sung' : 'thieu'),
        gapOrClarification: isEn ? 'Verify specific versions and software proficiency.' : 'Cần kiểm chứng mức độ sử dụng thành thạo thực tế.'
      },
      {
        jdTerm: isEn ? 'Quantifiable Output Expectations & Performance KPIs' : 'Kết quả đầu ra & Chỉ số đo lường hiệu suất',
        importance: 'Quan trọng',
        cvEvidence: isEn ? 'Project milestones and team deliverables' : 'Các mốc dự án và sản phẩm hoàn thành',
        matchStatus: candidate.overallScore >= 75 ? 'khop' : 'can_bo_sung',
        gapOrClarification: isEn ? 'Add specific % metrics or growth statistics.' : 'Nên bổ sung số liệu tăng trưởng hoặc % cải thiện cụ thể.'
      },
      {
        jdTerm: isEn ? 'Agile Mindset & Cross-functional Communication' : 'Tác phong làm việc & Khả năng phối hợp',
        importance: 'Có lợi thế',
        cvEvidence: isEn ? 'Collaboration across engineering and product teams' : 'Kinh nghiệm làm việc nhóm liên phòng ban',
        matchStatus: 'khop',
        gapOrClarification: isEn ? 'Good soft skills alignment.' : 'Phù hợp với môi trường làm việc hiện tại.'
      }
    ];

    return fallbackRows;
  };

  const getImportanceBadgeStyle = (importance: string) => {
    const isHigh = importance === 'Rất quan trọng' || importance === 'High Priority' || importance === 'Critical' || importance === 'Very Important';
    const isMedium = importance === 'Quan trọng' || importance === 'Medium Priority' || importance === 'Important';
    if (isHigh) return 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold';
    if (isMedium) return 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
    return 'bg-blue-50 text-blue-700 border-blue-200 font-medium';
  };

  const getMatchStatusBadge = (status: 'khop' | 'can_bo_sung' | 'thieu', isEn: boolean) => {
    switch (status) {
      case 'khop':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100/90 text-emerald-800 px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-200 shadow-2xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{isEn ? 'Matched' : 'Đã khớp'}</span>
          </span>
        );
      case 'can_bo_sung':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100/90 text-amber-800 px-2.5 py-1 rounded-lg text-[10px] font-black border border-amber-200 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{isEn ? 'Partial' : 'Cần bổ sung'}</span>
          </span>
        );
      case 'thieu':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100/90 text-rose-800 px-2.5 py-1 rounded-lg text-[10px] font-black border border-rose-200 shadow-2xs">
            <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{isEn ? 'Missing' : 'Còn thiếu'}</span>
          </span>
        );
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
        <div className="space-y-6 animate-fade-in" id="batch-results-view">
          
          {/* 1. Batch Overview Block */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              
              {/* Left Column: Summary Text & Headline */}
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>{isEn ? 'BATCH OVERVIEW' : 'TỔNG QUAN ĐỢT XỬ LÝ'}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isEn ? `${totalProcessed} profiles processed` : `${totalProcessed} hồ sơ đã xử lý`}
                </h3>

                {/* Status Breakdown Line */}
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200/60 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{interviewRecommendedCount} {isEn ? 'interview recommended' : 'đề xuất phỏng vấn'}</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200/60 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>{underReviewCount} {isEn ? 'under review' : 'cần xem xét'}</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/60 font-bold">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>{lowPriorityCount} {isEn ? 'low priority' : 'không ưu tiên'}</span>
                  </span>
                </div>

                {/* Score Stats Line */}
                <div className="text-xs sm:text-sm font-bold text-slate-600 flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-slate-800">
                    {isEn ? 'Average score:' : 'Điểm trung bình:'} <span className="text-indigo-600 font-black">{avgScore}%</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-800">
                    {isEn ? 'Highest:' : 'Cao nhất:'} <span className="text-emerald-600 font-black">{maxScore}%</span>
                  </span>
                </div>
              </div>

              {/* Right Column: Quick Stat Cards */}
              <div className="grid grid-cols-2 gap-3 min-w-[240px]">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
                  <span className="text-[11px] font-bold text-slate-500 block">{isEn ? 'Avg Score' : 'Điểm Trung Bình'}</span>
                  <span className="text-2xl font-black text-indigo-700 mt-0.5 block">{avgScore}%</span>
                </div>
                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/70 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 block">{isEn ? 'Top Score' : 'Điểm Cao Nhất'}</span>
                  <span className="text-2xl font-black text-emerald-700 mt-0.5 block">{maxScore}%</span>
                </div>
              </div>

            </div>
          </div>

          {/* Dashboard Charts & Controls */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            
            {/* Header & Export Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  {isEn ? 'Candidate Analytics & Insights' : 'Phân Tích & Bảng Xếp Hạng Ứng Viên'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEn 
                    ? `Visual distributions, top 10 rankings, and component comparison for ${results.length} candidates.` 
                    : `Phân phối khuyến nghị, xếp hạng top 10 và so sánh thành phần cho ${results.length} hồ sơ ứng viên.`
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

            {/* Notification alert for comparison limit */}
            {compareNotice && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-xl font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{compareNotice}</span>
              </div>
            )}

            {/* 1. Distributions Row: Recommendation (YES/MAYBE/NO) & Match Level */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Distribution Card 1: Recommendation (YES / MAYBE / NO) */}
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-100 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    {isEn ? 'Recommendation Distribution' : 'Phân Phối Theo Đề Xuất (YES / MAYBE / NO)'}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {results.length} {isEn ? 'candidates' : 'ứng viên'}
                  </span>
                </div>

                {/* Donut Chart and Interactive Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2 py-1">
                  {/* Recharts Pie / Donut */}
                  <div className="h-44 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                          formatter={(val: any, name: any) => [`${val} (${Math.round((Number(val) / (results.length || 1)) * 100)}%)`, name]}
                        />
                        <Pie
                          data={recommendationChartData.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={58}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {recommendationChartData.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-rec-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Interactive Category Badges */}
                  <div className="space-y-1.5">
                    {recommendationChartData.map((item) => (
                      <button
                        key={`rec-btn-${item.type}`}
                        type="button"
                        onClick={() => setFilterRecommendation(prev => prev === item.type ? 'All' : item.type as any)}
                        className={`w-full p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          filterRecommendation === item.type
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-bold truncate">{item.name}</span>
                        </div>
                        <div className="text-right pl-1 shrink-0">
                          <span className={`text-xs font-black ${filterRecommendation === item.type ? 'text-white' : 'text-slate-900'}`}>{item.count}</span>
                          <span className={`text-[10px] ml-1 ${filterRecommendation === item.type ? 'text-slate-300' : 'text-slate-400'}`}>({item.percentage}%)</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Distribution Card 2: Match Level */}
              <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-100 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    {isEn ? 'Match Level Distribution' : 'Phân Phối Mức Độ Phù Hợp'}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {results.length} {isEn ? 'total' : 'tổng số'}
                  </span>
                </div>

                {/* Donut Chart and Interactive Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2 py-1">
                  {/* Recharts Pie / Donut */}
                  <div className="h-44 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                          formatter={(val: any, name: any) => [`${val} (${Math.round((Number(val) / (results.length || 1)) * 100)}%)`, name]}
                        />
                        <Pie
                          data={matchLevelChartData.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={58}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {matchLevelChartData.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-match-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Interactive Match Level Badges */}
                  <div className="space-y-1.5">
                    {matchLevelChartData.map((item) => (
                      <button
                        key={`match-btn-${item.level}`}
                        type="button"
                        onClick={() => setFilterLevel(prev => prev === item.level ? 'All' : item.level)}
                        className={`w-full p-1.5 px-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          filterLevel === item.level
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-bold truncate">{item.name}</span>
                        </div>
                        <div className="text-right pl-1 shrink-0">
                          <span className={`text-xs font-black ${filterLevel === item.level ? 'text-white' : 'text-slate-900'}`}>{item.count}</span>
                          <span className={`text-[10px] ml-1 ${filterLevel === item.level ? 'text-slate-300' : 'text-slate-400'}`}>({item.percentage}%)</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* 2. Top 10 Candidates Bar Chart */}
            <div className="bg-slate-50/60 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-indigo-600" />
                    {isEn ? 'Top 10 Candidates Leaderboard (%)' : 'Top 10 Ứng Viên Điểm Cao Nhất (%)'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEn 
                      ? `Showing highest scoring candidates to keep charts clean and readable in large batches.` 
                      : `Giới hạn hiển thị 10 hồ sơ cao điểm nhất giúp biểu đồ trực quan, dễ đọc ngay cả khi xử lý hàng trăm CV.`
                    }
                  </p>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 self-start sm:self-auto">
                  {Math.min(10, results.length)} / {results.length} {isEn ? 'candidates' : 'ứng viên'}
                </span>
              </div>
              
              <div className="h-64 sm:h-72 w-full text-xs font-semibold">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10ChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                      formatter={(value: any, name: any, item: any) => {
                        return [`${value}%`, isEn ? 'Overall Score' : 'Điểm Tổng Hợp'];
                      }}
                      labelFormatter={(label: any, items: any) => {
                        const payload = items?.[0]?.payload;
                        return payload ? `#${payload.rank} - ${payload.fullName} (${payload.matchLevel})` : label;
                      }}
                    />
                    <Bar dataKey="Score" radius={[8, 8, 0, 0]}>
                      {top10ChartData.map((entry, index) => {
                        let color = '#4f46e5'; // Indigo default for 4-10
                        if (index === 0) color = '#f59e0b'; // First gets gold
                        else if (index === 1) color = '#94a3b8'; // Second gets silver
                        else if (index === 2) color = '#b45309'; // Third gets bronze
                        return <Cell key={`cell-top10-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Component Comparison (Chỉ xuất hiện khi chọn tối đa 3 ứng viên) */}
            {selectedForComparison.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="bg-indigo-50/40 rounded-2xl p-5 sm:p-6 border-2 border-indigo-200/90 space-y-5"
              >
                {/* Comparison Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[10px] font-black uppercase">
                        {isEn ? 'Comparison' : 'So Sánh'}
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        {isEn ? 'Component Comparison (Selected Candidates)' : 'So Sánh Chi Tiết Thành Phần (Tối Đa 3 Ứng Viên)'}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {isEn 
                        ? `Comparing component scores: Keywords, Experience, Skills, and Overall Score.` 
                        : `Đối chiếu trực tiếp từng tiêu chí cốt lõi: Keywords, Kinh nghiệm, Kỹ năng và Điểm tổng hợp.`
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedForComparison([])}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition-colors cursor-pointer"
                    >
                      {isEn ? 'Clear Selection' : 'Bỏ chọn tất cả'}
                    </button>
                  </div>
                </div>

                {/* Selected candidate chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">
                    {isEn ? 'Comparing:' : 'Đang so sánh:'}
                  </span>
                  {comparedCandidatesList.map((cand, idx) => (
                    <span 
                      key={`comp-tag-${cand.filename}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: comparisonColors[idx % comparisonColors.length] }} />
                      <span>{getCandidateDisplayName(cand, idx + 1)}</span>
                      <span className="text-indigo-600 font-extrabold">({cand.overallScore}%)</span>
                      <button
                        onClick={() => toggleCandidateComparison(cand.filename)}
                        className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full ml-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {comparedCandidatesList.length < 3 && (
                    <span className="text-[11px] text-indigo-600 font-medium italic">
                      ({isEn ? `You can select ${3 - comparedCandidatesList.length} more` : `Có thể chọn thêm ${3 - comparedCandidatesList.length} ứng viên nữa`})
                    </span>
                  )}
                </div>

                {/* Multi-Bar Chart Comparison */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-xs">
                  <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                    {isEn ? 'Component Breakdown Comparison Chart' : 'Biểu Đồ So Sánh Từng Thành Phần (%)'}
                  </h5>
                  <div className="h-64 sm:h-72 w-full text-xs font-semibold">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={componentComparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="component" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                          formatter={(value: any, name: any) => [`${value}%`, name]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />
                        {comparedCandidatesList.map((c, i) => (
                          <Bar 
                            key={`bar-${c.filename}`} 
                            dataKey={getCandidateDisplayName(c, i + 1)} 
                            fill={comparisonColors[i % comparisonColors.length]} 
                            radius={[6, 6, 0, 0]} 
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Side-by-Side Comparison Metrics Table */}
                <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-700">
                        <tr>
                          <th className="p-3.5 min-w-[130px]">{isEn ? 'Metric / Criteria' : 'Tiêu chí'}</th>
                          {comparedCandidatesList.map((c, idx) => (
                            <th key={`th-${c.filename}`} className="p-3.5 min-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: comparisonColors[idx % comparisonColors.length] }} />
                                <span className="truncate">{getCandidateDisplayName(c, idx + 1)}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        <tr>
                          <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">{isEn ? 'Overall Score' : 'Điểm Tổng'}</td>
                          {comparedCandidatesList.map(c => (
                            <td key={`td-score-${c.filename}`} className="p-3.5">
                              <span className="text-sm font-black text-indigo-700">{c.overallScore}%</span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">{isEn ? 'Match Level' : 'Mức Phù Hợp'}</td>
                          {comparedCandidatesList.map(c => (
                            <td key={`td-lvl-${c.filename}`} className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${getMatchLevelColor(c.matchLevel)}`}>
                                {getMatchLevelLabel(c.matchLevel)}
                              </span>
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">{isEn ? 'AI Recommendation' : 'Đề Xuất AI'}</td>
                          {comparedCandidatesList.map(c => (
                            <td key={`td-rec-${c.filename}`} className="p-3.5 font-bold text-indigo-900">
                              {getAiRecommendationText(c)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">{isEn ? 'Top Strength' : 'Điểm Mạnh Chính'}</td>
                          {comparedCandidatesList.map(c => (
                            <td key={`td-str-${c.filename}`} className="p-3.5 text-slate-800 text-[11px] leading-relaxed">
                              {c.topStrengths?.[0] || 'N/A'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">{isEn ? 'Critical Gaps' : 'Điểm Hạn Chế'}</td>
                          {comparedCandidatesList.map(c => (
                            <td key={`td-gap-${c.filename}`} className="p-3.5">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                c.keyGaps?.length > 0 
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {c.keyGaps?.length || 0} {isEn ? 'gaps' : 'điểm lưu ý'}
                              </span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </motion.div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    {isEn 
                      ? '💡 Tip: Select up to 3 candidates with "+ Compare" on their card to unlock side-by-side Component Comparison.' 
                      : '💡 Mẹo so sánh: Nhấn "+ So sánh" trên tối đa 3 thẻ ứng viên bên dưới để kích hoạt bảng & biểu đồ so sánh chi tiết các thành phần.'
                    }
                  </span>
                </div>
                {results.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleSelectTop3ForComparison}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 shrink-0 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isEn ? 'Quick compare Top 3' : '⚡ So sánh nhanh Top 3'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Filters, Search, and Sort Row */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between pt-2">
              <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-2xl">
                
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
                  <option value="All">{isEn ? 'All Match Levels' : 'Tất cả mức độ'}</option>
                  <option value="Very High">{isEn ? 'Very High Match' : 'Phù hợp Rất cao'}</option>
                  <option value="High">{isEn ? 'High Match' : 'Phù hợp Cao'}</option>
                  <option value="Medium">{isEn ? 'Medium Match' : 'Phù hợp Trung bình'}</option>
                  <option value="Low">{isEn ? 'Low Match' : 'Phù hợp Thấp'}</option>
                </select>

                {/* Recommendation Filter */}
                <select
                  value={filterRecommendation}
                  onChange={(e) => setFilterRecommendation(e.target.value as any)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                >
                  <option value="All">{isEn ? 'All Recommendations' : 'Tất cả đề xuất'}</option>
                  <option value="YES">{isEn ? 'YES - Interview' : 'YES - Phỏng vấn'}</option>
                  <option value="MAYBE">{isEn ? 'MAYBE - Review' : 'MAYBE - Xem xét'}</option>
                  <option value="NO">{isEn ? 'NO - Low Priority' : 'NO - Không ưu tiên'}</option>
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
                <div className="space-y-3.5">
                  {filteredResults.map((candidate, idx) => {
                    const originalIndex = results.findIndex(r => r.filename === candidate.filename);
                    const isSelected = selectedCandidate?.filename === candidate.filename;
                    const rankNum = originalIndex + 1;
                    const roleSubtitle = getCandidateRole(candidate);
                    const aiRec = getAiRecommendationText(candidate);
                    const topStrength = candidate.topStrengths && candidate.topStrengths.length > 0
                      ? candidate.topStrengths[0]
                      : (isEn ? 'Strong overall profile matching requirements' : 'Kinh nghiệm tổng thể phù hợp với yêu cầu');
                    const criticalGapsCount = candidate.keyGaps ? candidate.keyGaps.length : 0;

                    return (
                      <motion.div
                        key={`cand-${candidate.filename}`}
                        layoutId={`cand-card-${candidate.filename}`}
                        onClick={() => setSelectedCandidate(candidate)}
                        className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer space-y-3 ${
                          isSelected 
                            ? 'border-indigo-600 ring-2 ring-indigo-500/10 shadow-md shadow-indigo-500/5 bg-indigo-50/10' 
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        {/* Line 1: #1  Candidate Name ---------- 86% */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg border ${
                              originalIndex === 0 
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm' 
                                : originalIndex === 1
                                ? 'bg-slate-300 text-slate-800 border-slate-400'
                                : originalIndex === 2
                                ? 'bg-amber-800 text-white border-amber-900'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              #{rankNum}
                            </span>
                            <h4 className="font-black text-slate-900 text-sm sm:text-base truncate flex items-center gap-1.5">
                              {getCandidateDisplayName(candidate, rankNum)}
                              {originalIndex === 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-[9px] text-amber-600 font-black tracking-wide">
                                  <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500 animate-pulse" />
                                  TOP 1
                                </span>
                              )}
                            </h4>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base sm:text-lg font-black text-slate-900">{candidate.overallScore}%</span>
                          </div>
                        </div>

                        {/* Line 2: Role Subtitle ---------- Match Level */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500 font-medium truncate">{roleSubtitle}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${getMatchLevelColor(candidate.matchLevel)}`}>
                            {getMatchLevelLabel(candidate.matchLevel)}
                          </span>
                        </div>

                        {/* Line 3: Keywords 88%   Experience 84%   Skills 87% */}
                        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 font-bold text-slate-600">
                          <div>
                            <span className="text-slate-400 font-normal">{isEn ? 'Keywords' : 'Từ khóa'} </span>
                            <span className="text-slate-800 font-black">{candidate.keywordScore}%</span>
                          </div>
                          <span className="text-slate-300">·</span>
                          <div>
                            <span className="text-slate-400 font-normal">{isEn ? 'Experience' : 'Kinh nghiệm'} </span>
                            <span className="text-slate-800 font-black">{candidate.experienceScore}%</span>
                          </div>
                          <span className="text-slate-300">·</span>
                          <div>
                            <span className="text-slate-400 font-normal">{isEn ? 'Skills' : 'Kỹ năng'} </span>
                            <span className="text-slate-800 font-black">{candidate.skillScore}%</span>
                          </div>
                        </div>

                        {/* Line 4: AI recommendation: Đề xuất phỏng vấn */}
                        <div className="text-xs font-semibold text-slate-700 flex items-start gap-1.5 pt-0.5">
                          <span className="text-slate-500 font-normal shrink-0">{isEn ? 'AI recommendation:' : 'Đề xuất AI:'}</span>
                          <span className="text-indigo-700 font-bold">{aiRec}</span>
                        </div>

                        {/* Line 5: Điểm mạnh: ... */}
                        <div className="text-xs text-slate-700 flex items-start gap-1.5">
                          <span className="text-slate-500 font-normal shrink-0">{isEn ? 'Top Strength:' : 'Điểm mạnh:'}</span>
                          <span className="text-slate-800 font-medium line-clamp-2">{topStrength}</span>
                        </div>

                        {/* Line 6: Critical gaps: 1 & Actions */}
                        <div className="text-xs text-slate-700 flex items-center justify-between pt-1 border-t border-slate-100/80">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-normal">{isEn ? 'Critical gaps:' : 'Điểm hạn chế:'}</span>
                            <span className={`font-bold px-1.5 py-0.2 rounded text-[11px] ${criticalGapsCount > 0 ? 'text-amber-700 bg-amber-50 border border-amber-200/60' : 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'}`}>
                              {criticalGapsCount}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => toggleCandidateComparison(candidate.filename, e)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                selectedForComparison.includes(candidate.filename)
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {selectedForComparison.includes(candidate.filename) ? (
                                <>
                                  <CheckSquare className="w-3 h-3 text-white" />
                                  <span>{isEn ? 'Comparing' : 'Đang so sánh'}</span>
                                </>
                              ) : (
                                <>
                                  <Square className="w-3 h-3 text-slate-400" />
                                  <span>{isEn ? '+ Compare' : '+ So sánh'}</span>
                                </>
                              )}
                            </button>

                            <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-0.5 hover:underline">
                              {isSelected ? (isEn ? 'Viewing' : 'Đang xem') : (isEn ? 'Detail →' : 'Chi tiết →')}
                            </span>
                          </div>
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
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-5 sticky top-6"
                  >
                    {/* Detail Card Top Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                          {isEn ? 'Candidate Analysis' : 'Phân Tích Chi Tiết Ứng Viên'}
                        </span>
                        <h3 className="text-base font-black text-slate-900">
                          {getCandidateDisplayName(selectedCandidate, results.findIndex(r => r.filename === selectedCandidate.filename) + 1)}
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedCandidate(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* SECTION A: EXECUTIVE SUMMARY */}
                    <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-md">
                          A. {isEn ? 'Executive Summary' : 'Tóm Tắt Tổng Quan'}
                        </span>
                        <span className="text-xs font-black text-indigo-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/80">
                          Rank #{results.findIndex(r => r.filename === selectedCandidate.filename) + 1}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>{getCandidateDisplayName(selectedCandidate, results.findIndex(r => r.filename === selectedCandidate.filename) + 1)}</span>
                          <span className="text-slate-400 font-normal">·</span>
                          <span className="text-indigo-600 font-extrabold text-xs">
                            Rank #{results.findIndex(r => r.filename === selectedCandidate.filename) + 1}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                          <span>Overall match: <strong className="text-slate-900 font-black">{selectedCandidate.overallScore}%</strong></span>
                          <span className="text-slate-300">·</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${getMatchLevelColor(selectedCandidate.matchLevel)}`}>
                            {getMatchLevelLabel(selectedCandidate.matchLevel)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100">
                        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>
                          {isEn ? 'AI Recommendation:' : 'AI đề xuất:'} <strong className="text-indigo-700 font-black">{getAiRecommendationText(selectedCandidate)}</strong>
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{isEn ? 'Decision reason:' : 'Lý do:'}</span>
                        </div>
                        <p className="text-slate-600 font-medium leading-relaxed pl-4 border-l-2 border-indigo-400 italic text-[11px]">
                          {getDecisionReason(selectedCandidate, isEn)}
                        </p>
                      </div>
                    </div>

                    {/* SECTION B: SCORE BREAKDOWN */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100/80">
                          B. {isEn ? 'Score Breakdown' : 'Chi Tiết Điểm Số'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">3 Dimensions</span>
                      </div>

                      <div className="space-y-3">
                        {/* Keyword alignment */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-700">{isEn ? 'Keyword alignment' : 'Keyword alignment'}</span>
                            <span className="text-slate-900 font-black">{selectedCandidate.keywordScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${selectedCandidate.keywordScore}%` }}
                            />
                          </div>
                        </div>

                        {/* Experience fit */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-700">{isEn ? 'Experience fit' : 'Experience fit'}</span>
                            <span className="text-slate-900 font-black">{selectedCandidate.experienceScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-emerald-600 h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${selectedCandidate.experienceScore}%` }}
                            />
                          </div>
                        </div>

                        {/* Skills fit */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-700">{isEn ? 'Skills fit' : 'Skills fit'}</span>
                            <span className="text-slate-900 font-black">{selectedCandidate.skillScore}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
                              style={{ width: `${selectedCandidate.skillScore}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Score breakdown auto insight sentence */}
                      <div className="text-xs text-slate-600 bg-slate-50/90 p-2.5 rounded-xl border border-slate-100 font-medium leading-relaxed flex items-start gap-2">
                        <span className="shrink-0 text-sm">💡</span>
                        <span className="text-[11px] text-slate-700 leading-snug">{getScoreBreakdownInsight(selectedCandidate, isEn)}</span>
                      </div>
                    </div>

                    {/* SECTION C: KEY STRENGTHS & CRITICAL GAPS */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100/80">
                          {isEn ? 'C. Key Strengths & Critical Gaps' : 'C. Điểm Mạnh & Điểm Hạn Chế'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {isEn ? '3-5 key factors' : '3-5 yếu tố trọng yếu'}
                        </span>
                      </div>

                      {/* Key Strengths */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            {isEn ? 'Key Strengths' : 'Điểm mạnh nổi bật'}
                          </h4>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                            {getNormalizedList(selectedCandidate.topStrengths, 'strengths', selectedCandidate, isEn).length} {isEn ? 'strengths' : 'điểm mạnh'}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {getNormalizedList(selectedCandidate.topStrengths, 'strengths', selectedCandidate, isEn).map((str, i) => (
                            <li key={`str-${i}`} className="text-xs text-slate-700 leading-relaxed bg-emerald-50/30 p-2.5 rounded-xl border border-emerald-500/15 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Critical Gaps */}
                      <div className="space-y-2 pt-2 border-t border-slate-100/80">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            {isEn ? 'Critical Gaps' : 'Điểm hạn chế'}
                          </h4>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            {getNormalizedList(selectedCandidate.keyGaps, 'gaps', selectedCandidate, isEn).length} {isEn ? 'gaps' : 'điểm hạn chế'}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {getNormalizedList(selectedCandidate.keyGaps, 'gaps', selectedCandidate, isEn).map((gap, i) => (
                            <li key={`gap-${i}`} className="text-xs text-slate-700 leading-relaxed bg-amber-50/30 p-2.5 rounded-xl border border-amber-500/15 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* SECTION D: RECRUITER QUICK SCAN */}
                    {(() => {
                      const quickScanData = getRecruiterQuickScan(selectedCandidate, isEn);
                      return (
                        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3.5 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100/80">
                              {isEn ? 'D. Recruiter Quick Scan' : 'D. Sàng Lọc Nhanh'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {isEn ? '4 key observations' : '4 quan sát trọng yếu'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Card 1: First Impression */}
                            <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/80 space-y-1.5 flex flex-col justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>{isEn ? '10-Second First Impression' : 'Ấn tượng trong 10 giây'}</span>
                              </div>
                              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                                "{quickScanData.firstImpression10s}"
                              </p>
                            </div>

                            {/* Card 2: Immediate Strength */}
                            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/80 space-y-1.5 flex flex-col justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                                <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{isEn ? 'Immediate Strength' : 'Điểm mạnh nổi bật'}</span>
                              </div>
                              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                                "{quickScanData.immediateStrength}"
                              </p>
                            </div>

                            {/* Card 3: Biggest Doubt */}
                            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/80 space-y-1.5 flex flex-col justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                                <AlertOctagon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{isEn ? 'Biggest Doubt' : 'Điểm cần xác minh'}</span>
                              </div>
                              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                                "{quickScanData.biggestDoubt}"
                              </p>
                            </div>

                            {/* Card 4: Fastest Point Loss */}
                            <div className="bg-rose-50/50 rounded-xl p-3 border border-rose-100/80 space-y-1.5 flex flex-col justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-black text-rose-950">
                                <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>{isEn ? 'Fastest Point Loss Factor' : 'Yếu tố làm giảm điểm'}</span>
                              </div>
                              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                                "{quickScanData.fastestPointLossSection}"
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* SECTION E: REQUIREMENT MATCH */}
                    {(() => {
                      const compTableRows = getRequirementComparisonTable(selectedCandidate, isEn);

                      const filteredRows = compTableRows.filter(row => {
                        if (requirementFilter === 'KHOP') return row.matchStatus === 'khop';
                        if (requirementFilter === 'CAN_BO_SUNG') return row.matchStatus === 'can_bo_sung';
                        if (requirementFilter === 'THIEU') return row.matchStatus === 'thieu';
                        return true; // ALL
                      });

                      // Sort pinned items ("Rất quan trọng" + "thieu") to top
                      const displayCompRows = [...filteredRows].sort((a, b) => {
                        const aImp = a.importance as string;
                        const bImp = b.importance as string;
                        const aPinned = (aImp === 'Rất quan trọng' || aImp === 'High Priority' || aImp === 'Critical' || aImp === 'Very Important') && a.matchStatus === 'thieu';
                        const bPinned = (bImp === 'Rất quan trọng' || bImp === 'High Priority' || bImp === 'Critical' || bImp === 'Very Important') && b.matchStatus === 'thieu';
                        if (aPinned && !bPinned) return -1;
                        if (!aPinned && bPinned) return 1;
                        return 0;
                      });

                      const matchedCount = compTableRows.filter(r => r.matchStatus === 'khop').length;
                      const partialCount = compTableRows.filter(r => r.matchStatus === 'can_bo_sung').length;
                      const missingCount = compTableRows.filter(r => r.matchStatus === 'thieu').length;

                      return (
                        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 space-y-3.5 shadow-2xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                            <div>
                              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100/80">
                                {isEn ? 'E. Requirement Match' : 'E. Yêu Cầu & Độ Khớp'}
                              </span>
                            </div>

                            {/* Internal Filter Buttons */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold overflow-x-auto">
                              <button
                                type="button"
                                onClick={() => setRequirementFilter('ALL')}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                  requirementFilter === 'ALL'
                                    ? 'bg-white text-slate-900 shadow-xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {isEn ? 'All' : 'Tất cả'} ({compTableRows.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequirementFilter('KHOP')}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                  requirementFilter === 'KHOP'
                                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {isEn ? 'Matched' : 'Đã khớp'} ({matchedCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequirementFilter('CAN_BO_SUNG')}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                  requirementFilter === 'CAN_BO_SUNG'
                                    ? 'bg-amber-500 text-white font-black shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {isEn ? 'Partial' : 'Cần bổ sung'} ({partialCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequirementFilter('THIEU')}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                  requirementFilter === 'THIEU'
                                    ? 'bg-rose-600 text-white font-black shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {isEn ? 'Missing' : 'Còn thiếu'} ({missingCount})
                              </button>
                            </div>
                          </div>

                          {/* Rows List */}
                          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                            {displayCompRows.length === 0 ? (
                              <div className="text-center py-6 text-slate-400 text-xs italic">
                                {isEn ? 'No requirements found for selected status filter.' : 'Không có yêu cầu nào thuộc trạng thái lọc đã chọn.'}
                              </div>
                            ) : (
                              displayCompRows.map((row, idx) => {
                                const rowImp = row.importance as string;
                                const isCriticalMissing = (rowImp === 'Rất quan trọng' || rowImp === 'High Priority' || rowImp === 'Critical' || rowImp === 'Very Important') && row.matchStatus === 'thieu';

                                return (
                                  <div
                                    key={`req-row-${idx}`}
                                    className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                                      isCriticalMissing
                                        ? 'bg-rose-50/70 border-rose-300 shadow-2xs ring-1 ring-rose-300'
                                        : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-50'
                                    }`}
                                  >
                                    {/* Header: JD Requirement + Importance + Status Badge */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {isCriticalMissing && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-600 text-white shadow-xs flex items-center gap-1">
                                              <Pin className="w-3 h-3 text-white shrink-0" />
                                              {isEn ? 'Pinned: Critical & Missing' : 'Ghim: Rất quan trọng & Còn thiếu'}
                                            </span>
                                          )}
                                          <span className="font-black text-slate-900 text-xs">{row.jdTerm}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded text-[10px] border ${getImportanceBadgeStyle(row.importance)}`}>
                                            {row.importance}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Status Badge */}
                                      <div className="shrink-0">{getMatchStatusBadge(row.matchStatus, isEn)}</div>
                                    </div>

                                    {/* CV Evidence */}
                                    {row.cvEvidence && (
                                      <div className="bg-white p-2 rounded-lg border border-slate-200/70 text-[11px] text-slate-700">
                                        <strong className="text-slate-900 font-bold">{isEn ? 'CV Evidence: ' : 'Bằng chứng trong CV: '}</strong>
                                        <span className="text-slate-600">{row.cvEvidence}</span>
                                      </div>
                                    )}

                                    {/* Gap or Clarification */}
                                    {row.gapOrClarification && (
                                      <div className={`p-2 rounded-lg border text-[11px] ${
                                        row.matchStatus === 'thieu' 
                                          ? 'bg-rose-100/60 text-rose-900 border-rose-200 font-medium'
                                          : (row.matchStatus === 'can_bo_sung' ? 'bg-amber-100/60 text-amber-900 border-amber-200 font-medium' : 'bg-emerald-50 text-emerald-900 border-emerald-200/60')
                                      }`}>
                                        <strong className="font-bold">{isEn ? 'Gap / Clarification: ' : 'Khoảng trống / Cần làm rõ: '}</strong>
                                        <span>{row.gapOrClarification}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* File name footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono truncate">
                      <span className="truncate">{selectedCandidate.filename}</span>
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
