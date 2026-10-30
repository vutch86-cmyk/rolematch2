import {
  InterviewPrepData,
  InterviewQuestionItem,
  StarAnswerGuide,
  ComparisonRow,
  RiskMitigationItem,
} from '../types';

/**
 * Standard category keys and display labels for Interview Questions
 */
export const INTERVIEW_CATEGORIES = {
  GAP_VERIFICATION: {
    vi: 'Kiểm chứng khoảng trống CV',
    en: 'CV Gap Verification',
    key: 'gap_verification',
  },
  DEEP_DIVE: {
    vi: 'Tình huống & Chuyên môn sâu',
    en: 'Deep-Dive Technical & Scenario',
    key: 'deep_dive_scenario',
  },
  SENIORITY_CULTURE: {
    vi: 'Tầm vóc & Cách làm việc',
    en: 'Seniority & Behavioral Leadership',
    key: 'seniority_culture',
  },
};

/**
 * Normalizes question category to standard representation based on language
 */
export function normalizeCategory(categoryStr: string | undefined, isEn: boolean): string {
  if (!categoryStr) {
    return isEn ? INTERVIEW_CATEGORIES.DEEP_DIVE.en : INTERVIEW_CATEGORIES.DEEP_DIVE.vi;
  }
  const lower = categoryStr.toLowerCase();
  if (lower.includes('khoảng trống') || lower.includes('gap') || lower.includes('kiểm chứng') || lower.includes('xác minh')) {
    return isEn ? INTERVIEW_CATEGORIES.GAP_VERIFICATION.en : INTERVIEW_CATEGORIES.GAP_VERIFICATION.vi;
  }
  if (lower.includes('tầm vóc') || lower.includes('seniority') || lower.includes('văn hóa') || lower.includes('lãnh đạo') || lower.includes('leadership') || lower.includes('behavioral')) {
    return isEn ? INTERVIEW_CATEGORIES.SENIORITY_CULTURE.en : INTERVIEW_CATEGORIES.SENIORITY_CULTURE.vi;
  }
  return isEn ? INTERVIEW_CATEGORIES.DEEP_DIVE.en : INTERVIEW_CATEGORIES.DEEP_DIVE.vi;
}

/**
 * Normalizes difficulty label based on language
 */
export function normalizeDifficulty(diffStr: string | undefined, isEn: boolean): string {
  if (!diffStr) {
    return isEn ? 'High Priority' : 'Trọng tâm';
  }
  const lower = diffStr.toLowerCase();
  if (lower.includes('rất khó') || lower.includes('very hard') || lower.includes('extreme')) {
    return isEn ? 'Very Hard' : 'Rất khó';
  }
  if (lower.includes('khó') || lower.includes('hard') || lower.includes('challenging')) {
    return isEn ? 'Hard' : 'Khó';
  }
  return isEn ? 'High Priority' : 'Trọng tâm';
}

/**
 * Normalizes STAR answer guide into a clean object with situationTask, action, result
 */
export function normalizeStarGuide(rawGuide: any, isEn: boolean): StarAnswerGuide {
  if (!rawGuide) {
    return {
      situationTask: isEn
        ? 'Briefly state the context, system scale, and specific challenge from your past experience.'
        : 'Nêu ngắn gọn bối cảnh dự án, quy mô công việc và bài toán hóc búa cần giải quyết.',
      action: isEn
        ? 'Detail your direct ownership, technical decisions, tools used, and steps executed.'
        : 'Trình bày rõ hành động trực tiếp của bạn, giải pháp/công cụ áp dụng và các bước xử lý cụ thể.',
      result: isEn
        ? 'Cite quantified business impact (%, latency, cost savings) and key engineering takeaway.'
        : 'Đưa ra chỉ số kết quả đo lường được (%, thời gian, ngân sách) và bài học chuyên môn rút ra.',
    };
  }

  if (typeof rawGuide === 'string') {
    return {
      situationTask: rawGuide,
      action: isEn ? 'Specify your direct actions and methodology.' : 'Nêu rõ hành động và phương pháp thực hiện cụ thể.',
      result: isEn ? 'Quantify final outcome and business value.' : 'Định lượng kết quả cuối cùng và giá trị đem lại.',
    };
  }

  return {
    situationTask: rawGuide.situationTask || rawGuide.situation || rawGuide.task || (isEn ? 'Describe specific context from your CV.' : 'Mô tả bối cảnh và bài toán thực tế từ dự án trong CV.'),
    action: rawGuide.action || rawGuide.actions || (isEn ? 'Describe specific steps and methodologies you used.' : 'Mô tả chi tiết giải pháp, công cụ và các bước bạn trực tiếp triển khai.'),
    result: rawGuide.result || rawGuide.outcome || (isEn ? 'State measurable outcome and business impact.' : 'Nêu kết quả đạt được có số liệu chứng minh (%, thời gian, chất lượng).'),
  };
}

/**
 * Infers a realistic set of interview questions when AI output does not have feature4 or questions list is insufficient.
 */
export function inferInterviewQuestions(
  cvText: string = '',
  jdText: string = '',
  isEn: boolean = false,
  comparisonGaps?: ComparisonRow[],
  risks?: RiskMitigationItem[]
): InterviewQuestionItem[] {
  const questions: InterviewQuestionItem[] = [];

  // Group 1: Gap Verification Questions (from comparisonTable gaps or risks)
  const topGaps = (comparisonGaps || []).filter((g) => g.matchStatus === 'can_bo_sung' || g.matchStatus === 'thieu').slice(0, 3);

  if (topGaps.length > 0) {
    topGaps.forEach((gap, idx) => {
      questions.push({
        id: `iq_gap_${idx + 1}`,
        question: isEn
          ? `In your CV, experience with ${gap.jdTerm} is not fully detailed. Could you share a real-world project where you applied ${gap.jdTerm} to solve a complex issue?`
          : `Trong CV của bạn, kinh nghiệm thực chiến với "${gap.jdTerm}" chưa thể hiện rõ số liệu. Bạn hãy chia sẻ một bài toán thực tế bạn từng dùng ${gap.jdTerm} để giải quyết?`,
        category: isEn ? INTERVIEW_CATEGORIES.GAP_VERIFICATION.en : INTERVIEW_CATEGORIES.GAP_VERIFICATION.vi,
        difficulty: gap.isMustHave ? (isEn ? 'Very Hard' : 'Rất khó') : (isEn ? 'Hard' : 'Khó'),
        sourceGapOrDoubt: isEn
          ? `CV gap detected: "${gap.jdTerm}" is required by the JD but lacking deep project evidence.`
          : `Khoảng trống hồ sơ: Tiêu chí "${gap.jdTerm}" trong JD nhưng CV chưa có dẫn chứng dự án đủ sâu.`,
        interviewerIntent: isEn
          ? `Verify whether you genuinely have hands-on production depth or merely theoretical familiarity with ${gap.jdTerm}.`
          : `Xác minh ứng viên thực sự làm chủ "${gap.jdTerm}" ở môi trường thực tế hay chỉ mới dừng ở mức tìm hiểu/lý thuyết.`,
        starAnswerGuide: {
          situationTask: isEn
            ? `Describe a project at your previous company where ${gap.jdTerm} was necessary to achieve business goals.`
            : `Chọn một dự án tiêu biểu ở công ty gần nhất mà bạn đã trực tiếp ứng dụng ${gap.jdTerm} để xử lý yêu cầu nghiệp vụ.`,
          action: isEn
            ? `Explain the architectural decisions, tools integrated, and specific technical obstacles you personally solved.`
            : `Nêu rõ các bước triển khai kỹ thuật, công cụ phối hợp và cách bạn trực tiếp khắc phục các sự cố phát sinh.`,
          result: isEn
            ? `Highlight concrete outcome (e.g. 20% performance improvement, SLA compliance) and what you learned.`
            : `Định lượng kết quả đạt được (ví dụ tăng 20% hiệu năng, đáp ứng SLA) và cam kết áp dụng tương tự tại quý công ty.`,
        },
        pitfallToAvoid: isEn
          ? `Do not give vague definitions or general tutorials. Focus on your own production hands-on experience.`
          : `Tuyệt đối không giải thích lý thuyết chung chung hoặc nói "em có biết sơ qua". Hãy tập trung vào việc bạn đã làm gì cụ thể.`,
      });
    });
  }

  // Group 2: Risk-based questions (from riskMitigationMatrix)
  const topRisks = (risks || []).slice(0, 2);
  topRisks.forEach((risk, idx) => {
    questions.push({
      id: `iq_risk_${idx + 1}`,
      question: isEn
        ? `Regarding your experience, ${risk.recruiterConcern.toLowerCase()} How do you ensure this won't impact delivery here?`
        : `Khi xem xét hồ sơ, điểm khiến chúng tôi băn khoăn là: ${risk.recruiterConcern} Bạn sẽ làm thế nào để đảm bảo hoàn thành tốt vai trò này?`,
      category: isEn ? INTERVIEW_CATEGORIES.GAP_VERIFICATION.en : INTERVIEW_CATEGORIES.GAP_VERIFICATION.vi,
      difficulty: risk.severity === 'high' ? (isEn ? 'Very Hard' : 'Rất khó') : (isEn ? 'Hard' : 'Khó'),
      sourceGapOrDoubt: risk.riskTitle,
      interviewerIntent: isEn
        ? `Testing self-awareness, honesty, and whether the candidate has a pragmatic plan to bridge the gap.`
        : `Kiểm tra mức độ thẳng thắn, khả năng nhận thức điểm yếu và sự chủ động chuẩn bị kế hoạch hành động.`,
      starAnswerGuide: {
        situationTask: isEn
          ? `Acknowledge the observation transparently without becoming defensive.`
          : `Thừa nhận điểm băn khoăn một cách tự tin, bình tĩnh, không bao biện hay đổ lỗi cho hoàn cảnh cũ.`,
        action: isEn
          ? risk.interviewDefense
          : risk.interviewDefense || 'Trình bày phương pháp tự đào tạo, làm quen quy trình mới và các tiêu chuẩn kiểm soát chất lượng.',
        result: isEn
          ? `Provide a past precedent where you overcame a similar steep learning curve.`
          : `Dẫn chứng tiền lệ bạn từng bắt nhịp cực nhanh và đạt kết quả vượt mong đợi trong 30-60 ngày đầu tại công ty trước.`,
      },
      pitfallToAvoid: isEn
        ? 'Avoid defensive excuses or blaming previous companies/environments.'
        : 'Tránh thái độ phòng thủ, tranh cãi với người phỏng vấn hoặc đưa ra lời hứa suông không có bằng chứng.',
    });
  });

  // Baseline Question: Elevator Pitch & Core Value Proposition
  questions.unshift({
    id: `iq_pitch_0`,
    question: isEn
      ? 'Can you briefly summarize your top 2-3 career accomplishments and explain why your skill set is the ideal fit for this specific role?'
      : 'Bạn hãy tóm tắt ngắn gọn 2–3 thành tựu lớn nhất trong sự nghiệp và giải thích lý do vì sao bộ kỹ năng của bạn là mảnh ghép phù hợp nhất cho vị trí này?',
    category: isEn ? INTERVIEW_CATEGORIES.SENIORITY_CULTURE.en : INTERVIEW_CATEGORIES.SENIORITY_CULTURE.vi,
    difficulty: isEn ? 'High Priority' : 'Trọng tâm',
    sourceGapOrDoubt: isEn
      ? 'Core qualification alignment and executive elevator pitch.'
      : 'Khung định vị năng lực cốt lõi và ấn tượng mở đầu buổi phỏng vấn.',
    interviewerIntent: isEn
      ? 'Evaluate candidate conciseness, structured thinking, self-positioning, and alignment with target role demands.'
      : 'Đánh giá khả năng tổng hợp súc tích, tư duy mạch lạc và mức độ thấu hiểu của ứng viên về giá trị bản thân đối với vị trí.',
    starAnswerGuide: {
      situationTask: isEn
        ? 'Select 2 key career milestones directly matching the top priorities of this JD.'
        : 'Chọn 2 dấu mốc sự nghiệp nổi bật nhất tương thích trực tiếp với yêu cầu cốt lõi của JD.',
      action: isEn
        ? 'Highlight leadership ownership, technologies mastered, and execution discipline.'
        : 'Nhấn mạnh vai trò chủ động, công nghệ/phương pháp bạn làm chủ và cách bạn dẫn dắt kết quả.',
      result: isEn
        ? 'Deliver quantified business outcomes and state explicit enthusiasm for this company mission.'
        : 'Đưa ra số liệu thành tích chứng minh và khẳng định cam kết đồng hành tạo giá trị cho tổ chức.',
    },
    pitfallToAvoid: isEn
      ? 'Do not recite your entire CV chronologically from college graduation. Keep it under 2 minutes.'
      : 'Tuyệt đối không đọc lại CV theo thứ tự thời gian từ thời đi học. Giới hạn câu trả lời trong 2 phút súc tích.',
  });

  // Group 3: Deep-Dive Technical & Scenario Questions
  questions.push({
    id: `iq_deep_1`,
    question: isEn
      ? 'Can you walk through a high-severity incident or complex technical blocker you encountered, and how you resolved it under pressure?'
      : 'Hãy kể về một sự cố nghiêm trọng hoặc bài toán kỹ thuật phức tạp nhất bạn từng gặp phải và cách bạn giải quyết khi chịu áp lực tiến độ?',
    category: isEn ? INTERVIEW_CATEGORIES.DEEP_DIVE.en : INTERVIEW_CATEGORIES.DEEP_DIVE.vi,
    difficulty: isEn ? 'High Priority' : 'Trọng tâm',
    sourceGapOrDoubt: isEn
      ? 'JD demands resilience and crisis troubleshooting in mission-critical environments.'
      : 'Yêu cầu của JD về khả năng xử lý sự cố trong môi trường áp lực cao.',
    interviewerIntent: isEn
      ? 'Evaluating root-cause analysis process, composure under pressure, and systematic problem solving.'
      : 'Đánh giá quy trình tìm nguyên nhân gốc rễ (Root Cause Analysis), sự bình tĩnh và tư duy xử lý sự cố có hệ thống.',
    starAnswerGuide: {
      situationTask: isEn
        ? 'State the critical incident (impact, timeline, business downtime).'
        : 'Nêu sự cố cụ thể: thời điểm xảy ra, mức độ ảnh hưởng đến khách hàng/hệ thống và thời hạn khắc phục.',
      action: isEn
        ? 'Detail diagnostic steps, triage prioritization, containment, and ultimate architectural fix.'
        : 'Nêu các bước chẩn đoán, cô lập vùng lỗi, huy động nguồn lực và giải pháp kỹ thuật dứt điểm.',
      result: isEn
        ? 'Recovery timeline achieved, zero data loss, and post-mortem safeguards implemented.'
        : 'Thời gian khôi phục hệ thống (MTTR), đảm bảo an toàn dữ liệu và quy trình phòng ngừa sự cố tái diễn.',
    },
    pitfallToAvoid: isEn
      ? 'Avoid vague statements like "we just fixed the code". Show precise debugging steps.'
      : 'Tránh nói chung chung kiểu "em sửa code là xong". Cần chỉ rõ tư duy phân tích log, giả thuyết và giải pháp bền vững.',
  });

  questions.push({
    id: `iq_deep_2`,
    question: isEn
      ? 'How do you measure the quality and performance of your deliverables before handing them off to production or stakeholders?'
      : 'Bạn thiết lập và đo lường tiêu chuẩn chất lượng (KPI, SLA, hiệu năng) cho các đầu việc của mình như thế nào trước khi bàn giao?',
    category: isEn ? INTERVIEW_CATEGORIES.DEEP_DIVE.en : INTERVIEW_CATEGORIES.DEEP_DIVE.vi,
    difficulty: isEn ? 'Hard' : 'Khó',
    sourceGapOrDoubt: isEn
      ? 'Assessing engineering discipline and quality assurance mindset.'
      : 'Đánh giá tính kỷ luật nghề nghiệp và tiêu chuẩn nghiệm thu chất lượng công việc.',
    interviewerIntent: isEn
      ? 'Ensure the candidate does not cut corners and possesses high professional standards.'
      : 'Đảm bảo ứng viên có tiêu chuẩn cao, không làm việc cẩu thả và biết cách tự kiểm tra chéo công việc.',
    starAnswerGuide: {
      situationTask: isEn
        ? 'Reference a deliverable with strict accuracy or reliability requirements.'
        : 'Lấy ví dụ một tính năng hoặc dự án đòi hỏi độ tin cậy và chính xác cao.',
      action: isEn
        ? 'Explain the checklist, testing suite, peer review, or automation gates applied.'
        : 'Trình bày bộ checklist kiểm thử, quy trình review chéo và các tiêu chí nghiệm thu rõ ràng.',
      result: isEn
        ? 'Zero regression defects reported in production and positive stakeholder feedback.'
        : 'Tỷ lệ lỗi phát sinh bằng 0 sau khi triển khai và sự hài lòng của các bên liên quan.',
    },
    pitfallToAvoid: isEn
      ? 'Do not say testing is solely the responsibility of QA or someone else.'
      : 'Tuyệt đối không đùn đẩy trách nhiệm kiểm tra cho bộ phận khác (như QA hay quản lý).',
  });

  // Group 4: Seniority & Behavioral Questions
  questions.push({
    id: `iq_senior_1`,
    question: isEn
      ? 'Describe a situation where you had a significant disagreement with a teammate or technical lead regarding a solution. How did you resolve it?'
      : 'Hãy chia sẻ một tình huống bạn có bất đồng quan điểm chuyên môn gay gắt với đồng nghiệp hoặc cấp trên. Bạn đã xử lý và tìm được tiếng nói chung ra sao?',
    category: isEn ? INTERVIEW_CATEGORIES.SENIORITY_CULTURE.en : INTERVIEW_CATEGORIES.SENIORITY_CULTURE.vi,
    difficulty: isEn ? 'Hard' : 'Khó',
    sourceGapOrDoubt: isEn
      ? 'Assessing emotional intelligence, collaborative negotiation, and alignment with company culture.'
      : 'Đánh giá chỉ số trí tuệ cảm xúc (EQ), kỹ năng thương lượng và văn hóa hợp tác liên phòng ban.',
    interviewerIntent: isEn
      ? 'Hiring Manager wants to verify maturity, constructive conflict resolution, and commitment to the team goal over personal ego.'
      : 'Nhà tuyển dụng muốn xem ứng viên có giữ được sự tôn trọng, dựa trên dữ liệu khách quan để thuyết phục hay bảo thủ cố chấp.',
    starAnswerGuide: {
      situationTask: isEn
        ? 'Summarize the core disagreement objectively without portraying the other party negatively.'
        : 'Tóm lược bất đồng một cách khách quan, tôn trọng góc nhìn của đối phương, không nói xấu đồng nghiệp.',
      action: isEn
        ? 'Explain how you gathered objective data, conducted a POC or benchmark, and facilitated consensus.'
        : 'Nêu cách bạn thu thập số liệu khách quan, làm thử nghiệm (POC/A-B test) để đưa ra quyết định tối ưu cho tập thể.',
      result: isEn
        ? 'Solution delivered successfully on schedule, maintaining strong professional trust.'
        : 'Dự án về đích đúng hạn với giải pháp được đồng thuận, mối quan hệ đồng nghiệp ngày càng tin cậy.',
    },
    pitfallToAvoid: isEn
      ? 'Do not portray yourself as always 100% right or dismissive of alternative viewpoints.'
      : 'Tránh nhận định mình luôn luôn đúng 100% hoặc xem nhẹ ý kiến của người khác. Hãy thể hiện tinh thần "Team First".',
  });

  questions.push({
    id: `iq_senior_2`,
    question: isEn
      ? 'Within your first 90 days at our company, what concrete roadmap would you establish to create tangible value for the team?'
      : 'Trong 90 ngày đầu tiên nếu gia nhập công ty, bạn dự định thiết lập lộ trình hành động như thế nào để tạo ra giá trị cụ thể?',
    category: isEn ? INTERVIEW_CATEGORIES.SENIORITY_CULTURE.en : INTERVIEW_CATEGORIES.SENIORITY_CULTURE.vi,
    difficulty: isEn ? 'High Priority' : 'Trọng tâm',
    sourceGapOrDoubt: isEn
      ? 'Validating proactive strategic thinking and speed of onboarding integration.'
      : 'Kiểm chứng tư duy chiến lược chủ động và tốc độ hòa nhập để tạo ra giá trị (Time-to-Value).',
    interviewerIntent: isEn
      ? 'Assess whether candidate has a structured 30-60-90 day mindset tailored to the position.'
      : 'Đánh giá xem ứng viên có tư duy tổ chức công việc chuyên nghiệp (khung 30-60-90 ngày) hay thụ động chờ giao việc.',
    starAnswerGuide: {
      situationTask: isEn
        ? 'Target position expectations and immediate operational goals.'
        : 'Đặt mục tiêu theo 3 chặng: 30 ngày (học hỏi & hòa nhập quy trình), 60 ngày (thực thi độc lập), 90 ngày (tối ưu & cải tiến).',
      action: isEn
        ? 'Outline clear 30-60-90 day milestones: Learn & absorb, Execute independently, Optimize & contribute.'
        : 'Nêu các hành động cụ thể ở từng giai đoạn: nắm bắt hệ thống, kết nối các bên và bắt tay triển khai các "Quick-Wins".',
      result: isEn
        ? 'Fast time-to-productivity, measurable KPI contribution, and autonomous ownership.'
        : 'Rút ngắn thời gian đào tạo của công ty, mang lại kết quả có thể đo lường ngay trong quý đầu tiên.',
    },
    pitfallToAvoid: isEn
      ? 'Do not promise unrealistic overhauls on day 1 before fully understanding the existing systems.'
      : 'Tránh hứa hẹn đao to búa lớn đòi "đập đi xây lại" hệ thống ngay ngày đầu tiên khi chưa hiểu văn hóa và bối cảnh doanh nghiệp.',
  });

  return questions;
}

/**
 * Normalizes Feature 4 Interview Prep Data, ensuring 5 to 10 questions and complete STAR fields
 */
export function normalizeFeature4Data(
  rawFeature4: any,
  cvText: string = '',
  jdText: string = '',
  lang: 'vi' | 'en' = 'vi',
  comparisonGaps?: ComparisonRow[],
  risks?: RiskMitigationItem[]
): InterviewPrepData {
  const isEn = lang === 'en';

  let summary = rawFeature4?.interviewPrepSummary;
  if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
    summary = isEn
      ? 'Tailored 5-10 practical interview questions addressing real gaps in your CV, key technical scenarios, and seniority expectations.'
      : 'Bộ 5–10 câu hỏi phỏng vấn thực chiến xoáy sâu vào các khoảng trống trong CV, tình huống chuyên môn cốt lõi và bài toán định vị tầm vóc.';
  }

  const rawQuestions: any[] = Array.isArray(rawFeature4?.questions)
    ? rawFeature4.questions
    : (Array.isArray(rawFeature4) ? rawFeature4 : []);

  let normalizedQuestions: InterviewQuestionItem[] = [];

  rawQuestions.forEach((q, idx) => {
    if (!q || (!q.question && typeof q !== 'string')) return;

    const questionText = typeof q === 'string' ? q : (q.question || '');
    if (!questionText.trim()) return;

    const starGuide = normalizeStarGuide(q.starAnswerGuide || q.star || q.answerGuide, isEn);

    normalizedQuestions.push({
      id: q.id || `iq_${idx + 1}`,
      question: questionText.trim(),
      category: normalizeCategory(q.category, isEn),
      difficulty: normalizeDifficulty(q.difficulty, isEn),
      sourceGapOrDoubt: q.sourceGapOrDoubt || (isEn ? 'Identified from JD requirements vs CV evidence' : 'Đối chiếu từ yêu cầu JD và bằng chứng trên CV'),
      interviewerIntent: q.interviewerIntent || (isEn ? 'Verify depth of experience and problem-solving competence' : 'Kiểm chứng chiều sâu kinh nghiệm và năng lực giải quyết bài toán'),
      starAnswerGuide: starGuide,
      pitfallToAvoid: q.pitfallToAvoid || (isEn ? 'Avoid giving vague, non-committal or purely theoretical answers' : 'Tránh trả lời mơ hồ, lý thuyết suông hoặc thiếu số liệu thực tế'),
    });
  });

  // If questions are fewer than 5, supplement with high-quality inferred questions
  if (normalizedQuestions.length < 5) {
    const fallbackList = inferInterviewQuestions(cvText, jdText, isEn, comparisonGaps, risks);
    for (const fb of fallbackList) {
      if (normalizedQuestions.length >= 7) break;
      const alreadyExists = normalizedQuestions.some(
        (existing) => existing.question.toLowerCase().includes(fb.question.toLowerCase().slice(0, 30))
      );
      if (!alreadyExists) {
        normalizedQuestions.push({
          ...fb,
          id: `iq_supp_${normalizedQuestions.length + 1}`,
        });
      }
    }
  }

  // Ensure minimum 5 and maximum 10 questions
  if (normalizedQuestions.length > 10) {
    normalizedQuestions = normalizedQuestions.slice(0, 10);
  }

  return {
    interviewPrepSummary: summary,
    questions: normalizedQuestions,
  };
}

/**
 * Returns color classes for Category tags
 */
export function getCategoryBadgeColor(category: string): { bg: string; text: string; border: string; indicator: string } {
  const lower = (category || '').toLowerCase();
  if (lower.includes('khoảng trống') || lower.includes('gap') || lower.includes('kiểm chứng') || lower.includes('xác minh')) {
    return {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      indicator: 'bg-rose-500',
    };
  }
  if (lower.includes('tầm vóc') || lower.includes('seniority') || lower.includes('cách làm việc') || lower.includes('leadership')) {
    return {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      indicator: 'bg-purple-500',
    };
  }
  return {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    indicator: 'bg-indigo-500',
  };
}

/**
 * Returns color classes for Difficulty badges
 */
export function getDifficultyBadgeColor(difficulty: string): { bg: string; text: string; border: string } {
  const lower = (difficulty || '').toLowerCase();
  if (lower.includes('rất khó') || lower.includes('very hard')) {
    return {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
    };
  }
  if (lower.includes('khó') || lower.includes('hard')) {
    return {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-300',
    };
  }
  return {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
  };
}

/**
 * Formats a question item into Markdown string for single copy
 */
export function formatQuestionToMarkdown(item: InterviewQuestionItem, index: number, isEn: boolean): string {
  return `### ${index + 1}. ${item.question}
- **${isEn ? 'Category' : 'Phân loại'}:** ${item.category} (${item.difficulty})
- **${isEn ? 'Source Gap' : 'Căn cứ từ CV/JD'}:** ${item.sourceGapOrDoubt}
- **${isEn ? 'Interviewer Intent' : 'Ý đồ của Nhà tuyển dụng'}:** ${item.interviewerIntent}
- **${isEn ? 'STAR Answer Blueprint' : 'Khung trả lời STAR gợi ý'}:**
  - **S/T (Situation/Task):** ${item.starAnswerGuide.situationTask}
  - **A (Action):** ${item.starAnswerGuide.action}
  - **R (Result):** ${item.starAnswerGuide.result}
- **⚠️ ${isEn ? 'Pitfall to Avoid' : 'Bẫy cần tránh'}:** ${item.pitfallToAvoid}
`;
}
