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
        label: isEn ? 'Needs Urgent Attention' : 'Cần bổ sung gấp',
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
      pitch: `Results-driven ${targetRole} with substantive hands-on expertise in ${primarySkills}. Proven background in architecting high-reliability systems, automating mission-critical workflows, and resolving complex technical bottlenecks. Committed to leveraging rigorous engineering standards and continuous performance optimization to deliver resilient, scalable technology solutions directly aligned with ${targetCompany}'s engineering goals.`,
      keyHighlights: [
        `Core technical proficiency: ${primarySkills}`,
        'System architecture, resilience & scalable design',
        'Process automation & performance optimization',
      ],
    };

    const management: ExecutiveSummaryVersion = {
      title: 'Version 2: Leadership & Business Impact Focus',
      focusType: 'management',
      pitch: `Impact-focused ${targetRole} adept at bridging engineering capabilities with core organizational business objectives. Experienced in steering agile delivery timelines, fostering cross-functional stakeholder alignment, and maintaining strict SLA and quality standards. Dedicated to accelerating release cycles, minimizing operational risks, and driving measurable ROI and product value for ${targetCompany}.`,
      keyHighlights: [
        'Cross-functional team coordination & delivery velocity',
        'Process optimization, risk mitigation & cost control',
        'Commitment to 100% KPI/SLA fulfillment and strategic value',
      ],
    };

    return { technicalFocus: technical, managementFocus: management };
  }

  const technical: ExecutiveSummaryVersion = {
    title: 'Bản 1: Định vị Chuyên môn / Kỹ thuật sâu (Technical Mastery)',
    focusType: 'technical',
    pitch: `Chuyên viên ${targetRole} với nền tảng chuyên môn vững vàng và kinh nghiệm thực chiến chuyên sâu trong ${primarySkills}. Có thế mạnh làm chủ công nghệ cốt lõi, thiết kế kiến trúc hệ thống bền vững, tự động hóa quy trình vận hành và xử lý các điểm nghẽn kỹ thuật phức tạp. Sẵn sàng mang tư duy kỹ thuật chuẩn mực và tinh thần trách nhiệm cao để đồng hành xây dựng hạ tầng phần mềm chất lượng, sẵn sàng mở rộng quy mô tại ${targetCompany}.`,
    keyHighlights: [
      `Làm chủ công nghệ cốt lõi: ${primarySkills}`,
      'Thiết kế kiến trúc hệ thống và chuẩn hóa quy trình kỹ thuật',
      'Tối ưu hóa hiệu năng, bảo mật và giải quyết sự cố phức tạp',
    ],
  };

  const management: ExecutiveSummaryVersion = {
    title: 'Bản 2: Tác động Quản lý & Giá trị Kinh doanh (Business & Management Impact)',
    focusType: 'management',
    pitch: `Nhân sự ${targetRole} định hướng hiệu quả thực tế, sở hữu năng lực liên kết chặt chẽ giữa giải pháp kỹ thuật với các mục tiêu kinh doanh trọng yếu của doanh nghiệp. Dày dặn kinh nghiệm điều phối đội ngũ liên chức năng, tối ưu hóa tiến độ triển khai theo chuẩn Agile và kiểm soát chặt chẽ các chỉ tiêu chất lượng. Cam kết đồng hành cùng ${targetCompany} nâng cao năng suất vận hành, giảm thiểu rủi ro và hiện thực hóa các chỉ tiêu KPI chiến lược.`,
    keyHighlights: [
      'Điều phối đội ngũ liên chức năng và quản lý tiến độ bàn giao',
      'Tối ưu hóa quy trình làm việc, tiết kiệm chi phí và nâng cao ROI',
      'Cam kết đảm bảo 100% chỉ số SLA/KPI và an toàn vận hành',
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
      ? 'Adopt one of the targeted professional summary versions (50-150 words) above, placed directly beneath your contact details.'
      : 'Đặt đoạn Tóm tắt hồ sơ định vị (50–150 từ) ngay dưới thông tin liên hệ ở đầu CV để tạo ấn tượng tức thì với nhà tuyển dụng.',
    suggestedSnippets: isEn
      ? [
          'Professional with proven hands-on track record, dedicated to delivering resilient engineering solutions and high operational uptime.',
          'Adept at applying specialized technical expertise to accelerate team delivery cycles and support organizational growth.'
        ]
      : [
          'Chuyên viên giàu kinh nghiệm thực chiến với tinh thần trách nhiệm cao, sẵn sàng đóng góp năng lực chuyên môn để tối ưu hóa hiệu quả vận hành.',
          'Có thế mạnh giải quyết bài toán kỹ thuật phức tạp, chuẩn hóa quy trình và đồng hành cùng sự phát triển bền vững của tổ chức.'
        ],
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
      ? 'Rewrite bullets using the XYZ formula: Accomplished [X], as measured by [Y], by doing [Z]. Insert verified metric numbers from your real experience.'
      : 'Áp dụng công thức XYZ: Đạt được [Kết quả X], đo lường bằng [Chỉ số Y], thông qua [Hành động/Phương pháp Z]. Điền số liệu thực tế dựa trên kinh nghiệm sẵn có.',
    suggestedSnippets: isEn
      ? [
          'Spearheaded key project deliverables, improving operational efficiency by [15-25%] while maintaining system stability.',
          'Streamlined workflow automation and deployment pipelines, reducing turnaround time by [20%] for cross-functional teams.'
        ]
      : [
          'Chủ trì triển khai các hạng mục kỹ thuật trọng điểm, giúp nâng cao [15-25%] hiệu suất vận hành và duy trì độ ổn định hệ thống.',
          'Tối ưu hóa quy trình làm việc và tự động hóa quy trình triển khai, rút ngắn [20%] thời gian xử lý công việc cho toàn đội ngũ.'
        ],
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
    suggestedSnippets: isEn
      ? [
          'Core Technical Capabilities: Architecture Design, System Optimization, Infrastructure Administration',
          'Methodologies & Tools: Agile / Scrum, CI/CD Automation, Git, Monitoring & Logging'
        ]
      : [
          'Kỹ năng Chuyên môn Cốt lõi: Thiết kế kiến trúc, Tối ưu hóa hiệu năng, Quản trị hệ thống',
          'Công cụ & Phương pháp: Agile / Scrum, CI/CD, Quản lý phiên bản Git, Giám sát vận hành'
        ],
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
    suggestedSnippets: isEn
      ? [
          'Degree: Bachelor of Science in Information Technology / Related Engineering Discipline',
          'Certifications: [Relevant Professional Certification, e.g. AWS / PMP / Professional Scrum Master] - Completion Year'
        ]
      : [
          'Học vấn: Cử nhân Công nghệ Thông tin / Chuyên ngành Kỹ thuật liên quan - Đại học chính quy',
          'Chứng chỉ Chuyên môn: [Chứng chỉ nghề nghiệp uy tín, VD: AWS / PMP / Scrum Master] - Năm cấp'
        ],
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
  } else {
    // Ensure suggestedSnippets is present and sanitized
    const fallbackAudit = inferSectionAudit(cvText, jdText, isEn);
    sectionAudit.sections = sectionAudit.sections.map((sec, idx) => {
      let snippets: string[] = Array.isArray(sec.suggestedSnippets)
        ? sec.suggestedSnippets.filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        : [];
      if (snippets.length === 0 && fallbackAudit.sections[idx]?.suggestedSnippets) {
        snippets = fallbackAudit.sections[idx].suggestedSnippets || [];
      }
      return {
        ...sec,
        suggestedSnippets: snippets,
      };
    });
  }

  return {
    clarifyingQuestions,
    rewrittenBullets,
    tailoredSummaries,
    sectionAudit,
  };
}
