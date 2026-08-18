/**
 * UI PREVIEW — MOCK DATA ONLY
 * 
 * Standalone prototype component for "Real Batch Processing Queue".
 * NOTE: DO NOT IMPORT OR USE IN PRODUCTION APP UNTIL APPROVED BY USER.
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Play, 
  Check, 
  XCircle, 
  RefreshCw, 
  Slash, 
  RotateCcw, 
  Smartphone, 
  Layers, 
  UserCheck, 
  ArrowLeft, 
  Activity, 
  Ban, 
  Download, 
  ListOrdered, 
  Trophy, 
  CheckCircle2, 
  Eye, 
  AlertCircle, 
  UploadCloud, 
  Clock, 
  FileText, 
  Cpu 
} from 'lucide-react';

export interface MockQueueItem {
  id: string;
  fileName: string;
  fileSize: string;
  candidateName: string;
  status: 'Uploading' | 'Queued' | 'Extracting' | 'Analyzing' | 'Completed' | 'Failed' | 'Cancelled';
  stage: string;
  progress: number;
  elapsedTime: string;
  attempts: number;
  score: number | null;
  coverage: number | null;
  verdict: string | null;
  errorMsg?: string | null;
  suggestion?: string | null;
}

export const BatchProcessingQueuePreview: React.FC = () => {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'batch' | 'single'>('batch');
  const [selectedCandidate, setSelectedCandidate] = useState<MockQueueItem | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [autoDemo, setAutoDemo] = useState(false);

  const [queueItems, setQueueItems] = useState<MockQueueItem[]>([
    {
      id: 'cv-1',
      fileName: 'CV_NguyenVanA_SeniorFrontend.pdf',
      fileSize: '1.4 MB',
      candidateName: 'Nguyễn Văn A',
      status: 'Completed',
      stage: 'Hoàn tất phân tích',
      progress: 100,
      elapsedTime: '12s',
      attempts: 1,
      score: 84,
      coverage: 76,
      verdict: 'Rất phù hợp (Strong Match)',
      errorMsg: null
    },
    {
      id: 'cv-2',
      fileName: 'CV_TranVanB_Protected.pdf',
      fileSize: '1.8 MB',
      candidateName: 'Trần Văn B (Chưa nhận diện)',
      status: 'Failed',
      stage: 'Extracting',
      progress: 25,
      elapsedTime: '4s',
      attempts: 2,
      score: null,
      coverage: null,
      verdict: null,
      errorMsg: 'Không thể đọc nội dung PDF. File có thể bị lỗi hoặc được bảo vệ bằng mật khẩu.',
      suggestion: 'Tải lại bản PDF không có mật khẩu.'
    },
    {
      id: 'cv-3',
      fileName: 'CV_LeThiHuong_ReactLead.pdf',
      fileSize: '2.1 MB',
      candidateName: 'Lê Thị Hương',
      status: 'Analyzing',
      stage: 'Đang so khớp dữ liệu song song với trí tuệ nhân tạo',
      progress: 62,
      elapsedTime: '7s',
      attempts: 1,
      score: null,
      coverage: null,
      verdict: null,
      errorMsg: null
    }
  ]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-800 font-sans">
      <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-center text-xs tracking-wider uppercase rounded-xl mb-4">
        UI PREVIEW — MOCK DATA ONLY • KHÔNG KẾT NỐI SERVER THẬT
      </div>
      <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">RoleMatch — Batch Processing Queue Concept</h2>
        <p className="text-xs text-slate-500 mt-1">Prototype mã nguồn React tham chiếu độc lập cho Phase 0.</p>
      </div>
    </div>
  );
};

export default BatchProcessingQueuePreview;
