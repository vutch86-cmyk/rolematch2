export interface CandidateComparisonExportItem {
  candidateName: string;
  filename: string;
  overallScore: number | null;
  weightedScore?: number | null;
  matchLevel: string;
  isKnockedOut?: boolean;
  knockoutReason?: string;
  pipelineStage?: string;
  rating?: number;
  notes?: string;
  topStrengths?: string[];
  keyGaps?: string[];
  fullAnalysis?: any;
}

export const generateRecruiterComparisonMarkdown = (
  candidates: CandidateComparisonExportItem[],
  roleTitle: string = 'Vị trí tuyển dụng',
  lang: 'vi' | 'en' = 'vi'
): string => {
  const isEn = lang === 'en';
  const nowStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let md = `# ${isEn ? 'DEEP-DIVE CANDIDATE COMPARISON REPORT' : 'BÁO CÁO SO SÁNH CHUYÊN SÂU ỨNG VIÊN'}\n\n`;
  md += `> **${isEn ? 'Role / Position' : 'Vị trí tuyển dụng'}:** ${roleTitle}\n`;
  md += `> **${isEn ? 'Generated At' : 'Thời gian lập'}:** ${nowStr}\n`;
  md += `> **${isEn ? 'Evaluated Candidates' : 'Số lượng ứng viên so sánh'}:** ${candidates.length}\n\n`;
  md += `---\n\n`;

  // 1. Executive Summary Table
  md += `## 1. ${isEn ? 'Executive Score & Fit Summary' : 'Bảng Tổng Hợp Điểm Số & Mức Độ Khớp'}\n\n`;
  md += `| ${isEn ? 'Candidate' : 'Ứng viên'} | ${isEn ? 'Overall Score' : 'Điểm Tổng'} | ${isEn ? 'Weighted Score' : 'Điểm Trọng Số'} | ${isEn ? 'Match Level' : 'Mức Khớp'} | ${isEn ? 'Pipeline Stage' : 'Trạng Thái Tuyển Dụng'} | ${isEn ? 'Rating' : 'Đánh Giá'} | ${isEn ? 'Status' : 'Điều Kiện'} |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  candidates.forEach((c) => {
    const ov = c.overallScore !== null ? `${c.overallScore}%` : '—';
    const wt = typeof c.weightedScore === 'number' ? `${c.weightedScore}%` : ov;
    const stg = c.pipelineStage || 'INBOX';
    const stars = typeof c.rating === 'number' && c.rating > 0 ? `${'★'.repeat(c.rating)}` : '—';
    const ko = c.isKnockedOut ? `⚠️ ${isEn ? 'Disqualified' : 'Loại sàn'}` : `✅ ${isEn ? 'Qualified' : 'Đạt chuẩn'}`;
    md += `| **${c.candidateName}** | ${ov} | **${wt}** | ${c.matchLevel} | ${stg} | ${stars} | ${ko} |\n`;
  });
  md += `\n---\n\n`;

  // 2. Head-to-Head Deep Dive Matrix
  md += `## 2. ${isEn ? 'Side-by-Side Deep Dive Breakdown' : 'Đối Chiếu Trực Diện Từng Chiều Sâu'}\n\n`;
  candidates.forEach((c, idx) => {
    md += `### ${idx + 1}. ${c.candidateName} (${c.filename})\n\n`;
    if (c.isKnockedOut) {
      md += `> ⚠️ **${isEn ? 'Knock-out Notice' : 'Cảnh báo Loại sàn'}:** ${c.knockoutReason || (isEn ? 'Did not meet core minimum requirements' : 'Không đạt chuẩn sàn bắt buộc')}\n\n`;
    }
    if (c.notes) {
      md += `> 📝 **${isEn ? 'Recruiter Notes' : 'Ghi chú nội bộ HR'}:** ${c.notes}\n\n`;
    }

    const feature3 = c.fullAnalysis?.feature3;
    const feature1 = c.fullAnalysis?.feature1;

    md += `- **${isEn ? 'Key Competitive Edge' : 'Lợi thế cạnh tranh nổi trội'}:** ${feature1?.summary?.biggestStrength || (isEn ? 'Strong fundamental fit' : 'Khớp kỹ năng nền tảng')}\n`;
    md += `- **${isEn ? 'Recruiter Concern / Doubt' : 'Mối e ngại lớn nhất của HR'}:** ${feature3?.biggestDoubt || (isEn ? 'Requires skill verification' : 'Cần thẩm định thêm qua phỏng vấn')}\n`;
    md += `- **${isEn ? 'Seniority Fit' : 'Đánh giá Tầm vóc & Cấp bậc'}:** ${feature3?.seniorityFit?.level || feature3?.inviteDecision || 'MAYBE'}\n`;

    const gaps = Array.isArray(feature1?.summary?.missingKeywordsSkills)
      ? feature1.summary.missingKeywordsSkills.slice(0, 4).join(', ')
      : (c.keyGaps && c.keyGaps.length > 0 ? c.keyGaps.slice(0, 4).join(', ') : (isEn ? 'None identified' : 'Không có lỗ hổng lớn'));
    md += `- **${isEn ? 'Unproven JD Requirements' : 'Lỗ hổng / Tiêu chí chưa có bằng chứng'}:** ${gaps}\n\n`;
  });

  md += `---\n\n`;

  // 3. HR Interview Verification Kit
  md += `## 3. ${isEn ? 'HR Interview & Verification Question Kit' : 'Bộ Kịch Bản Phỏng Vấn Thẩm Định Dành Riêng Cho HR'}\n\n`;
  candidates.forEach((c, idx) => {
    md += `### 🎯 ${isEn ? 'Interview Kit for' : 'Kịch bản thẩm định cho'}: ${c.candidateName}\n\n`;

    const f4Questions = c.fullAnalysis?.feature4?.interviewQuestions;
    if (Array.isArray(f4Questions) && f4Questions.length > 0) {
      f4Questions.slice(0, 3).forEach((q: any, qIdx: number) => {
        md += `#### ${isEn ? 'Question' : 'Câu hỏi'} ${qIdx + 1}: "${q.question}"\n`;
        md += `- **${isEn ? 'Recruiter Intent' : 'Ý đồ ẩn sau câu hỏi'}:** ${q.interviewerIntent || (isEn ? 'Verify depth of experience' : 'Thẩm định độ sâu kinh nghiệm')}\n`;
        if (q.starAnswerGuide) {
          md += `- **${isEn ? 'What HR Should Listen For (STAR)' : 'Điều HR cần lắng nghe (STAR)'}:** ${q.starAnswerGuide.action || q.starAnswerGuide.situationTask || ''}\n`;
        }
        if (q.pitfallToAvoid) {
          md += `- **🚨 ${isEn ? 'Red Flags to Watch Out For' : 'Cờ đỏ Red Flags cần cảnh giác'}:** ${q.pitfallToAvoid}\n`;
        }
        md += `\n`;
      });
    } else {
      // Fallback questions based on keyGaps
      const gaps = c.keyGaps && c.keyGaps.length > 0 ? c.keyGaps : ['kinh nghiệm thực tế với hệ thống quy mô lớn'];
      gaps.slice(0, 2).forEach((gap, gIdx) => {
        md += `#### ${isEn ? 'Question' : 'Câu hỏi'} ${gIdx + 1}: ${isEn ? `Can you describe your hands-on experience handling "${gap}" in production?` : `Bạn có thể chia sẻ tình huống thực tế khi xử lý "${gap}" trong dự án gần nhất?`}\n`;
        md += `- **${isEn ? 'What to listen for' : 'Điều HR cần nghe'}:** ${isEn ? 'Concrete metrics, technical trade-offs, and personal ownership.' : 'Số liệu định lượng, bài toán đánh đổi kỹ thuật và vai trò thực tế của ứng viên.'}\n`;
        md += `- **🚨 ${isEn ? 'Red Flag' : 'Cờ đỏ Red Flag'}:** ${isEn ? 'Vague generalizations or claiming team achievements as personal.' : 'Nói chung chung lý thuyết, né tránh câu hỏi đào sâu hoặc nhận vơ công việc của cả nhóm.'}\n\n`;
      });
    }
  });

  return md;
};

export const downloadTextFile = (content: string, filename: string, mimeType: string = 'text/markdown;charset=utf-8;') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
