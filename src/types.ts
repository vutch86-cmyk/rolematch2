export type ImportanceLevel = 'Rất quan trọng' | 'Quan trọng' | 'Có lợi thế';

export type KeywordCategory =
  | 'Kỹ năng chuyên môn'
  | 'Công cụ, phần mềm hoặc phương pháp'
  | 'Kinh nghiệm mong muốn'
  | 'Kết quả đầu ra hoặc kỳ vọng công việc'
  | 'Phẩm chất hoặc cách làm việc';

export interface JDKeyword {
  keyword: string;
  category: KeywordCategory;
  importance: ImportanceLevel;
}

export interface ComparisonRow {
  jdTerm: string;
  importance: ImportanceLevel;
  cvEvidence: string; // "CV của tôi đã thể hiện ở đâu"
  gapOrClarification: string; // "Khoảng trống cần bổ sung hoặc viết rõ hơn"
  matchStatus: 'khop' | 'can_bo_sung' | 'thieu';
}

export interface CompatibilityScores {
  keywordMatchScore: number; // Mức độ khớp từ khóa chuyên môn (0-100)
  skillMatchScore: number; // Mức độ khớp kỹ năng (0-100)
  experienceOutcomeScore: number; // Mức độ khớp kinh nghiệm và kết quả đầu ra (0-100)
  overallRoleScore: number; // Mức độ phù hợp tổng thể với vai trò (0-100)
}

export interface AnalysisSummary {
  biggestStrength: string; // Điểm mạnh lớn nhất của CV so với JD
  missingKeywordsSkills: string[]; // Những từ khóa, kỹ năng hoặc kinh nghiệm quan trọng còn thiếu
  weakOrVagueSections: string[]; // Những phần trong CV đang yếu, quá chung chung hoặc chưa chứng minh được năng lực
  immediateActions: string[]; // 5 việc cụ thể cần sửa ngay để CV cạnh tranh hơn
}

export interface BulletRewriteItem {
  originalBullet: string;
  issueInOriginal: string; // Vấn đề của bullet gốc
  rewrittenBullet: string; // Bullet viết lại (Ngắn gọn và đầy đủ, Hành động + Công cụ + Kết quả)
  reasonBetter: string; // Vì sao bản mới tốt hơn
  isLackingInfo?: boolean; // If true, rewrittenBullet says "Cần bổ sung thông tin trước khi viết lại."
}

export interface RecruiterScanResult {
  inviteDecision: 'YES' | 'NO' | 'MAYBE'; // 1. Mời phỏng vấn không
  decisionReason: string; // Lý do chính
  firstImpression10s: string; // 2. Ấn tượng đầu tiên trong 10s
  immediateStrength: string; // 3. Điểm mạnh đập vào mắt ngay lập tức
  biggestDoubt: string; // 4. Nghi ngờ lớn nhất về ứng viên
  fastestPointLossSection: string; // 5. Phần khiến ứng viên bị mất điểm nhanh nhất
  top3MustFix: string[]; // 6. 3 điều bắt buộc phải sửa
}

export interface PipelineAuditStep {
  step: number;
  name: string;
  provider: string;
  status: 'completed' | 'in_progress' | 'skipped';
  durationMs?: number;
  details?: string;
}

export interface SequentialPipelineMetadata {
  modelPattern: string;
  steps: PipelineAuditStep[];
  auditorFeedback?: string;
  usedOpenAiKey?: boolean;
}

export interface CompleteCVAnalysisResponse {
  isDemoFallback?: boolean;
  pipelineMetadata?: SequentialPipelineMetadata;
  feature1: {
    jdKeywords: JDKeyword[];
    comparisonTable: ComparisonRow[];
    scores: CompatibilityScores;
    summary: AnalysisSummary;
  };
  feature2: {
    clarifyingQuestions: string[]; // Tối đa 3 câu hỏi làm rõ ngắn gọn
    rewrittenBullets: BulletRewriteItem[];
  };
  feature3: RecruiterScanResult;
}

export interface SamplePreset {
  id: string;
  title: string;
  role: string;
  jdText: string;
  cvText: string;
}

export interface UpdatedCvResponse {
  isDemoFallback?: boolean;
  updatedCvMarkdown: string;
  summaryOfChanges: string[];
}

export interface HistoryItem {
  id: string;
  title: string;
  timestamp: number;
  cvText: string;
  jdText: string;
  analysis: CompleteCVAnalysisResponse;
  score?: number;
}

export interface LogItem {
  id: string;
  timestamp: string;
  source: 'client' | 'server' | 'upload' | 'gemini' | 'network';
  level: 'error' | 'warn' | 'info';
  message: string;
  details?: string;
  endpoint?: string;
  userAgent?: string;
}

export type UserRole = 'admin' | 'normal';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  token?: string;
  isLocked?: boolean;
  failedLoginAttempts?: number;
  lockedAt?: string;
  dailyAnalysisCount?: { [dateStr: string]: number };
}

export interface AIModelStatus {
  id: string;
  provider: string;
  model: string;
  status: 'active' | 'auto_platform' | 'standby' | 'online' | 'error';
  statusLabel: string;
  role: string;
  configured: boolean;
  maskedKey: string;
  capabilities: string[];
  endpoints: string[];
}

export interface AiPingResult {
  id: string;
  provider: string;
  model: string;
  status: 'online' | 'standby' | 'error';
  latencyMs: number;
  message: string;
  responseSnippet?: string;
  testedAt: string;
  configuredKey: boolean;
}

export interface SystemStats {
  totalUsers: number;
  adminUsers: number;
  normalUsers: number;
  activeSessions: number;
  activeSessionsList?: any[];
  uptimeSeconds: number;
  memoryHeapUsedMB: number;
  memoryHeapTotalMB: number;
  nodeVersion: string;
  geminiConfigured: boolean;
  openrouterConfigured?: boolean;
  openaiConfigured?: boolean;
  systemTime: string;
  aiModels?: AIModelStatus[];
  appSettings?: {
    limitEnabled: boolean;
    dailyLimit: number;
  };
}

export interface AuthState {
  user: UserAccount | null;
  token: string | null;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: 'admin' | 'normal' | 'guest';
  action: string;
  category: 'AUTH' | 'USER_MGMT' | 'AI_SERVICE' | 'SYSTEM' | 'SECURITY';
  status: 'success' | 'warning' | 'error';
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UploadedDocumentItem {
  id: string;
  filename: string;
  fileType: 'CV' | 'JD';
  mimeType: string;
  fileSizeKB: number;
  characterCount: number;
  uploadedBy: string;
  uploadedAt: string;
  extractedTextPreview: string;
  fullText: string;
  format: 'PDF' | 'DOCX' | 'TXT' | 'IMAGE' | 'TEXT_INPUT';
}

export interface AnalysisRecordItem {
  id: string;
  timestamp: string;
  userEmail: string;
  jobTitle: string;
  overallScore: number;
  matchLevel: 'XUAT_SAC' | 'TOT' | 'TRUNG_BINH' | 'CAN_CAI_THIEN';
  cvFileName?: string;
  jdTitle?: string;
  topStrengths: string[];
  missingSkills: string[];
  recruiterDecision: 'YES' | 'NO' | 'MAYBE';
  engineUsed: string;
  durationMs: number;
  cvTextLength: number;
  jdTextLength: number;
  fullAnalysis?: CompleteCVAnalysisResponse;
}

