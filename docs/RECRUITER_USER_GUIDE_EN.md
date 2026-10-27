# RoleMatch User Guide for Recruiters

> **Purpose:** Help recruiters interpret AI-generated analysis correctly and make evidence-based hiring decisions.

## 1. What does RoleMatch help you do?

RoleMatch helps recruiters:

- Analyze multiple CVs against the same job description (JD).
- Rank candidates whose profiles were analyzed successfully.
- Summarize candidate fit, strengths, evidence gaps, and areas requiring verification.
- Save, reopen, and export analysis results without running the AI again.

AI supports screening and interview preparation. It does not replace decisions made by recruiters or the hiring panel.

## 2. Quick workflow

1. Switch to **Recruiter** mode.
2. Provide a clear JD (paste text, upload a file, or use **Import Link** to extract the JD from a job posting URL; if the portal requires sign-in such as LinkedIn/ITviec, a login popup and 1-click AI clipboard extractor will assist you) and upload the CVs to be analyzed.
3. Select **Start Analysis**.
4. Check how many profiles were completed successfully, failed, or returned no valid score.
5. Review the batch overview to understand the result distribution.
6. Open each candidate to examine supporting evidence, gaps, and key concerns.
7. Use the follow-up points to prepare a structured interview.
8. Record the human decision and rationale, then save the batch or export the report.

## 3. Prepare your data before analysis

### 3.1. Prepare the JD

The clearer the JD, the more useful the analysis will be. Before uploading it, verify that:

- The job title and scope of responsibilities are consistent.
- Must-have requirements are clearly separated from nice-to-have criteria.
- Experience is described through responsibilities, scope, and expected outcomes—not only years of experience.
- Skills, tools, industry background, and language requirements are genuinely necessary for the role.
- The JD does not contain discriminatory criteria or information unrelated to the ability to perform the job.

If the JD is too broad, too short, or internally inconsistent, the AI may produce results that lack differentiation or are difficult to explain.

### 3.2. Prepare the CVs

- Make sure each file is readable, unlocked, and not corrupted.
- For scanned CVs, check the quality of text recognition.
- Avoid uploading sensitive personal information that is not necessary for recruitment.
- If the system reports a processing error, check the file format and upload the profile again. A system error is not a negative assessment of the candidate.

## 4. Understand scores and match levels

### 4.1. The four score categories

| Metric | What it means | What it does not mean |
|---|---|---|
| **Overall Score** | Overall fit of the CV for the current JD, from 0–100 | It is not the probability that the candidate will succeed or be hired |
| **Keyword Alignment** | Alignment of keywords, skills, and terminology between the CV and JD | A low score does not always mean the candidate lacks the capability; the CV may use synonyms or different wording |
| **Experience Fit** | Alignment of demonstrated experience, responsibilities, industry exposure, and outcomes | It does not verify that statements in the CV are factually true |
| **Skills Fit** | Alignment of the technical and soft skills required by the JD | The appearance of a skill in a CV does not prove proficiency |

**Overall Score** is a holistic fit score assigned directly by the AI after evaluating the complete CV and JD. It is not calculated as the average of **Keyword Alignment**, **Experience Fit**, and **Skills Fit**. Because the system does not currently apply a fixed weighting formula, recruiters should also examine supporting evidence, unmet requirements, and the AI recommendation before making a decision.

### 4.2. Match levels

| Overall Score | Displayed level | Appropriate use |
|---:|---|---|
| 85–100 | **Very High** | Prioritize reviewing the evidence and must-have requirements before inviting the candidate to interview |
| 70–84 | **High** | The profile shows several strong fit signals, but specific gaps still need to be reviewed |
| 50–69 | **Medium** | Examine transferable skills and unmet criteria carefully |
| Below 50 | **Low** | The profile has substantial differences from the JD; lower its priority only after reviewing the causes |
| No valid score | **Not Available** | Review manually or reprocess the profile; do not treat it as a score of zero |

Scores are meaningful only within the context of the **same JD and analysis batch**. Do not directly compare scores assigned using different JDs.

### 4.3. How to interpret differences between scores

- **High Keyword Alignment, low Experience Fit:** The CV uses language similar to the JD, but evidence of scope, execution, or outcomes may be weak.
- **High Experience Fit, low Keyword Alignment:** The candidate may have relevant experience but describe it using different terminology. Review transferable skills carefully.
- **High Skills Fit, low Overall Score:** The skills align, but other factors such as seniority, industry context, outcomes, or must-have criteria may reduce the overall fit.
- **High Overall Score with a critical requirement still missing:** Do not automatically invite the candidate to interview. Verify the critical requirement first.

## 5. Read the batch overview

### 5.1. Summary metrics

The overview shows:

- Total profiles processed.
- Candidates recommended for interview.
- Candidates requiring further review.
- Low-priority candidates.
- Candidates with no recommendation.
- Profiles that failed during processing.
- Average and highest scores among successfully processed candidates with valid scores.

Recommendation and match-level percentages are calculated using successfully analyzed profiles. Always check the number of failed and no-score profiles before interpreting these percentages.

### 5.2. Recommendation distribution

The chart divides candidates into four groups:

- **YES — Recommend for interview:** The AI found sufficient signals to prioritize the next step.
- **MAYBE — Review and verify:** The profile shows potential, but one or more important points remain unclear.
- **NO — Low priority:** The current fit is lower than other profiles or substantial gaps remain.
- **No recommendation:** The analysis did not contain enough valid information to produce a recommendation.

These are AI screening recommendations, not final hiring decisions. Select a group in the chart to filter the candidate list.

### 5.3. Match-level distribution

This chart shows how candidates are distributed across Very High, High, Medium, Low, and no-score groups. It can also help you assess input quality:

- If almost every profile is Very High or YES, the JD may be too broad or may not distinguish must-have requirements clearly enough.
- If almost every profile is Low or NO, the JD may be unrealistic, the candidate source may be unsuitable, or the batch may not match the role.
- If many profiles have no score, check file extraction, document quality, and processing errors.

### 5.4. Top 10 candidates

The Top 10 chart includes only successfully analyzed candidates with a valid Overall Score and sorts them in descending score order. Hover over or select a candidate to see the match level and component scores.

Ranking is a tool for prioritizing profile review—not an automated hiring order. When a batch is saved, its ranking is preserved so the batch can be reopened without running the AI again.

## 6. Read an individual candidate report

Read sections A through F in sequence. Use expanded view when you need more space for a long report.

### A. Executive Summary

This section includes the candidate's name, rank, Overall Score, match level, AI recommendation, and recommendation rationale.

Use section A for initial triage, then review sections C, E, and F before making a decision. A short rationale cannot replace detailed evidence.

### B. Score Breakdown

This section places Keyword Alignment, Experience Fit, and Skills Fit side by side to show their relative strengths and weaknesses.

When one score differs substantially from the others, look for the reason in **JD Match Evidence & Gaps** and **Requirement Match**. Do not infer actual capability from the height of a score bar alone.

### C. JD Match Evidence & Gaps

This section includes:

- **JD Match Strength:** The strongest signal or evidence showing how the CV aligns with the JD.
- **Unproven JD Requirements:** JD requirements for which the AI could not find sufficiently clear evidence in the CV.

“No evidence found” does not mean “the candidate does not have the capability.” Three common explanations are possible:

1. The candidate does not have the relevant experience.
2. The candidate has the experience but did not include it in the CV.
3. The CV uses different terminology that the AI did not fully recognize.

Convert each important evidence gap into a verification question instead of using it as an automatic reason for rejection.

### D. Recruiter Quick Scan

This section simulates a recruiter's rapid first review:

- **First 10-second impression.**
- **Immediate standout strength.**
- **Primary concern.**
- **Fastest point of score loss.**

These items reflect initial screening signals and how clearly the CV communicates value. A “concern” is a hypothesis requiring verification, not a confirmed fact.

### E. Requirement Match

This is the most important section for understanding and validating the analysis. Each row contains:

- A requirement from the JD.
- Its importance: **Critical**, **Important**, or **Advantage**.
- Evidence found in the CV.
- A gap or point requiring clarification.
- Its status: **Matched**, **Needs clarification**, or **Missing**.

Review the rows in this order:

1. **Critical + Missing.**
2. **Critical + Needs clarification.**
3. The quality of evidence for critical requirements marked as matched.
4. Important and advantage criteria.

The system places critical missing requirements first and allows filtering by status. Do not merely check whether a keyword appears. Read the evidence to understand what the candidate did, at what scope, and with what result.

### F. Interview Follow-up Points

This list is compiled from clarification questions, gaps in the requirement table, and areas the AI considers necessary to improve or verify.

Use these points as interview questions, not accusations. A strong question should ask the candidate to describe:

- The context and objective.
- Their individual role and specific actions.
- The tools or methods used.
- The scope, such as team size, customers, systems, or budget.
- Measurable results and lessons learned.

For example, instead of asking, “You do not have team management experience, correct?”, ask, “Could you describe a situation in which you coordinated a team, including the team size, your responsibilities, and the outcome?”

## 7. Interpret YES, MAYBE, and NO recommendations

| Recommendation | How to interpret it | Appropriate action |
|---|---|---|
| **YES** | The profile contains relatively clear fit signals | Verify must-have requirements and supporting evidence before inviting the candidate to interview |
| **MAYBE** | The profile shows potential but contains an important gap or concern | Verify through a screening call, follow-up questions, or manual CV review |
| **NO** | The current fit is low or substantial differences exist | Review the rationale and evidence; lower the candidate's priority only after human confirmation |
| **No recommendation** | The AI did not produce a valid recommendation | Review manually or rerun the analysis if appropriate |

Do not treat YES as a guarantee, and do not use NO as the sole reason to reject a candidate.

## 8. Compare candidates

You can select up to three candidates for comparison. The comparison chart and table include Overall Score, Keyword Alignment, Experience Fit, Skills Fit, match level, AI recommendation, strengths, concerns, fastest point of score loss, and unproven JD requirements.

When comparing candidates:

- Compare only candidates assessed against the same JD.
- Prioritize must-have requirements and evidence quality over small differences in Overall Score.
- A candidate with a lower Overall Score may still be a better fit if they provide stronger evidence for a non-negotiable requirement.
- Record the human rationale for advancing or not advancing each candidate so the decision can be reviewed later.

## 9. Suggested decision workflow

### Advance to the next stage

Consider advancing a candidate when the recommendation is YES or a strong MAYBE, critical requirements are supported by credible evidence, and no serious concern remains unresolved.

### Hold for verification

Use this status when a candidate has a good score but a critical requirement is marked Needs clarification or Missing, or when Experience Fit is not sufficiently supported. Verify through a screening call or structured interview.

### Review manually

Manual review is required for profiles that failed during processing, returned no valid score, or contain significant missing analysis data.

### Lower priority

Do so only after reviewing the JD, AI rationale, CV evidence, and must-have requirements. Do not automatically reject a candidate solely because of a low score or NO recommendation.

## 10. Save, reopen, and export reports

- Select **Save Current Batch** after the analysis is complete.
- A saved batch contains batch details, ranking, scores, complete analysis, and processing status.
- When reopened from **Saved Batches**, the system uses the saved results and does not run the AI again.
- Select **Export Leaderboard (Markdown)** to share or archive a report.
- Use **Full Report** to open the complete analysis for an individual candidate.

When sharing or exporting reports, follow your organization's CV confidentiality policy and grant access only to people responsible for the recruitment process.

## 11. Handle exceptional statuses

| Status | What it means | What to do |
|---|---|---|
| **Completed** | Analysis succeeded and returned a valid score | Continue reviewing supporting evidence and gaps |
| **No Score** | Processing completed but returned no valid Overall Score; the candidate is not ranked | Review manually, inspect the input, or rerun the analysis |
| **Failed** | File extraction or AI processing failed | Check the file and upload or process it again; never treat this as a candidate assessment |
| **Not Available** | A specific metric contains no valid data | Do not replace it with zero; verify it from the CV or interview |

## 12. Use AI responsibly

- Humans remain accountable for every final hiring decision.
- Assess all candidates against the same JD and the same job-related criteria.
- Do not use gender, age, ethnicity, religion, disability, marital status, photographs, addresses, or other sensitive attributes to make decisions.
- Verify important claims through the original CV, interviews, appropriate assessments, or permitted references.
- Recognize that AI may be wrong or incomplete because of JD quality, CV format, extraction errors, or wording differences.
- Record the recruiter's rationale, especially when the human decision differs from the AI recommendation.
- Collect, retain, and share only the candidate information required under your organization's privacy policy.

## 13. Checklist before making a decision

- [ ] The JD clearly distinguishes must-have requirements from advantage criteria.
- [ ] Any profile with an unresolved Failed or No Score status has been handled appropriately.
- [ ] Supporting evidence has been reviewed—not only the Overall Score or rank.
- [ ] Every **Critical + Missing/Needs clarification** requirement has been checked.
- [ ] “No evidence in the CV” has been distinguished from “no capability.”
- [ ] Important concerns have been converted into neutral verification questions.
- [ ] Candidates have been compared using the same JD and criteria.
- [ ] Sensitive attributes or information unrelated to the job have not influenced the decision.
- [ ] The final human decision and rationale have been recorded.

## 14. Example: interpreting a candidate report

Suppose a candidate has:

- Overall Score: 78 — High.
- Keyword Alignment: 90.
- Experience Fit: 62.
- Skills Fit: 80.
- Recommendation: MAYBE.
- A critical team-management requirement marked Needs clarification.

Appropriate interpretation:

1. The CV uses language and describes skills that align closely with the JD.
2. Evidence of execution experience or outcomes is weaker than the keyword alignment.
3. A score of 78 does not remove the evidence gap for the team-management requirement.
4. The recruiter should review related evidence, then ask about team size, the candidate's direct responsibilities, the management situation, and the outcome.
5. Advance the candidate only after verifying this must-have criterion.

## 15. Glossary

- **JD:** The job description used as the comparison standard.
- **Batch:** One analysis run containing one JD and multiple CVs.
- **Evidence:** CV content used by the AI to support alignment with a requirement.
- **Gap:** A requirement with missing or insufficient evidence in the CV.
- **Rank:** The priority order based on Overall Score within the same batch.
- **Recommendation:** The AI's YES/MAYBE/NO screening suggestion—not the final decision.
