import {
  validatePublicJobUrl,
  detectJobSiteName,
  extractLinkedInJobId,
  decodeHtmlEntities,
  stripHtmlToFormattedText,
  extractJsonLdJobPosting,
  extractMetaAndBodyText,
  isLikelyAuthOrBotWall,
  cleanPortalTitleSuffix,
  cleanJdTextHeuristically,
} from '../../src/utils/jdUrlExtractorHelpers';

export {
  validatePublicJobUrl,
  detectJobSiteName,
  extractLinkedInJobId,
  decodeHtmlEntities,
  stripHtmlToFormattedText,
  extractJsonLdJobPosting,
  extractMetaAndBodyText,
  isLikelyAuthOrBotWall,
  cleanPortalTitleSuffix,
  cleanJdTextHeuristically,
};

export async function cleanAndExtractJdWithAi(
  rawInputText: string,
  sourceInfo: { url?: string; siteName?: string; hintTitle?: string },
  lang: 'vi' | 'en',
  aiClientCaller?: (prompt: string) => Promise<any>
): Promise<{ isAuthWall: boolean; jobTitle: string; jdText: string }> {
  const trimmedInput = rawInputText.slice(0, 35000).trim();

  if (aiClientCaller) {
    try {
      const prompt = `
You are an expert HR Data Extraction Engine.
Below is raw text extracted or copied from a job posting webpage (${sourceInfo.siteName || 'Job Portal'}${sourceInfo.url ? ` - ${sourceInfo.url}` : ''}).

Your tasks:
1. Determine if this text actually contains a Job Description (JD) or if it is ONLY a login wall / sign-in prompt / Cloudflare captcha / empty error page with no job details.
   - Set "isAuthWall": true ONLY IF there is no actual job description content and the text is mainly asking the user to sign in, verify they are human, or showing an error.
2. If it contains a Job Description, extract and format the COMPLETE Job Description into clean, structured Markdown in its ORIGINAL language (do NOT translate the JD).
   - Strip out website navigation menus, "Sign in / Register" buttons, "Similar Jobs / Việc làm tương tự", company reviews sidebar, footer copyright, and cookie notices.
   - Keep 100% of the job details: Job Title, Company Name, Location/Work mode, Job Overview/Summary, Responsibilities/Job Description, Requirements/Qualifications/Skills, and Benefits/Compensation.
   - Use clear Markdown headings (e.g., # Job Title, ## Mô tả công việc / Responsibilities, ## Yêu cầu ứng viên / Requirements, ## Quyền lợi / Benefits) and bullet points ("- ").

Respond ONLY with valid JSON matching this exact structure:
{
  "isAuthWall": boolean,
  "companyName": "Hiring company name (e.g. FPT Software, Techcombank) or empty string if not mentioned",
  "jobTitle": "Clean job title (e.g. Senior React Developer)",
  "jdText": "Full cleaned Markdown job description"
}

RAW WEBPAGE TEXT:
"""
${trimmedInput}
"""
`;
      const parsed = await aiClientCaller(prompt);
      if (parsed && typeof parsed === 'object') {
        if (parsed.isAuthWall === true) {
          return { isAuthWall: true, jobTitle: '', jdText: '' };
        }
        if (typeof parsed.jdText === 'string' && parsed.jdText.trim().length > 60) {
          const cleanRole = typeof parsed.jobTitle === 'string' && parsed.jobTitle.trim()
            ? parsed.jobTitle.trim()
            : cleanPortalTitleSuffix(sourceInfo.hintTitle || '');
          const cleanCompany = typeof parsed.companyName === 'string' && parsed.companyName.trim()
            ? parsed.companyName.trim()
            : '';
          let formattedJd = parsed.jdText.trim();
          if (cleanCompany && !/(?:công\s*ty|company)\s*:/i.test(formattedJd.slice(0, 300))) {
            if (formattedJd.startsWith('#')) {
              const firstNewline = formattedJd.indexOf('\n');
              if (firstNewline !== -1) {
                formattedJd = `${formattedJd.slice(0, firstNewline)}\n**Công ty / Company:** ${cleanCompany}${formattedJd.slice(firstNewline)}`;
              }
            } else {
              formattedJd = `# ${cleanRole || 'Job Description'}\n**Công ty / Company:** ${cleanCompany}\n\n${formattedJd}`;
            }
          }
          return {
            isAuthWall: false,
            jobTitle: cleanCompany && cleanRole && !cleanRole.toLowerCase().includes(cleanCompany.toLowerCase())
              ? `${cleanCompany} - ${cleanRole}`
              : cleanRole,
            jdText: formattedJd,
          };
        }
      }
    } catch (aiErr: any) {
      console.warn('[JD URL Extract] AI structuring fallback triggered:', aiErr?.message || aiErr);
    }
  }

  // Heuristic fallback when AI is unavailable or rate-limited
  return cleanJdTextHeuristically(trimmedInput, sourceInfo, lang);
}
