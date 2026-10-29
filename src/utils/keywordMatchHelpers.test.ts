import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import module from 'node:module';
import {
  resolveIsMustHave,
  resolveProjectedOverallScore,
  enrichCompatibilityScores,
  inferTargetSection,
  inferSuggestedPhrasing,
  normalizeFeature1Data,
} from './keywordMatchHelpers.ts';
import type { JDKeyword, ComparisonRow, CompatibilityScores } from '../types.ts';

test('1. resolveIsMustHave distinguishes Must-Have vs Nice-to-Have and supports legacy fallback', () => {
  assert.equal(resolveIsMustHave(true, 'Có lợi thế'), true);
  assert.equal(resolveIsMustHave(false, 'Rất quan trọng'), false);
  assert.equal(resolveIsMustHave(undefined, 'Rất quan trọng'), true);
  assert.equal(resolveIsMustHave(undefined, 'High Priority'), true);
  assert.equal(resolveIsMustHave(undefined, 'Quan trọng'), false);
  assert.equal(resolveIsMustHave(undefined, 'Có lợi thế'), false);
});

test('2. resolveProjectedOverallScore and enrichCompatibilityScores generate rationales & projected score', () => {
  const legacyScores: CompatibilityScores = {
    keywordMatchScore: 72,
    skillMatchScore: 78,
    experienceOutcomeScore: 68,
    overallRoleScore: 73,
  };

  const rows: ComparisonRow[] = [
    {
      jdTerm: 'ITIL v4',
      importance: 'Rất quan trọng',
      cvEvidence: 'Đã có chứng chỉ ITIL',
      gapOrClarification: '',
      matchStatus: 'khop',
    },
    {
      jdTerm: 'Cloud FinOps',
      importance: 'Rất quan trọng',
      cvEvidence: 'Mới nêu quản lý chi phí AWS',
      gapOrClarification: 'Cần nêu rõ % tiết kiệm chi phí',
      matchStatus: 'can_bo_sung',
    },
    {
      jdTerm: 'ISO 27001',
      importance: 'Quan trọng',
      cvEvidence: 'Thiếu thông tin',
      gapOrClarification: 'Chưa đề cập tiêu chuẩn bảo mật',
      matchStatus: 'thieu',
    },
  ];

  const projected = resolveProjectedOverallScore(legacyScores, rows);
  assert.ok(projected > legacyScores.overallRoleScore, 'Projected score should exceed current score');
  assert.ok(projected <= 98, 'Projected score should be capped at 98');

  const enrichedVi = enrichCompatibilityScores(legacyScores, rows, 'vi');
  assert.equal(enrichedVi.overallRoleScore, 73);
  assert.equal(enrichedVi.projectedOverallScore, projected);
  assert.ok(enrichedVi.keywordRationale.includes('1/3'));
  assert.ok(enrichedVi.skillRationale.length > 20);
  assert.ok(enrichedVi.experienceRationale.length > 20);
  assert.ok(enrichedVi.overallRationale.includes(`${projected}%`));
});

test('3. normalizeFeature1Data computes Must-Have stats and populates targetSection + suggestedPhrasing', () => {
  const jdKeywords: JDKeyword[] = [
    {
      keyword: 'Kubernetes',
      category: 'Công cụ, phần mềm hoặc phương pháp',
      importance: 'Rất quan trọng',
    },
    {
      keyword: 'Terraform',
      category: 'Công cụ, phần mềm hoặc phương pháp',
      importance: 'Quan trọng',
      isMustHave: true,
    },
    {
      keyword: 'GraphQL',
      category: 'Kỹ năng chuyên môn',
      importance: 'Có lợi thế',
      isMustHave: false,
    },
  ];

  const comparisonTable: ComparisonRow[] = [
    {
      jdTerm: 'Kubernetes',
      importance: 'Rất quan trọng',
      cvEvidence: 'Vận hành cụm EKS 50 nodes',
      gapOrClarification: '',
      matchStatus: 'khop',
    },
    {
      jdTerm: 'Terraform',
      importance: 'Quan trọng',
      cvEvidence: 'Có liệt kê ở mục Skills',
      gapOrClarification: 'Thiếu dẫn chứng dự án IaC',
      matchStatus: 'can_bo_sung',
    },
    {
      jdTerm: 'GraphQL',
      importance: 'Có lợi thế',
      cvEvidence: 'Thiếu thông tin',
      gapOrClarification: 'Chưa có trong CV',
      matchStatus: 'thieu',
    },
  ];

  const scores: CompatibilityScores = {
    keywordMatchScore: 75,
    skillMatchScore: 80,
    experienceOutcomeScore: 70,
    overallRoleScore: 75,
    projectedOverallScore: 89,
    keywordRationale: 'Khớp 2/3 từ khóa chính.',
    skillRationale: 'Kỹ năng container tốt.',
    experienceRationale: 'Cần thêm số liệu SLA.',
    overallRationale: 'Có thể tăng lên 89% nếu bổ sung Terraform.',
  };

  const result = normalizeFeature1Data(jdKeywords, comparisonTable, scores, 'vi');

  assert.equal(result.mustHaveStats.totalMustHave, 2);
  assert.equal(result.mustHaveStats.matchedMustHave, 1);
  assert.equal(result.mustHaveStats.needsWorkMustHave, 1);
  assert.equal(result.mustHaveStats.missingMustHave, 0);
  assert.equal(result.mustHaveStats.totalNiceToHave, 1);
  assert.equal(result.mustHaveStats.mustHavePassRate, 50);

  // Check populated targetSection and suggestedPhrasing for needs-work / missing rows
  const terraformRow = result.normalizedComparisonTable[1];
  assert.equal(terraformRow.isMustHave, true);
  assert.ok(terraformRow.targetSection && terraformRow.targetSection.length > 5);
  assert.ok(terraformRow.suggestedPhrasing && terraformRow.suggestedPhrasing.includes('Terraform'));

  // Matched row should have empty suggestedPhrasing by default
  const k8sRow = result.normalizedComparisonTable[0];
  assert.equal(k8sRow.suggestedPhrasing, '');
});

test('4. UI & Backend Schema Contract check for Phase 1.1 (KeywordMatchTab & server.ts)', () => {
  const tabSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/KeywordMatchTab.tsx'),
    'utf-8'
  );
  const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

  // Verify KeywordMatchTab renders all 3 pillars of Step 1.1
  assert.ok(tabSource.includes('projectedOverallScore'), 'KeywordMatchTab must display projectedOverallScore');
  assert.ok(tabSource.includes('keywordRationale'), 'KeywordMatchTab must display keywordRationale');
  assert.ok(tabSource.includes('skillRationale'), 'KeywordMatchTab must display skillRationale');
  assert.ok(tabSource.includes('experienceRationale'), 'KeywordMatchTab must display experienceRationale');
  assert.ok(tabSource.includes('mustHaveTrackerTitle'), 'KeywordMatchTab must display Must-Have coverage tracker');
  assert.ok(tabSource.includes('targetSection'), 'KeywordMatchTab must display targetSection');
  assert.ok(tabSource.includes('suggestedPhrasing'), 'KeywordMatchTab must display suggestedPhrasing');
  assert.ok(tabSource.includes('handleCopySnippet'), 'KeywordMatchTab must allow copying suggestedPhrasing');

  // Verify server.ts schema includes the new fields
  assert.ok(serverSource.includes('projectedOverallScore'), 'server.ts schema must include projectedOverallScore');
  assert.ok(serverSource.includes('keywordRationale'), 'server.ts schema must include keywordRationale');
  assert.ok(serverSource.includes('isMustHave'), 'server.ts schema must include isMustHave');
  assert.ok(serverSource.includes('targetSection'), 'server.ts schema must include targetSection');
  assert.ok(serverSource.includes('suggestedPhrasing'), 'server.ts schema must include suggestedPhrasing');

  // Permanent Build & Syntax Guard: compile/strip TypeScript types on server.ts and helpers
  // to catch any unescaped template backticks or syntax errors before Cloud Build
  if (typeof (module as any).stripTypeScriptTypes === 'function') {
    const stripTs = (module as any).stripTypeScriptTypes;
    assert.doesNotThrow(() => {
      stripTs(serverSource, { mode: 'transform' });
    }, 'server.ts must have valid TypeScript/JavaScript syntax without unescaped template backticks');

    const exportMdSource = fs.readFileSync(
      path.join(process.cwd(), 'src/utils/exportMarkdown.ts'),
      'utf-8'
    );
    assert.doesNotThrow(() => {
      stripTs(exportMdSource, { mode: 'strip' });
    }, 'src/utils/exportMarkdown.ts must have valid TypeScript syntax');

    const i18nSource = fs.readFileSync(
      path.join(process.cwd(), 'src/utils/i18n.ts'),
      'utf-8'
    );
    assert.doesNotThrow(() => {
      stripTs(i18nSource, { mode: 'strip' });
    }, 'src/utils/i18n.ts must have valid TypeScript syntax');
  }
});
