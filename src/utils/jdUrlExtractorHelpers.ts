export interface UrlValidationResult {
  valid: boolean;
  parsed?: URL;
  errorVi?: string;
  errorEn?: string;
}

export interface JsonLdJobPostingResult {
  title?: string;
  company?: string;
  location?: string;
  descriptionText?: string;
}

export interface HeuristicJdCleanResult {
  isAuthWall: boolean;
  jobTitle: string;
  jdText: string;
}

export function validatePublicJobUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      valid: false,
      errorVi: 'Vui lòng nhập đường dẫn (URL) tin tuyển dụng.',
      errorEn: 'Please enter a job posting URL.',
    };
  }

  let normalized = rawUrl.trim();
  if (/^(javascript|data|vbscript|file|ftp|mailto|tel):/i.test(normalized)) {
    return {
      valid: false,
      errorVi: 'Chỉ hỗ trợ đường dẫn website http:// hoặc https://.',
      errorEn: 'Only http:// and https:// website URLs are supported.',
    };
  }

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return {
      valid: false,
      errorVi: 'Đường dẫn URL không hợp lệ. Vui lòng kiểm tra lại.',
      errorEn: 'Invalid URL format. Please check the link and try again.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      errorVi: 'Chỉ hỗ trợ đường dẫn http:// hoặc https://.',
      errorEn: 'Only http:// and https:// URLs are supported.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalOrPrivate =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (isLocalOrPrivate) {
    return {
      valid: false,
      errorVi: 'Không hỗ trợ truy cập địa chỉ mạng nội bộ.',
      errorEn: 'Private or local network URLs are not allowed.',
    };
  }

  // Must have a valid domain dot and TLD (e.g. linkedin.com, itviec.com, company.vn)
  if (!host.includes('.') || !/\.[a-z]{2,}$/i.test(host)) {
    return {
      valid: false,
      errorVi: 'Đường dẫn URL phải có tên miền hợp lệ (ví dụ: linkedin.com, itviec.com).',
      errorEn: 'URL must contain a valid domain name (e.g., linkedin.com, itviec.com).',
    };
  }

  return { valid: true, parsed };
}

export function detectJobSiteName(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host.includes('linkedin.com')) return 'LinkedIn';
  if (host.includes('itviec.com')) return 'ITviec';
  if (host.includes('topcv.vn')) return 'TopCV';
  if (host.includes('vietnamworks.com')) return 'VietnamWorks';
  if (host.includes('careerviet.vn')) return 'CareerViet';
  if (host.includes('glints.com')) return 'Glints';
  if (host.includes('topdev.vn')) return 'TopDev';
  if (host.includes('glassdoor.')) return 'Glassdoor';
  if (host.includes('indeed.')) return 'Indeed';
  if (host.includes('careerlink.vn')) return 'CareerLink';
  if (host.includes('jobsgo.vn')) return 'JobsGO';
  return host;
}

export function extractLinkedInJobId(url: URL): string | null {
  if (!url.hostname.toLowerCase().includes('linkedin.com')) return null;
  const currentJobId = url.searchParams.get('currentJobId');
  if (currentJobId && /^\d{6,15}$/.test(currentJobId.trim())) {
    return currentJobId.trim();
  }
  const viewMatch = url.pathname.match(/\/jobs\/view\/(?:.*?-)?(\d{6,15})(?:\/|$)/i);
  if (viewMatch && viewMatch[1]) {
    return viewMatch[1];
  }
  const anyDigits = url.pathname.match(/(\d{8,15})/);
  if (anyDigits && anyDigits[1]) {
    return anyDigits[1];
  }
  return null;
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&bull;/gi, '•')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

export function stripHtmlToFormattedText(html: string): string {
  if (!html) return '';
  let text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|noscript|iframe|canvas|form|button)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|section|article|tr|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<h([1-6])[^>]*>/gi, '\n## ')
    .replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractJsonLdJobPosting(html: string): JsonLdJobPostingResult | null {
  if (!html) return null;
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  const findJobPostingNode = (node: any): any => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findJobPostingNode(item);
        if (found) return found;
      }
      return null;
    }
    const typeVal = node['@type'];
    const isJob =
      typeVal === 'JobPosting' ||
      (Array.isArray(typeVal) && typeVal.includes('JobPosting')) ||
      (typeof typeVal === 'string' && typeVal.toLowerCase().includes('jobposting'));
    if (isJob) return node;
    if (node['@graph'] && Array.isArray(node['@graph'])) {
      return findJobPostingNode(node['@graph']);
    }
    return null;
  };

  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      const jobNode = findJobPostingNode(parsed);
      if (jobNode) {
        const title = typeof jobNode.title === 'string' ? decodeHtmlEntities(jobNode.title).trim() : undefined;
        const company =
          typeof jobNode.hiringOrganization?.name === 'string'
            ? decodeHtmlEntities(jobNode.hiringOrganization.name).trim()
            : undefined;

        let location: string | undefined;
        const locNode = Array.isArray(jobNode.jobLocation) ? jobNode.jobLocation[0] : jobNode.jobLocation;
        if (locNode?.address) {
          const addr = locNode.address;
          if (typeof addr === 'string') {
            location = addr;
          } else if (typeof addr === 'object') {
            location = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .filter(Boolean)
              .join(', ');
          }
        }

        const parts: string[] = [];
        if (title) parts.push(`# ${title}`);
        if (company) parts.push(`**Company / Công ty:** ${company}`);
        if (location) parts.push(`**Location / Địa điểm:** ${location}`);

        if (typeof jobNode.description === 'string' && jobNode.description.trim()) {
          parts.push(stripHtmlToFormattedText(jobNode.description));
        }
        if (typeof jobNode.responsibilities === 'string' && jobNode.responsibilities.trim()) {
          parts.push(`## Responsibilities\n${stripHtmlToFormattedText(jobNode.responsibilities)}`);
        }
        if (typeof jobNode.qualifications === 'string' && jobNode.qualifications.trim()) {
          parts.push(`## Qualifications\n${stripHtmlToFormattedText(jobNode.qualifications)}`);
        }
        if (typeof jobNode.skills === 'string' && jobNode.skills.trim()) {
          parts.push(`## Skills\n${stripHtmlToFormattedText(jobNode.skills)}`);
        }
        if (typeof jobNode.jobBenefits === 'string' && jobNode.jobBenefits.trim()) {
          parts.push(`## Benefits\n${stripHtmlToFormattedText(jobNode.jobBenefits)}`);
        }

        const descriptionText = parts.join('\n\n').trim();
        if (descriptionText.length > 80) {
          return { title, company, location, descriptionText };
        }
      }
    } catch {
      // ignore malformed JSON-LD block
    }
  }
  return null;
}

export function extractMetaAndBodyText(html: string): { pageTitle: string; metaDescription: string; bodyText: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitleMatch =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i);
  const ogDescMatch =
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i) ||
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

  const pageTitle = decodeHtmlEntities((ogTitleMatch?.[1] || titleMatch?.[1] || '').trim());
  const metaDescription = decodeHtmlEntities((ogDescMatch?.[1] || '').trim());

  // Remove noisy layout blocks (nav, header, footer, aside) before extracting body text
  const cleanedHtml = html
    .replace(/<(nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(
      /<(div|section)[^>]*(?:id|class)=["'][^"']*(?:footer|navbar|nav-bar|cookie|popup|modal|sidebar|similar-jobs|related-jobs)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      ' '
    );

  const bodyText = stripHtmlToFormattedText(cleanedHtml);
  return { pageTitle, metaDescription, bodyText };
}

export function isLikelyAuthOrBotWall(params: {
  status: number;
  finalUrl: string;
  rawHtml: string;
  pageTitle: string;
  extractedText: string;
}): boolean {
  const { status, finalUrl, rawHtml, pageTitle, extractedText } = params;

  // Status codes indicating auth required, forbidden, Cloudflare challenge, or LinkedIn 999 block
  if ([401, 403, 407, 429, 503, 999].includes(status)) {
    return true;
  }

  // Redirected to login / authwall URL
  if (/\/(login|signin|sign_in|sign-in|authwall|uas\/login|checkpoint|challenge|verify|security-check)/i.test(finalUrl)) {
    return true;
  }

  const lowerHtml = (rawHtml || '').toLowerCase();
  const lowerTitle = (pageTitle || '').toLowerCase();
  const lowerText = (extractedText || '').toLowerCase();

  // Cloudflare / Bot protection markers
  if (
    lowerTitle.includes('just a moment') ||
    lowerTitle.includes('attention required') ||
    lowerTitle.includes('security check') ||
    lowerTitle.includes('access denied') ||
    lowerHtml.includes('cf-browser-verification') ||
    lowerHtml.includes('cf_chl_opt') ||
    lowerHtml.includes('enable javascript and cookies to continue') ||
    lowerHtml.includes('verify you are human')
  ) {
    return true;
  }

  // LinkedIn / ITviec / Job board login wall markers when actual job content is missing
  const hasLoginWallPhrase =
    lowerTitle.includes('sign in') ||
    lowerTitle.includes('log in') ||
    lowerTitle.includes('đăng nhập') ||
    lowerText.includes('sign in to view') ||
    lowerText.includes('sign in to linkedin') ||
    lowerText.includes('join linkedin') ||
    lowerText.includes('đăng nhập để xem') ||
    lowerText.includes('vui lòng đăng nhập');

  if (hasLoginWallPhrase && extractedText.length < 600) {
    return true;
  }

  // If page returned almost no text (e.g. SPA shell requiring authenticated session or JS anti-bot)
  if (extractedText.trim().length < 120) {
    return true;
  }

  return false;
}

export function cleanPortalTitleSuffix(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/^#+\s*/, '')
    .replace(/\s*(?:\||-|\u2013|\u2014)\s*(?:LinkedIn|ITviec|TopCV|VietnamWorks|CareerViet|Glints|TopDev|Glassdoor|Indeed|JobsGO).*$/i, '')
    .replace(/^Tuyển dụng\s+/i, '')
    .trim();
}

export function cleanJdTextHeuristically(
  rawInputText: string,
  sourceInfo?: { url?: string; siteName?: string; hintTitle?: string },
  lang: 'vi' | 'en' = 'vi'
): { isAuthWall: boolean; jobTitle: string; jdText: string } {
  if (!rawInputText || typeof rawInputText !== 'string') {
    return { isAuthWall: true, jobTitle: '', jdText: '' };
  }

  const trimmedInput = rawInputText.slice(0, 35000).trim();
  const lowerInput = trimmedInput.toLowerCase();

  // Check if input is purely an auth/login/captcha screen without real JD sections
  const hasJdSignal =
    /(mô tả công việc|yêu cầu ứng viên|yêu cầu công việc|quyền lợi|trách nhiệm|kinh nghiệm|kỹ năng|job description|responsibilities|requirements|qualifications|what you will do|your skills and experience|why you'll love working here|about the job|about the role|benefits)/i.test(
      trimmedInput
    );

  const hasStrongAuthPrompt =
    /(sign in to linkedin|join linkedin|forgot password|stay updated on your professional world|verify you are human|enable javascript and cookies to continue|đăng nhập để tiếp tục|vui lòng đăng nhập tài khoản)/i.test(
      lowerInput
    );

  if (hasStrongAuthPrompt && !hasJdSignal && trimmedInput.length < 1200) {
    return { isAuthWall: true, jobTitle: '', jdText: '' };
  }

  // Normalize line endings and bullets
  const normalizedText = trimmedInput
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^[ \t]*[\u2022\u25cf\u25cb\u25aa\u25fe\u25b6\u2713*][ \t]+/gm, '- ');

  const rawLines = normalizedText.split('\n').map(l => l.trim());

  // Noisy portal navigation / chrome lines to strip
  const noisyLineRegex =
    /^(linkedin|itviec|topcv|vietnamworks|careerviet|glints|topdev|glassdoor|indeed|jobsgo|careerlink|home|trang chủ|jobs|all jobs|it jobs|my jobs|việc làm|hồ sơ & cv|công ty|companies|top companies|công cụ|đăng nhập|đăng ký|nhà tuyển dụng|sign in|sign up|log in|register|skip to main content|bỏ qua đến nội dung chính|cookie|privacy policy|terms of service|all rights reserved|©|bản quyền|ứng tuyển ngay|apply now|easy apply|save|lưu tin|báo cáo tin tuyển dụng|share|chia sẻ|show more|show less|xem thêm|thu gọn|notifications|messaging|my network|for business|me|search|tìm kiếm)$/i;

  // Footer cutoff markers where unrelated jobs / portal footers begin
  const footerCutoffRegex =
    /^(việc làm tương tự|việc làm gợi ý|việc làm liên quan|similar jobs|people also viewed|other jobs you may like|explore collaborative articles|more jobs from this company)$/i;

  const jdSectionHeaderRegex =
    /^(mô tả công việc|chi tiết công việc|trách nhiệm công việc|yêu cầu ứng viên|yêu cầu công việc|yêu cầu chuyên môn|kỹ năng yêu cầu|quyền lợi|quyền lợi được hưởng|chế độ đãi ngộ|phúc lợi|địa điểm làm việc|thời gian làm việc|about the job|about the role|job description|key responsibilities|responsibilities|what you will do|what you'll do|requirements|qualifications|your skills and experience|skills & experience|minimum qualifications|preferred qualifications|benefits|perks & benefits|what we offer|why you'll love working here|compensation & benefits)$/i;

  const cleanedLines: string[] = [];
  for (const line of rawLines) {
    if (!line) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      continue;
    }

    const strippedHeading = line.replace(/^#+\s*/, '').replace(/[:\-\=]+$/, '').trim();

    // Stop if we hit the "Similar Jobs / Việc làm tương tự" footer block after collecting substantial JD content
    if (footerCutoffRegex.test(strippedHeading) && cleanedLines.join('\n').length > 250) {
      break;
    }

    if (noisyLineRegex.test(strippedHeading)) {
      continue;
    }

    if (jdSectionHeaderRegex.test(strippedHeading)) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      cleanedLines.push(`## ${strippedHeading}`);
      continue;
    }

    cleanedLines.push(line);
  }

  const jdText = cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Infer clean job title
  let inferredTitle = cleanPortalTitleSuffix(sourceInfo?.hintTitle || '');
  if (!inferredTitle) {
    for (const line of cleanedLines) {
      if (!line || line.startsWith('## ') || line.startsWith('- ') || line.startsWith('**')) continue;
      const candidate = cleanPortalTitleSuffix(line);
      if (candidate.length >= 4 && candidate.length <= 100) {
        inferredTitle = candidate;
        break;
      }
    }
  }
  if (!inferredTitle) {
    inferredTitle = lang === 'en' ? 'Job Description' : 'Mô tả công việc';
  }

  const isAuthWall = jdText.length < 80 || (!hasJdSignal && hasStrongAuthPrompt);

  return {
    isAuthWall,
    jobTitle: inferredTitle,
    jdText,
  };
}
