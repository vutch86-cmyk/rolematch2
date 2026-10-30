# Antigravity Local Development Rules

## 1. Nguyên Tắc Cốt Lõi (Core Principles)
- **Môi trường cục bộ (Local-First):** Ứng dụng chạy trên môi trường local, ưu tiên tính gọn nhẹ, phản hồi nhanh, code sạch và zero-crash.
- **Quy trình 4 Agent tuần tự:** Bắt buộc tuân thủ tuần tự 4 vai trò: `Planning` -> `Coding` -> `Testing` -> `Handover`. Không nhảy cóc khi giai đoạn trước chưa hoàn thành.
- **Phạm vi tác động tối thiểu (Minimal Blast Radius):** Chỉ chỉnh sửa các file thuộc phạm vi task hiện tại; không tự ý refactor các file không liên quan.
- **Bảo toàn dữ liệu cục bộ (Data Safety):** Không được ghi đè làm mất mát cấu trúc dữ liệu người dùng trong thư mục `data/*.json`. Biến môi trường/API keys luôn đặt trong `.env`.
- **Approved-Commit Rule (`.antigravity/implementation_plan.md`):**
  - File `.antigravity/implementation_plan.md` là nhật ký chính thức ghi nhận các thay đổi đã được người dùng **Duyệt (Approved)**.
  - Ở bước Planning: Chỉ trình bày phương án trong chat/artifact tạm — **KHÔNG** ghi trước vào `implementation_plan.md`.
  - Chỉ khi người dùng chốt nghiệm thu/cho phép commit, mới ghi chép thay đổi vào `implementation_plan.md`.

---

## 2. Quy Trình 4 Agent (Phased Agents)

```
[User Request] 
      │
      ▼
┌───────────────┐
│ 1. PLANNING   │ ──(Chờ User duyệt)──► [Approved]
└───────────────┘                              │
                                               ▼
                                        ┌───────────────┐
                                        │  2. CODING    │
                                        └───────────────┘
                                               │
                                               ▼
                                        ┌───────────────┐
                                        │  3. TESTING   │ ◄──(Lặp sửa lỗi tối đa 3 lần)
                                        └───────────────┘
                                               │ (Tất cả test/typecheck PASS)
                                               ▼
                                        ┌───────────────┐
                                        │ 4. HANDOVER   │ ──(User Approved)──► Ghi implementation_plan.md
                                        └───────────────┘
```

### Agent 1: Planning Agent (Kiến trúc & Kế hoạch)
- **Nhiệm vụ:**
  1. Đọc hiểu yêu cầu, kiểm tra mã nguồn và cấu trúc hiện có.
  2. Soạn kế hoạch triển khai ngắn gọn:
     - **Mục tiêu (Objective):** Tóm tắt thay đổi cần làm.
     - **Files Affected:** Danh sách các file dự kiến tạo mới hoặc chỉnh sửa.
     - **Checklist:** Các bước thực thi cụ thể `[ ]`.
     - **Test Strategy:** Phương án kiểm thử (typecheck, unit test, hoặc smoke test).
  3. **Checkpoint:** Dừng lại, hỏi ý kiến người dùng và CHỜ người dùng xác nhận kế hoạch trước khi chuyển sang bước Code.

### Agent 2: Coding Agent (Triển khai mã nguồn)
- **Nhiệm vụ:**
  1. Chỉ bắt đầu khi Planning đã được người dùng đồng ý.
  2. Thực thi code chính xác theo từng đầu việc trong checklist.
  3. Tuân thủ typing chuẩn của TypeScript, xử lý bắt lỗi (try/catch), giữ nguyên style code sẵn có của dự án.
  4. Nếu thay đổi chức năng làm ảnh hưởng luồng sử dụng của người dùng, cập nhật luôn tài liệu hướng dẫn tương ứng trong `docs/`.

### Agent 3: Testing Agent (Đảm bảo chất lượng & Kiểm thử)
- **Nhiệm vụ:**
  1. **Static Check & Typecheck (Bắt buộc):**
     - Chạy `npx tsc --noEmit` (hoặc `npm run lint` nếu script đã có sẵn trong `package.json`).
     - Đảm bảo 100% không còn lỗi TypeScript compilation.
  2. **Automated Tests (Nếu dự án có test suite):**
     - Chạy `npm test` hoặc `npx vitest run` với các file test liên quan.
  3. **Local Runtime Smoke Check (Cho tính năng giao diện/API):**
     - Đảm bảo server local khởi động được không crash.
     - API endpoint hoặc UI logic không văng lỗi unhandled exception / 500.
  4. **Self-Healing Loop (Tự sửa lỗi):**
     - Khi gặp lỗi typecheck/runtime: Đọc stack trace -> tự động sửa file liên quan -> chạy lại lệnh kiểm tra.
     - Giới hạn lặp lại tối đa 3 lần. Nếu vẫn lỗi sau 3 lần, dừng lại và thông báo rõ nguyên nhân cho người dùng.

### Agent 4: Handover Agent (Bàn giao & Ghi nhận)
- **Nhiệm vụ:**
  1. Dọn dẹp tiến trình nền (nếu có bật server tạm để test).
  2. Báo cáo ngắn gọn trong chat:
     - Bảng tóm tắt các file đã sửa/tạo mới.
     - Kết quả kiểm thử (Typecheck: PASS, Unit tests: PASS).
     - Hướng dẫn test nhanh trên giao diện local (URL/nút bấm).
  3. **Khi người dùng xác nhận nghiệm thu (Approved):**
     - Cập nhật nhật ký công việc vào `.antigravity/implementation_plan.md`.
     - Thực hiện `git commit` nếu thư mục dự án đang có quản lý Git.
     - Nếu người dùng từ chối, không ghi nhận vào `implementation_plan.md`.

---

## 3. An Toàn & Giới Hạn (Guardrails)
- **Cấm:** Không chạy các lệnh xóa file nguy hiểm (`rm -rf *`, `git reset --hard`) mà không hỏi trước người dùng.
- **Bảo mật:** Không commit token, API key vào mã nguồn; mọi cấu hình nhạy cảm đặt trong file `.env`.
