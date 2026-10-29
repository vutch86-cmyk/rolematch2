import {
  BulletRewriteItem,
  SectionAuditItem,
  SectionBySectionAudit,
  SectionAuditStatus,
  TailoredSummaryPitch,
  ExecutiveSummaryVersion,
} from '../types';

export interface SectionStyleConfig {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  progressColor: string;
  label: string;
}

/**
 * Returns color classes and localized labels for section audit statuses
 */
export function getSectionStatusConfig(
  status: SectionAuditStatus,
  isEn: boolean = false
): SectionStyleConfig {
  switch (status) {
    case 'tot':
      return {
        badgeBg: 'bg-emerald-50 text-emerald-700',
        badgeBorder: 'border-emerald-200',
        badgeText: 'text-emerald-700',
        progressColor: 'bg-emerald-500',
        label: isEn ? 'Good (Strong)' : 'Tốt (Đạt chuẩn)',
      };
    case 'can_cai_thien':
      return {
        badgeBg: 'bg-amber-50 text-amber-700',
        badgeBorder: 'border-amber-200',
        badgeText: 'text-amber-700',
        progressColor: 'bg-amber-500',
        label: isEn ? 'Needs Improvement' : 'Cần cải thiện',
      };
    case 'yeu_nghiem_trong':
    default:
      return {
        badgeBg: 'bg-rose-50 text-rose-700',
        badgeBorder: 'border-rose-200',
        badgeText: 'text-rose-700',
        progressColor: 'bg-rose-500',
        label: isEn ? 'Critical Gap' : 'Điểm yếu nghiêm trọng',
      };
  }
}

/**
 * Extract clean single keywords from JD text to enrich bullet points
 */
export function extractKeyTermsFromJd(jdText: string): string[] {
  if (!jdText) return [];
  const knownKeywords = [
    'Agile', 'Scrum', 'CI/CD', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'React', 'Node.js', 'TypeScript', 'Python', 'Java', 'Go', 'SQL', 'NoSQL',
    'Microservices', 'RESTful API', 'System Architecture', 'DevOps', 'KPI', 'SLA',
    'Product Management', 'Data Analysis', 'Automation', 'Unit Test', 'Git',
    'Tối ưu hóa', 'Hiệu suất', 'Bảo mật', 'Vận hành', 'Quản lý dự án', 'Chuyển đổi số'
  ];

  const matched = new Set<string>();
  const lowerJd = jdText.toLowerCase();

  for (const kw of knownKeywords) {
    if (lowerJd.includes(kw.toLowerCase())) {
      matched.add(kw);
    }
  }

  return Array.from(matched);
}

/**
 * Fallback synthesizer for 2 tailored executive summaries (Technical vs Management focus)
 */
export function inferTailoredSummaries(
  cvText: string,
  jdText: string,
  companyName?: string,
  jobTitle?: string,
  isEn: boolean = false
): TailoredSummaryPitch {
  const targetCompany = companyName?.trim() || (isEn ? 'your company' : 'quý công ty');
  const targetRole = jobTitle?.trim() || (isEn ? 'the target role' : 'vị trí ứng tuyển');
  const jdTerms = extractKeyTermsFromJd(jdText);
  const primarySkills = jdTerms.slice(0, 3).join(', ') || (isEn ? 'modern technologies & agile processes' : 'công nghệ hiện đại và quy trình Agile');

  if (isEn) {
    const technical: ExecutiveSummaryVersion = {
      title: 'Version 1: Technical & Engineering Mastery Focus',
      focusType: 'technical',
      pitch: `Results-driven ${targetRole} with proven hands-on expertise in ${primarySkills}. Demonstrated track record of architecting scalable systems, enhancing code quality, and driving end-to-end execution. Committed to delivering high-impact engineering solutions and technical excellence tailored to ${targetCompany}.`,
      keyHighlights: [
        `Deep proficiency in ${primarySkills}`,
        'System architecture & scalable implementation',
        'Performance optimization & reliable delivery',
      ],
    };

    const management: ExecutiveSummaryVersion = {
      title: 'Version 2: Leadership & Business Impact Focus',
      focusType: 'management',
      pitch: `Proactive ${targetRole} adept at bridging technical capabilities with organizational business objectives. Experienced in mentoring cross-functional collaborators, optimizing operational workflows, and ensuring 100% SLA/KPI fulfillment. Eager to drive strategic growth and measurable business value at ${targetCompany}.`,
      keyHighlights: [
        'Cross-functional ownership & stakeholder communication',
        'Process optimization & measurable KPI/ROI uplift',
        'Delivery velocity & strategic resource alignment',
      ],
    };

    return { technicalFocus: technical, managementFocus: management };
  }

  const technical: ExecutiveSummaryVersion = {
    title: 'Bản 1: Định vị Chuyên môn / Kỹ thuật sâu (Technical & Craft Focus)',
    focusType: 'technical',
    pitch: `Chuyên viên ${targetRole} với nền tảng chuyên môn vững vàng và kinh nghiệm thực chiến trong ${primarySkills}. Có thế mạnh làm chủ công nghệ lõi, thiết kế hệ thống tối ưu và chuẩn hóa quy trình kỹ thuật. Sẵn sàng đóng góp năng lực chuyên môn để tạo ra giải pháp công nghệ bền vững, chất lượng cao tại ${targetCompany}.`,
    keyHighlights: [
      `Thành thạo công nghệ cốt lõi: ${primarySkills}`,
      'Thiết kế kiến trúc hệ thống và chuẩn hóa chất lượng mã nguồn',
      'Tối ưu hóa hiệu năng và giải quyết bài toán kỹ thuật phức tạp',
    ],
  };

  const management: ExecutiveSummaryVersion = {
    title: 'Bản 2: Tác động Quản lý & Giá trị Kinh doanh (Business Impact & Leadership Focus)',
    focusType: 'management',
    pitch: `Nhân sự ${targetRole} định hướng tạo giá trị thực tế, sở hữu khả năng liên kết mục tiêu kỹ thuật với chỉ số kinh doanh của tổ chức. Dày dặn kinh nghiệm dẫn dắt tiến độ, điều phối liên phòng ban và tối ưu hóa năng suất vận hành. Cam kết đồng hành cùng ${targetCompany} nâng cao hiệu quả dự án và đạt các chỉ tiêu KPI chiến lược.`,
    keyHighlights: [
      'Điều phối đội ngũ liên chức năng và quản lý tiến độ chặt chẽ',
      'Tối ưu hóa quy trình làm việc, tiết kiệm chi phí và nâng cao ROI',
      'Cam kết đảm bảo chỉ tiêu KPI/SLA và bàn giao sản phẩm đúng hạn',
    ],
  };

  return { technicalFocus: technical, managementFocus: management };
}

/**
 * Fallback analyzer for Section-by-Section CV Audit
 */
export function inferSectionAudit(
  cvText: string,
  _jdText: string,
  isEn: boolean = false
): SectionBySectionAudit {
  const lowerCv = (cvText || '').toLowerCase();

  // 1. Summary Audit
  const hasSummary =
    lowerCv.includes('summary') ||
    lowerCv.includes('tóm tắt') ||
    lowerCv.includes('mục tiêu') ||
    lowerCv.includes('profile') ||
    lowerCv.includes('giới thiệu');

  const summaryItem: SectionAuditItem = {
    sectionKey: 'summary',
    sectionName: isEn ? 'Executive Summary' : 'Tóm tắt mở đầu (Executive Summary)',
    status: hasSummary ? 'can_cai_thien' : 'yeu_nghiem_trong',
    score: hasSummary ? 70 : 40,
    comment: hasSummary
      ? isEn
        ? 'Executive summary exists but is somewhat generic; needs tighter alignment with target company goals and standout value propositions.'
        : 'Đã có phần tóm tắt mở đầu nhưng còn mang tính tự sự chung chung, chưa làm bật được thế mạnh độc bản khớp thẳng với vị trí ứng tuyển.'
      : isEn
      ? 'Missing a dedicated executive summary section. Recruiters lack a quick 10-second anchor to assess overall suitability.'
      : 'Chưa có phần Tóm tắt mở đầu độc lập. Nhà tuyển dụng thiếu điểm neo tóm lược giá trị trong 10 giây đầu.',
    actionableFix: isEn
      ? 'Adopt one of the tailored 3-4 sentence pitches above with quantifiable achievements at the top of your resume.'
      : 'Sử dụng một trong 2 bản Tóm tắt mở đầu gợi ý ở trên, đặt ngay dưới phần thông tin liên hệ để gây ấn tượng ngay.',
  };

  // 2. Experience Audit
  const hasNumbers = /\d+%|\$\d+|\d+\s*(triệu|tỷ|users|người|dự án|projects|clients)/i.test(cvText);
  const hasActionVerbs = /(chủ trì|triển khai|xây dựng|tối ưu|lãnh đạo|spearheaded|architected|managed|optimized|delivered)/i.test(cvText);

  let expStatus: SectionAuditStatus = 'can_cai_thien';
  let expScore = 65;
  if (hasNumbers && hasActionVerbs) {
    expStatus = 'tot';
    expScore = 85;
  } else if (!hasNumbers) {
    expStatus = 'yeu_nghiem_trong';
    expScore = 50;
  }

  const experienceItem: SectionAuditItem = {
    sectionKey: 'experience',
    sectionName: isEn ? 'Work Experience & Impact' : 'Kinh nghiệm làm việc & Kết quả (Work Experience)',
    status: expStatus,
    score: expScore,
    comment: hasNumbers
      ? isEn
        ? 'Work history features quantifiable evidence, but some bullet points still describe duties rather than measurable outcomes.'
        : 'Phần kinh nghiệm đã có một số số liệu dẫn chứng, nhưng nhiều dòng bullet vẫn mang tính mô tả trách nhiệm nhiệm vụ thay vì thành tựu.'
      : isEn
      ? 'Work experience bullets heavily focus on task lists without metrics (%, revenue, team scale, SLA improvements).'
      : 'Các dòng kinh nghiệm chủ yếu liệt kê đầu việc được giao, hoàn toàn thiếu số liệu định lượng (%, ngân sách, quy mô người dùng, cải thiện hiệu suất).',
    actionableFix: isEn
      ? 'Rewrite bullets using the XYZ formula: Accomplished [X], as measured by [Y], by doing [Z]. Insert metric numbers.'
      : 'Áp dụng công thức XYZ: Đạt được [Kết quả X], đo lường bằng [Chỉ số Y], thông qua [Hành động/Phương pháp Z]. Điền số liệu vào các vị trí được gợi ý.',
  };

  // 3. Skills Audit
  const hasGroupedSkills =
    (lowerCv.includes('kỹ năng') || lowerCv.includes('skills')) &&
    (lowerCv.includes('công cụ') || lowerCv.includes('tools') || lowerCv.includes('backend') || lowerCv.includes('chuyên môn'));

  const skillsItem: SectionAuditItem = {
    sectionKey: 'skills',
    sectionName: isEn ? 'Skills Structure & Grouping' : 'Cấu trúc Kỹ năng chuyên môn (Core Skills)',
    status: hasGroupedSkills ? 'tot' : 'can_cai_thien',
    score: hasGroupedSkills ? 80 : 60,
    comment: hasGroupedSkills
      ? isEn
        ? 'Skills are categorized into logical clusters. Recommend elevating JD must-have technical terms to the top.'
        : 'Kỹ năng đã được phân nhóm tương đối rõ ràng. Cần đẩy các từ khóa cốt lõi của JD lên các vị trí đầu tiên.'
      : isEn
      ? 'Skills appear in an unstructured flat list without clear seniority levels or thematic grouping.'
      : 'Kỹ năng đang liệt kê thành danh sách phẳng, chưa phân loại theo Nhóm chuyên môn / Công cụ phần mềm / Phương pháp luận.',
    actionableFix: isEn
      ? 'Group skills into 3 distinct categories: Core Technical, Frameworks & Tools, and Domain/Methodologies.'
      : 'Phân nhóm kỹ năng thành 3 khối rõ ràng: Kỹ năng Chuyên môn cốt lõi, Công cụ/Công nghệ và Phương pháp làm việc (Agile/Scrum).',
  };

  // 4. Education & ATS Standards
  const hasEducation = lowerCv.includes('học vấn') || lowerCv.includes('education') || lowerCv.includes('đại học') || lowerCv.includes('university') || lowerCv.includes('bachelor');
  const atsScore = hasEducation ? 85 : 65;

  const educationAtsItem: SectionAuditItem = {
    sectionKey: 'education_ats',
    sectionName: isEn ? 'Education, Certifications & ATS Standards' : 'Học vấn/Chứng chỉ & Định dạng chuẩn ATS (Education & ATS)',
    status: hasEducation ? 'tot' : 'can_cai_thien',
    score: atsScore,
    comment: hasEducation
      ? isEn
        ? 'Education and degree entries are readable. Clear single-column layout ensures smooth parsing by automated ATS scanners.'
        : 'Thông tin học vấn và bằng cấp rõ ràng, bố cục phân tầng dễ đọc đối với các hệ thống quét hồ sơ ATS tự động.'
      : isEn
      ? 'Education credentials or relevant technical certifications could be emphasized more prominently.'
      : 'Mục học vấn hoặc chứng chỉ chuyên môn quốc tế chưa được làm nổi bật để củng cố độ tin cậy.',
    actionableFix: isEn
      ? 'Include institution, exact graduation degree, honors (if any), and valid industry certifications (AWS, PMP, ScrumMaster, etc.).'
      : 'Ghi rõ tên trường, chuyên ngành tốt nghiệp, năm hoàn thành và các chứng chỉ nghề nghiệp uy tín (nếu có).',
  };

  const sections = [summaryItem, experienceItem, skillsItem, educationAtsItem];
  const avgScore = Math.round(sections.reduce((acc, s) => acc + s.score, 0) / sections.length);

  return {
    sections,
    overallSectionRating: isEn
      ? `Structural Health: ${avgScore}/100. Work Experience and Executive Summary are the primary levers for score uplift.`
      : `Độ hoàn thiện cấu trúc CV: ${avgScore}/100. Phần Tóm tắt mở đầu và Định lượng Kinh nghiệm là 2 đòn bẩy lớn nhất để tăng điểm.`,
  };
}

/**
 * Normalizes and enriches feature2 data with tailored summaries, section audit,
 * embedded keywords, and metric placeholders.
 */
export function normalizeFeature2Data(
  feature2: any,
  cvText: string = '',
  jdText: string = '',
  companyName: string = '',
  jobTitle: string = '',
  isEn: boolean = false
): {
  clarifyingQuestions: string[];
  rewrittenBullets: BulletRewriteItem[];
  tailoredSummaries: TailoredSummaryPitch;
  sectionAudit: SectionBySectionAudit;
} {
  const jdKeywords = extractKeyTermsFromJd(jdText);

  // 1. Clarifying questions
  const rawQuestions = Array.isArray(feature2?.clarifyingQuestions) ? feature2.clarifyingQuestions : [];
  const clarifyingQuestions = rawQuestions.filter((q: any) => typeof q === 'string' && q.trim().length > 0);

  // 2. Rewritten bullets
  const rawBullets: any[] = Array.isArray(feature2?.rewrittenBullets) ? feature2.rewrittenBullets : [];

  let rewrittenBullets: BulletRewriteItem[] = rawBullets.map((item: any, idx: number) => {
    const orig = typeof item?.originalBullet === 'string' ? item.originalBullet.trim() : `Kinh nghiệm làm việc ${idx + 1}`;
    const rew = typeof item?.rewrittenBullet === 'string' ? item.rewrittenBullet.trim() : orig;
    const issue = typeof item?.issueInOriginal === 'string' ? item.issueInOriginal.trim() : (isEn ? 'Lacks measurable impact and standard XYZ formula.' : 'Thiếu số liệu định lượng và chưa áp dụng công thức XYZ.');
    const reason = typeof item?.reasonBetter === 'string' ? item.reasonBetter.trim() : (isEn ? 'Uses active verbs and links action to result.' : 'Dùng động từ hành động mạnh và liên kết hành động với kết quả.');
    const isLacking = Boolean(item?.isLackingInfo);

    // Extract or infer embeddedKeywords
    let embeddedKeywords: string[] = Array.isArray(item?.embeddedKeywords)
      ? item.embeddedKeywords.filter((k: any) => typeof k === 'string' && k.trim().length > 0)
      : [];

    if (embeddedKeywords.length === 0 && jdKeywords.length > 0) {
      const lowerRew = rew.toLowerCase();
      embeddedKeywords = jdKeywords.filter(k => lowerRew.includes(k.toLowerCase())).slice(0, 3);
      if (embeddedKeywords.length === 0 && jdKeywords.length > 0) {
        embeddedKeywords = [jdKeywords[idx % jdKeywords.length]];
      }
    }

    // Extract or infer metricPlaceholders
    let metricPlaceholders: string[] = Array.isArray(item?.metricPlaceholders)
      ? item.metricPlaceholders.filter((m: any) => typeof m === 'string' && m.trim().length > 0)
      : [];

    if (metricPlaceholders.length === 0) {
      // Find bracketed placeholders in rewrittenBullet (e.g. [X]%, [25%], [N], [Số liệu])
      const matches = rew.match(/\[[^\]]+\]/g);
      if (matches && matches.length > 0) {
        metricPlaceholders = Array.from(new Set(matches));
      } else {
        metricPlaceholders = isEn ? ['[X]% efficiency gain', '[N] team members'] : ['[X]% tăng trưởng/tiết kiệm', '[N] thành viên'];
      }
    }

    return {
      originalBullet: orig,
      issueInOriginal: issue,
      rewrittenBullet: rew,
      reasonBetter: reason,
      isLackingInfo: isLacking,
      embeddedKeywords,
      metricPlaceholders,
    };
  });

  // If no bullets exist at all, construct sample bullets from CV
  if (rewrittenBullets.length === 0) {
    const cvLines = cvText
      .split('\n')
      .map(l => l.trim().replace(/^[•\-\*]\s*/, ''))
      .filter(l => l.length > 20 && !l.startsWith('#') && !l.includes('http'));

    const linesToUse = cvLines.slice(0, 5);
    if (linesToUse.length > 0) {
      rewrittenBullets = linesToUse.map((line, idx) => ({
        originalBullet: line,
        issueInOriginal: isEn ? 'Lacks quantifiable metric outcome and active structure.' : 'Chưa định lượng kết quả và thiếu động từ hành động chủ động.',
        rewrittenBullet: isEn
          ? `Spearheaded execution of ${jdKeywords[idx % jdKeywords.length] || 'core project deliverables'}, achieving [20-25]% performance improvement.`
          : `Chủ trì triển khai ${jdKeywords[idx % jdKeywords.length] || 'các hạng mục công việc trọng điểm'}, giúp nâng cao [20-25]% hiệu suất vận hành.`,
        reasonBetter: isEn ? 'Incorporates strong action verb and adds quantifiable metrics.' : 'Sử dụng động từ hành động mạnh và bổ sung chỉ số định lượng cụ thể.',
        isLackingInfo: false,
        embeddedKeywords: jdKeywords.slice(0, 2),
        metricPlaceholders: isEn ? ['[20-25]% performance improvement'] : ['[20-25]% hiệu suất vận hành'],
      }));
    }
  }

  // 3. Tailored Summaries
  let tailoredSummaries: TailoredSummaryPitch = feature2?.tailoredSummaries;
  if (!tailoredSummaries?.technicalFocus?.pitch || !tailoredSummaries?.managementFocus?.pitch) {
    tailoredSummaries = inferTailoredSummaries(cvText, jdText, companyName, jobTitle, isEn);
  }

  // 4. Section Audit
  let sectionAudit: SectionBySectionAudit = feature2?.sectionAudit;
  if (!sectionAudit?.sections || !Array.isArray(sectionAudit.sections) || sectionAudit.sections.length < 4) {
    sectionAudit = inferSectionAudit(cvText, jdText, isEn);
  }

  return {
    clarifyingQuestions,
    rewrittenBullets,
    tailoredSummaries,
    sectionAudit,
  };
}
