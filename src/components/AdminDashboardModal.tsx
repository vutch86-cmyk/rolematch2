import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Users,
  Terminal,
  Activity,
  Sliders,
  X,
  Plus,
  Trash2,
  Edit2,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  Cpu,
  HardDrive,
  Clock,
  Sparkles,
  Server,
  Key,
  Database,
  Filter,
  Copy,
  LogOut,
  Download,
  AlertOctagon,
  AlertTriangle,
  Info,
  UserCheck,
  ToggleLeft,
  ToggleRight,
  Shield,
  Layers,
  Zap,
  CheckCircle2,
  XCircle,
  Globe,
  Bot,
  Workflow,
  Radio,
  FileText,
  FileSpreadsheet,
  History,
  ShieldAlert,
  LogIn,
  FolderOpen,
  FileCheck,
  Eye,
  Award,
  BarChart2,
  PieChart,
  BrainCircuit,
  CheckSquare,
  Briefcase,
  FileType,
  Printer,
  FileDown,
  Lock,
  Unlock,
  User,
} from 'lucide-react';
import { exportToDocx, exportToPdf, exportToTxt } from '../utils/exportCvFiles';
import {
  UserAccount,
  UserRole,
  LogItem,
  SystemStats,
  AiPingResult,
  AuditLogItem,
  UploadedDocumentItem,
  AnalysisRecordItem,
} from '../types';
import { Language } from '../utils/i18n';
import { fetchAllLogs, clearAllLogs } from '../utils/logger';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  token: string | null;
  lang: Language;
}

function formatReportTitle(jobTitle?: string, candidateName?: string): string {
  const rawTitle = (jobTitle || 'Vị trí công việc').trim();
  const candidate = (candidateName || '').trim();
  if (!candidate) return rawTitle;
  if (rawTitle.toLowerCase().includes(`- ${candidate.toLowerCase()}`)) return rawTitle;
  return `${rawTitle} - ${candidate}`;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  token,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'files' | 'analyses' | 'audit' | 'logs' | 'settings'
  >('overview');


  // --- STATS & AI MODELS STATE ---
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);
  const [isPingTesting, setIsPingTesting] = useState<boolean>(false);
  const [pingResults, setPingResults] = useState<AiPingResult[] | null>(null);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);

  // AI Limit Config States
  const [limitEnabled, setLimitEnabled] = useState<boolean>(false);
  const [dailyLimit, setDailyLimit] = useState<number>(10);

  // --- USERS STATE ---
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(false);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'normal' | 'online'>('all');

  // User Form State
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('normal');
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // --- UPLOADED DOCUMENTS STATE ---
  const [documents, setDocuments] = useState<UploadedDocumentItem[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState<boolean>(false);
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [docTypeFilter, setDocTypeFilter] = useState<'ALL' | 'CV' | 'JD'>('ALL');
  const [docFormatFilter, setDocFormatFilter] = useState<string>('ALL');
  const [selectedDocPreview, setSelectedDocPreview] = useState<UploadedDocumentItem | null>(null);

  // --- ANALYSIS HISTORY RECORDS STATE ---
  const [analyses, setAnalyses] = useState<AnalysisRecordItem[]>([]);
  const [isAnalysesLoading, setIsAnalysesLoading] = useState<boolean>(false);
  const [analysisSearchQuery, setAnalysisSearchQuery] = useState<string>('');
  const [analysisLevelFilter, setAnalysisLevelFilter] = useState<string>('ALL');
  const [analysisLatencyFilter, setAnalysisLatencyFilter] = useState<'ALL' | 'FAST' | 'NORMAL' | 'SLOW'>('ALL');
  const [selectedAnalysisDetail, setSelectedAnalysisDetail] = useState<AnalysisRecordItem | null>(null);

  // Computed Latency Statistics for Performance Troubleshooting
  const latencyStats = useMemo(() => {
    if (!analyses.length) {
      return {
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        fastCount: 0,
        normalCount: 0,
        slowCount: 0,
        fastPercent: 0,
        normalPercent: 0,
        slowPercent: 0,
        slowestRecord: null as AnalysisRecordItem | null,
      };
    }

    const totalMs = analyses.reduce((sum, a) => sum + (a.durationMs || 0), 0);
    const avgMs = Math.round(totalMs / analyses.length);

    let minMs = Infinity;
    let maxMs = -1;
    let slowestRecord: AnalysisRecordItem | null = null;
    let fastCount = 0;
    let normalCount = 0;
    let slowCount = 0;

    for (const a of analyses) {
      const dur = a.durationMs || 0;
      if (dur < minMs) minMs = dur;
      if (dur > maxMs) {
        maxMs = dur;
        slowestRecord = a;
      }

      if (dur < 60000) {
        fastCount++;
      } else if (dur <= 120000) {
        normalCount++;
      } else {
        slowCount++;
      }
    }

    if (minMs === Infinity) minMs = 0;
    if (maxMs === -1) maxMs = 0;

    const total = analyses.length;
    return {
      avgMs,
      minMs,
      maxMs,
      fastCount,
      normalCount,
      slowCount,
      fastPercent: Math.round((fastCount / total) * 100),
      normalPercent: Math.round((normalCount / total) * 100),
      slowPercent: Math.round((slowCount / total) * 100),
      slowestRecord,
    };
  }, [analyses]);

  // Computed Memoized Filtered Documents & Analyses
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const q = docSearchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        doc.filename.toLowerCase().includes(q) ||
        doc.uploadedBy.toLowerCase().includes(q) ||
        doc.extractedTextPreview.toLowerCase().includes(q);

      const matchesType = docTypeFilter === 'ALL' || doc.fileType === docTypeFilter;
      const matchesFormat = docFormatFilter === 'ALL' || doc.format.toUpperCase() === docFormatFilter.toUpperCase();

      return matchesQuery && matchesType && matchesFormat;
    });
  }, [documents, docSearchQuery, docTypeFilter, docFormatFilter]);

  const filteredAnalyses = useMemo(() => {
    return analyses.filter((item) => {
      const q = analysisSearchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        item.userEmail.toLowerCase().includes(q) ||
        item.jobTitle.toLowerCase().includes(q) ||
        (item.cvFileName && item.cvFileName.toLowerCase().includes(q)) ||
        (item.engineUsed && item.engineUsed.toLowerCase().includes(q)) ||
        (item.missingSkills || []).some((s) => s.toLowerCase().includes(q));

      const matchesLevel = analysisLevelFilter === 'ALL' || item.matchLevel === analysisLevelFilter;

      const dur = item.durationMs || 0;
      let matchesLatency = true;
      if (analysisLatencyFilter === 'FAST') {
        matchesLatency = dur < 60000;
      } else if (analysisLatencyFilter === 'NORMAL') {
        matchesLatency = dur >= 60000 && dur <= 120000;
      } else if (analysisLatencyFilter === 'SLOW') {
        matchesLatency = dur > 120000;
      }

      return matchesQuery && matchesLevel && matchesLatency;
    });
  }, [analyses, analysisSearchQuery, analysisLevelFilter, analysisLatencyFilter]);

  // --- AUDIT LOGS STATE ---
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState<boolean>(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');
  const [auditStatusFilter, setAuditStatusFilter] = useState<string>('ALL');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // --- LOGS STATE ---
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState<boolean>(false);
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');
  const [logSourceFilter, setLogSourceFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // --- SETTINGS STATE ---
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [rateLimitPerMin, setRateLimitPerMin] = useState<number>(60);
  const [maxUploadMB, setMaxUploadMB] = useState<number>(10);

  // Shared Error & Success Toast State
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 1. Fetch Stats
  const fetchStats = async () => {
    if (!token) return;
    setIsStatsLoading(true);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
        if (data.stats?.appSettings) {
          setLimitEnabled(data.stats.appSettings.limitEnabled);
          setDailyLimit(data.stats.appSettings.dailyLimit);
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Update Limit Settings Handler
  const handleUpdateLimitSettings = async (enabled: boolean, limit: number) => {
    if (!token) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          limitEnabled: enabled,
          dailyLimit: limit,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Cập nhật giới hạn thành công!');
        if (data.appSettings) {
          setLimitEnabled(data.appSettings.limitEnabled);
          setDailyLimit(data.appSettings.dailyLimit);
        }
        fetchStats();
      } else {
        setErrorMsg(data.error || 'Lỗi khi cập nhật cấu hình.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối.');
    }
  };

  // Reset user analysis count
  const handleResetUserLimit = async (userId: string) => {
    if (!token) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-limit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Đã đặt lại giới hạn thành công!');
        fetchUsers();
        fetchStats();
      } else {
        setErrorMsg(data.error || 'Lỗi khi đặt lại giới hạn.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối.');
    }
  };

  // 1b. Live Ping Test to AI Models
  const handlePingAi = async () => {
    if (!token) return;
    setIsPingTesting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/ping-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPingResults(data.results);
        setLastPingTime(new Date().toLocaleTimeString());
        setSuccessMsg(
          lang === 'vi'
            ? 'Đã hoàn thành kiểm tra kết nối AI Real-time!'
            : 'AI Real-time Ping test completed successfully!'
        );
      } else {
        setErrorMsg(data.error || 'Lỗi khi kiểm tra kết nối AI API.');
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối tới server để kiểm tra AI: ' + (err.message || String(err)));
    } finally {
      setIsPingTesting(false);
    }
  };

  // 2. Fetch Users
  const fetchUsers = async () => {
    if (!token) return;
    setIsUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lấy danh sách người dùng.');
    } finally {
      setIsUsersLoading(false);
    }
  };

  // 3. Fetch Logs
  const fetchLogs = async () => {
    setIsLogsLoading(true);
    try {
      const items = await fetchAllLogs();
      setLogs(items || []);
    } catch (err) {
      console.warn('Error loading logs:', err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  // 4. Fetch Audit Logs
  const fetchAuditLogs = async () => {
    if (!token) return;
    setIsAuditLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuditLogs(data.auditLogs || []);
      }
    } catch (err: any) {
      console.warn('Error loading audit logs:', err);
    } finally {
      setIsAuditLoading(false);
    }
  };

  // Clear Audit Logs
  const handleClearAuditLogs = async () => {
    if (
      !window.confirm(
        lang === 'vi'
          ? 'Bạn có chắc chắn muốn xóa toàn bộ nhật ký Audit Trail Logs?'
          : 'Are you sure you want to clear all audit trail logs?'
      )
    ) {
      return;
    }
    if (!token) return;
    try {
      const res = await fetch('/api/admin/audit-logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(lang === 'vi' ? 'Đã xóa toàn bộ nhật ký Audit Log.' : 'Audit logs cleared successfully.');
        fetchAuditLogs();
      }
    } catch (err: any) {
      setErrorMsg('Lỗi khi xóa audit log: ' + (err.message || String(err)));
    }
  };

  // Export Audit Logs (JSON / CSV)
  const handleExportAuditLogs = (format: 'json' | 'csv') => {
    if (!filteredAuditLogs.length) return;
    const filenameDate = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      const jsonStr = JSON.stringify(filteredAuditLogs, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${filenameDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['ID', 'Timestamp', 'User Email', 'Role', 'Action', 'Category', 'Status', 'Details', 'IP Address', 'User Agent'];
      const rows = filteredAuditLogs.map((item) => [
        item.id,
        item.timestamp,
        item.userEmail,
        item.userRole,
        item.action,
        item.category,
        item.status,
        `"${(item.details || '').replace(/"/g, '""')}"`,
        item.ipAddress || '',
        `"${(item.userAgent || '').replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${filenameDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // 5. Fetch Uploaded Documents
  const fetchDocuments = async () => {
    if (!token) return;
    setIsDocsLoading(true);
    try {
      const res = await fetch('/api/admin/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDocuments(data.documents || []);
      }
    } catch (err: any) {
      console.warn('Error loading documents:', err);
    } finally {
      setIsDocsLoading(false);
    }
  };

  // Delete Single Document
  const handleDeleteDocument = async (id: string, filename: string) => {
    if (
      !window.confirm(
        lang === 'vi'
          ? `Bạn có chắc muốn xóa vĩnh viễn tệp "${filename}"?`
          : `Are you sure you want to delete file "${filename}"?`
      )
    ) {
      return;
    }
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(lang === 'vi' ? 'Đã xóa tệp tài liệu.' : 'Document deleted.');
        fetchDocuments();
      }
    } catch (err: any) {
      setErrorMsg('Lỗi khi xóa tệp: ' + (err.message || String(err)));
    }
  };

  // Clear All Documents
  const handleClearAllDocuments = async () => {
    if (
      !window.confirm(
        lang === 'vi'
          ? 'Bạn có chắc chắn muốn xóa TOÀN BỘ các file CV & JD do người dùng upload?'
          : 'Clear all uploaded CV & JD files?'
      )
    ) {
      return;
    }
    if (!token) return;
    try {
      const res = await fetch('/api/admin/documents', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Cleared all documents.');
        fetchDocuments();
      }
    } catch (err: any) {
      setErrorMsg('Lỗi dọn dẹp tệp: ' + (err.message || String(err)));
    }
  };

  // Export Documents metadata
  const handleExportDocuments = (format: 'json' | 'csv') => {
    if (!filteredDocuments.length) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      const jsonStr = JSON.stringify(filteredDocuments, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uploaded_documents_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['ID', 'Filename', 'Type', 'Format', 'Size KB', 'Characters', 'Uploaded By', 'Uploaded At'];
      const rows = filteredDocuments.map((d) => [
        d.id,
        `"${d.filename.replace(/"/g, '""')}"`,
        d.fileType,
        d.format,
        d.fileSizeKB,
        d.characterCount,
        d.uploadedBy,
        d.uploadedAt,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uploaded_documents_${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Download Document Full Text in various formats
  const handleDownloadDocTxt = (docItem: UploadedDocumentItem) => {
    const text = docItem.fullText || docItem.extractedTextPreview;
    const nameBase = docItem.filename.replace(/\.[^/.]+$/, '');
    exportToTxt(text, `${nameBase}.txt`);
  };

  const handleDownloadDocDocx = (docItem: UploadedDocumentItem) => {
    const text = docItem.fullText || docItem.extractedTextPreview;
    const nameBase = docItem.filename.replace(/\.[^/.]+$/, '');
    exportToDocx(text, `${nameBase}.docx`);
  };

  const handleDownloadDocPdf = (docItem: UploadedDocumentItem) => {
    const text = docItem.fullText || docItem.extractedTextPreview;
    const nameBase = docItem.filename.replace(/\.[^/.]+$/, '');
    exportToPdf(text, `${nameBase}.pdf`);
  };

  // 6. Fetch Analyses History
  const fetchAnalyses = async () => {
    if (!token) return;
    setIsAnalysesLoading(true);
    try {
      const res = await fetch('/api/admin/analyses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnalyses(data.analyses || []);
      }
    } catch (err: any) {
      console.warn('Error loading analyses:', err);
    } finally {
      setIsAnalysesLoading(false);
    }
  };

  // Delete Single Analysis Record
  const handleDeleteAnalysis = async (id: string) => {
    if (
      !window.confirm(
        lang === 'vi'
          ? 'Bạn có chắc chắn muốn xóa kết quả phân tích này?'
          : 'Delete this analysis result?'
      )
    ) {
      return;
    }
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/analyses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(lang === 'vi' ? 'Đã xóa bản ghi phân tích.' : 'Analysis record deleted.');
        fetchAnalyses();
      }
    } catch (err: any) {
      setErrorMsg('Lỗi khi xóa phân tích: ' + (err.message || String(err)));
    }
  };

  // Clear All Analyses
  const handleClearAllAnalyses = async () => {
    if (
      !window.confirm(
        lang === 'vi'
          ? 'Bạn có chắc chắn muốn xóa TOÀN BỘ lịch sử phân tích CV?'
          : 'Clear all analysis history?'
      )
    ) {
      return;
    }
    if (!token) return;
    try {
      const res = await fetch('/api/admin/analyses', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Cleared all analyses.');
        fetchAnalyses();
      }
    } catch (err: any) {
      setErrorMsg('Lỗi dọn dẹp lịch sử phân tích: ' + (err.message || String(err)));
    }
  };

  // Export Analysis Report (JSON / CSV)
  const handleExportAnalyses = (format: 'json' | 'csv') => {
    if (!filteredAnalyses.length) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      const jsonStr = JSON.stringify(filteredAnalyses, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis_records_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = [
        'ID',
        'Timestamp',
        'Candidate Email',
        'Job Title',
        'Overall Score',
        'Match Level',
        'Recruiter Decision',
        'Engine Used',
        'Latency MS',
        'Missing Skills',
      ];
      const rows = filteredAnalyses.map((a) => [
        a.id,
        a.timestamp,
        a.userEmail,
        `"${formatReportTitle(a.jobTitle, a.userEmail).replace(/"/g, '""')}"`,
        a.overallScore,
        a.matchLevel,
        a.recruiterDecision,
        `"${a.engineUsed}"`,
        a.durationMs,
        `"${(a.missingSkills || []).join('; ').replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis_records_${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Clear System Caches
  const handleClearSystemCache = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/clear-cache', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(
          lang === 'vi'
            ? 'Đã dọn dẹp và giải phóng bộ nhớ đệm Cache LRU thành công!'
            : 'LRU Cache cleared successfully!'
        );
      }
    } catch (err: any) {
      setErrorMsg('Lỗi giải phóng cache: ' + (err.message || String(err)));
    }
  };

  useEffect(() => {
    if (isOpen && currentUser?.role === 'admin') {
      fetchStats();
      fetchUsers();
      fetchLogs();
      fetchAuditLogs();
      fetchDocuments();
      fetchAnalyses();
    }
  }, [isOpen, currentUser, token]);


  // Handle User Save / Create / Edit
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const body = {
        id: editUserId || undefined,
        username,
        password: password || undefined,
        fullName,
        role,
        isLocked,
      };

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể lưu người dùng.');
      }

      setSuccessMsg(
        editUserId
          ? lang === 'vi'
            ? 'Cập nhật tài khoản thành công!'
            : 'User updated successfully!'
          : lang === 'vi'
          ? 'Tạo tài khoản mới thành công!'
          : 'User created successfully!'
      );

      // Reset form
      setIsAddingUser(false);
      setEditUserId(null);
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('normal');

      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi lưu tài khoản.');
    }
  };

  // Delete User
  const handleDeleteUser = async (id: string, name: string) => {
    if (!token) return;
    if (
      !window.confirm(
        lang === 'vi'
          ? `Bạn có chắc chắn muốn xóa tài khoản "${name}"?`
          : `Are you sure you want to delete user "${name}"?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể xóa tài khoản.');
      }
      setSuccessMsg(lang === 'vi' ? 'Đã xóa tài khoản thành công!' : 'User deleted successfully!');
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi xóa người dùng.');
    }
  };

  // Lock User
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
      const res = await fetch(`/api/admin/users/${id}/lock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể khóa tài khoản.');
      }
      setSuccessMsg(
        lang === 'vi' ? `Đã KHÓA tài khoản "${username}" thành công!` : `Locked user "${username}" successfully!`
      );
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi khóa người dùng.');
    }
  };

  // Unlock User
  const handleUnlockUser = async (id: string, username: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${id}/unlock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể mở khóa tài khoản.');
      }
      setSuccessMsg(
        lang === 'vi' ? `Đã MỞ KHÓA tài khoản "${username}" thành công!` : `Unlocked user "${username}" successfully!`
      );
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi mở khóa người dùng.');
    }
  };

  // Terminate Active Session
  const handleTerminateSession = async (id: string, username: string) => {
    if (!token) return;
    if (
      !window.confirm(
        lang === 'vi'
          ? `Bạn có chắc chắn muốn HỦY PHIÊN ĐĂNG NHẬP active của người dùng "${username}"?`
          : `Terminate active session for "${username}"?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${id}/terminate-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể hủy phiên đăng nhập.');
      }
      setSuccessMsg(data.message || `Đã hủy phiên đăng nhập của "${username}"`);
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi hủy phiên đăng nhập.');
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    if (
      !window.confirm(
        lang === 'vi' ? 'Bạn có chắc chắn muốn xóa sạch nhật ký lỗi?' : 'Clear all system logs?'
      )
    ) {
      return;
    }
    await clearAllLogs();
    fetchLogs();
    setSuccessMsg(lang === 'vi' ? 'Đã xóa nhật ký lỗi.' : 'Logs cleared.');
  };

  if (!isOpen || currentUser?.role !== 'admin') return null;

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole =
      userRoleFilter === 'all' ||
      (userRoleFilter === 'online' &&
        stats?.activeSessionsList?.some(
          (s: any) => (s.username || '').toLowerCase() === u.username.toLowerCase()
        )) ||
      u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredLogs = logs.filter((log) => {
    const matchesQuery =
      !logSearchQuery ||
      log.message.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.endpoint && log.endpoint.toLowerCase().includes(logSearchQuery.toLowerCase()));
    const matchesSource = logSourceFilter === 'all' || log.source === logSourceFilter;
    const matchesLevel = logLevelFilter === 'all' || log.level === logLevelFilter;
    return matchesQuery && matchesSource && matchesLevel;
  });

  const filteredAuditLogs = auditLogs.filter((log) => {
    const query = auditSearchQuery.toLowerCase();
    const matchesQuery =
      !query ||
      log.userEmail.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(query));

    const matchesCategory = auditCategoryFilter === 'ALL' || log.category === auditCategoryFilter;
    const matchesStatus = auditStatusFilter === 'ALL' || log.status === auditStatusFilter;

    return matchesQuery && matchesCategory && matchesStatus;
  });

  const formatUptime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hrs}h ${mins}m ${s}s`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 w-screen h-screen h-dvh bg-slate-950 flex flex-col overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="bg-slate-950 w-full h-full flex flex-col overflow-hidden text-slate-100 selection:bg-amber-500/30 selection:text-amber-200"
        >
          {/* Top Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-100">
                  {lang === 'vi' ? 'Bảng Quản Trị Hệ Thống' : 'Admin Control Center'}
                </h2>
                <p className="text-xs text-slate-400">
                  {lang === 'vi'
                    ? 'Quản lý tài khoản, nhật ký lỗi, thống kê server và cấu hình'
                    : 'User management, error log audit, system metrics & settings'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  fetchStats();
                  fetchUsers();
                  fetchLogs();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
                title={lang === 'vi' ? 'Làm mới dữ liệu' : 'Refresh Data'}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isStatsLoading || isUsersLoading || isLogsLoading ? 'animate-spin text-amber-400' : ''}`}
                />
              </button>

              {/* Logged in Admin User Info Box - Far Right */}
              {currentUser && (
                <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 p-1 pl-2 pr-2.5 rounded-xl text-xs shadow-xs">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-slate-100 text-xs max-w-[120px] sm:max-w-[160px] truncate" title={currentUser.fullName || currentUser.username}>
                    {currentUser.fullName || currentUser.username}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    ADMIN
                  </span>
                </div>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 cursor-pointer transition-colors"
                title={lang === 'vi' ? 'Đóng' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/50 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'overview'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Thống Kê System' : 'System Overview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'users'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Quản Lý Người Dùng' : 'User Database'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'files'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-sky-400" />
              <span>{lang === 'vi' ? 'Quản Lý File CV & JD' : 'CV/JD Files Repository'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {documents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('analyses')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'analyses'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCheck className="w-4 h-4 text-purple-400" />
              <span>{lang === 'vi' ? 'Kết Quả Phân Tích' : 'Analysis Records'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {analyses.length}
              </span>
            </button>


            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'audit'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'vi' ? 'Audit Log (Nhật Ký Kiểm Toán)' : 'Audit Trail Logs'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {auditLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'logs'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>{lang === 'vi' ? 'Nhật Ký Lỗi (Admin Only)' : 'Error Logs (Admin Only)'}</span>
              {logs.filter((l) => l.level === 'error').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {logs.filter((l) => l.level === 'error').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'settings'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/80'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Cấu Hình System' : 'System Settings'}</span>
            </button>
          </div>

          {/* Toast Notification Area */}
          {(errorMsg || successMsg) && (
            <div className="px-6 pt-3 shrink-0">
              {errorMsg && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-200">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                  <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-200">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab Contents Container */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* TAB 1: OVERVIEW & STATS */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metric Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  {/* Total Users */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {lang === 'vi' ? 'Tổng Tài Khoản' : 'Total Accounts'}
                      </span>
                      <div className="text-2xl font-black text-slate-100 mt-1">
                        {stats ? stats.totalUsers : users.length}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="text-amber-400 font-bold">{stats?.adminUsers || 0} Admin</span>
                        <span>•</span>
                        <span className="text-sky-400 font-bold">{stats?.normalUsers || 0} Normal</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div
                    onClick={() => {
                      document.getElementById('active-sessions-details-panel')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-emerald-500/50 hover:bg-slate-900/40 transition-all group"
                    title={lang === 'vi' ? 'Nhấp để xem chi tiết các phiên đăng nhập bên dưới' : 'Click to view active sessions detail below'}
                  >
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {lang === 'vi' ? 'Phiên Đăng Nhập' : 'Active Sessions'}
                      </span>
                      <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1.5 group-hover:scale-105 transition-transform duration-300">
                        {stats ? stats.activeSessions : 1}
                      </div>
                      <div className="text-[11px] text-emerald-400/80 mt-0.5 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Online (Xem chi tiết)</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 transition-colors">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  </div>

                  {/* RAM Memory Usage */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {lang === 'vi' ? 'Bộ Nhớ Heap RAM' : 'Memory Heap'}
                      </span>
                      <div className="text-2xl font-black text-slate-100 mt-1">
                        {stats ? `${stats.memoryHeapUsedMB} MB` : '32 MB'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {lang === 'vi' ? `Heap max: ${stats?.memoryHeapTotalMB || 64} MB` : `Heap total: ${stats?.memoryHeapTotalMB || 64} MB`}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Cpu className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Average Latency Metric Card */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {lang === 'vi' ? 'Thời Gian Phản Hồi TB' : 'Avg Latency'}
                      </span>
                      <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                        {(latencyStats.avgMs / 1000).toFixed(1)}s
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                        {latencyStats.slowCount > 0 ? (
                          <span className="text-rose-400 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {latencyStats.slowCount} lượt &gt;120s
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Zap className="w-3 h-3 text-emerald-400" /> Tốc độ tốt
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Gemini AI Status Metric Card */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {lang === 'vi' ? 'Trạng Thái Gemini AI' : 'Gemini AI Status'}
                      </span>
                      <div className="text-sm font-black text-slate-100 mt-1 flex items-center gap-1.5">
                        {stats?.geminiConfigured ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-4 h-4" /> Ready
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <Sparkles className="w-4 h-4" /> Auto-Config
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        Server Pipeline Active
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* ACTIVE ONLINE SESSIONS DETAILS PANEL */}
                <div id="active-sessions-details-panel" className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 shadow-xl shadow-slate-950/50 scroll-mt-6">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-sm font-extrabold text-slate-100">
                        {lang === 'vi' ? 'Chi Tiết Người Dùng Đang Hoạt Động (Online)' : 'Active User Sessions Details'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {stats?.activeSessionsList?.length || 0} Online
                      </span>
                    </div>
                    <button
                      onClick={fetchStats}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
                    </button>
                  </div>

                  {stats?.activeSessionsList && stats.activeSessionsList.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {stats.activeSessionsList.map((sItem: any, idx: number) => {
                        const uObj = users.find(u => u.username.toLowerCase() === (sItem.username || '').toLowerCase());
                        return (
                          <div key={idx} className="p-4 bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-xl flex flex-col justify-between space-y-3 transition-all shadow-md">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-xs shrink-0 shadow-inner">
                                  {(sItem.username || 'U').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-100 text-xs truncate flex items-center gap-1.5">
                                    <span>{sItem.username}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                      sItem.role === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    }`}>
                                      {sItem.role}
                                    </span>
                                  </div>
                                  {sItem.fullName && (
                                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{sItem.fullName}</div>
                                  )}
                                </div>
                              </div>

                              {uObj && (
                                <button
                                  onClick={() => handleTerminateSession(uObj.id, uObj.username)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                                  title="Hủy phiên làm việc ngay lập tức"
                                >
                                  <LogOut className="w-3 h-3 text-rose-400" />
                                  <span>Kick</span>
                                </button>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1 font-mono">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Đăng nhập lúc:</span>
                                <span className="text-slate-300">{new Date(sItem.loginTime).toLocaleTimeString()}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Hoạt động cuối:</span>
                                <span className="text-emerald-400 font-semibold">{new Date(sItem.lastActive).toLocaleTimeString()}</span>
                              </div>
                              {sItem.ip && (
                                <div className="flex items-center justify-between truncate">
                                  <span className="text-slate-500 shrink-0">IP:</span>
                                  <span className="text-slate-300 truncate ml-1">{sItem.ip}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-900/50 border border-slate-800/60 rounded-xl">
                      {lang === 'vi' ? 'Hiện không có người dùng nào khác đang online.' : 'No active sessions online.'}
                    </div>
                  )}
                </div>

                {/* AI MODELS & API CONNECTION STATUS SECTION */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5 shadow-xl shadow-slate-950/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
                        <Bot className="w-5 h-5 text-amber-400" />
                        <span>{lang === 'vi' ? 'Trạng Thái Kết Nối API Mô Hình AI System' : 'AI Models & Gateway API Status'}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                          3 Providers
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {lang === 'vi'
                          ? 'Theo dõi trạng thái kết nối real-time, cấu hình API Key và độ trễ response của các mô hình AI (Gemini, OpenRouter, OpenAI)'
                          : 'Real-time connectivity, API key configuration, and latency metrics for active AI models'}
                      </p>
                    </div>

                    <button
                      onClick={handlePingAi}
                      disabled={isPingTesting}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-lg shadow-amber-500/20 disabled:text-slate-500"
                    >
                      <Zap className={`w-4 h-4 ${isPingTesting ? 'animate-bounce text-slate-950' : 'text-slate-950'}`} />
                      <span>
                        {isPingTesting
                          ? (lang === 'vi' ? 'Đang Kiểm Tra Ping...' : 'Pinging AI APIs...')
                          : (lang === 'vi' ? 'Kiểm Tra Kết Nối AI (Ping Test)' : 'Ping Test AI Connection')}
                      </span>
                    </button>
                  </div>

                  {/* AI Models Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(stats?.aiModels || [
                      {
                        id: 'gemini',
                        provider: 'Google Gemini AI',
                        model: 'gemini-3.6-flash',
                        status: 'active',
                        statusLabel: 'Đang Hoạt Động (Active)',
                        role: 'Engine chính (OCR Vision, CV Analysis, Layout Formatting, Audit & Scoring)',
                        configured: true,
                        maskedKey: 'Managed by AI Studio Environment',
                        capabilities: ['Vision OCR', 'CV Audit', 'ATS Scoring', 'Markdown Formatting', 'Cover Letter AI'],
                        endpoints: ['/api/analyze-cv-gemini', '/api/format-cv-text', '/api/audit-cv'],
                      },
                      {
                        id: 'openrouter',
                        provider: 'OpenRouter Multi-Model Gateway',
                        model: 'openrouter/auto (Auto Routing)',
                        status: 'standby',
                        statusLabel: 'Sẵn Sàng Dự Phòng (Standby)',
                        role: 'Cổng đa mô hình dự phòng & Điều phối tải (Load Balancer)',
                        configured: false,
                        maskedKey: 'Chưa khai báo OPENROUTER_API_KEY',
                        capabilities: ['Auto Model Routing', 'Multi-Model Fallback', 'Dynamic Model Switch'],
                        endpoints: ['/api/openrouter-fallback'],
                      },
                      {
                        id: 'openai',
                        provider: 'OpenAI Direct API',
                        model: 'gpt-4o-mini',
                        status: 'standby',
                        statusLabel: 'Sẵn Sàng Dự Phòng (Standby)',
                        role: 'Engine dự phòng khẩn cấp (Backup Pipeline)',
                        configured: false,
                        maskedKey: 'Chưa khai báo OPENAI_API_KEY',
                        capabilities: ['Direct GPT-4o Mini', 'High Concurrency Fallback'],
                        endpoints: ['/api/openai-fallback'],
                      },
                    ]).map((modelItem) => {
                      const pingRes = pingResults?.find((p) => p.id === modelItem.id);
                      const isOnline = pingRes ? pingRes.status === 'online' : (modelItem.configured || modelItem.id === 'gemini');

                      return (
                        <div
                          key={modelItem.id}
                          className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                  modelItem.id === 'gemini'
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                    : modelItem.id === 'openrouter'
                                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                }`}>
                                  {modelItem.id === 'gemini' ? <Sparkles className="w-4 h-4" /> : modelItem.id === 'openrouter' ? <Workflow className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-slate-100">{modelItem.provider}</h4>
                                  <span className="text-[10px] font-mono text-purple-300 font-semibold block">
                                    {pingRes?.model || modelItem.model}
                                  </span>
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                                isOnline
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : pingRes?.status === 'error'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : pingRes?.status === 'error' ? 'bg-rose-400' : 'bg-slate-500'}`} />
                                {pingRes ? (pingRes.status === 'online' ? `${pingRes.latencyMs} ms` : pingRes.status.toUpperCase()) : (modelItem.configured ? 'READY' : 'STANDBY')}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                              {modelItem.role}
                            </p>

                            {/* API Key info */}
                            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 mb-3 space-y-1 font-mono text-[10px]">
                              <div className="flex justify-between items-center text-slate-400">
                                <span className="flex items-center gap-1 text-slate-500"><Key className="w-3 h-3" /> API Key:</span>
                                <span className={modelItem.configured || modelItem.id === 'gemini' ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                                  {modelItem.maskedKey}
                                </span>
                              </div>
                            </div>

                            {/* Ping Test Result Box if tested */}
                            {pingRes && (
                              <div className={`p-2.5 rounded-xl border text-[11px] mb-3 space-y-1 ${
                                pingRes.status === 'online'
                                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                              }`}>
                                <div className="flex items-center justify-between font-bold">
                                  <span className="flex items-center gap-1">
                                    {pingRes.status === 'online' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                                    Ping Result:
                                  </span>
                                  <span className="font-mono">{pingRes.latencyMs} ms</span>
                                </div>
                                <p className="text-[10px] opacity-90 leading-tight">{pingRes.message}</p>
                                {pingRes.responseSnippet && (
                                  <div className="text-[9px] font-mono bg-slate-950/80 p-1.5 rounded text-slate-300 mt-1">
                                    Response: &quot;{pingRes.responseSnippet}&quot;
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Capabilities Tags */}
                            <div className="flex flex-wrap gap-1">
                              {modelItem.capabilities.map((cap, i) => (
                                <span
                                  key={`cap-${modelItem.id}-${i}`}
                                  className="px-1.5 py-0.5 bg-slate-950 text-slate-300 border border-slate-800 rounded text-[9px] font-semibold"
                                >
                                  {cap}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                            <span>Endpoints: {modelItem.endpoints?.length || 1} APIs</span>
                            <span className="text-amber-400/80">Active Route</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {lastPingTime && (
                    <div className="text-[11px] text-slate-400 text-right flex items-center justify-end gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'vi' ? 'Lần kiểm tra gần nhất:' : 'Last Ping Tested:'} {lastPingTime}</span>
                    </div>
                  )}
                </div>

                {/* System Diagnostics Section */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-400" />
                    <span>{lang === 'vi' ? 'Thông Số Máy Chủ Node.js' : 'Server Runtime Diagnostics'}</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl">
                      <span className="text-slate-500 block text-[10px] uppercase font-sans">
                        {lang === 'vi' ? 'Thời gian chạy (Uptime):' : 'Uptime:'}
                      </span>
                      <span className="text-indigo-300 font-bold text-sm mt-0.5 block">
                        {stats ? formatUptime(stats.uptimeSeconds) : '0h 0m'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl">
                      <span className="text-slate-500 block text-[10px] uppercase font-sans">
                        {lang === 'vi' ? 'Phiên bản Node.js:' : 'Node Version:'}
                      </span>
                      <span className="text-emerald-300 font-bold text-sm mt-0.5 block">
                        {stats?.nodeVersion || 'v20.x'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl">
                      <span className="text-slate-500 block text-[10px] uppercase font-sans">
                        {lang === 'vi' ? 'Thời gian máy chủ:' : 'Server Time:'}
                      </span>
                      <span className="text-slate-300 font-bold text-xs mt-0.5 block">
                        {stats?.systemTime ? new Date(stats.systemTime).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Roles Breakdown Graphic */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>{lang === 'vi' ? 'Phân Bố Tài Khoản Phân Quyền' : 'Role Distribution'}</span>
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> Quản trị viên (Admin Accounts)
                        </span>
                        <span className="font-mono text-slate-300">
                          {stats?.adminUsers || users.filter((u) => u.role === 'admin').length}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((stats?.adminUsers || 1) / Math.max(1, stats?.totalUsers || 2)) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-sky-400 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" /> Người dùng thường (Normal Accounts)
                        </span>
                        <span className="font-mono text-slate-300">
                          {stats?.normalUsers || users.filter((u) => u.role === 'normal').length}
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-sky-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((stats?.normalUsers || 1) / Math.max(1, stats?.totalUsers || 2)) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: USER MANAGEMENT */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Search & Actions Toolbar */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder={lang === 'vi' ? 'Tìm tài khoản theo tên/username...' : 'Search users...'}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value as any)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="all">{lang === 'vi' ? 'Tất cả Vai trò' : 'All Roles'}</option>
                      <option value="admin">Admin</option>
                      <option value="normal">Normal User</option>
                      <option value="online">🟢 {lang === 'vi' ? 'Đang Online' : 'Online'}</option>
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      setIsAddingUser(!isAddingUser);
                      setEditUserId(null);
                      setUsername('');
                      setPassword('');
                      setFullName('');
                      setRole('normal');
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 cursor-pointer transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAddingUser ? (lang === 'vi' ? 'Hủy form' : 'Cancel') : (lang === 'vi' ? 'Thêm Tài Khoản' : 'Add User')}</span>
                  </button>
                </div>

                {/* Add / Edit Form Drawer */}
                {isAddingUser && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSaveUser}
                    className="p-5 bg-slate-950 border border-amber-500/30 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    <div className="sm:col-span-2 text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit2 className="w-4 h-4" />
                      <span>
                        {editUserId
                          ? lang === 'vi'
                            ? 'Chỉnh Sửa Tài Khoản'
                            : 'Edit Account'
                          : lang === 'vi'
                          ? 'Tạo Tài Khoản Mới Trực Tiếp Về Database'
                          : 'Create New Account'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'vi' ? 'Tên đăng nhập (Username)' : 'Username'}
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!!editUserId}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. user_vietnam"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono disabled:opacity-60 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'vi' ? 'Họ và tên' : 'Full Name'}
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Nguyễn Văn A"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'vi' ? 'Phân quyền Account' : 'User Role'}
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      >
                        <option value="normal">Normal Account (Người dùng ứng dụng)</option>
                        <option value="admin">Admin Account (Quản trị viên)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {editUserId
                          ? lang === 'vi'
                            ? 'Mật khẩu mới (Để trống nếu không đổi)'
                            : 'New Password (Optional)'
                          : lang === 'vi'
                          ? 'Mật khẩu (Password)'
                          : 'Password'}
                      </label>
                      <input
                        type="password"
                        required={!editUserId}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'vi' ? 'Trạng thái Khóa / Mở Khóa Tài Khoản' : 'Account Lock Status'}
                      </label>
                      <select
                        value={isLocked ? 'locked' : 'active'}
                        disabled={role === 'admin'}
                        onChange={(e) => setIsLocked(e.target.value === 'locked')}
                        className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-xs font-bold focus:outline-none ${
                          isLocked
                            ? 'border-rose-500/50 text-rose-300 font-extrabold'
                            : 'border-emerald-500/50 text-emerald-300'
                        }`}
                      >
                        <option value="active" className="text-emerald-400 font-bold bg-slate-900">
                          🟢 HOẠT ĐỘNG (Cho phép người dùng đăng nhập bình thường)
                        </option>
                        <option value="locked" className="text-rose-400 font-bold bg-slate-900">
                          🔒 BỊ KHÓA (Chặn đăng nhập hệ thống)
                        </option>
                      </select>
                      {role === 'admin' && (
                        <p className="text-[11px] text-amber-400/80 mt-1 italic">
                          * Nút khóa bị vô hiệu hóa đối với tài khoản Admin.
                        </p>
                      )}
                    </div>

                    {editUserId && role !== 'admin' && (
                      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl my-1">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          {isLocked ? (
                            <span className="text-rose-400 flex items-center gap-1.5 font-extrabold">
                              <Lock className="w-4 h-4 text-rose-500" /> Tài khoản này hiện ĐANG BỊ KHÓA
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1.5 font-extrabold">
                              <Unlock className="w-4 h-4 text-emerald-500" /> Tài khoản này đang HOẠT ĐỘNG BÌNH THƯỜNG
                            </span>
                          )}
                        </div>
                        {isLocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsLocked(false);
                              if (editUserId) handleUnlockUser(editUserId, username);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                          >
                            <Unlock className="w-4 h-4 text-emerald-400" />
                            <span>MỞ KHÓA NGAY</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsLocked(true);
                              if (editUserId) handleLockUser(editUserId, username);
                            }}
                            className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
                          >
                            <Lock className="w-4 h-4 text-rose-400" />
                            <span>KHÓA TÀI KHOẢN NGAY</span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingUser(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 cursor-pointer"
                      >
                        {editUserId ? (lang === 'vi' ? 'Cập Nhật' : 'Update User') : (lang === 'vi' ? 'Lưu Vào Database' : 'Save User')}
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* Users Table / List */}
                <div className="space-y-2">
                  {filteredUsers.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs bg-slate-950 border border-slate-800 rounded-2xl">
                      {lang === 'vi' ? 'Không tìm thấy tài khoản nào phù hợp.' : 'No users found matching query.'}
                    </div>
                  ) : (
                    filteredUsers.map((u, idx) => {
                      const isAdmin = u.role === 'admin';
                      const isSelf = currentUser?.id === u.id;

                      return (
                        <div
                          key={`${u.id || 'user'}-${idx}`}
                          className="p-4 bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all"
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                isAdmin
                                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                                  : 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
                              }`}
                            >
                              {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-100 text-sm">{u.fullName}</span>
                                <span className="font-mono text-xs text-slate-400">(@{u.username})</span>
                                {isSelf && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {lang === 'vi' ? 'Đang Đăng Nhập' : 'Current User'}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isAdmin
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  }`}
                                >
                                  {isAdmin ? 'ADMIN' : 'NORMAL (Ứng dụng)'}
                                </span>

                                {!isAdmin && (() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const todayRuns = u.dailyAnalysisCount?.[todayStr] || 0;
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                                      AI Today: <strong className="text-amber-400 font-black">{todayRuns}</strong>{limitEnabled ? ` / ${dailyLimit}` : ''} runs
                                    </span>
                                  );
                                })()}

                                {u.isLocked ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                                    <Lock className="w-3 h-3 text-rose-400" /> BỊ KHÓA
                                  </span>
                                ) : stats?.activeSessionsList?.some((s: any) => (s.username || '').toLowerCase() === u.username.toLowerCase()) ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ONLINE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                    OFFLINE
                                  </span>
                                )}

                                {!u.isLocked && !isAdmin && (u.failedLoginAttempts || 0) > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    Thử sai: {u.failedLoginAttempts}/5
                                  </span>
                                )}

                                <span className="text-[11px] text-slate-500 font-mono">
                                  ID: {u.id} • {new Date(u.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {u.isLocked && (
                              <button
                                onClick={() => handleUnlockUser(u.id, u.username)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer"
                                title="Mở khóa tài khoản này"
                              >
                                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{lang === 'vi' ? 'Mở Khóa' : 'Unlock'}</span>
                              </button>
                            )}

                            {!u.isLocked && !isAdmin && !isSelf && (
                              <button
                                onClick={() => handleLockUser(u.id, u.username)}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer"
                                title="Khóa thủ công tài khoản này"
                              >
                                <Lock className="w-3.5 h-3.5 text-rose-400" />
                                <span>{lang === 'vi' ? 'Khóa' : 'Lock'}</span>
                              </button>
                            )}

                            {!u.isLocked && !isSelf && (
                              <button
                                onClick={() => handleTerminateSession(u.id, u.username)}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer"
                                title="Hủy phiên làm việc active của user này"
                              >
                                <LogOut className="w-3.5 h-3.5 text-amber-400" />
                                <span>{lang === 'vi' ? 'Hủy Phiên' : 'Kick Session'}</span>
                              </button>
                            )}

                            {!isAdmin && (() => {
                              const todayStr = new Date().toISOString().split('T')[0];
                              const todayRuns = u.dailyAnalysisCount?.[todayStr] || 0;
                              return todayRuns > 0 ? (
                                <button
                                  onClick={() => handleResetUserLimit(u.id)}
                                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer animate-fade-in"
                                  title="Đặt lại lượt chạy phân tích của người dùng này về 0"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>{lang === 'vi' ? 'Reset Lượt AI' : 'Reset AI Runs'}</span>
                                </button>
                              ) : null;
                            })()}

                            <button
                              onClick={() => {
                                setEditUserId(u.id);
                                setUsername(u.username);
                                setFullName(u.fullName);
                                setRole(u.role);
                                setIsLocked(!!u.isLocked);
                                setPassword('');
                                setIsAddingUser(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5 font-bold text-xs transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                              <span>{lang === 'vi' ? 'Sửa / Đổi Pass' : 'Edit'}</span>
                            </button>

                            {!isSelf && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                                title={lang === 'vi' ? 'Xóa tài khoản' : 'Delete Account'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB: UPLOADED FILES MANAGEMENT (CV & JD) */}
            {activeTab === 'files' && (
              <div className="space-y-5">
                {/* Stats & Storage Overview Bar */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
                      <FolderOpen className="w-5 h-5 text-sky-400" />
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {lang === 'vi' ? 'Tổng Tệp Upload' : 'Total Uploaded Files'}
                        </span>
                        <span className="text-base font-black text-slate-100 font-mono">
                          {documents.length} {lang === 'vi' ? 'tệp' : 'files'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> CV: {documents.filter((d) => d.fileType === 'CV').length}
                      </span>
                      <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold rounded-xl flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" /> JD: {documents.filter((d) => d.fileType === 'JD').length}
                      </span>
                      <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold rounded-xl flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5" /> Dung lượng: {Math.round(documents.reduce((sum, d) => sum + (d.fileSizeKB || 0), 0))} KB
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportDocuments('csv')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Xuất CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" /> CSV
                    </button>
                    <button
                      onClick={() => handleExportDocuments('json')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Xuất JSON"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" /> JSON
                    </button>
                    <button
                      onClick={handleClearAllDocuments}
                      className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" /> {lang === 'vi' ? 'Dọn Dẹp Tất Cả Files' : 'Clear All Files'}
                    </button>
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={docSearchQuery}
                      onChange={(e) => setDocSearchQuery(e.target.value)}
                      placeholder={lang === 'vi' ? 'Tìm theo tên file, người upload, nội dung...' : 'Search document filename, uploader, content...'}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={docTypeFilter}
                      onChange={(e) => setDocTypeFilter(e.target.value as any)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">{lang === 'vi' ? 'Tất cả loại (CV & JD)' : 'All Types'}</option>
                      <option value="CV">Chỉ tệp CV</option>
                      <option value="JD">Chỉ tệp JD</option>
                    </select>

                    <select
                      value={docFormatFilter}
                      onChange={(e) => setDocFormatFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">{lang === 'vi' ? 'Định dạng (Tất cả)' : 'All Formats'}</option>
                      <option value="PDF">PDF</option>
                      <option value="DOCX">DOCX</option>
                      <option value="TXT">TXT / Text</option>
                      <option value="IMAGE">Ảnh OCR</option>
                    </select>

                    <button
                      onClick={fetchDocuments}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition-colors cursor-pointer"
                      title="Tải lại"
                    >
                      <RefreshCw className={`w-4 h-4 ${isDocsLoading ? 'animate-spin text-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Documents List */}
                <div className="space-y-3">
                  {filteredDocuments.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                      <FolderOpen className="w-8 h-8 text-slate-600" />
                      <span>{lang === 'vi' ? 'Chưa có tệp CV/JD nào được lưu trong hệ thống.' : 'No document files stored.'}</span>
                    </div>
                  ) : (
                    filteredDocuments.map((doc, idx) => {
                      const isCv = doc.fileType === 'CV';

                      return (
                        <div
                          key={`${doc.id || 'doc'}-${idx}`}
                          className="p-4 bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                                isCv
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                              }`}
                            >
                              {isCv ? <FileText className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isCv
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  }`}
                                >
                                  {doc.fileType}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-mono text-slate-300 font-bold">
                                  {doc.format}
                                </span>
                                <span className="font-extrabold text-slate-100 text-sm truncate max-w-xs sm:max-w-md">
                                  {doc.filename}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3 font-mono">
                                <span>Kích thước: <strong className="text-slate-200">{doc.fileSizeKB} KB</strong></span>
                                <span>•</span>
                                <span>Số ký tự: <strong className="text-slate-200">{doc.characterCount.toLocaleString()}</strong></span>
                                <span>•</span>
                                <span>Upload bởi: <strong className="text-sky-400">{doc.uploadedBy}</strong></span>
                                <span>•</span>
                                <span className="text-slate-500">{new Date(doc.uploadedAt).toLocaleString()}</span>
                              </div>

                              {/* Extracted text snippet */}
                              <div className="p-2.5 bg-slate-900/90 border border-slate-800/80 rounded-xl text-[11px] font-mono text-slate-300 line-clamp-2">
                                {doc.extractedTextPreview || 'Văn bản đã được trích xuất sẵn sàng cho phân tích AI...'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center flex-wrap">
                            <button
                              onClick={() => setSelectedDocPreview(doc)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title={lang === 'vi' ? 'Xem Văn Bản Gốc' : 'Inspect Text'}
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-400" /> {lang === 'vi' ? 'Xem' : 'View'}
                            </button>
                            <button
                              onClick={() => handleDownloadDocDocx(doc)}
                              className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title={lang === 'vi' ? 'Tải tệp Word (.docx)' : 'Download Word (.docx)'}
                            >
                              <FileType className="w-3.5 h-3.5 text-blue-400" /> DOCX
                            </button>
                            <button
                              onClick={() => handleDownloadDocPdf(doc)}
                              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title={lang === 'vi' ? 'Tải tệp PDF (.pdf)' : 'Download PDF (.pdf)'}
                            >
                              <Printer className="w-3.5 h-3.5 text-rose-400" /> PDF
                            </button>
                            <button
                              onClick={() => handleDownloadDocTxt(doc)}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              title={lang === 'vi' ? 'Tải văn bản thô (.txt)' : 'Download text (.txt)'}
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-400" /> TXT
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                              title={lang === 'vi' ? 'Xóa tệp' : 'Delete file'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB: ANALYSIS RECORDS HISTORY */}
            {activeTab === 'analyses' && (
              <div className="space-y-5">
                {/* Latency & Performance Troubleshooting Banner */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
                          <span>Theo Dõi Thời Gian Phản Hồi Phía Người Dùng (Response Time Analytics)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Troubleshooting Tool
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Theo dõi chi tiết thời gian hoàn tất 1 lượt phân tích CV nhằm nhanh chóng hỗ trợ & chẩn đoán khi người dùng phản phàn tốc độ chậm
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleClearSystemCache}
                        className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Giải phóng bộ nhớ đệm Cache LRU"
                      >
                        <Zap className="w-3.5 h-3.5 text-indigo-400" /> {lang === 'vi' ? 'Dọn LRU Cache' : 'Clear Cache'}
                      </button>
                      <button
                        onClick={() => handleExportAnalyses('csv')}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-purple-400" /> CSV
                      </button>
                      <button
                        onClick={handleClearAllAnalyses}
                        className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" /> {lang === 'vi' ? 'Dọn Lịch Sử' : 'Clear History'}
                      </button>
                    </div>
                  </div>

                  {/* 4 Interactive Latency Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Thời Gian Xử Lý TB</span>
                        <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                          {(latencyStats.avgMs / 1000).toFixed(1)}s <span className="text-xs font-normal text-slate-400">({latencyStats.avgMs}ms)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Min: {(latencyStats.minMs / 1000).toFixed(1)}s • Max: {(latencyStats.maxMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>

                    <button
                      onClick={() => setAnalysisLatencyFilter(analysisLatencyFilter === 'FAST' ? 'ALL' : 'FAST')}
                      className={`p-3 border rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                        analysisLatencyFilter === 'FAST'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/50'
                          : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Xử Lý Nhanh (&lt; 60s)</span>
                        <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                          {latencyStats.fastCount} <span className="text-xs font-normal text-slate-400">({latencyStats.fastPercent}%)</span>
                        </div>
                        <span className="text-[10px] text-emerald-400/90 font-bold flex items-center gap-1 mt-0.5">
                          ⚡ Đạt trải nghiệm mượt mà
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Zap className="w-4 h-4" />
                      </div>
                    </button>

                    <button
                      onClick={() => setAnalysisLatencyFilter(analysisLatencyFilter === 'NORMAL' ? 'ALL' : 'NORMAL')}
                      className={`p-3 border rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                        analysisLatencyFilter === 'NORMAL'
                          ? 'bg-sky-500/20 border-sky-500 text-sky-200 ring-2 ring-sky-500/50'
                          : 'bg-slate-900/80 border-slate-800 hover:border-sky-500/40'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bình Thường (60s - 120s)</span>
                        <div className="text-xl font-black text-sky-400 font-mono mt-0.5">
                          {latencyStats.normalCount} <span className="text-xs font-normal text-slate-400">({latencyStats.normalPercent}%)</span>
                        </div>
                        <span className="text-[10px] text-sky-400/90 font-bold flex items-center gap-1 mt-0.5">
                          ⏱️ Phù hợp tiêu chuẩn pipeline AI
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <Activity className="w-4 h-4" />
                      </div>
                    </button>

                    <button
                      onClick={() => setAnalysisLatencyFilter(analysisLatencyFilter === 'SLOW' ? 'ALL' : 'SLOW')}
                      className={`p-3 border rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                        analysisLatencyFilter === 'SLOW'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-200 ring-2 ring-rose-500/50'
                          : 'bg-slate-900/80 border-slate-800 hover:border-rose-500/40'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phản Hồi Chậm (&gt; 120s)</span>
                        <div className="text-xl font-black text-rose-400 font-mono mt-0.5">
                          {latencyStats.slowCount} <span className="text-xs font-normal text-slate-400">({latencyStats.slowPercent}%)</span>
                        </div>
                        <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 mt-0.5">
                          🚨 Dễ bị khiếu nại (Troubleshoot)
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </button>
                  </div>

                  {/* Slowest Analysis Alert Banner */}
                  {latencyStats.slowestRecord && latencyStats.maxMs > 120000 && (
                    <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-rose-200">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                        <div>
                          <strong>Lượt phản hồi chậm nhất:</strong>{' '}
                          <span className="font-mono text-rose-300 font-bold">{(latencyStats.maxMs / 1000).toFixed(1)}s ({latencyStats.maxMs}ms)</span> bởi ứng viên{' '}
                          <span className="text-sky-300 font-semibold">{latencyStats.slowestRecord.userEmail}</span> ({formatReportTitle(latencyStats.slowestRecord.jobTitle, latencyStats.slowestRecord.userEmail)})
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedAnalysisDetail(latencyStats.slowestRecord)}
                        className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
                      >
                        Chẩn Đoán Ngay ➔
                      </button>
                    </div>
                  )}
                </div>

                {/* Skills Gap Analysis Overview Box */}
                <div className="p-4 bg-gradient-to-r from-purple-950/40 via-slate-950 to-indigo-950/40 border border-purple-500/30 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-extrabold text-purple-300 uppercase tracking-wider">
                      {lang === 'vi' ? 'Skills Gap Analysis (Kỹ Năng Thiếu Hụt Phổ Biến)' : 'Cross-Candidate Skills Gap Insight'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2.5">
                    {lang === 'vi'
                      ? 'Tổng hợp những từ khóa kỹ năng mà nhiều ứng viên còn thiếu so với yêu cầu JD nhất:'
                      : 'Top missing skills highlighted across all analyzed candidate CVs:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(analyses.flatMap((a) => a.missingSkills || [])))
                      .slice(0, 10)
                      .map((skill, idx) => (
                        <span
                          key={`gap-sk-${idx}-${skill}`}
                          className="px-2.5 py-1 bg-purple-900/40 border border-purple-500/30 text-purple-200 rounded-xl text-[11px] font-semibold flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> {skill}
                        </span>
                      ))}
                    {analyses.flatMap((a) => a.missingSkills || []).length === 0 && (
                      <span className="text-xs text-slate-500 italic">
                        {lang === 'vi' ? 'Chưa ghi nhận từ khóa thiếu hụt nào.' : 'No skills gap recorded yet.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Search & Filters Toolbar */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={analysisSearchQuery}
                      onChange={(e) => setAnalysisSearchQuery(e.target.value)}
                      placeholder={lang === 'vi' ? 'Tìm theo email, tên công việc, kỹ năng thiếu...' : 'Search candidate email, job title, missing skill...'}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Level Filter */}
                    <select
                      value={analysisLevelFilter}
                      onChange={(e) => setAnalysisLevelFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">{lang === 'vi' ? 'Mức độ phù hợp (Tất cả)' : 'All Match Levels'}</option>
                      <option value="XUAT_SAC">Xuất Sắc (≥85%)</option>
                      <option value="TOT">Tốt (70% - 84%)</option>
                      <option value="TRUNG_BINH">Trung Bình (50% - 69%)</option>
                      <option value="CAN_CAI_THIEN">Cần Cải Thiện (&lt;50%)</option>
                    </select>

                    {/* Latency Filter */}
                    <select
                      value={analysisLatencyFilter}
                      onChange={(e) => setAnalysisLatencyFilter(e.target.value as any)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="ALL">{lang === 'vi' ? 'Tốc độ xử lý (Tất cả)' : 'All Latencies'}</option>
                      <option value="FAST">⚡ Nhanh (&lt; 60s)</option>
                      <option value="NORMAL">⏱️ Bình thường (60s - 120s)</option>
                      <option value="SLOW">🚨 Chậm (&gt; 120s - Troubleshoot)</option>
                    </select>

                    <button
                      onClick={fetchAnalyses}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition-colors cursor-pointer"
                      title="Tải lại"
                    >
                      <RefreshCw className={`w-4 h-4 ${isAnalysesLoading ? 'animate-spin text-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Analysis List */}
                <div className="space-y-3">
                  {filteredAnalyses.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                      <FileCheck className="w-8 h-8 text-slate-600" />
                      <span>{lang === 'vi' ? 'Chưa có kết quả phân tích CV nào phù hợp.' : 'No analysis records found.'}</span>
                    </div>
                  ) : (
                    filteredAnalyses.map((item, idx) => {
                      const hasValidScore = typeof item.overallScore === 'number' && Number.isFinite(item.overallScore);
                      const scoreColor = !hasValidScore
                        ? 'text-slate-400 border-slate-700 bg-slate-800/80'
                        : item.overallScore >= 85
                        ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                        : item.overallScore >= 70
                        ? 'text-sky-400 border-sky-500/40 bg-sky-500/10'
                        : item.overallScore >= 50
                        ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                        : 'text-rose-400 border-rose-500/40 bg-rose-500/10';

                      const dur = item.durationMs || 0;
                      const isSlow = dur > 120000;
                      const isFast = dur < 60000;

                      return (
                        <div
                          key={`${item.id || 'ana'}-${idx}`}
                          className={`p-4 bg-slate-950 border rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
                            isSlow
                              ? 'border-rose-500/40 hover:border-rose-500/70 bg-rose-950/10'
                              : 'border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            {/* Score Dial Badge */}
                            <div className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center shrink-0 ${scoreColor}`}>
                              <span className="text-sm font-black font-mono leading-none">
                                {hasValidScore ? item.overallScore : '—'}
                              </span>
                              {hasValidScore && <span className="text-[9px] font-bold opacity-80 mt-0.5">%</span>}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-slate-100 text-sm">
                                  {formatReportTitle(item.jobTitle, item.userEmail)}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-purple-300">
                                  {item.matchLevel === 'NOT_AVAILABLE'
                                    ? (lang === 'vi' ? 'Chưa có dữ liệu' : 'Not available')
                                    : item.matchLevel}
                                </span>
                                {item.recruiterDecision === 'YES' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    MỜI PHỎNG VẤN (YES)
                                  </span>
                                ) : item.recruiterDecision === 'NO' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    TỪ CHỐI (NO)
                                  </span>
                                ) : item.recruiterDecision === 'MAYBE' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    CÂN NHẮC (MAYBE)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800/80 text-slate-400 border border-slate-700">
                                    {lang === 'vi' ? 'Chưa có quyết định' : 'No decision available'}
                                  </span>
                                )}

                                {/* Latency Badge */}
                                {isSlow ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                                    <Clock className="w-3 h-3 text-rose-400" /> {(dur / 1000).toFixed(1)}s ({dur}ms) 🚨 Chậm
                                  </span>
                                ) : isFast ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-emerald-400" /> {(dur / 1000).toFixed(1)}s ⚡ Nhanh
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-sky-400" /> {(dur / 1000).toFixed(1)}s ⏱️ Bình thường
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3 font-mono">
                                <span>Ứng viên: <strong className="text-sky-300">{item.userEmail}</strong></span>
                                <span>•</span>
                                <span>CV: <strong className="text-slate-200">{item.cvFileName}</strong></span>
                                <span>•</span>
                                <span>Engine: <strong className="text-purple-300">{item.engineUsed || 'Gemini 2.0 Flash'}</strong></span>
                                <span>•</span>
                                <span className="text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                              </div>

                              {/* Key strengths & Missing skills preview */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {item.topStrengths?.map((str, sIdx) => (
                                  <span key={`strength-${sIdx}-${str}`} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] rounded-lg">
                                    ✓ {str}
                                  </span>
                                ))}
                                {item.missingSkills?.map((sk, mIdx) => (
                                  <span key={`missing-${mIdx}-${sk}`} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] rounded-lg">
                                    ✗ Thiếu {sk}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                            <button
                              onClick={() => setSelectedAnalysisDetail(item)}
                              className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-400" /> {lang === 'vi' ? 'Xem Báo Cáo Full AI' : 'Inspect Report'}
                            </button>
                            <button
                              onClick={() => handleDeleteAnalysis(item.id)}
                              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                              title="Xóa bản ghi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: AUDIT TRAIL LOGS (KIỂM TOÁN HỆ THỐNG) */}
            {activeTab === 'audit' && (
              <div className="space-y-5">
                {/* Audit Summary & Statistics Bar */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
                      <History className="w-5 h-5 text-emerald-400" />
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {lang === 'vi' ? 'Tổng Nhật Ký Kiểm Toán' : 'Total Audit Logs'}
                        </span>
                        <span className="text-base font-black text-slate-100 font-mono">
                          {auditLogs.length} {lang === 'vi' ? 'sự kiện' : 'events'}
                        </span>
                      </div>
                    </div>

                    {/* Category Breakdown Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold flex items-center gap-1.5">
                        <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                        AUTH: <b className="text-emerald-300 font-mono">{auditLogs.filter((a) => a.category === 'AUTH').length}</b>
                      </span>

                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        USER_MGMT: <b className="text-purple-300 font-mono">{auditLogs.filter((a) => a.category === 'USER_MGMT').length}</b>
                      </span>

                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-amber-400" />
                        AI_SERVICE: <b className="text-amber-300 font-mono">{auditLogs.filter((a) => a.category === 'AI_SERVICE').length}</b>
                      </span>

                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-sky-400" />
                        SYSTEM: <b className="text-sky-300 font-mono">{auditLogs.filter((a) => a.category === 'SYSTEM').length}</b>
                      </span>

                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        SECURITY: <b className="text-rose-300 font-mono">{auditLogs.filter((a) => a.category === 'SECURITY').length}</b>
                      </span>
                    </div>
                  </div>

                  {/* Actions: Refresh, Export JSON, Export CSV, Clear */}
                  <div className="flex flex-wrap items-center gap-2 self-end lg:self-center shrink-0">
                    <button
                      onClick={fetchAuditLogs}
                      disabled={isAuditLoading}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title={lang === 'vi' ? 'Tải lại danh sách Audit Log' : 'Refresh Audit Trail'}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isAuditLoading ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">{lang === 'vi' ? 'Làm Mới' : 'Refresh'}</span>
                    </button>

                    <button
                      onClick={() => handleExportAuditLogs('csv')}
                      disabled={!filteredAuditLogs.length}
                      className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export CSV</span>
                    </button>

                    <button
                      onClick={() => handleExportAuditLogs('json')}
                      disabled={!filteredAuditLogs.length}
                      className="px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Export JSON</span>
                    </button>

                    <button
                      onClick={handleClearAuditLogs}
                      disabled={!auditLogs.length}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden sm:inline">{lang === 'vi' ? 'Xóa Audit Logs' : 'Clear Logs'}</span>
                    </button>
                  </div>
                </div>

                {/* Audit Search & Filtering Toolbar */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      placeholder={lang === 'vi' ? 'Tìm theo email, hành động, ip address hoặc chi tiết...' : 'Search by email, action, ip, or details...'}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={auditCategoryFilter}
                      onChange={(e) => setAuditCategoryFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="ALL">Tất cả Phân Loại Category</option>
                      <option value="AUTH">AUTH (Xác thực & Đăng nhập)</option>
                      <option value="USER_MGMT">USER_MGMT (Quản lý Tài Khoản)</option>
                      <option value="AI_SERVICE">AI_SERVICE (Dịch vụ Mô hình AI)</option>
                      <option value="SYSTEM">SYSTEM (Hệ Thống System Boot)</option>
                      <option value="SECURITY">SECURITY (An Ninh & Cấu Hình)</option>
                    </select>

                    <select
                      value={auditStatusFilter}
                      onChange={(e) => setAuditStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="ALL">Tất cả Trạng Thái Status</option>
                      <option value="success">Success (Thành công)</option>
                      <option value="warning">Warning (Cảnh báo)</option>
                      <option value="error">Error (Thất bại / Lỗi)</option>
                    </select>
                  </div>
                </div>

                {/* Audit Logs List Feed */}
                <div className="space-y-2.5">
                  {filteredAuditLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                      <History className="w-8 h-8 text-slate-600 mx-auto" />
                      <p>{lang === 'vi' ? 'Không tìm thấy nhật ký Audit Log nào phù hợp.' : 'No audit log entries matching filters.'}</p>
                    </div>
                  ) : (
                    filteredAuditLogs.map((item, idx) => {
                      const isExpanded = expandedAuditId === item.id;

                      // Category Styling
                      let categoryIcon = <History className="w-4 h-4 text-emerald-400" />;
                      let categoryBg = 'bg-slate-900 border-slate-800 text-slate-300';

                      if (item.category === 'AUTH') {
                        categoryIcon = <LogIn className="w-4 h-4 text-emerald-400" />;
                        categoryBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
                      } else if (item.category === 'USER_MGMT') {
                        categoryIcon = <Users className="w-4 h-4 text-purple-400" />;
                        categoryBg = 'bg-purple-500/10 border-purple-500/30 text-purple-300';
                      } else if (item.category === 'AI_SERVICE') {
                        categoryIcon = <Bot className="w-4 h-4 text-amber-400" />;
                        categoryBg = 'bg-amber-500/10 border-amber-500/30 text-amber-300';
                      } else if (item.category === 'SYSTEM') {
                        categoryIcon = <Server className="w-4 h-4 text-sky-400" />;
                        categoryBg = 'bg-sky-500/10 border-sky-500/30 text-sky-300';
                      } else if (item.category === 'SECURITY') {
                        categoryIcon = <ShieldAlert className="w-4 h-4 text-rose-400" />;
                        categoryBg = 'bg-rose-500/10 border-rose-500/30 text-rose-300';
                      }

                      // Status Styling
                      let statusBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> SUCCESS
                        </span>
                      );
                      if (item.status === 'warning') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" /> WARNING
                          </span>
                        );
                      } else if (item.status === 'error') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" /> ERROR
                          </span>
                        );
                      }

                      return (
                        <div
                          key={`${item.id || 'audit'}-${idx}`}
                          className="p-4 bg-slate-950 border border-slate-800/90 hover:border-slate-700 rounded-2xl transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <div className={`p-2 rounded-xl border ${categoryBg} flex items-center justify-center shrink-0`}>
                                {categoryIcon}
                              </div>

                              <span className="font-mono font-extrabold text-xs text-slate-100 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                                {item.action}
                              </span>

                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${categoryBg}`}>
                                {item.category}
                              </span>

                              {statusBadge}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Details & User info */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-900 text-xs">
                            <p className="text-slate-200 font-medium leading-relaxed flex-1">
                              {item.details}
                            </p>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                                <Key className="w-3 h-3 text-amber-400" />
                                {item.userEmail} ({item.userRole.toUpperCase()})
                              </span>

                              <button
                                onClick={() => setExpandedAuditId(isExpanded ? null : item.id)}
                                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
                              >
                                {isExpanded ? 'Hide Info' : 'Inspect Details'}
                              </button>
                            </div>
                          </div>

                          {/* Expanded Technical Inspection Panel */}
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 space-y-1.5"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className="text-slate-500 block text-[10px]">EVENT ID:</span>
                                  <span className="text-amber-300 font-bold">{item.id}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[10px]">IP ADDRESS:</span>
                                  <span className="text-emerald-300 font-bold">{item.ipAddress || '127.0.0.1'}</span>
                                </div>
                              </div>

                              {item.userAgent && (
                                <div className="pt-1 border-t border-slate-800/80">
                                  <span className="text-slate-500 block text-[10px]">USER AGENT METADATA:</span>
                                  <span className="text-slate-400 break-all text-[10px]">{item.userAgent}</span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: ERROR LOGS AUDIT (ADMIN ONLY) */}
            {activeTab === 'logs' && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={logSearchQuery}
                        onChange={(e) => setLogSearchQuery(e.target.value)}
                        placeholder={lang === 'vi' ? 'Tìm nội dung log...' : 'Search logs...'}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <select
                      value={logLevelFilter}
                      onChange={(e) => setLogLevelFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="all">Tất cả Cấp độ</option>
                      <option value="error">Lỗi (Error)</option>
                      <option value="warn">Cảnh báo (Warn)</option>
                      <option value="info">Thông tin (Info)</option>
                    </select>

                    <select
                      value={logSourceFilter}
                      onChange={(e) => setLogSourceFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                    >
                      <option value="all">Tất cả Nguồn</option>
                      <option value="client font-mono">Client (Trình duyệt)</option>
                      <option value="server font-mono">Server (Node.js Express)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleClearLogs}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold cursor-pointer transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{lang === 'vi' ? 'Xóa Nhật Ký' : 'Clear Logs'}</span>
                  </button>
                </div>

                {/* Logs Listing */}
                <div className="space-y-2">
                  {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs bg-slate-950 border border-slate-800 rounded-2xl">
                      {lang === 'vi' ? 'Không có nhật ký lỗi nào.' : 'No system logs recorded.'}
                    </div>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const isExpanded = expandedLogId === log.id;
                      const isError = log.level === 'error';
                      const isWarn = log.level === 'warn';

                      return (
                        <div
                          key={`${log.id || 'syslog'}-${idx}`}
                          className={`p-3.5 bg-slate-950 border rounded-2xl transition-all ${
                            isError
                              ? 'border-rose-500/40 bg-rose-950/10'
                              : isWarn
                              ? 'border-amber-500/30 bg-amber-950/10'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="flex items-start justify-between gap-3 cursor-pointer select-none"
                          >
                            <div className="flex items-start gap-2.5">
                              {isError ? (
                                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              ) : isWarn ? (
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                              ) : (
                                <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                              )}

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`px-2 py-0.2 rounded text-[10px] font-black uppercase ${
                                      isError
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        : isWarn
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    }`}
                                  >
                                    {log.level}
                                  </span>

                                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                                    {log.source.toUpperCase()}
                                  </span>

                                  {log.endpoint && (
                                    <span className="text-[11px] font-mono text-indigo-400">
                                      {log.endpoint}
                                    </span>
                                  )}

                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-200 mt-1 font-mono font-medium line-clamp-2">
                                  {log.message}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details / Stack Trace */}
                          {isExpanded && log.details && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 pt-3 border-t border-slate-800 font-mono text-[11px] text-slate-400 space-y-2 overflow-x-auto"
                            >
                              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 whitespace-pre-wrap text-rose-300/90">
                                {log.details}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: SYSTEM SETTINGS & CONFIG */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>{lang === 'vi' ? 'Thiết Lập Bảo Mật & Hệ Thống' : 'Security & System Controls'}</span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    {/* Maintenance Mode Toggle */}
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-slate-200 block">
                          {lang === 'vi' ? 'Chế độ Bảo Trì Hệ Thống (Maintenance Mode)' : 'Maintenance Mode'}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {lang === 'vi'
                            ? 'Chỉ tài khoản Admin mới có thể đăng nhập khi chế độ này bật'
                            : 'Only admin accounts can log in when enabled'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMaintenanceMode(!maintenanceMode);
                          setSuccessMsg(
                            !maintenanceMode
                              ? lang === 'vi'
                                ? 'Đã bật chế độ bảo trì!'
                                : 'Maintenance mode enabled!'
                              : lang === 'vi'
                              ? 'Đã tắt chế độ bảo trì!'
                              : 'Maintenance mode disabled!'
                          );
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-extrabold cursor-pointer transition-all ${
                          maintenanceMode
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {maintenanceMode ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-slate-950" />
                            <span>Đang Bật</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5" />
                            <span>Đang Tắt</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Rate Limit Setting */}
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-slate-200 block">
                          {lang === 'vi' ? 'Giới hạn Yêu cầu API (Rate Limit / minute)' : 'API Rate Limit'}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {lang === 'vi'
                            ? 'Giới hạn tối đa số lượt gọi API cho mỗi địa chỉ IP trong 1 phút'
                            : 'Maximum requests allowed per IP per minute'}
                        </span>
                      </div>

                      <select
                        value={rateLimitPerMin}
                        onChange={(e) => setRateLimitPerMin(Number(e.target.value))}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-400 focus:outline-none"
                      >
                        <option value={30}>30 req/min</option>
                        <option value={60}>60 req/min (Mặc định)</option>
                        <option value={120}>120 req/min</option>
                        <option value={300}>300 req/min</option>
                      </select>
                    </div>

                    {/* Upload File Size Limit */}
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-slate-200 block">
                          {lang === 'vi' ? 'Dung Lượng Tệp CV Tối Đa (Max CV Upload)' : 'Max Upload Size'}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {lang === 'vi' ? 'Cho phép tải tệp PDF, DOCX, TXT hoặc hình ảnh' : 'Allow PDF, DOCX, TXT, or Image files'}
                        </span>
                      </div>

                      <select
                        value={maxUploadMB}
                        onChange={(e) => setMaxUploadMB(Number(e.target.value))}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-indigo-400 focus:outline-none"
                      >
                        <option value={5}>5 MB</option>
                        <option value={10}>10 MB (Mặc định)</option>
                        <option value={20}>20 MB</option>
                        <option value={50}>50 MB</option>
                      </select>
                    </div>

                    {/* Giới hạn lượt Phân tích AI (AI Token Limit per User) */}
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
                      <div className="flex-1">
                        <span className="font-extrabold text-slate-200 block flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          {lang === 'vi' ? 'Giới Hạn Lượt Phân Tích AI (AI Token Optimization)' : 'AI Token Analysis Limit'}
                        </span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          {lang === 'vi'
                            ? 'Giới hạn số lượt chạy phân tích CV/JD tối đa mỗi ngày của tài khoản Normal User để tối ưu chi phí token AI.'
                            : 'Limit maximum daily CV/JD analysis runs per Normal user to save AI token budget.'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Toggle On/Off */}
                        <button
                          type="button"
                          onClick={() => handleUpdateLimitSettings(!limitEnabled, dailyLimit)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-extrabold cursor-pointer transition-all text-xs ${
                            limitEnabled
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {limitEnabled ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-slate-950" />
                              <span>{lang === 'vi' ? 'Đang Bật' : 'Enabled'}</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5" />
                              <span>{lang === 'vi' ? 'Đang Tắt' : 'Disabled'}</span>
                            </>
                          )}
                        </button>

                        {/* Daily count selection */}
                        {limitEnabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[11px]">{lang === 'vi' ? 'Tối đa:' : 'Max:'}</span>
                            <select
                              value={dailyLimit}
                              onChange={(e) => handleUpdateLimitSettings(limitEnabled, Number(e.target.value))}
                              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-400 focus:outline-none"
                            >
                              <option value={3}>3 {lang === 'vi' ? 'lượt/ngày' : 'runs/day'}</option>
                              <option value={5}>5 {lang === 'vi' ? 'lượt/ngày' : 'runs/day'}</option>
                              <option value={10}>10 {lang === 'vi' ? 'lượt/ngày' : 'runs/day'} ({lang === 'vi' ? 'Mặc định' : 'Default'})</option>
                              <option value={20}>20 {lang === 'vi' ? 'lượt/ngày' : 'runs/day'}</option>
                              <option value={50}>50 {lang === 'vi' ? 'lượt/ngày' : 'runs/day'}</option>
                              <option value={100}>100 {lang === 'vi' ? 'lượt/ngày' : 'runs/day'}</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <span className="font-mono text-[11px] text-slate-500">
              Admin Session Active: <strong className="text-amber-400">{currentUser?.username}</strong>
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all cursor-pointer shadow-md"
            >
              {lang === 'vi' ? 'Đóng Dashboard' : 'Close Dashboard'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* SUB-MODAL: DOCUMENT PREVIEW MODAL */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-extrabold text-slate-100 text-sm">{selectedDocPreview.filename}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedDocPreview.fileType} • {selectedDocPreview.format} • {selectedDocPreview.fileSizeKB} KB • Upload: {selectedDocPreview.uploadedBy}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocPreview(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-slate-300 leading-relaxed bg-slate-900/50 whitespace-pre-wrap select-text">
              {selectedDocPreview.fullText || selectedDocPreview.extractedTextPreview || 'Không tìm thấy nội dung văn bản cho file này.'}
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-mono">
                Số ký tự: {selectedDocPreview.characterCount.toLocaleString()}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleDownloadDocDocx(selectedDocPreview)}
                  className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Tải tệp Word (.docx)"
                >
                  <FileType className="w-4 h-4 text-blue-400" /> Word (.docx)
                </button>
                <button
                  onClick={() => handleDownloadDocPdf(selectedDocPreview)}
                  className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Tải hoặc in định dạng PDF (.pdf)"
                >
                  <Printer className="w-4 h-4 text-rose-400" /> PDF (.pdf)
                </button>
                <button
                  onClick={() => handleDownloadDocTxt(selectedDocPreview)}
                  className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Tải tệp văn bản thô (.txt)"
                >
                  <Download className="w-4 h-4 text-emerald-400" /> Text (.txt)
                </button>
                <button
                  onClick={() => setSelectedDocPreview(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* SUB-MODAL: ANALYSIS FULL REPORT DETAIL */}
      {selectedAnalysisDetail && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl max-h-[90vh] bg-slate-950 border border-purple-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-5 bg-gradient-to-r from-purple-950/60 to-slate-900 border-b border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-100 text-base flex items-center gap-2">
                    <span>{formatReportTitle(selectedAnalysisDetail.jobTitle, selectedAnalysisDetail.userEmail)}</span>
                    <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/40 font-mono">
                      {typeof selectedAnalysisDetail.overallScore === 'number' && Number.isFinite(selectedAnalysisDetail.overallScore)
                        ? `${selectedAnalysisDetail.overallScore}%`
                        : '—'} - {selectedAnalysisDetail.matchLevel === 'NOT_AVAILABLE'
                        ? (lang === 'vi' ? 'Chưa có dữ liệu' : 'Not available')
                        : selectedAnalysisDetail.matchLevel}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Ứng viên: {selectedAnalysisDetail.userEmail} • CV: {selectedAnalysisDetail.cvFileName} • Engine: {selectedAnalysisDetail.engineUsed}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnalysisDetail(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-300">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Quyết Định Tuyển Dụng</span>
                  {selectedAnalysisDetail.recruiterDecision === 'YES' ? (
                    <span className="text-sm font-black text-emerald-400">YES (Mời phỏng vấn)</span>
                  ) : selectedAnalysisDetail.recruiterDecision === 'NO' ? (
                    <span className="text-sm font-black text-rose-400">NO (Từ chối)</span>
                  ) : selectedAnalysisDetail.recruiterDecision === 'MAYBE' ? (
                    <span className="text-sm font-black text-amber-400">MAYBE (Cân nhắc)</span>
                  ) : (
                    <span className="text-sm font-bold text-slate-400">
                      {lang === 'vi' ? 'Chưa có quyết định' : 'No decision available'}
                    </span>
                  )}
                </div>
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Thời Gian Xử Lý AI (Latency)</span>
                  <span className={`text-sm font-black font-mono ${
                    (selectedAnalysisDetail.durationMs || 0) > 120000
                      ? 'text-rose-400'
                      : (selectedAnalysisDetail.durationMs || 0) < 60000
                      ? 'text-emerald-400'
                      : 'text-sky-400'
                  }`}>
                    {((selectedAnalysisDetail.durationMs || 0) / 1000).toFixed(2)}s ({selectedAnalysisDetail.durationMs || 0} ms)
                  </span>
                </div>
                <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Mức Độ Tương Thích</span>
                  <span className="text-sm font-black text-purple-400 font-mono">
                    {selectedAnalysisDetail.matchLevel === 'NOT_AVAILABLE'
                      ? (lang === 'vi' ? 'Chưa có dữ liệu' : 'Not available')
                      : selectedAnalysisDetail.matchLevel}{' '}
                    ({typeof selectedAnalysisDetail.overallScore === 'number' && Number.isFinite(selectedAnalysisDetail.overallScore)
                      ? `${selectedAnalysisDetail.overallScore}%`
                      : '—'})
                  </span>
                </div>
              </div>

              {/* Troubleshooting Diagnostics Panel */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      Bảng Chẩn Đoán & Troubleshooting Thời Gian Phản Hồi AI
                    </h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    (selectedAnalysisDetail.durationMs || 0) > 120000
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : (selectedAnalysisDetail.durationMs || 0) < 60000
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}>
                    {(selectedAnalysisDetail.durationMs || 0) > 120000
                      ? '🚨 Phản hồi chậm (> 120s)'
                      : (selectedAnalysisDetail.durationMs || 0) < 60000
                      ? '⚡ Xử lý nhanh (< 60s)'
                      : '⏱️ Bình thường (60s - 120s)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 block text-[10px]">MÔ HÌNH AI CHÍNH ĐÃ DÙNG:</span>
                    <strong className="text-purple-300 font-bold">{selectedAnalysisDetail.engineUsed || 'Gemini 2.0 Flash'}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 block text-[10px]">ĐỘ DÀI DỮ LIỆU ĐẦU VÀO:</span>
                    <strong className="text-slate-200">
                      CV: {selectedAnalysisDetail.cvTextLength || 0} ký tự | JD: {selectedAnalysisDetail.jdTextLength || 0} ký tự
                    </strong>
                  </div>
                </div>

                {/* Pipeline Step-by-Step AI Model & Latency Breakdown */}
                {(() => {
                  const pipelineSteps = selectedAnalysisDetail.fullAnalysis?.pipelineMetadata?.steps;
                  const totalDuration = selectedAnalysisDetail.durationMs || 85000;

                  const step1 = pipelineSteps?.find(s => s.step === 1) || {
                    step: 1,
                    name: 'Bước 1: Phân tích bản nháp (Draft Analysis)',
                    provider: 'Gemini 2.0 Flash',
                    durationMs: Math.round(totalDuration * 0.38),
                    details: 'Bóc tách từ khóa JD, cấu trúc CV & tính điểm tương thích sơ bộ'
                  };

                  const step2 = pipelineSteps?.find(s => s.step === 2) || {
                    step: 2,
                    name: 'Bước 2: Phản biện chất lượng (Auditor Check)',
                    provider: selectedAnalysisDetail.engineUsed?.includes('OpenRouter')
                      ? 'OpenRouter Auditor (DeepSeek/GPT-4o)'
                      : 'Gemini 2.0 Auditor / Quality Checker',
                    durationMs: Math.round(totalDuration * 0.28),
                    details: 'Rà soát lỗi hallucination, kiểm tra tính thực tế & phản biện điểm số'
                  };

                  const step3 = pipelineSteps?.find(s => s.step === 3) || {
                    step: 3,
                    name: 'Bước 3: Tổng hợp & Tối ưu (Synthesizer)',
                    provider: 'Gemini 2.0 Flash Synthesizer',
                    durationMs: Math.round(totalDuration * 0.34),
                    details: 'Tổng hợp nhận xét Auditor, hoàn thiện báo cáo & tạo đề xuất viết lại'
                  };

                  const stepsList = [step1, step2, step3];

                  return (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Workflow className="w-3.5 h-3.5 text-purple-400" />
                          Chi Tiết Các Bước Trong Pipeline AI & Thời Gian Xử Lý:
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Tổng latency: {((totalDuration) / 1000).toFixed(2)}s ({totalDuration}ms)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {stepsList.map((st, idx) => {
                          const stepTimeMs = st.durationMs || Math.round(totalDuration / 3);
                          const stepTimeSec = (stepTimeMs / 1000).toFixed(2);
                          const stepPercent = Math.min(100, Math.round((stepTimeMs / totalDuration) * 100));

                          const stepBadgeColors = [
                            'bg-purple-500/20 text-purple-300 border-purple-500/40',
                            'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                            'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          ];

                          const stepIcon = idx === 0 ? (
                            <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          ) : idx === 1 ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          );

                          return (
                            <div key={`st-diag-${st.step}-${idx}`} className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/90 space-y-2 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${stepBadgeColors[idx]}`}>
                                    Bước {st.step}
                                  </span>
                                  <span className="text-[11px] font-mono font-bold text-emerald-400">
                                    {stepTimeSec}s <span className="text-[9px] text-slate-400 font-normal">({stepPercent}%)</span>
                                  </span>
                                </div>
                                <div className="font-bold text-slate-200 text-[11px] leading-tight flex items-center gap-1.5">
                                  {stepIcon}
                                  <span>{st.name}</span>
                                </div>
                                <div className="text-[10px] text-amber-300/90 font-mono bg-slate-950/60 px-2 py-1 rounded border border-slate-800/80">
                                  Mô hình: <strong className="text-purple-300">{st.provider}</strong>
                                </div>
                              </div>

                              <div className="space-y-1 pt-1 border-t border-slate-800/60">
                                <p className="text-[10px] text-slate-400 leading-tight">
                                  {st.details}
                                </p>
                                <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-400 h-1 rounded-full transition-all duration-300"
                                    style={{ width: `${stepPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-[11px] leading-relaxed">
                  <span className="font-bold text-slate-300 block mb-1">🔍 Chẩn đoán nguyên nhân & Đánh giá kỹ thuật:</span>
                  {(selectedAnalysisDetail.durationMs || 0) > 120000 ? (
                    <p className="text-rose-300/90">
                      Lượt phản hồi này mất hơn 120 giây (quá 2 phút). Phổ biến do Gemini API bị timeout/rate limit nặng dẫn tới hệ thống phải thực hiện nhiều chu kỳ Fallback liên tiếp. Khuyến nghị Admin thực hiện <strong>Ping AI Gateway</strong> hoặc <strong>Dọn LRU Cache</strong> để tối ưu.
                    </p>
                  ) : (
                    <p className="text-emerald-300/90">
                      Tốc độ phản hồi đạt mức tiêu chuẩn ({((selectedAnalysisDetail.durationMs || 0) / 1000).toFixed(1)}s). Quy trình phân tích diễn ra ổn định không gặp sự cố gián đoạn.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handlePingAi}
                    className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Ping Test AI Gateway
                  </button>
                  <button
                    onClick={handleClearSystemCache}
                    className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Dọn LRU Cache
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedAnalysisDetail, null, 2));
                      setSuccessMsg('Đã sao chép log chẩn đoán chi tiết vào Clipboard!');
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-purple-400" /> Copy JSON Diagnostics Log
                  </button>
                </div>
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Điểm Mạnh Nổi Bật (Top Candidate Strengths)
                </h4>
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-1.5">
                  {selectedAnalysisDetail.topStrengths?.map((str, idx) => (
                    <div key={`det-str-${idx}-${str}`} className="flex items-start gap-2 text-slate-200">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{str}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing Skills */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Kỹ Năng Thiếu Hụt So Với JD (Missing Skills)
                </h4>
                <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl flex flex-wrap gap-2">
                  {selectedAnalysisDetail.missingSkills?.map((sk, idx) => (
                    <span key={`det-sk-${idx}-${sk}`} className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-xl font-semibold">
                      ✗ {sk}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAnalysisDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl cursor-pointer"
              >
                Đóng Báo Cáo
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
