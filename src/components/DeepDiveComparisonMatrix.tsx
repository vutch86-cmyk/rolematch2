import React, { useState } from 'react';
import {
  Users,
  X,
  Download,
  Copy,
  Check,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  ShieldAlert,
  Star,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { PIPELINE_STAGES } from '../utils/recruiterPipelineHelpers';
import {
  generateRecruiterComparisonMarkdown,
  downloadTextFile
} from '../utils/recruiterComparisonExport';

interface DeepDiveComparisonMatrixProps {
  candidates: any[];
  onRemoveCandidate: (filename: string) => void;
  onClearSelection: () => void;
  roleTitle?: string;
  isEn: boolean;
  comparisonColors?: string[];
}

export const DeepDiveComparisonMatrix: React.FC<DeepDiveComparisonMatrixProps> = ({
  candidates,
  onRemoveCandidate,
  onClearSelection,
  roleTitle = 'Vị trí tuyển dụng',
  isEn,
  comparisonColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
}) => {
  const [hasCopiedReport, setHasCopiedReport] = useState<boolean>(false);
  const [isInterviewKitExpanded, setIsInterviewKitExpanded] = useState<boolean>(true);

  if (candidates.length === 0) return null;

  const getCandidateDisplayName = (candidate: any, fallbackIdx: number): string => {
    if (!candidate) return `Ứng viên ${fallbackIdx}`;
    return candidate.candidateName || candidate.filename.replace(/\.[^/.]+$/, '');
  };

  // Prepare chart data for up to 5 candidates
  const chartData = [
    {
      component: isEn ? 'Keywords' : 'Từ khóa',
      ...Object.fromEntries(candidates.map((c, i) => [getCandidateDisplayName(c, i + 1), c.keywordScore ?? 0]))
    },
    {
      component: isEn ? 'Skills' : 'Kỹ năng',
      ...Object.fromEntries(candidates.map((c, i) => [getCandidateDisplayName(c, i + 1), c.skillScore ?? 0]))
    },
    {
      component: isEn ? 'Experience' : 'Kinh nghiệm',
      ...Object.fromEntries(candidates.map((c, i) => [getCandidateDisplayName(c, i + 1), c.experienceScore ?? 0]))
    },
    {
      component: isEn ? 'Weighted Score' : 'Điểm Trọng Số',
      ...Object.fromEntries(candidates.map((c, i) => [getCandidateDisplayName(c, i + 1), c.weightedScore ?? c.overallScore ?? 0]))
    }
  ];

  const handleExportMarkdown = () => {
    const md = generateRecruiterComparisonMarkdown(candidates, roleTitle, isEn ? 'en' : 'vi');
    const filename = `Candidate_Comparison_${roleTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 24)}_${Date.now()}.md`;
    downloadTextFile(md, filename);
  };

  const handleCopyReport = async () => {
    const md = generateRecruiterComparisonMarkdown(candidates, roleTitle, isEn ? 'en' : 'vi');
    try {
      await navigator.clipboard.writeText(md);
      setHasCopiedReport(true);
      setTimeout(() => setHasCopiedReport(false), 3000);
    } catch (err) {
      console.error('Failed to copy comparison markdown:', err);
    }
  };

  return (
    <div className="bg-indigo-50/50 rounded-2xl p-5 sm:p-6 border-2 border-indigo-200 shadow-sm space-y-6 animate-fade-in">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-600 text-white rounded-md text-[10px] font-black uppercase tracking-wider">
              {isEn ? 'Recruiter 2.0' : 'So Sánh Chuyên Sâu'}
            </span>
            <h4 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              {isEn ? `Side-by-Side Comparison Matrix (${candidates.length}/5 Candidates)` : `Ma Trận So Sánh Trực Diện (${candidates.length}/5 Ứng Viên)`}
            </h4>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {isEn
              ? 'Multi-dimensional evaluation: weighted score, seniority fit, key edge vs critical flaw, and tailored HR interview kit.'
              : 'Đối chiếu đa chiều: Điểm trọng số, tầm vóc cấp bậc, lợi thế vượt trội vs lỗ hổng chí mạng kèm bộ câu hỏi thẩm định cho HR.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            {hasCopiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{hasCopiedReport ? (isEn ? 'Copied!' : 'Đã chép!') : (isEn ? 'Copy Report' : 'Chép Báo Cáo')}</span>
          </button>

          <button
            type="button"
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isEn ? 'Export Markdown' : 'Xuất Báo Cáo (.md)'}</span>
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
          >
            {isEn ? 'Clear' : 'Bỏ chọn'}
          </button>
        </div>
      </div>

      {/* Candidate Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">{isEn ? 'Comparing:' : 'Đang chọn:'}</span>
        {candidates.map((cand, idx) => (
          <span
            key={cand.filename}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: comparisonColors[idx % comparisonColors.length] }}
            />
            <span>{getCandidateDisplayName(cand, idx + 1)}</span>
            <span className="text-indigo-600 font-extrabold">
              ({cand.weightedScore ?? cand.overallScore}%)
            </span>
            <button
              type="button"
              onClick={() => onRemoveCandidate(cand.filename)}
              className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {candidates.length < 5 && (
          <span className="text-[11px] text-indigo-600 font-medium italic">
            ({isEn ? `You can add ${5 - candidates.length} more` : `Có thể chọn thêm ${5 - candidates.length} ứng viên nữa`})
          </span>
        )}
      </div>

      {/* Bar Chart Breakdown */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-xs space-y-3">
        <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">
          {isEn ? 'Component Score Breakdown Comparison' : 'Biểu Đồ So Sánh Các Thành Phần Điểm (%)'}
        </h5>
        <div className="h-64 sm:h-72 w-full text-xs font-semibold">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="component" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '11px'
                }}
                formatter={(value: any, name: any) => [`${value}%`, name]}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 'bold' }} />
              {candidates.map((c, i) => (
                <Bar
                  key={c.filename}
                  dataKey={getCandidateDisplayName(c, i + 1)}
                  fill={comparisonColors[i % comparisonColors.length]}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Side-by-Side Comparison Table */}
      <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-800">
              <tr>
                <th className="p-3.5 min-w-[150px]">{isEn ? 'Evaluation Axis' : 'Trục Đánh Giá'}</th>
                {candidates.map((c, idx) => (
                  <th key={c.filename} className="p-3.5 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: comparisonColors[idx % comparisonColors.length] }}
                      />
                      <span className="truncate">{getCandidateDisplayName(c, idx + 1)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {/* Row 1: Weighted Score */}
              <tr>
                <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">
                  {isEn ? 'Weighted Score' : 'Điểm Trọng Số'}
                </td>
                {candidates.map((c) => (
                  <td key={c.filename} className="p-3.5">
                    <span className="text-base font-black text-indigo-600">
                      {typeof c.weightedScore === 'number'
                        ? `${c.weightedScore}%`
                        : typeof c.overallScore === 'number'
                        ? `${c.overallScore}%`
                        : '—'}
                    </span>
                    {typeof c.overallScore === 'number' && c.overallScore !== c.weightedScore && (
                      <span className="text-[11px] text-slate-400 block font-normal">
                        ({isEn ? 'Raw:' : 'Gốc:'} {c.overallScore}%)
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 2: Knockout Status */}
              <tr>
                <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">
                  {isEn ? 'Knock-out Check' : 'Điều Kiện Loại Sàn'}
                </td>
                {candidates.map((c) => (
                  <td key={c.filename} className="p-3.5">
                    {c.isKnockedOut ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                          <ShieldAlert className="w-3 h-3" />
                          <span>{isEn ? 'Knocked Out' : 'Bị Loại Sàn'}</span>
                        </span>
                        {c.knockoutReason && (
                          <p className="text-[10px] text-rose-600 mt-1 line-clamp-2">{c.knockoutReason}</p>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span>{isEn ? 'Qualified' : 'Đạt Chuẩn'}</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row 3: Pipeline Stage & Rating */}
              <tr>
                <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">
                  {isEn ? 'Pipeline & Rating' : 'Trạng Thái & Đánh Giá'}
                </td>
                {candidates.map((c) => {
                  const stage = (c.pipelineStage || 'INBOX') as keyof typeof PIPELINE_STAGES;
                  const cfg = PIPELINE_STAGES[stage] || PIPELINE_STAGES.INBOX;
                  return (
                    <td key={c.filename} className="p-3.5 space-y-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${cfg.badgeClass}`}>
                        {isEn ? cfg.labelEn : cfg.labelVi}
                      </span>
                      {typeof c.rating === 'number' && c.rating > 0 && (
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {'★'.repeat(c.rating)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row 4: Seniority & Scope Fit */}
              <tr>
                <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">
                  {isEn ? 'Seniority & Scope Fit' : 'Tầm Vóc & Cấp Bậc'}
                </td>
                {candidates.map((c) => {
                  const f3 = c.fullAnalysis?.feature3;
                  const fitLevel = f3?.seniorityFit?.level || f3?.inviteDecision || 'MAYBE';
                  const summary = f3?.seniorityFit?.scopeAssessment || f3?.firstImpression10s || '';
                  return (
                    <td key={c.filename} className="p-3.5 text-slate-800 text-[11px] leading-relaxed">
                      <span className="font-black text-indigo-700 block mb-0.5">{fitLevel}</span>
                      <p className="line-clamp-3 text-slate-600">{summary || (isEn ? 'No data' : 'Chưa có phân tích')}</p>
                    </td>
                  );
                })}
              </tr>

              {/* Row 5: Key Competitive Edge */}
              <tr>
                <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">
                  {isEn ? 'Key Edge (Strength)' : 'Lợi Thế Vượt Trội'}
                </td>
                {candidates.map((c) => {
                  const strength = c.fullAnalysis?.feature1?.summary?.biggestStrength || (c.topStrengths && c.topStrengths[0]) || '';
                  return (
                    <td key={c.filename} className="p-3.5 text-slate-800 text-[11px] leading-relaxed">
                      {strength || (isEn ? 'Standard match' : 'Khớp kỹ năng chung')}
                    </td>
                  );
                })}
              </tr>

              {/* Row 6: Recruiter Concern / Red Flag */}
              <tr>
                <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">
                  {isEn ? 'Recruiter Concern / Doubt' : 'Mối E Ngại / Rủi Ro'}
                </td>
                {candidates.map((c) => {
                  const doubt = c.fullAnalysis?.feature3?.biggestDoubt || '';
                  return (
                    <td key={c.filename} className="p-3.5 text-slate-800 text-[11px] leading-relaxed">
                      {doubt || (isEn ? 'Verify in interview' : 'Cần thẩm định thêm trong phỏng vấn')}
                    </td>
                  );
                })}
              </tr>

              {/* Row 7: Unproven JD Requirements */}
              <tr>
                <td className="p-3.5 font-bold text-slate-500 bg-slate-50/50">
                  {isEn ? 'Unproven JD Requirements' : 'Tiêu Chí Chưa Có Bằng Chứng'}
                </td>
                {candidates.map((c) => {
                  const gaps = Array.isArray(c.fullAnalysis?.feature1?.summary?.missingKeywordsSkills)
                    ? c.fullAnalysis.feature1.summary.missingKeywordsSkills
                    : (c.keyGaps || []);
                  return (
                    <td key={c.filename} className="p-3.5">
                      {gaps.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {gaps.slice(0, 3).map((g: string) => (
                            <span key={g} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                              {g}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">{isEn ? 'None' : 'Không có'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* HR Interview & Verification Kit Section */}
      <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setIsInterviewKitExpanded(!isInterviewKitExpanded)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h5 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                {isEn ? 'HR Interview & Verification Question Kit' : 'Bộ Kịch Bản Phỏng Vấn Thẩm Định Dành Riêng Cho HR'}
              </h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEn
                  ? 'Targeted interview questions generated per candidate with "What to listen for" & "Red Flags".'
                  : 'Câu hỏi xoáy sâu vào lỗ hổng thực tế của từng ứng viên kèm checklist điều HR cần nghe và cờ đỏ Red Flags.'}
              </p>
            </div>
          </div>
          {isInterviewKitExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isInterviewKitExpanded && (
          <div className="p-4 sm:p-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((cand, idx) => {
              const f4Questions = cand.fullAnalysis?.feature4?.interviewQuestions;
              const displayQuestions = Array.isArray(f4Questions) && f4Questions.length > 0
                ? f4Questions.slice(0, 2)
                : null;

              return (
                <div
                  key={cand.filename}
                  className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 space-y-3"
                >
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: comparisonColors[idx % comparisonColors.length] }}
                    />
                    <h6 className="text-xs font-black text-slate-900 truncate">
                      {getCandidateDisplayName(cand, idx + 1)}
                    </h6>
                  </div>

                  {displayQuestions ? (
                    displayQuestions.map((q: any, qIdx: number) => (
                      <div key={qIdx} className="space-y-1.5 text-xs bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                        <p className="font-bold text-slate-900 leading-snug">
                          {qIdx + 1}. "{q.question}"
                        </p>
                        <p className="text-[11px] text-slate-600">
                          <strong className="text-indigo-700">{isEn ? 'Listen for: ' : 'Cần nghe: '}</strong>
                          {q.starAnswerGuide?.action || q.interviewerIntent}
                        </p>
                        {q.pitfallToAvoid && (
                          <p className="text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded font-medium">
                            <strong>🚨 Red Flag: </strong>
                            {q.pitfallToAvoid}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2 text-xs bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <p className="font-bold text-slate-900 leading-snug">
                        1. "{isEn ? `Can you demonstrate your hands-on mastery in ${cand.keyGaps?.[0] || 'core technologies'}?` : `Bạn có thể chia sẻ tình huống thực tế khi triển khai ${cand.keyGaps?.[0] || 'công nghệ trọng yếu'}?`}"
                      </p>
                      <p className="text-[11px] text-slate-600">
                        <strong className="text-indigo-700">{isEn ? 'Listen for: ' : 'Cần nghe: '}</strong>
                        {isEn ? 'Specific metrics, technical ownership, and architectural trade-offs.' : 'Số liệu định lượng, vai trò chịu trách nhiệm và bài toán kỹ thuật thực tế.'}
                      </p>
                      <p className="text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded font-medium">
                        <strong>🚨 Red Flag: </strong>
                        {isEn ? 'Vague generalizations or theoretical recitations.' : 'Nói lý thuyết chung chung, không nắm rõ kiến trúc thực tế.'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
