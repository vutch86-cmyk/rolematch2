import {
  RecruiterScanResult,
  SeniorityFitResult,
  SeniorityDimension,
  SeniorityAssessment,
  RiskMitigationItem,
  RiskSeverity,
  RiskMitigationType,
} from '../types';

/**
 * Extracts years of experience from text using regular expressions.
 */
export function extractYearsOfExperience(text: string): number | null {
  if (!text) return null;
  // Match patterns like "5+ năm", "5 năm kinh nghiệm", "5+ years", "3-5 years"
  const patterns = [
    /(\d+)(?:\s*-\s*\d+)?\+?\s*(?:năm\s*kinh\s*nghiệm|years?(?:\s*of)?\s*experience)/i,
    /(?:kinh\s*nghiệm|experience)[:\s]+(\d+)\+?\s*(?:năm|years?)/i,
    /(\d+)\+?\s*(?:năm|years?)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const yrs = parseInt(match[1], 10);
      if (!isNaN(yrs) && yrs > 0 && yrs < 50) {
        return yrs;
      }
    }
  }
  return null;
}

/**
 * Detects seniority level tier from text.
 */
export function detectSeniorityTier(text: string): 'junior' | 'mid' | 'senior' | 'lead_manager' | 'director_exec' {
  const lower = (text || '').toLowerCase();
  if (/\b(director|vp|head\s*of|cto|cpo|chief|giám\s*đốc|trưởng\s*khối)\b/i.test(lower)) {
    return 'director_exec';
  }
  if (/\b(lead|leader|manager|quản\s*lý|trưởng\s*phòng|trưởng\s*nhóm|principal|architect)\b/i.test(lower)) {
    return 'lead_manager';
  }
  if (/\b(senior|chuyên\s*viên\s*chính|kỹ\s*sư\s*cao\s*cấp|sr\.?)\b/i.test(lower)) {
    return 'senior';
  }
  if (/\b(intern|fresher|junior|thực\s*tập\s*sinh|mới\s*tốt\s*nghiệp)\b/i.test(lower)) {
    return 'junior';
  }
  return 'mid';
}

/**
 * Infers a 4-dimensional Seniority & Scope Fit analysis when not directly provided by AI.
 */
export function inferSeniorityFit(
  cvText: string = '',
  jdText: string = '',
  isEn: boolean = false,
  biggestDoubt: string = ''
): SeniorityFitResult {
  const jdYears = extractYearsOfExperience(jdText);
  const cvYears = extractYearsOfExperience(cvText);
  const jdTier = detectSeniorityTier(jdText);
  const cvTier = detectSeniorityTier(cvText);

  // Dimension 1: Level & Tenure
  let levelAssessment: SeniorityAssessment = 'match';
  let levelComment = isEn
    ? 'Years of experience and career stage are generally aligned with JD requirements.'
    : 'Số năm kinh nghiệm và giai đoạn sự nghiệp nhìn chung tương thích với kỳ vọng của JD.';

  if (jdYears !== null && cvYears !== null) {
    if (cvYears < jdYears - 1) {
      levelAssessment = 'under';
      levelComment = isEn
        ? `JD expects around ${jdYears}+ years, while CV indicates approximately ${cvYears} years.`
        : `JD kỳ vọng khoảng ${jdYears}+ năm kinh nghiệm, trong khi CV thể hiện khoảng ${cvYears} năm.`;
    } else if (cvYears > jdYears + 4) {
      levelAssessment = 'over';
      levelComment = isEn
        ? `Candidate brings ${cvYears} years, surpassing the JD benchmark of ${jdYears} years.`
        : `Ứng viên có ${cvYears} năm kinh nghiệm, vượt trội so với mốc ${jdYears} năm của JD.`;
    }
  } else if (jdTier === 'lead_manager' && (cvTier === 'junior' || cvTier === 'mid')) {
    levelAssessment = 'under';
    levelComment = isEn
      ? 'JD targets a Lead/Manager level, while CV focuses on individual contributor roles.'
      : 'JD tuyển dụng cấp độ Lead/Quản lý, trong khi CV tập trung nhiều vào vai trò thực thi độc lập.';
  }

  // Dimension 2: Scale & Complexity
  const cvHasMetrics = /\b\d{1,3}(?:[.,]\d+)?%|\b\$\d+|\b\d+\s*(?:người|users?|triệu|kpi|sla)\b/i.test(cvText);
  const jdDemandsHighScale = /\b(large\s*scale|high\s*concurrency|enterprise|microservices|triệu\s*người|ngân\s*hàng|quốc\s*tế)\b/i.test(jdText);
  let scaleAssessment: SeniorityAssessment = 'match';
  let scaleComment = isEn
    ? 'Project complexity and workload scope are acceptable for the targeted level.'
    : 'Quy mô hệ thống và độ phức tạp công việc ở mức chấp nhận được so với vị trí.';

  if (jdDemandsHighScale && !cvHasMetrics) {
    scaleAssessment = 'under';
    scaleComment = isEn
      ? 'JD demands high-scale / enterprise environment, but CV lacks concrete volume and scale indicators.'
      : 'JD đòi hỏi xử lý hệ thống quy mô lớn/doanh nghiệp, nhưng CV còn thiếu số liệu chứng minh quy mô tải và dữ liệu.';
  }

  // Dimension 3: Scope of Ownership & Leadership
  const cvHasLeadership = /\b(lead|dẫn\s*dắt|quản\s*lý|đào\s*tạo|mentoring|chịu\s*trách\s*nhiệm|ownership|chủ\s*trì)\b/i.test(cvText);
  const jdRequiresLeadership = /\b(leadership|lead\s*team|quản\s*lý\s*đội|dẫn\s*dắt|mentoring|cross-functional)\b/i.test(jdText);
  let scopeAssessment: SeniorityAssessment = 'match';
  let scopeComment = isEn
    ? 'Autonomous execution capacity meets the day-to-day requirements.'
    : 'Khả năng tự chủ trong công việc đáp ứng yêu cầu vận hành hàng ngày.';

  if (jdRequiresLeadership && !cvHasLeadership) {
    scopeAssessment = 'under';
    scopeComment = isEn
      ? 'JD requires active cross-functional leadership, but CV shows mainly task-oriented contributions.'
      : 'JD đòi hỏi năng lực dẫn dắt phối hợp liên phòng ban, nhưng CV chủ yếu thể hiện vai trò thực thi nhiệm vụ được giao.';
  }

  // Dimension 4: Domain Relevance
  let domainAssessment: SeniorityAssessment = 'match';
  let domainComment = isEn
    ? 'Industry background and business context match the role well.'
    : 'Môi trường làm việc và hiểu biết ngành có độ tương thích cao với vị trí.';

  if (biggestDoubt && /ngành|domain|lĩnh\s*vực|chuyên\s*ngành/i.test(biggestDoubt)) {
    domainAssessment = 'under';
    domainComment = isEn
      ? `Recruiter highlighted domain adaptation risk: "${biggestDoubt}"`
      : `Nhà tuyển dụng e ngại về khả năng thích ứng ngành: "${biggestDoubt}"`;
  }

  const dimensions: SeniorityDimension[] = [
    {
      dimensionKey: 'level_tenure',
      dimensionName: isEn ? 'Level & Career Tenure' : 'Cấp bậc & Thâm niên thực chiến',
      jdExpectation: jdYears ? (isEn ? `${jdYears}+ years / ${jdTier.toUpperCase()} level` : `Từ ${jdYears}+ năm / Cấp độ ${jdTier.toUpperCase()}`) : (isEn ? 'Standard role tenure' : 'Thâm niên tương ứng vị trí'),
      cvReality: cvYears ? (isEn ? `~${cvYears} years recorded in CV` : `Khoảng ${cvYears} năm thể hiện trong CV`) : (isEn ? 'Tenure inferred from roles' : 'Kinh nghiệm theo các mốc công việc'),
      assessment: levelAssessment,
      comment: levelComment,
    },
    {
      dimensionKey: 'scale_complexity',
      dimensionName: isEn ? 'Scale & System Complexity' : 'Quy mô & Độ phức tạp dự án',
      jdExpectation: jdDemandsHighScale ? (isEn ? 'High-scale enterprise systems' : 'Hệ thống lớn, tải cao / Doanh nghiệp') : (isEn ? 'Standard project scale' : 'Quy mô dự án tiêu chuẩn'),
      cvReality: cvHasMetrics ? (isEn ? 'Quantified system metrics present' : 'Có số liệu chứng minh quy mô') : (isEn ? 'General project narrative' : 'Chủ yếu mô tả trách nhiệm chung'),
      assessment: scaleAssessment,
      comment: scaleComment,
    },
    {
      dimensionKey: 'scope_ownership',
      dimensionName: isEn ? 'Scope of Ownership & Initiative' : 'Phạm vi Tự chủ & Dẫn dắt',
      jdExpectation: jdRequiresLeadership ? (isEn ? 'Cross-functional leadership & ownership' : 'Dẫn dắt đội ngũ & chịu trách nhiệm đầu ra') : (isEn ? 'Independent task ownership' : 'Chủ động hoàn thành phần việc'),
      cvReality: cvHasLeadership ? (isEn ? 'Demonstrated leadership / initiative' : 'Có minh chứng dẫn dắt và chủ động') : (isEn ? 'Individual execution focus' : 'Tập trung thực thi nhiệm vụ được giao'),
      assessment: scopeAssessment,
      comment: scopeComment,
    },
    {
      dimensionKey: 'domain_match',
      dimensionName: isEn ? 'Domain & Business Context' : 'Độ khớp Ngành nghề & Nghiệp vụ',
      jdExpectation: isEn ? 'Domain fluency and relevant industry background' : 'Hiểu sâu nghiệp vụ và văn hóa ngành',
      cvReality: isEn ? 'Solid foundational knowledge transferable across domains' : 'Nền tảng nghiệp vụ có thể chuyển giao tốt',
      assessment: domainAssessment,
      comment: domainComment,
    },
  ];

  // Calculate overall assessment
  const underCount = dimensions.filter((d) => d.assessment === 'under').length;
  const overCount = dimensions.filter((d) => d.assessment === 'over').length;

  let overallAssessment: SeniorityAssessment = 'match';
  let overallAssessmentLabel = isEn ? 'Good Fit (Sweet Spot)' : 'Đúng Tầm (Sweet Spot)';
  let summaryRationale = isEn
    ? 'Candidate closely matches the seniority expectations and complexity baseline of this position.'
    : 'Ứng viên có tầm vóc, thâm niên và độ chín chuyên môn nằm đúng vùng kỳ vọng của vị trí.';
  let positioningAdvice = isEn
    ? 'Highlight measurable business impact and direct ownership in your interview stories to solidify confidence.'
    : 'Hãy nhấn mạnh các câu chuyện về tác động thực tế và tinh thần làm chủ để củng cố niềm tin tuyệt đối từ Hội đồng phỏng vấn.';

  if (underCount >= 2 || (underCount >= 1 && levelAssessment === 'under')) {
    overallAssessment = 'under';
    overallAssessmentLabel = isEn ? 'Stretch Opportunity (Under)' : 'Chưa Tới Tầm (Cần Bứt Phá)';
    summaryRationale = isEn
      ? 'Candidate shows solid potential but is currently positioned below the JD seniority and leadership expectations.'
      : 'Ứng viên có tiềm năng tốt nhưng hiện đang ở cấp độ thấp hơn một bậc so với kỳ vọng thâm niên và quyền tự chủ của JD.';
    positioningAdvice = isEn
      ? 'Reframe bullets with strategic ownership language and highlight high-impact contributions to bridge the seniority gap.'
      : 'Cần nâng cấp câu từ từ "thực thi nhiệm vụ" sang "tự chủ giải quyết bài toán", bổ sung số liệu KPI/SLA để xóa tan cảm giác non kinh nghiệm.';
  } else if (overCount >= 2 || (overCount >= 1 && levelAssessment === 'over' && underCount === 0)) {
    overallAssessment = 'over';
    overallAssessmentLabel = isEn ? 'Senior / Overqualified' : 'Vượt Tầm (Overqualified)';
    summaryRationale = isEn
      ? 'Candidate brings extensive senior experience exceeding the requirements of this role.'
      : 'Ứng viên sở hữu thâm niên và kinh nghiệm quản trị vượt trên mức sàn yêu cầu của vị trí này.';
    positioningAdvice = isEn
      ? 'Clarify your motivation for this specific role and emphasize hands-on readiness to alleviate recruiter cost/retention doubts.'
      : 'Cần chuẩn bị sẵn lý do vì sao bạn hứng thú với vị trí này và khẳng định tinh thần sẵn sàng xắn tay áo làm việc thực chiến để HR không e ngại vấn đề chi phí/nghỉ việc sớm.';
  }

  return {
    overallAssessment,
    overallAssessmentLabel,
    summaryRationale,
    positioningAdvice,
    dimensions,
  };
}

/**
 * Infers actionable risk mitigation items when not directly provided by AI.
 */
export function inferRiskMitigationMatrix(
  cvText: string = '',
  jdText: string = '',
  biggestDoubt: string = '',
  fastestPointLossSection: string = '',
  isEn: boolean = false
): RiskMitigationItem[] {
  const items: RiskMitigationItem[] = [];

  // 1. Metric lacking risk
  const cvHasMetrics = /\b\d{1,3}(?:[.,]\d+)?%|\b\$\d+|\b\d+\s*(?:người|users?|kpi|sla)\b/i.test(cvText);
  if (!cvHasMetrics || (fastestPointLossSection && /số\s*liệu|chỉ\s*số|number|metric/i.test(fastestPointLossSection))) {
    items.push({
      riskType: 'metric_lacking',
      riskTitle: isEn ? 'Lack of Quantified Achievements' : 'Thiếu Số Liệu & Thành Tựu Định Lượng',
      severity: 'high',
      recruiterConcern: isEn
        ? 'Without numbers (%, revenue, team size, SLA), achievements appear purely subjective or descriptive.'
        : 'Nếu không có số liệu (%, doanh thu, quy mô đội ngũ, SLA), các kết quả nêu ra dễ bị đánh giá là chung chung hoặc nói quá.',
      cvMitigation: isEn
        ? 'Rewrite each core work experience bullet using the XYZ formula: Accomplished [X], measured by [Y], by doing [Z].'
        : 'Sửa các bullet kinh nghiệm bằng công thức XYZ: Đạt được [X], đo lường bằng [Y], thông qua giải pháp [Z].',
      interviewDefense: isEn
        ? 'Prepare 2-3 specific case studies with exact starting baselines, actions taken, and final percentage results ready to share.'
        : 'Chuẩn bị sẵn 2-3 case study có số liệu mốc ban đầu (baseline), hành động xử lý và tỷ lệ phần trăm cải thiện cụ thể để chia sẻ ngay khi được hỏi.',
    });
  }

  // 2. Biggest Doubt Integration
  if (biggestDoubt && biggestDoubt.trim()) {
    items.push({
      riskType: 'other',
      riskTitle: isEn ? 'Recruiter Core Skepticism' : 'Nghi Ngại Lớn Nhất Từ Nhà Tuyển Dụng',
      severity: 'high',
      recruiterConcern: biggestDoubt.trim(),
      cvMitigation: isEn
        ? 'Address this directly in your Executive Summary or add clarifying context to the relevant experience block.'
        : 'Bổ sung ngay 1 câu định vị trong phần Tóm tắt mở đầu hoặc thêm ngữ cảnh làm rõ tại mục kinh nghiệm tương ứng.',
      interviewDefense: isEn
        ? 'Acknowledge the perspective immediately without becoming defensive, then pivot to concrete transferable evidence.'
        : 'Chủ động thừa nhận góc nhìn này một cách cởi mở, không bao biện, rồi lập tức đưa ra bằng chứng thực tế từ dự án tương tự để hóa giải.',
    });
  }

  // 3. Short stints / Tenure consistency
  const hasStintIndicators = /(?:0?[1-9]|1[0-2])\s*[\/\-.]\s*20\d\d\s*[-–]\s*(?:0?[1-9]|1[0-2])\s*[\/\-.]\s*20\d\d/g;
  const matches = cvText.match(hasStintIndicators);
  if (matches && matches.length >= 3) {
    items.push({
      riskType: 'job_hopping',
      riskTitle: isEn ? 'Tenure Stability & Commitment Concern' : 'E Ngại Về Độ Gắn Kết & Ổn Định Sự Nghiệp',
      severity: 'medium',
      recruiterConcern: isEn
        ? 'Recruiters may question long-term loyalty or retention risk if transitions occur frequently.'
        : 'Nhà tuyển dụng có thể e ngại ứng viên nhảy việc thường xuyên hoặc gặp khó khăn khi hòa nhập dài hạn.',
      cvMitigation: isEn
        ? 'Group short projects under a unified thematic consultancy or clearly label project/contract completion milestones.'
        : 'Nếu là dự án theo hợp đồng hoặc sáp nhập, hãy ghi rõ chữ [Dự án kết thúc] hoặc [Theo hợp đồng] để HR không hiểu nhầm là nghỉ việc sớm.',
      interviewDefense: isEn
        ? 'Frame each career move as an intentional step towards mastering specific technical domains or organizational scale.'
        : 'Giải thích mỗi bước chuyển dịch là một bước đi có chủ đích để mở rộng chuyên môn hoặc thử thách ở quy mô lớn hơn.',
    });
  } else {
    // Domain / Skill transition fallback
    items.push({
      riskType: 'domain_mismatch',
      riskTitle: isEn ? 'Domain Knowledge & Business Ramp-up' : 'Thời Gian Thích Nghi Nghiệp Vụ & Ngành Mới',
      severity: 'medium',
      recruiterConcern: isEn
        ? 'Recruiter needs confidence that you can deliver value quickly without extensive business training.'
        : 'HR cần chắc chắn ứng viên có thể tạo ra giá trị ngay mà không mất quá nhiều thời gian đào tạo lại quy trình ngành.',
      cvMitigation: isEn
        ? 'Incorporate relevant industry standards and cross-domain transferable workflows directly in your skills summary.'
        : 'Lồng ghép các quy chuẩn, tiêu chuẩn chung của ngành (VD: Agile, ITIL, Compliance, Data-driven) vào phần kỹ năng để tạo sự thân thuộc.',
      interviewDefense: isEn
        ? 'Emphasize your proven fast-learning curve by sharing an example where you mastered a new domain within the first 30 days.'
        : 'Chia sẻ ngay một ví dụ thực tế trong quá khứ khi bạn làm chủ một công nghệ hoặc nghiệp vụ hoàn toàn mới chỉ trong 30 ngày đầu nhận việc.',
    });
  }

  return items;
}

/**
 * Normalizes Feature 3 output ensuring completeness of Seniority Fit & Risk Mitigation Matrix.
 */
export function normalizeFeature3Data(
  rawResult?: RecruiterScanResult,
  cvText: string = '',
  jdText: string = '',
  lang: 'vi' | 'en' = 'vi'
): {
  normalizedResult: RecruiterScanResult;
  seniorityFit: SeniorityFitResult;
  riskMitigationMatrix: RiskMitigationItem[];
} {
  const isEn = lang === 'en';

  const defaultResult: RecruiterScanResult = {
    inviteDecision: 'MAYBE',
    decisionReason: isEn
      ? 'Relevant core capabilities present, but overall profile needs stronger quantified evidence.'
      : 'Ứng viên có kỹ năng phù hợp nhưng hồ sơ cần số liệu chứng minh thành tựu thuyết phục hơn.',
    firstImpression10s: isEn
      ? 'Clear structure, but key differentiator does not immediately stand out in 10 seconds.'
      : 'Bố cục rõ ràng nhưng chưa có điểm nhấn bứt phá đập vào mắt trong 10 giây đầu.',
    immediateStrength: isEn
      ? 'Hands-on execution experience in primary core responsibilities.'
      : 'Kinh nghiệm thực thi thực tế trong các nghiệp vụ chính.',
    biggestDoubt: isEn
      ? 'Scope of autonomy, project complexity, and quantified outcome scale.'
      : 'Mức độ tự chủ dẫn dắt và quy mô chịu trách nhiệm thực sự trong dự án.',
    fastestPointLossSection: isEn
      ? 'Work experience entries lacking concrete KPI/SLA metrics.'
      : 'Mục kinh nghiệm làm việc bị liệt kê nhiệm vụ thay vì thành tựu đo lường được.',
    top3MustFix: [
      isEn ? 'Add concrete numbers (%, $, team size) to key bullets.' : 'Bổ sung số liệu cụ thể (%, ngân sách, số người) vào các thành tựu chính.',
      isEn ? 'Incorporate exact JD keywords in executive summary and skills.' : 'Lồng ghép chính xác từ khóa trọng tâm của JD vào tóm tắt mở đầu.',
      isEn ? 'Restructure bullet points with action-oriented XYZ formula.' : 'Viết lại các dòng kinh nghiệm theo công thức hành động XYZ.',
    ],
  };

  const normalizedResult: RecruiterScanResult = {
    ...defaultResult,
    ...(rawResult || {}),
  };

  // Ensure seniorityFit
  const seniorityFit =
    normalizedResult.seniorityFit &&
    normalizedResult.seniorityFit.dimensions &&
    normalizedResult.seniorityFit.dimensions.length === 4
      ? normalizedResult.seniorityFit
      : inferSeniorityFit(cvText, jdText, isEn, normalizedResult.biggestDoubt);

  // Ensure riskMitigationMatrix
  const riskMitigationMatrix =
    normalizedResult.riskMitigationMatrix &&
    Array.isArray(normalizedResult.riskMitigationMatrix) &&
    normalizedResult.riskMitigationMatrix.length > 0
      ? normalizedResult.riskMitigationMatrix
      : inferRiskMitigationMatrix(
          cvText,
          jdText,
          normalizedResult.biggestDoubt,
          normalizedResult.fastestPointLossSection,
          isEn
        );

  normalizedResult.seniorityFit = seniorityFit;
  normalizedResult.riskMitigationMatrix = riskMitigationMatrix;

  return {
    normalizedResult,
    seniorityFit,
    riskMitigationMatrix,
  };
}

/**
 * Returns UI configuration for Seniority Assessment.
 */
export function getSeniorityAssessmentConfig(
  assessment: SeniorityAssessment,
  lang: 'vi' | 'en' = 'vi'
): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotBg: string;
} {
  const isEn = lang === 'en';
  switch (assessment) {
    case 'match':
      return {
        label: isEn ? 'Good Fit (Sweet Spot)' : 'Đúng Tầm (Sweet Spot)',
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        badgeText: 'text-emerald-700 dark:text-emerald-300',
        badgeBorder: 'border-emerald-200 dark:border-emerald-800',
        dotBg: 'bg-emerald-500',
      };
    case 'over':
      return {
        label: isEn ? 'Senior / Overqualified' : 'Vượt Tầm (Overqualified)',
        badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
        badgeText: 'text-purple-700 dark:text-purple-300',
        badgeBorder: 'border-purple-200 dark:border-purple-800',
        dotBg: 'bg-purple-500',
      };
    case 'under':
    default:
      return {
        label: isEn ? 'Stretch (Under)' : 'Chưa Tới Tầm (Cần Bứt Phá)',
        badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
        badgeText: 'text-amber-800 dark:text-amber-300',
        badgeBorder: 'border-amber-200 dark:border-amber-800',
        dotBg: 'bg-amber-500',
      };
  }
}

/**
 * Returns UI configuration for Risk Severity.
 */
export function getRiskSeverityConfig(
  severity: RiskSeverity,
  lang: 'vi' | 'en' = 'vi'
): {
  label: string;
  badgeClass: string;
} {
  const isEn = lang === 'en';
  switch (severity) {
    case 'high':
      return {
        label: isEn ? 'High Risk' : 'Rủi Ro Cao',
        badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
      };
    case 'medium':
      return {
        label: isEn ? 'Medium Risk' : 'Cần Chú Ý',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      };
    case 'low':
    default:
      return {
        label: isEn ? 'Low Risk' : 'Rủi Ro Thấp',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
      };
  }
}
