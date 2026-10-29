import { CompleteCVAnalysisResponse } from '../types';
import { normalizeFeature1Data } from './keywordMatchHelpers';
import { normalizeFeature2Data } from './bulletRewriteHelpers';
import { normalizeFeature3Data } from './recruiterScanHelpers';

export function generateMarkdownReport(
  analysis: CompleteCVAnalysisResponse,
  cvTitle: string
): string {
  const f1 = analysis?.feature1 || {
    scores: {
      keywordMatchScore: 0,
      skillMatchScore: 0,
      experienceOutcomeScore: 0,
      overallRoleScore: 0,
    },
    summary: {
      biggestStrength: '',
      missingKeywordsSkills: [],
      weakOrVagueSections: [],
      immediateActions: [],
    },
    comparisonTable: [],
    jdKeywords: [],
  };
  const f2 = analysis?.feature2 || { clarifyingQuestions: [], rewrittenBullets: [] };
  const f3 = analysis?.feature3 || {
    inviteDecision: 'MAYBE',
    decisionReason: '',
    firstImpression10s: '',
    immediateStrength: '',
    biggestDoubt: '',
    fastestPointLossSection: '',
    top3MustFix: [],
  };

  const {
    normalizedComparisonTable,
    enrichedScores,
    mustHaveStats,
  } = normalizeFeature1Data(
    f1.jdKeywords || [],
    f1.comparisonTable || [],
    f1.scores || {
      keywordMatchScore: 0,
      skillMatchScore: 0,
      experienceOutcomeScore: 0,
      overallRoleScore: 0,
    },
    'vi'
  );

  const {
    clarifyingQuestions: questions,
    rewrittenBullets: bullets,
    tailoredSummaries,
    sectionAudit,
  } = normalizeFeature2Data(
    f2,
    '',
    '',
    analysis?.companyName || '',
    analysis?.jobTitle || '',
    false
  );

  const {
    normalizedResult: normF3,
    seniorityFit,
    riskMitigationMatrix,
  } = normalizeFeature3Data(f3, '', '', 'vi');

  const missingSkills = f1.summary?.missingKeywordsSkills || [];
  const weakSections = f1.summary?.weakOrVagueSections || [];
  const actions = f1.summary?.immediateActions || [];
  const mustFix = normF3.top3MustFix || [];

  return `# BÁO CÁO PHÂN TÍCH VÀ TỐI ƯU CV CHUẨN TUYỂN DỤNG (SENIOR HR REPORT)
**Vị trí / Hồ sơ:** ${cvTitle || 'Ứng viên'}
**Công ty mục tiêu:** ${analysis?.companyName || 'Công ty tuyển dụng'}
**Ngày thực hiện:** ${new Date().toLocaleDateString('vi-VN')}

---

## TÍNH NĂNG 1: TRÍCH XUẤT NGÔN NGỮ NHÀ TUYỂN DỤNG & ĐỐI CHIẾU CV

### 1. Đánh giá Mức độ Phù hợp & Giải trình Điểm số (Thang điểm 0 - 100%)
- **Mức độ phù hợp tổng thể hiện tại:** **${enrichedScores.overallRoleScore}%** ➔ **Điểm tiềm năng sau tối ưu:** **${enrichedScores.projectedOverallScore}%**
  * *Giải trình tổng thể:* ${enrichedScores.overallRationale}
- **Mức độ khớp từ khóa chuyên môn:** **${enrichedScores.keywordMatchScore}%**
  * *Giải trình:* ${enrichedScores.keywordRationale}
- **Mức độ khớp kỹ năng:** **${enrichedScores.skillMatchScore}%**
  * *Giải trình:* ${enrichedScores.skillRationale}
- **Mức độ khớp kinh nghiệm và kết quả đầu ra:** **${enrichedScores.experienceOutcomeScore}%**
  * *Giải trình:* ${enrichedScores.experienceRationale}
- **Độ phủ Tiêu chí Bắt buộc (Must-Have / Knock-out):** Đạt **${mustHaveStats.matchedMustHave}/${mustHaveStats.totalMustHave}** tiêu chí (${mustHaveStats.mustHavePassRate}%).

### 2. Tóm tắt Phân tích
- **Điểm mạnh lớn nhất của CV so với JD:** ${f1.summary?.biggestStrength || 'Chưa cập nhật'}
- **Từ khóa / Kỹ năng / Kinh nghiệm còn thiếu:**
${missingSkills.map((s) => `  * ${s}`).join('\n')}
- **Phần CV đang yếu hoặc quá chung chung:**
${weakSections.map((s) => `  * ${s}`).join('\n')}
- **5 việc cụ thể cần sửa ngay:**
${actions.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

### 3. Bảng Đối chiếu CV với JD Thực chiến
| Cụm từ trong JD | Phân loại | Mức độ quan trọng | CV đã thể hiện ở đâu | Khoảng trống cần bổ sung | Vị trí chèn & Câu mẫu gợi ý |
| :--- | :--- | :--- | :--- | :--- | :--- |
${normalizedComparisonTable
  .map(
    (row) =>
      `| ${row.jdTerm || ''} | ${row.isMustHave ? 'Bắt buộc (Must-Have)' : 'Điểm cộng (Nice-to-Have)'} | ${row.importance || ''} | ${row.cvEvidence || 'Thiếu thông tin'} | ${
        row.gapOrClarification || 'Chưa có'
      } | ${
        row.matchStatus === 'khop'
          ? 'Đã khớp tốt'
          : `[${row.targetSection || 'Kinh nghiệm làm việc'}] "${row.suggestedPhrasing || ''}"`
      } |`
  )
  .join('\n')}

---

## TÍNH NĂNG 2: TỐI ƯU HỒ SƠ, AUDIT CẤU TRÚC & VIẾT LẠI BULLET POINT

### 1. Tóm Tắt Hồ Sơ Định Vị Theo Vị Trí (Targeted Professional Summary)
- **${tailoredSummaries.technicalFocus.title}:**
  > "${tailoredSummaries.technicalFocus.pitch}"
  * *Điểm sáng cốt lõi:* ${tailoredSummaries.technicalFocus.keyHighlights.join(' • ')}

- **${tailoredSummaries.managementFocus.title}:**
  > "${tailoredSummaries.managementFocus.pitch}"
  * *Điểm sáng cốt lõi:* ${tailoredSummaries.managementFocus.keyHighlights.join(' • ')}

### 2. Đánh Giá Cấu Trúc Từng Phần CV (Section-by-Section Structural Review)
${sectionAudit.overallSectionRating ? `*Đánh giá chung:* **${sectionAudit.overallSectionRating}**\n` : ''}
| Mục CV | Độ hoàn thiện | Trạng thái | Nhận xét thực trạng | Đề xuất điều chỉnh & Mẫu câu tham khảo |
| :--- | :--- | :--- | :--- | :--- |
${sectionAudit.sections
  .map(
    (s) =>
      `| **${s.sectionName}** | ${s.score}/100 | ${
        s.status === 'tot' ? '🟢 Tốt (Đạt chuẩn)' : s.status === 'can_cai_thien' ? '🟡 Cần cải thiện' : '🔴 Cần bổ sung gấp'
      } | ${s.comment} | ${s.actionableFix}${
        s.suggestedSnippets && s.suggestedSnippets.length > 0
          ? `<br/>*Mẫu câu tham khảo từ CV:*<br/>• ` + s.suggestedSnippets.join('<br/>• ')
          : ''
      } |`
  )
  .join('\n')}

### 3. Bảng Viết Lại Bullet Point Chuẩn XYZ & Lồng Ghép Từ Khóa JD
${
  questions.length > 0
    ? `#### Câu hỏi làm rõ:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : ''
}

| Bullet gốc trong CV | Vấn đề cần khắc phục | Bullet viết lại (XYZ / STAR) | Từ khóa JD & Chỗ điền số liệu | Vì sao bản mới tốt hơn |
| :--- | :--- | :--- | :--- | :--- |
${bullets
  .map(
    (b) =>
      `| ${b.originalBullet || ''} | ${b.issueInOriginal || ''} | ${b.rewrittenBullet || ''} | **Từ khóa:** ${(b.embeddedKeywords || []).join(', ') || 'N/A'}<br/>**Gợi ý số liệu:** ${(b.metricPlaceholders || []).join(', ') || 'N/A'} | ${b.reasonBetter || ''} |`
  )
  .join('\n')}

---

## TÍNH NĂNG 3: GÓC NHÌN NHÀ TUYỂN DỤNG, ĐỐI CHIẾU TẦM VÓC & HÓA GIẢI RỦI RO

### 1. Quyết Định Đọc Lướt 10 Giây
- **Quyết định phỏng vấn:** **${normF3.inviteDecision || 'MAYBE'}**
- **Lý do chính:** ${normF3.decisionReason || ''}
- **Ấn tượng đầu tiên trong 10 giây:** ${normF3.firstImpression10s || ''}
- **Điểm mạnh đập vào mắt ngay lập tức:** ${normF3.immediateStrength || ''}
- **Nghi ngờ lớn nhất của HR:** ${normF3.biggestDoubt || ''}
- **Phần mất điểm nhanh nhất:** ${normF3.fastestPointLossSection || ''}

### 2. Đánh Giá Tầm Vóc & Cấp Bậc (Seniority & Scope Fit 4 Trục)
- **Định vị tầm vóc tổng thể:** **${seniorityFit.overallAssessmentLabel}**
- **Giải trình tầm vóc:** ${seniorityFit.summaryRationale}
- **Chiến lược định vị phỏng vấn:** ${seniorityFit.positioningAdvice}

| Trục đánh giá | Đánh giá | Kỳ vọng từ JD | Thực tế thể hiện trong CV | Nhận xét của HR |
| :--- | :--- | :--- | :--- | :--- |
${seniorityFit.dimensions
  .map(
    (d) =>
      `| **${d.dimensionName}** | ${
        d.assessment === 'match' ? '🟢 Đúng tầm' : d.assessment === 'over' ? '🟣 Vượt tầm' : '🟡 Chưa tới tầm'
      } | ${d.jdExpectation} | ${d.cvReality} | ${d.comment} |`
  )
  .join('\n')}

### 3. Ma Trận Hóa Giải Rủi Ro (Risk Radar & Mitigation Playbook)
| Red Flag / Điểm nghi ngại | Mức độ | Nỗi e ngại của HR | Cách hóa giải trên CV | Kịch bản trả lời khi Phỏng vấn |
| :--- | :--- | :--- | :--- | :--- |
${riskMitigationMatrix
  .map(
    (r) =>
      `| **${r.riskTitle}** | ${
        r.severity === 'high' ? '🔴 Rủi ro cao' : r.severity === 'medium' ? '🟡 Cần chú ý' : '🔵 Rủi ro thấp'
      } | ${r.recruiterConcern} | ${r.cvMitigation} | ${r.interviewDefense} |`
  )
  .join('\n')}

### 4. 3 Điều Bắt Buộc Phải Sửa Ngay
${mustFix.map((item, i) => `${i + 1}. ${item}`).join('\n')}

---
*Báo cáo được tổng hợp bởi Trợ lý Senior HR & Talent Acquisition Lead AI Studio.*
`;
}
