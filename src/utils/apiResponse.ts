export interface ParsedApiResponse<T = any> {
  success: boolean;
  data?: T;
  code?: string;
  error?: string;
  message?: string;
  requestId?: string;
  dailyLimit?: number;
  used?: number;
  remaining?: number;
  resetAt?: string;
  [key: string]: any;
}

export class ApiParseError extends Error {
  code: string;
  status: number;
  requestId?: string;
  rawBody?: string;
  data?: any;

  constructor({
    message,
    code = 'API_ERROR',
    status = 500,
    requestId,
    rawBody,
    data
  }: {
    message: string;
    code?: string;
    status?: number;
    requestId?: string;
    rawBody?: string;
    data?: any;
  }) {
    super(message);
    this.name = 'ApiParseError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.rawBody = rawBody;
    this.data = data;
  }
}

export async function parseApiResponseSafely<T = any>(
  response: Response,
  lang: 'vi' | 'en' = 'vi',
  fallbackRequestId?: string
): Promise<ParsedApiResponse<T>> {
  const isEn = lang === 'en';
  const headerReqId = response.headers.get('x-request-id') || fallbackRequestId;
  const contentType = response.headers.get('content-type') || '';

  let rawBody = '';
  try {
    rawBody = await response.text();
  } catch (e) {
    const errorMsg = isEn
      ? `Network or response reading failed. Request ID: ${headerReqId || 'N/A'}`
      : `Không thể đọc phản hồi từ máy chủ. Mã yêu cầu: ${headerReqId || 'N/A'}`;
    throw new ApiParseError({
      message: errorMsg,
      code: 'NETWORK_ERROR',
      status: response.status || 0,
      requestId: headerReqId
    });
  }

  let jsonBody: any = null;
  const trimmed = rawBody.trim();
  const isJsonLike = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (contentType.includes('json') || isJsonLike) {
    try {
      jsonBody = JSON.parse(rawBody);
    } catch (parseErr) {
      jsonBody = null;
    }
  }

  const reqId = jsonBody?.requestId || headerReqId || 'N/A';

  // If response is HTML or malformed non-JSON
  if (!jsonBody && (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || !isJsonLike)) {
    const errorMsg = isEn
      ? `The server returned an invalid response. Please retry or contact the administrator with request ID ${reqId}.`
      : `Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại hoặc liên hệ quản trị viên với mã yêu cầu ${reqId}.`;

    throw new ApiParseError({
      message: errorMsg,
      code: 'INVALID_HTML_RESPONSE',
      status: response.status,
      requestId: reqId,
      rawBody
    });
  }

  if (!response.ok) {
    const code = jsonBody?.code || (response.status === 401 ? 'AUTH_REQUIRED' : response.status === 429 ? 'DAILY_AI_LIMIT_EXCEEDED' : response.status === 503 ? 'QUOTA_SERVICE_UNAVAILABLE' : 'INTERNAL_API_ERROR');
    let message = jsonBody?.error || jsonBody?.message;

    if (!message || typeof message !== 'string') {
      if (code === 'AUTH_REQUIRED') {
        message = isEn ? 'Please log in to continue.' : 'Vui lòng đăng nhập để tiếp tục.';
      } else if (code === 'DAILY_AI_LIMIT_EXCEEDED') {
        const resetTime = jsonBody?.resetAt ? new Date(jsonBody.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        message = isEn
          ? `Daily AI usage limit reached (${jsonBody?.used || 0}/${jsonBody?.dailyLimit || 10}). Remaining: ${jsonBody?.remaining || 0}. Resets at: ${resetTime}.`
          : `Bạn đã đạt giới hạn sử dụng AI trong ngày (${jsonBody?.used || 0}/${jsonBody?.dailyLimit || 10} lượt). Còn lại: ${jsonBody?.remaining || 0}. Làm mới lúc: ${resetTime}.`;
      } else if (code === 'QUOTA_SERVICE_UNAVAILABLE') {
        message = isEn ? 'Quota service temporarily unavailable. Please try again later.' : 'Dịch vụ kiểm soát lượt tạm thời không khả dụng. Vui lòng thử lại sau.';
      } else {
        message = isEn ? 'An error occurred while calling the API.' : 'Đã có lỗi xảy ra khi gọi API.';
      }
    }

    throw new ApiParseError({
      message,
      code,
      status: response.status,
      requestId: reqId,
      rawBody,
      data: jsonBody
    });
  }

  if (jsonBody) {
    return jsonBody;
  }

  return {
    success: true,
    message: rawBody,
    requestId: reqId
  };
}
