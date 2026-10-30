import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractYearsOfExperience,
  detectSeniorityTier,
  inferSeniorityFit,
  inferRiskMitigationMatrix,
  normalizeFeature3Data,
  getSeniorityAssessmentConfig,
  getRiskSeverityConfig,
} from './recruiterScanHelpers';
import { generateMarkdownReport } from './exportMarkdown';
import { CompleteCVAnalysisResponse } from '../types';

test('1. extractYearsOfExperience and detectSeniorityTier detect tenure and role levels accurately', () => {
  assert.equal(extractYearsOfExperience('Yêu cầu 5+ năm kinh nghiệm quản trị hệ thống'), 5);
  assert.equal(extractYearsOfExperience('Minimum 7 years of experience in distributed systems'), 7);
  assert.equal(extractYearsOfExperience('Fresher mới ra trường'), null);

  assert.equal(detectSeniorityTier('Tuyển dụng Giám đốc Công nghệ (CTO)'), 'director_exec');
  assert.equal(detectSeniorityTier('Cần tuyển Senior DevOps Engineer'), 'senior');
  assert.equal(detectSeniorityTier('Engineering Lead / Technical Manager'), 'lead_manager');
  assert.equal(detectSeniorityTier('Thực tập sinh Frontend'), 'junior');
  assert.equal(detectSeniorityTier('Chuyên viên phân tích dữ liệu'), 'mid');
});

test('2. inferSeniorityFit generates 4 dimensions with proper assessments for Vietnamese and English', () => {
  const jdText = 'Tuyển Senior DevOps Engineer. Yêu cầu 5 năm kinh nghiệm. Quản lý hệ thống lớn microservices phục vụ triệu người dùng. Cần dẫn dắt team 5 người.';
  const cvText = 'Nguyễn Văn A. 3 năm kinh nghiệm làm việc với Docker, Linux. Thực hiện các task deploy.';

  const fitVi = inferSeniorityFit(cvText, jdText, false, 'Chưa có kinh nghiệm dẫn dắt hệ thống lớn');

  assert.ok(fitVi.dimensions.length === 4, 'Must have exactly 4 dimensions');
  assert.equal(fitVi.dimensions[0].dimensionKey, 'level_tenure');
  assert.equal(fitVi.dimensions[1].dimensionKey, 'scale_complexity');
  assert.equal(fitVi.dimensions[2].dimensionKey, 'scope_ownership');
  assert.equal(fitVi.dimensions[3].dimensionKey, 'domain_match');

  // Should detect under-qualified aspects
  assert.equal(fitVi.dimensions[0].assessment, 'under');
  assert.ok(fitVi.overallAssessment === 'under');
  assert.ok(fitVi.overallAssessmentLabel.includes('Chưa Tới Tầm'));
  assert.ok(fitVi.positioningAdvice.length > 20);

  // English test
  const fitEn = inferSeniorityFit('John Doe - 8 years lead architect', 'Looking for Lead Architect 7+ years', true);
  assert.ok(fitEn.overallAssessment === 'match' || fitEn.overallAssessment === 'over');
  assert.ok(fitEn.dimensions[0].comment.length > 10);
});

test('3. inferRiskMitigationMatrix detects red flags with 3 pillars (Concern, CV fix, Interview defense)', () => {
  const cvText = 'Kinh nghiệm: Quản trị hệ thống, sửa lỗi mạng, cài đặt phần mềm.';
  const jdText = 'Senior Cloud Architect';

  const risks = inferRiskMitigationMatrix(
    cvText,
    jdText,
    'Ứng viên thiếu hoàn toàn số liệu KPI định lượng',
    'Phần trách nhiệm công việc',
    false
  );

  assert.ok(risks.length >= 2, 'Must have at least 2 risk items');

  const metricRisk = risks.find((r) => r.riskType === 'metric_lacking');
  assert.ok(metricRisk, 'Must flag metric lacking risk');
  assert.equal(metricRisk.severity, 'high');
  assert.ok(metricRisk.recruiterConcern.length > 15);
  assert.ok(metricRisk.cvMitigation.length > 15);
  assert.ok(metricRisk.interviewDefense.length > 15);

  const doubtRisk = risks.find((r) => r.riskType === 'other');
  assert.ok(doubtRisk, 'Must integrate biggest doubt into risk matrix');
  assert.ok(doubtRisk.recruiterConcern.includes('số liệu KPI'));
});

test('4. normalizeFeature3Data safely enriches partial or missing raw data', () => {
  const normalized = normalizeFeature3Data(undefined, 'CV Text', 'JD Text', 'vi');

  assert.ok(normalized.normalizedResult.inviteDecision);
  assert.ok(normalized.seniorityFit.dimensions.length === 4);
  assert.ok(normalized.riskMitigationMatrix.length >= 2);
  assert.equal(normalized.normalizedResult.top3MustFix.length, 3);
});

test('5. UI badge configuration functions return correct color styling and labels', () => {
  const matchConfig = getSeniorityAssessmentConfig('match', 'vi');
  assert.ok(matchConfig.label.includes('Đúng Tầm'));
  assert.ok(matchConfig.badgeBg.includes('emerald'));

  const underConfig = getSeniorityAssessmentConfig('under', 'en');
  assert.ok(underConfig.label.includes('Stretch'));
  assert.ok(underConfig.badgeBg.includes('amber'));

  const highRisk = getRiskSeverityConfig('high', 'vi');
  assert.ok(highRisk.label.includes('Cao'));
  assert.ok(highRisk.badgeClass.includes('rose'));
});

test('6. UI & Backend Schema Contract check for Phase 1.3 (RecruiterScanTab & server.ts)', () => {
  const serverPath = path.resolve(process.cwd(), 'server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  // Check Schema definitions in server.ts
  assert.ok(serverCode.includes('seniorityFit: {'), 'server.ts schema must include seniorityFit');
  assert.ok(serverCode.includes('riskMitigationMatrix: {'), 'server.ts schema must include riskMitigationMatrix');
  assert.ok(serverCode.includes('overallAssessment: {'), 'server.ts schema must include overallAssessment enum');
  assert.ok(serverCode.includes('level_tenure'), 'server.ts schema must include level_tenure dimension enum');
  assert.ok(serverCode.includes('scale_complexity'), 'server.ts schema must include scale_complexity dimension enum');
  assert.ok(serverCode.includes('scope_ownership'), 'server.ts schema must include scope_ownership dimension enum');
  assert.ok(serverCode.includes('domain_match'), 'server.ts schema must include domain_match dimension enum');
  assert.ok(serverCode.includes('riskType: {'), 'server.ts schema must include riskType');
  assert.ok(serverCode.includes('interviewDefense: { type: Type.STRING }'), 'server.ts schema must include interviewDefense');

  // Check Fallback Response in server.ts
  assert.ok(
    serverCode.includes("overallAssessmentLabel: isEn ? 'Good Fit (Sweet Spot)' : 'Đúng Tầm (Sweet Spot)'"),
    'server.ts fallback response must have seniorityFit fallback'
  );
  assert.ok(
    serverCode.includes("riskType: 'metric_lacking'"),
    'server.ts fallback response must have riskMitigationMatrix fallback'
  );

  // Check Prompt guidelines
  assert.ok(
    serverCode.includes('Seniority & Scope Fit Assessment (seniorityFit)'),
    'English prompt must instruct seniorityFit'
  );
  assert.ok(
    serverCode.includes('Đánh Giá Tầm Vóc & Cấp Bậc (seniorityFit)'),
    'Vietnamese prompt must instruct seniorityFit'
  );
  assert.ok(
    serverCode.includes('Ma Trận Hóa Giải Rủi Ro Hồ Sơ (riskMitigationMatrix)'),
    'Vietnamese prompt must instruct riskMitigationMatrix'
  );
});

test('7. generateMarkdownReport includes Seniority Fit and Risk Radar tables', () => {
  const dummyAnalysis: CompleteCVAnalysisResponse = {
    companyName: 'VNG Corporation',
    jobTitle: 'Senior Cloud Platform Engineer',
    feature1: {
      scores: {
        keywordMatchScore: 85,
        skillMatchScore: 80,
        experienceOutcomeScore: 75,
        overallRoleScore: 80,
      },
      summary: {
        biggestStrength: 'Kinh nghiệm DevOps thực chiến',
        missingKeywordsSkills: [],
        weakOrVagueSections: [],
        immediateActions: [],
      },
      comparisonTable: [],
      jdKeywords: [],
    },
    feature2: {
      clarifyingQuestions: [],
      rewrittenBullets: [],
    },
    feature3: {
      inviteDecision: 'YES',
      decisionReason: 'Hồ sơ rất sáng và đúng tầm',
      firstImpression10s: 'Rõ ràng, chuyên nghiệp',
      immediateStrength: 'AWS và Kubernetes thành thạo',
      biggestDoubt: 'Cần chứng minh quy mô hệ thống',
      fastestPointLossSection: 'Phần kinh nghiệm công ty cũ',
      top3MustFix: ['Bổ sung số liệu KPI', 'Nêu rõ vai trò Lead', 'Thêm chứng chỉ AWS'],
    },
  };

  const md = generateMarkdownReport(dummyAnalysis, 'Kỹ sư Cloud Senior');

  assert.ok(md.includes('Đánh Giá Tầm Vóc & Cấp Bậc (Seniority & Scope Fit 4 Trục)'));
  assert.ok(md.includes('Ma Trận Hóa Giải Rủi Ro (Risk Radar & Mitigation Playbook)'));
  assert.ok(md.includes('Kịch bản trả lời khi Phỏng vấn'));
  assert.ok(md.includes('VNG Corporation'));
});
