import { Type } from '@google/genai';

export const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    candidateName: {
      type: Type.STRING,
      description: 'Họ và tên đầy đủ của ứng viên trích xuất từ CV',
    },
    companyName: {
      type: Type.STRING,
      description: 'Tên công ty hoặc tổ chức tuyển dụng trích xuất từ JD (để trống nếu JD không nêu tên công ty)',
    },
    jobTitle: {
      type: Type.STRING,
      description: 'Chức danh / Vị trí ứng tuyển chính xác trích xuất từ JD (không lấy từ khóa kỹ năng)',
    },
    feature1: {
      type: Type.OBJECT,
      properties: {
        jdKeywords: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
              category: { type: Type.STRING },
              importance: { type: Type.STRING },
              isMustHave: {
                type: Type.BOOLEAN,
                description: 'true nếu là tiêu chí bắt buộc (Must-Have / Knock-out), false nếu là điểm cộng (Nice-to-Have)',
              },
            },
            required: ['keyword', 'category', 'importance', 'isMustHave'],
          },
        },
        comparisonTable: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              jdTerm: { type: Type.STRING },
              importance: { type: Type.STRING },
              isMustHave: {
                type: Type.BOOLEAN,
                description: 'true nếu là tiêu chí bắt buộc (Must-Have / Knock-out), false nếu là điểm cộng (Nice-to-Have)',
              },
              cvEvidence: { type: Type.STRING },
              gapOrClarification: { type: Type.STRING },
              matchStatus: {
                type: Type.STRING,
                enum: ['khop', 'can_bo_sung', 'thieu'],
              },
              targetSection: {
                type: Type.STRING,
                description: 'Vị trí cụ thể trong CV nên chèn hoặc làm rõ (VD: Tóm tắt mở đầu, Kinh nghiệm tại công ty X, Kỹ năng chuyên môn)',
              },
              suggestedPhrasing: {
                type: Type.STRING,
                description: 'Câu văn mẫu gợi ý sát ngữ cảnh (cùng ngôn ngữ CV gốc) để ứng viên chèn vào CV đối với tiêu chí can_bo_sung hoặc thieu',
              },
            },
            required: [
              'jdTerm',
              'importance',
              'isMustHave',
              'cvEvidence',
              'gapOrClarification',
              'matchStatus',
              'targetSection',
              'suggestedPhrasing',
            ],
          },
        },
        scores: {
          type: Type.OBJECT,
          properties: {
            keywordMatchScore: { type: Type.INTEGER },
            skillMatchScore: { type: Type.INTEGER },
            experienceOutcomeScore: { type: Type.INTEGER },
            overallRoleScore: { type: Type.INTEGER },
            projectedOverallScore: {
              type: Type.INTEGER,
              description: 'Điểm phù hợp tổng thể dự kiến (0-100) nếu ứng viên tối ưu lại cách trình bày CV hiện tại theo hướng dẫn',
            },
            keywordRationale: {
              type: Type.STRING,
              description: 'Giải trình chi tiết vì sao đạt điểm khớp từ khóa này và yếu tố nào kéo điểm xuống',
            },
            skillRationale: {
              type: Type.STRING,
              description: 'Giải trình chi tiết vì sao đạt điểm khớp kỹ năng này và yếu tố nào kéo điểm xuống',
            },
            experienceRationale: {
              type: Type.STRING,
              description: 'Giải trình chi tiết vì sao đạt điểm khớp kinh nghiệm & kết quả đầu ra này',
            },
            overallRationale: {
              type: Type.STRING,
              description: 'Giải trình tổng hợp mức độ phù hợp và cơ sở tăng điểm lên projectedOverallScore',
            },
          },
          required: [
            'keywordMatchScore',
            'skillMatchScore',
            'experienceOutcomeScore',
            'overallRoleScore',
            'projectedOverallScore',
            'keywordRationale',
            'skillRationale',
            'experienceRationale',
            'overallRationale',
          ],
        },
        summary: {
          type: Type.OBJECT,
          properties: {
            biggestStrength: { type: Type.STRING },
            missingKeywordsSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            weakOrVagueSections: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            immediateActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'biggestStrength',
            'missingKeywordsSkills',
            'weakOrVagueSections',
            'immediateActions',
          ],
        },
      },
      required: ['jdKeywords', 'comparisonTable', 'scores', 'summary'],
    },
    feature2: {
      type: Type.OBJECT,
      properties: {
        clarifyingQuestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Tối đa 3 câu hỏi làm rõ ngắn gọn',
        },
        tailoredSummaries: {
          type: Type.OBJECT,
          properties: {
            technicalFocus: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                focusType: { type: Type.STRING, enum: ['technical'] },
                pitch: {
                  type: Type.STRING,
                  description: 'Đoạn tóm tắt mở đầu dài từ 50 đến 200 từ (tối đa 250 từ cho cấp Senior/Quản lý), gồm: định vị vai trò & thâm niên từ CV, năng lực kỹ thuật nổi bật khớp JD, tiêu chuẩn làm việc, và cam kết giá trị cho công ty mục tiêu. TUYỆT ĐỐI KHÔNG viết dưới 50 từ.',
                },
                keyHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['title', 'focusType', 'pitch', 'keyHighlights'],
            },
            managementFocus: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                focusType: { type: Type.STRING, enum: ['management'] },
                pitch: {
                  type: Type.STRING,
                  description: 'Đoạn tóm tắt mở đầu dài từ 50 đến 200 từ (tối đa 250 từ cho cấp Senior/Quản lý), gồm: định vị điều phối & kết nối mục tiêu kinh doanh từ CV, thành tựu quản lý tiến độ/KPI, và cam kết giá trị cho công ty mục tiêu. TUYỆT ĐỐI KHÔNG viết dưới 50 từ.',
                },
                keyHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['title', 'focusType', 'pitch', 'keyHighlights'],
            },
          },
          required: ['technicalFocus', 'managementFocus'],
        },
        sectionAudit: {
          type: Type.OBJECT,
          properties: {
            overallSectionRating: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionKey: {
                    type: Type.STRING,
                    enum: ['summary', 'experience', 'skills', 'education_ats'],
                  },
                  sectionName: { type: Type.STRING },
                  status: {
                    type: Type.STRING,
                    enum: ['tot', 'can_cai_thien', 'yeu_nghiem_trong'],
                  },
                  score: { type: Type.INTEGER },
                  comment: { type: Type.STRING },
                  actionableFix: { type: Type.STRING },
                  suggestedSnippets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '1-2 sample sentences based strictly on candidate CV info for this section. Absolutely NO fabricated facts, fake companies, or fake metrics.',
                  },
                },
                required: [
                  'sectionKey',
                  'sectionName',
                  'status',
                  'score',
                  'comment',
                  'actionableFix',
                ],
              },
            },
          },
          required: ['sections'],
        },
        rewrittenBullets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalBullet: { type: Type.STRING },
              issueInOriginal: { type: Type.STRING },
              rewrittenBullet: { type: Type.STRING },
              reasonBetter: { type: Type.STRING },
              isLackingInfo: { type: Type.BOOLEAN },
              embeddedKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              metricPlaceholders: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'originalBullet',
              'issueInOriginal',
              'rewrittenBullet',
              'reasonBetter',
            ],
          },
        },
      },
      required: ['clarifyingQuestions', 'rewrittenBullets'],
    },
    feature3: {
      type: Type.OBJECT,
      properties: {
        inviteDecision: {
          type: Type.STRING,
          enum: ['YES', 'NO', 'MAYBE'],
        },
        decisionReason: { type: Type.STRING },
        firstImpression10s: { type: Type.STRING },
        immediateStrength: { type: Type.STRING },
        biggestDoubt: { type: Type.STRING },
        fastestPointLossSection: { type: Type.STRING },
        top3MustFix: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        seniorityFit: {
          type: Type.OBJECT,
          properties: {
            overallAssessment: {
              type: Type.STRING,
              enum: ['under', 'match', 'over'],
            },
            overallAssessmentLabel: { type: Type.STRING },
            summaryRationale: { type: Type.STRING },
            positioningAdvice: { type: Type.STRING },
            dimensions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dimensionKey: {
                    type: Type.STRING,
                    enum: [
                      'level_tenure',
                      'scale_complexity',
                      'scope_ownership',
                      'domain_match',
                    ],
                  },
                  dimensionName: { type: Type.STRING },
                  jdExpectation: { type: Type.STRING },
                  cvReality: { type: Type.STRING },
                  assessment: {
                    type: Type.STRING,
                    enum: ['under', 'match', 'over'],
                  },
                  comment: { type: Type.STRING },
                },
                required: [
                  'dimensionKey',
                  'dimensionName',
                  'jdExpectation',
                  'cvReality',
                  'assessment',
                  'comment',
                ],
              },
            },
          },
          required: [
            'overallAssessment',
            'overallAssessmentLabel',
            'summaryRationale',
            'positioningAdvice',
            'dimensions',
          ],
        },
        riskMitigationMatrix: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              riskType: {
                type: Type.STRING,
                enum: [
                  'tenure_gap',
                  'job_hopping',
                  'domain_mismatch',
                  'metric_lacking',
                  'over_under_qualified',
                  'other',
                ],
              },
              riskTitle: { type: Type.STRING },
              severity: {
                type: Type.STRING,
                enum: ['high', 'medium', 'low'],
              },
              recruiterConcern: { type: Type.STRING },
              cvMitigation: { type: Type.STRING },
              interviewDefense: { type: Type.STRING },
            },
            required: [
              'riskType',
              'riskTitle',
              'severity',
              'recruiterConcern',
              'cvMitigation',
              'interviewDefense',
            ],
          },
        },
      },
      required: [
        'inviteDecision',
        'decisionReason',
        'firstImpression10s',
        'immediateStrength',
        'biggestDoubt',
        'fastestPointLossSection',
        'top3MustFix',
      ],
    },
    feature4: {
      type: Type.OBJECT,
      properties: {
        interviewPrepSummary: {
          type: Type.STRING,
          description: 'Tóm tắt chiến lược chuẩn bị phỏng vấn tổng quan',
        },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'Câu hỏi phỏng vấn thực chiến cụ thể từ HR hoặc Hiring Manager',
              },
              category: {
                type: Type.STRING,
                description: 'Nhóm câu hỏi: "Kiểm chứng khoảng trống CV", "Tình huống & Chuyên môn sâu", hoặc "Tầm vóc & Cách làm việc"',
              },
              difficulty: {
                type: Type.STRING,
                description: 'Độ khó: "Trọng tâm", "Khó", hoặc "Rất khó"',
              },
              sourceGapOrDoubt: {
                type: Type.STRING,
                description: 'Khoảng trống hoặc điểm nghi ngờ cụ thể nào trong CV dẫn đến câu hỏi này',
              },
              interviewerIntent: {
                type: Type.STRING,
                description: 'Ý đồ thực sự của Nhà tuyển dụng khi hỏi câu này',
              },
              starAnswerGuide: {
                type: Type.OBJECT,
                properties: {
                  situationTask: {
                    type: Type.STRING,
                    description: 'Tình huống & Thách thức thực tế từ CV (Situation & Task)',
                  },
                  action: {
                    type: Type.STRING,
                    description: 'Hành động cụ thể, kỹ thuật/công cụ và phương pháp giải quyết (Action)',
                  },
                  result: {
                    type: Type.STRING,
                    description: 'Kết quả định lượng, giá trị kinh doanh hoặc bài học rút ra (Result)',
                  },
                },
                required: ['situationTask', 'action', 'result'],
              },
              pitfallToAvoid: {
                type: Type.STRING,
                description: 'Sai lầm / bẫy ứng viên tuyệt đối cần tránh khi trả lời',
              },
            },
            required: [
              'question',
              'category',
              'difficulty',
              'sourceGapOrDoubt',
              'interviewerIntent',
              'starAnswerGuide',
              'pitfallToAvoid',
            ],
          },
        },
      },
      required: ['questions'],
    },
  },
  required: ['feature1', 'feature2', 'feature3', 'feature4'],
};

export const generateCvResponseSchema = {
  type: Type.OBJECT,
  properties: {
    updatedCvMarkdown: { type: Type.STRING },
    summaryOfChanges: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['updatedCvMarkdown', 'summaryOfChanges'],
};;
