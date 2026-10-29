# Security Audit Gate — Định tuyến theo loại thay đổi

Skill: `.antigravity/skills/security-audit/` (bản copy của Cloudflare `security-audit`, đọc `SKILL.md` trước).
Mục đích: trước khi commit/push lên `staging`, chỉ audit **phần code thay đổi** và chỉ nạp **companion file liên quan**, không chạy toàn bộ skill.

## 1. Cách chạy (bắt buộc)

1. Lấy phạm vi: `git diff --name-only origin/staging...HEAD` + file đang staged/unstaged (`git status --short`).
2. Phân loại từng file theo bảng mục 2 → chọn tập companion.
3. Chạy skill ở chế độ **scoped run**, profile **`quick`** (mặc định). Dùng `deep` nếu chạm vào nhóm "Nhạy cảm cao" (mục 3) hoặc người dùng yêu cầu.
   - Seed coverage chỉ cho file trong phạm vi; phần còn lại ghi `out_of_scope`, **không** ghi `covered`.
   - Báo cáo phải nêu rõ đây là *partial coverage*.
4. Output ghi **ngoài repo**: `~/security-audit-skill/rolematch2/run-<N>` (không ghi vào repo trừ khi thư mục bị gitignore).
5. Chạy validator: `node .antigravity/skills/security-audit/validate-findings.cjs <output-dir>/findings.json` và `validate-coverage-ledger.cjs <output-dir>/coverage-ledger.json`.
6. Tóm tắt kết quả cho người dùng **trước** bước xin duyệt commit (xem mục 4).

## 2. Bảng định tuyến (đường dẫn → companion)

`ATTACK-CLASSES.md` (core: Injection, Access control, Resource & file handling, Crypto & secrets…) luôn được dùng làm nền. Companion chỉ chọn khi diff chạm đúng ranh giới tin cậy tương ứng.

| Thay đổi chạm vào | Companion cần nạp | Trọng tâm cho rolematch2 |
|---|---|---|
| `src/components/**`, `src/App.tsx`, `src/main.tsx`, `index.html`, `src/utils/export*.ts`, `src/utils/i18n.ts` (frontend, render DOM) | `CLIENT-SIDE.md` | XSS qua nội dung CV/JD/kết quả AI (`react-markdown`, `dangerouslySetInnerHTML`), lưu trữ token/dữ liệu trong localStorage, `postMessage`, open redirect, link `target=_blank` |
| Component đăng nhập/session (`LoginModal`, `StandaloneLoginPage`, `AdminUsersModal`) hoặc phần xác thực trong `server.ts` | `WEB-PROTOCOL-AND-AUTH.md` + `CLIENT-SIDE.md` | Session/JWT, CSRF, CORS, phân quyền admin, brute-force |
| Route API, middleware, upload (`multer`), parse PDF/DOCX/ZIP trong `server.ts` | `WEB-PROTOCOL-AND-AUTH.md` + core "Resource and file handling" | Path traversal, zip-slip (`adm-zip`), SSRF (JD URL extractor), kiểm tra loại/size file |
| Prompt, gọi Gemini (`@google/genai`), xử lý output AI | `AI-AND-LLM.md` | Prompt injection từ CV/JD, output AI đi vào HTML/lệnh/DB, lộ prompt hệ thống |
| `quotaService.ts`, rate limit, batch processing, tác vụ tốn token/CPU | `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md` | Vượt quota, chi phí Gemini, file/batch lớn, DoS |
| `firestore.rules`, `firebase-*.json`, truy cập dữ liệu người dùng, lịch sử, batch đã lưu, export/xoá dữ liệu | `DATA-ISOLATION-AND-LIFECYCLE.md` (+ `CLOUD-AND-DEPLOYMENT.md` cho rules) | IDOR giữa user, rule quá rộng, xoá/retention |
| `package.json`, `bun.lock`, `.github/**`, `vite.config.ts`, script build | `SUPPLY-CHAIN-AND-RELEASE.md` | Dependency mới/đáng ngờ, script lifecycle, CI |
| `.env*`, config deploy, Dockerfile, IaC | `CLOUD-AND-DEPLOYMENT.md` | Secret lộ, cấu hình runtime |
| Chỉ sửa docs/CSS/test/asset thuần | Không cần audit sâu → chỉ quét nhanh secret (`.env`, API key trong diff) | — |

**Không dùng** (không có trong kiến trúc rolematch2): `MEMORY-SAFETY-AND-BINARY.md`, `DESKTOP-MOBILE-AND-LOCAL-IPC.md`, `PROTOCOLS-RPC-AND-MESSAGING.md` (trừ khi thêm webhook/queue/GraphQL/gRPC).

Ví dụ: thay đổi chỉ trong `src/components/*.tsx` → `ATTACK-CLASSES.md` (Injection, Crypto & secrets) + `CLIENT-SIDE.md`. Không nạp các companion khác.

## 3. Nhóm "Nhạy cảm cao" (nên dùng profile `deep`)
`server.ts` (auth, upload, parse file), `firestore.rules`, `quotaService.ts`, mọi thay đổi liên quan secret/API key.

## 4. Tiêu chí pass/fail trước khi xin duyệt commit

| Kết quả | Hành động |
|---|---|
| Có `confirmed` mức **critical/high** | **Chặn**: không xin duyệt commit; sửa rồi audit lại |
| Có `confirmed` **medium** | Báo người dùng, người dùng quyết định (sửa hoặc chấp nhận rủi ro, ghi lại lý do) |
| `confirmed` low/informational, `needs_validation` | Cho qua, liệt kê trong báo cáo kèm điều cần xác minh |
| Validator lỗi / audit chưa xong (`run_status: incomplete`) | Coi là **chưa pass** |

## 5. An toàn khi thực thi
Tuân theo mục "Universal execution safety" của `SKILL.md`: đọc source là mặc định; **không** chạy build/test/server của dự án trong audit trừ khi có sandbox đủ (không mạng, env allowlist, ghi chỉ vào scratch). Không gọi API thật (Gemini, Firebase production). Không cài thêm dependency.
