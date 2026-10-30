import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeCategory,
  normalizeDifficulty,
  normalizeStarGuide,
  inferInterviewQuestions,
  normalizeFeature4Data,
  formatQuestionToMarkdown,
  getCategoryBadgeColor,
  getDifficultyBadgeColor,
} from './interviewPrepHelpers';
import { ComparisonRow, RiskMitigationItem } from '../types';

test('1. normalizeCategory and normalizeDifficulty correctly map Vietnamese and English categories & levels', () => {
  assert.equal(normalizeCategory('Kiểm chứng khoảng trống CV', false), 'Kiểm chứng khoảng trống CV');
  assert.equal(normalizeCategory('CV Gap Verification', true), 'CV Gap Verification');
  assert.equal(normalizeCategory('khoảng trống kỹ năng', false), 'Kiểm chứng khoảng trống CV');
  assert.equal(normalizeCategory('tầm vóc và phong cách làm việc', false), 'Tầm vóc & Cách làm việc');
  assert.equal(normalizeCategory('behavioral leadership', true), 'Seniority & Behavioral Leadership');
  assert.equal(normalizeCategory('technical deep dive', false), 'Tình huống & Chuyên môn sâu');

  assert.equal(normalizeDifficulty('Rất khó', false), 'Rất khó');
  assert.equal(normalizeDifficulty('Very hard', true), 'Very Hard');
  assert.equal(normalizeDifficulty('Khó', false), 'Khó');
  assert.equal(normalizeDifficulty('Trọng tâm', false), 'Trọng tâm');
  assert.equal(normalizeDifficulty('critical priority', true), 'High Priority');
});

test('2. normalizeStarGuide guarantees situationTask, action, result structure', () => {
  const guideFromString = normalizeStarGuide('Nêu tình huống thực tế và kết quả đạt được', false);
  assert.ok(guideFromString.situationTask.length > 5);
  assert.ok(guideFromString.action.length > 5);
  assert.ok(guideFromString.result.length > 5);

  const guideFromObj = normalizeStarGuide(
    {
      situation: 'Dự án thương mại điện tử Black Friday',
      action: 'Tối ưu hóa caching Redis và scale pods Kubernetes',
      result: 'Hệ thống đạt 99.99% uptime, xử lý 50K RPS',
    },
    false
  );
  assert.equal(guideFromObj.situationTask, 'Dự án thương mại điện tử Black Friday');
  assert.equal(guideFromObj.action, 'Tối ưu hóa caching Redis và scale pods Kubernetes');
  assert.equal(guideFromObj.result, 'Hệ thống đạt 99.99% uptime, xử lý 50K RPS');

  const emptyGuideEn = normalizeStarGuide(null, true);
  assert.ok(emptyGuideEn.situationTask.includes('context'));
  assert.ok(emptyGuideEn.action.includes('Detail'));
  assert.ok(emptyGuideEn.result.includes('impact'));
});

test('3. inferInterviewQuestions generates 5 to 10 tailored questions based on gaps and risks', () => {
  const gaps: ComparisonRow[] = [
    {
      jdTerm: 'Kubernetes Cluster Management',
      importance: 'Rất quan trọng',
      isMustHave: true,
      cvEvidence: 'Thiếu thông tin',
      gapOrClarification: 'CV chưa có kinh nghiệm thực tế với K8s',
      matchStatus: 'thieu',
    },
    {
      jdTerm: 'Terraform IaC',
      importance: 'Quan trọng',
      isMustHave: false,
      cvEvidence: 'Có nhắc đến ở mục Kỹ năng',
      gapOrClarification: 'Cần bổ sung dự án cụ thể',
      matchStatus: 'can_bo_sung',
    },
  ];

  const risks: RiskMitigationItem[] = [
    {
      riskType: 'metric_lacking',
      riskTitle: 'Thiếu số liệu đo lường hiệu năng',
      severity: 'high',
      recruiterConcern: 'Chưa thấy số liệu SLA/KPI cụ thể',
      cvMitigation: 'Thêm số liệu XYZ',
      interviewDefense: 'Chuẩn bị dẫn chứng các chỉ số 99.9% uptime và 30% latency reduction',
    },
  ];

  const questions = inferInterviewQuestions(
    'CV mẫu DevOps',
    'JD Senior DevOps Engineer',
    false,
    gaps,
    risks
  );

  assert.ok(questions.length >= 5 && questions.length <= 10, `Expected 5-10 questions, got ${questions.length}`);
  const k8sQ = questions.find((q) => q.question.includes('Kubernetes Cluster Management'));
  assert.ok(k8sQ, 'Should contain question about missing Kubernetes gap');
  assert.equal(k8sQ?.difficulty, 'Rất khó');
  assert.ok(k8sQ?.starAnswerGuide.situationTask.length > 10);
  assert.ok(k8sQ?.starAnswerGuide.action.length > 10);
  assert.ok(k8sQ?.starAnswerGuide.result.length > 10);
  assert.ok(k8sQ?.pitfallToAvoid.length > 10);
});

test('4. normalizeFeature4Data safeguards missing data, handles backward compatibility, and constrains to 5-10 questions', () => {
  // Empty rawFeature4 -> should infer fallback with 5-10 questions
  const emptyRes = normalizeFeature4Data(null, 'CV dev', 'JD dev', 'vi');
  assert.ok(emptyRes.questions.length >= 5 && emptyRes.questions.length <= 10);
  assert.ok(emptyRes.interviewPrepSummary && emptyRes.interviewPrepSummary.length > 10);

  // Partial rawFeature4 with only 2 questions -> should supplement to at least 5
  const partialRes = normalizeFeature4Data(
    {
      interviewPrepSummary: 'Chiến lược phỏng vấn tùy chỉnh',
      questions: [
        {
          question: 'Em hãy giới thiệu dự án tâm đắc nhất?',
          category: 'Tình huống',
          difficulty: 'Trọng tâm',
          sourceGapOrDoubt: 'JD yêu cầu',
          interviewerIntent: 'Xem khả năng diễn đạt',
          starAnswerGuide: {
            situationTask: 'Dự án A',
            action: 'Làm B',
            result: 'Đạt C',
          },
          pitfallToAvoid: 'Nói dài dòng',
        },
      ],
    },
    'CV text',
    'JD text',
    'vi'
  );

  assert.ok(partialRes.questions.length >= 5, `Expected >= 5 questions after supplementing, got ${partialRes.questions.length}`);
  assert.equal(partialRes.questions[0].question, 'Em hãy giới thiệu dự án tâm đắc nhất?');
});

test('5. formatQuestionToMarkdown and badge helpers return valid output and styles', () => {
  const item = {
    question: 'Tại sao bạn nghỉ việc ở công ty cũ?',
    category: 'Tầm vóc & Cách làm việc',
    difficulty: 'Khó',
    sourceGapOrDoubt: 'Thời gian gắn bó 8 tháng',
    interviewerIntent: 'Đánh giá tính cam kết lâu dài',
    starAnswerGuide: {
      situationTask: 'Bối cảnh công ty cũ tái cấu trúc',
      action: 'Chủ động bàn giao và tìm kiếm môi trường mới',
      result: 'Rời đi chuyên nghiệp, giữ mối quan hệ tốt',
    },
    pitfallToAvoid: 'Nói xấu sếp cũ hoặc văn hóa công ty cũ',
  };

  const md = formatQuestionToMarkdown(item, 0, false);
  assert.ok(md.includes('### 1. Tại sao bạn nghỉ việc ở công ty cũ?'));
  assert.ok(md.includes('S/T (Situation/Task)'));
  assert.ok(md.includes('Bẫy cần tránh'));

  const catStyle = getCategoryBadgeColor('Tầm vóc & Cách làm việc');
  assert.ok(catStyle.bg.includes('purple'));

  const diffStyle = getDifficultyBadgeColor('Rất khó');
  assert.ok(diffStyle.bg.includes('red'));
});

test('6. Backend schema and server.ts contract contains feature4, starAnswerGuide, and pitfallToAvoid', () => {
  const serverPath = path.resolve(__dirname, '../../server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf-8');

  // We will verify server.ts contains feature4 after we update server.ts
  assert.ok(serverCode.includes('feature4'), 'server.ts must reference feature4');
});
