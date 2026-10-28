import { CompleteCVAnalysisResponse } from '../types';
import { normalizeFeature1Data } from './keywordMatchHelpers';

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

  const missingSkills = f1.summary?.missingKeywordsSkills || [];
  const weakSections = f1.summary?.weakOrVagueSections || [];
  const actions = f1.summary?.immediateActions || [];
  const questions = f2.clarifyingQuestions || [];
  const bullets = f2.rewrittenBullets || [];
  const mustFix = f3.top3MustFix || [];

  return `# BÁO CÁO PHÂN TÍCH VÀ TỐI ƯU CV CHUẨN TUYỂN DỤNG (SENIOR HR REPORT)
**Vị trí / Hồ sơ:** ${cvTitle || 'Ứng viên'}
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

## TÍNH NĂNG 2: BẢNG VIẾT LẠI CÁC BULLET POINT TRONG CV THEO JD

${
  questions.length > 0
    ? `### Câu hỏi làm rõ:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n`
    : ''
}

| Bullet gốc | Vấn đề của bullet gốc | Bullet viết lại | Vì sao bản mới tốt hơn |
| :--- | :--- | :--- | :--- |
${bullets
  .map(
    (b) =>
      `| ${b.originalBullet || ''} | ${b.issueInOriginal || ''} | ${b.rewrittenBullet || ''} | ${b.reasonBetter || ''} |`
  )
  .join('\n')}

---

## TÍNH NĂNG 3: ĐÓNG VAI NHÀ TUYỂN DỤNG ĐỌC CV TRONG 10 GIÂY

1. **Bạn có muốn mời ứng viên này vào vòng phỏng vấn không? Vì sao?**
   - **Quyết định:** ${f3.inviteDecision || ''}
   - **Lý do:** ${f3.decisionReason || ''}

2. **Ấn tượng đầu tiên khi nhìn lướt CV trong 10 giây:**
   ${f3.firstImpression10s || ''}

3. **Điểm mạnh nào đập vào mắt ngay lập tức?**
   ${f3.immediateStrength || ''}

4. **Nghi ngờ lớn nhất của bạn về ứng viên này là gì?**
   ${f3.biggestDoubt || ''}

5. **Phần nào trong CV khiến ứng viên bị mất điểm nhanh nhất?**
   ${f3.fastestPointLossSection || ''}

6. **3 điều bắt buộc phải sửa để tăng khả năng được gọi phỏng vấn:**
${mustFix.map((item, i) => `   ${i + 1}. ${item}`).join('\n')}

---
*Báo cáo được tổng hợp bởi Trợ lý Senior HR & Talent Acquisition Lead AI Studio.*
`;
}
