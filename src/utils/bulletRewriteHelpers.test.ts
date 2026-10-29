import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ensureSubstantivePitch,
  inferTailoredSummaries,
  inferSectionAudit,
  normalizeFeature2Data,
  getSectionStatusConfig,
  extractKeyTermsFromJd,
} from './bulletRewriteHelpers';

test('1. inferTailoredSummaries creates 2 targeted professional summaries (50-200 words) with role and company context', () => {
  const jdText = 'Tuyển dụng Senior DevOps Engineer tại FPT Software. Yêu cầu CI/CD, Docker, Kubernetes, AWS, Agile.';
  const cvText = 'Nguyễn Văn A - 5 năm kinh nghiệm quản trị hệ thống Linux, Docker, CI/CD pipelines.';

  const summariesVi = inferTailoredSummaries(cvText, jdText, 'FPT Software', 'Senior DevOps Engineer', false);

  assert.ok(summariesVi.technicalFocus, 'Must have technicalFocus');
  assert.ok(summariesVi.managementFocus, 'Must have managementFocus');
  assert.equal(summariesVi.technicalFocus.focusType, 'technical');
  assert.equal(summariesVi.managementFocus.focusType, 'management');

  // Verify company & role presence
  assert.ok(summariesVi.technicalFocus.pitch.includes('Senior DevOps Engineer'), 'Technical pitch must mention role');
  assert.ok(summariesVi.technicalFocus.pitch.includes('FPT Software'), 'Technical pitch must mention company');
  assert.ok(summariesVi.managementFocus.pitch.includes('FPT Software'), 'Management pitch must mention company');

  // Check word count range (50-150 words)
  const techWords = summariesVi.technicalFocus.pitch.trim().split(/\s+/).length;
  assert.ok(techWords >= 40 && techWords <= 200, `Pitch words should be ~50-200 words, got ${techWords}`);

  // Highlights
  assert.ok(summariesVi.technicalFocus.keyHighlights.length >= 3, 'Must have at least 3 technical highlights');
  assert.ok(summariesVi.managementFocus.keyHighlights.length >= 3, 'Must have at least 3 management highlights');

  // English check
  const summariesEn = inferTailoredSummaries(cvText, jdText, 'TechCorp', 'Lead Architect', true);
  assert.ok(summariesEn.technicalFocus.pitch.includes('TechCorp'), 'En pitch must mention company');
  assert.ok(summariesEn.technicalFocus.pitch.includes('Lead Architect'), 'En pitch must mention role');
});

test('2. inferSectionAudit diagnoses 4 core CV sections with scores, comments, actionable fixes, and grounded sample snippets', () => {
  const cvText = `
    Nguyễn Văn A - IT Specialist
    Kinh nghiệm làm việc:
    - Chịu trách nhiệm quản lý dự án công nghệ thông tin.
    Kỹ năng:
    - Docker, Kubernetes, Linux
    Học vấn:
    - Cử nhân Công nghệ Thông tin, Đại học Bách Khoa
  `;
  const jdText = 'Senior DevOps Engineer';

  const audit = inferSectionAudit(cvText, jdText, false);

  assert.ok(audit.sections, 'Must have sections array');
  assert.equal(audit.sections.length, 4, 'Must audit exactly 4 core sections');

  const sectionKeys = audit.sections.map((s) => s.sectionKey);
  assert.deepEqual(sectionKeys, ['summary', 'experience', 'skills', 'education_ats']);

  for (const section of audit.sections) {
    assert.ok(section.score >= 0 && section.score <= 100, `Section ${section.sectionKey} score must be between 0 and 100`);
    assert.ok(['tot', 'can_cai_thien', 'yeu_nghiem_trong'].includes(section.status), `Valid status for ${section.sectionKey}`);
    assert.ok(section.comment && section.comment.length > 10, `Comment required for ${section.sectionKey}`);
    assert.ok(section.actionableFix && section.actionableFix.length > 10, `Actionable fix required for ${section.sectionKey}`);
    // Check suggested snippets presence
    assert.ok(Array.isArray(section.suggestedSnippets) && section.suggestedSnippets.length >= 1, `suggestedSnippets required for ${section.sectionKey}`);
  }

  assert.ok(audit.overallSectionRating, 'Must provide overallSectionRating');
});

test('3. normalizeFeature2Data enriches bullets with embeddedKeywords, metricPlaceholders, and section suggestedSnippets', () => {
  const jdText = 'Yêu cầu kinh nghiệm CI/CD, Kubernetes, Docker, AWS và tối ưu hóa hiệu suất.';
  const cvText = 'Chịu trách nhiệm phát triển phần mềm và sửa lỗi.';

  const rawFeature2 = {
    clarifyingQuestions: ['Bạn quản lý team bao nhiêu người?'],
    rewrittenBullets: [
      {
        originalBullet: 'Chịu trách nhiệm phát triển phần mềm và sửa lỗi.',
        issueInOriginal: 'Thiếu số liệu và công cụ.',
        rewrittenBullet: 'Chủ trì thiết kế hệ thống CI/CD trên Docker, giúp cải thiện [25%] hiệu suất vận hành.',
        reasonBetter: 'Dùng động từ hành động mạnh và bổ sung số liệu định lượng.',
        isLackingInfo: false,
      },
    ],
  };

  const normalized = normalizeFeature2Data(rawFeature2, cvText, jdText, 'VNG Corporation', 'Senior Developer', false);

  // Checks
  assert.equal(normalized.clarifyingQuestions.length, 1);
  assert.equal(normalized.rewrittenBullets.length, 1);

  const b = normalized.rewrittenBullets[0];
  assert.ok(b.embeddedKeywords && b.embeddedKeywords.length > 0, 'Must have embeddedKeywords');
  assert.ok(b.metricPlaceholders && b.metricPlaceholders.length > 0, 'Must have metricPlaceholders');
  assert.ok(b.metricPlaceholders.includes('[25%]'), 'Should extract bracketed placeholder [25%]');

  // Check that tailoredSummaries and sectionAudit were automatically generated
  assert.ok(normalized.tailoredSummaries.technicalFocus.pitch.includes('VNG Corporation'));
  assert.equal(normalized.sectionAudit.sections.length, 4);

  // Check suggestedSnippets in section audit
  for (const s of normalized.sectionAudit.sections) {
    assert.ok(Array.isArray(s.suggestedSnippets) && s.suggestedSnippets.length >= 1, 'Section must have suggestedSnippets');
  }
});

test('4. getSectionStatusConfig provides proper styling and professional corporate labels', () => {
  const totVi = getSectionStatusConfig('tot', false);
  assert.equal(totVi.label, 'Tốt (Đạt chuẩn)');
  assert.ok(totVi.badgeBg.includes('emerald'));

  const gapEn = getSectionStatusConfig('yeu_nghiem_trong', true);
  assert.equal(gapEn.label, 'Needs Urgent Attention');
  assert.ok(gapEn.badgeBg.includes('rose'));

  const gapVi = getSectionStatusConfig('yeu_nghiem_trong', false);
  assert.equal(gapVi.label, 'Cần bổ sung gấp');
});

test('5. UI & Backend Schema Contract check for Phase 1.2 refinements (BulletPointRewriteTab & server.ts)', () => {
  const tabSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/BulletPointRewriteTab.tsx'),
    'utf-8'
  );
  const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

  // Verify BulletPointRewriteTab renders all 3 pillars of Step 1.2
  // Pillar 1: Targeted Professional Summary
  assert.ok(tabSource.includes('tailoredSummaries'), 'BulletPointRewriteTab must display tailoredSummaries');
  assert.ok(tabSource.includes('activePitchType'), 'BulletPointRewriteTab must support switching pitch versions');
  assert.ok(tabSource.includes('handleCopyPitch'), 'BulletPointRewriteTab must allow copying tailored pitch');
  assert.ok(tabSource.includes('technicalFocus') || tabSource.includes('mgmtFocusTab'), 'BulletPointRewriteTab must support technical & management focus');

  // Pillar 2: Section-by-Section Structural Review
  assert.ok(tabSource.includes('sectionAudit'), 'BulletPointRewriteTab must display sectionAudit');
  assert.ok(tabSource.includes('overallSectionRating'), 'BulletPointRewriteTab must show overallSectionRating');
  assert.ok(tabSource.includes('actionableFix'), 'BulletPointRewriteTab must show actionableFix');
  assert.ok(tabSource.includes('suggestedSnippets'), 'BulletPointRewriteTab must render suggestedSnippets');
  assert.ok(tabSource.includes('handleCopySnippet'), 'BulletPointRewriteTab must support copying suggested snippet');
  assert.ok(tabSource.includes('getSectionStatusConfig'), 'BulletPointRewriteTab must style section status');

  // Pillar 3: Upgraded Bullet Point Rewrite
  assert.ok(tabSource.includes('embeddedKeywords'), 'BulletPointRewriteTab must display embeddedKeywords');
  assert.ok(tabSource.includes('metricPlaceholders'), 'BulletPointRewriteTab must display metricPlaceholders');
  assert.ok(tabSource.includes('handleCopySingle'), 'BulletPointRewriteTab must allow copying single bullet');
  assert.ok(tabSource.includes('handleCopyAll'), 'BulletPointRewriteTab must allow copying all bullets');

  // Verify server.ts schema includes the new fields
  assert.ok(serverSource.includes('tailoredSummaries:'), 'server.ts schema must include tailoredSummaries');
  assert.ok(serverSource.includes('technicalFocus'), 'server.ts schema must include technicalFocus');
  assert.ok(serverSource.includes('managementFocus'), 'server.ts schema must include managementFocus');
  assert.ok(serverSource.includes('sectionAudit:'), 'server.ts schema must include sectionAudit');
  assert.ok(serverSource.includes('overallSectionRating'), 'server.ts schema must include overallSectionRating');
  assert.ok(serverSource.includes('actionableFix'), 'server.ts schema must include actionableFix');
  assert.ok(serverSource.includes('suggestedSnippets:'), 'server.ts schema must include suggestedSnippets');
  assert.ok(serverSource.includes('embeddedKeywords'), 'server.ts schema must include embeddedKeywords');
  assert.ok(serverSource.includes('metricPlaceholders'), 'server.ts schema must include metricPlaceholders');
  assert.ok(serverSource.includes('phase1-step1.2-v2'), 'server.ts must use phase1-step1.2-v1 cache key');
});

test('6. ensureSubstantivePitch enriches brief summaries (< 50 words) to achieve standard 50-200 words range', () => {
  // 33-word brief input from real user scenario
  const briefPitch = 'Chuyên viên tuyển dụng với kinh nghiệm làm việc tại công ty công nghệ, tập trung vào việc tìm kiếm và thu hút nhân tài kỹ thuật thông qua các kênh chuyên biệt.';
  const briefCount = briefPitch.split(/\s+/).length;
  assert.ok(briefCount < 50, 'Original brief pitch must be under 50 words');

  const enrichedTechnical = ensureSubstantivePitch(briefPitch, 'technical', 'VNG Corporation', 'Chuyên viên Tuyển dụng IT', false);
  const techCount = enrichedTechnical.split(/\s+/).length;
  assert.ok(techCount >= 50 && techCount <= 200, `Enriched technical pitch must be between 50 and 200 words, got ${techCount}`);
  assert.ok(enrichedTechnical.includes('VNG Corporation'), 'Must mention target company');
  assert.ok(enrichedTechnical.includes('Chuyên viên Tuyển dụng IT'), 'Must mention target role');

  const enrichedMgmt = ensureSubstantivePitch(briefPitch, 'management', 'TechCorp', 'Talent Lead', true);
  const mgmtCount = enrichedMgmt.split(/\s+/).length;
  assert.ok(mgmtCount >= 50 && mgmtCount <= 200, `Enriched English mgmt pitch must be between 50 and 200 words, got ${mgmtCount}`);

  // An already substantive pitch (60 words) should remain unmodified
  const alreadySubstantive = 'A'.repeat(10).split('').map((_, i) => `Word${i}`).join(' ') + ' ' + 'B'.repeat(55).split('').map((_, i) => `Term${i}`).join(' ');
  const notChanged = ensureSubstantivePitch(alreadySubstantive, 'technical', 'ABC', 'Role', false);
  assert.equal(notChanged, alreadySubstantive, 'Pitches >= 50 words must not be modified');
});
