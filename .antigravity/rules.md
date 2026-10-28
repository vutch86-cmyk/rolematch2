# Antigravity Autonomous Workflow Rules

## 1. Core Operating Principles
- **Strict Phased Execution:** Bạn bắt buộc phải tuân thủ tuần tự 4 giai đoạn: `Planning` -> `Coding` -> `Testing & Verification` -> `Handover`. Không được nhảy cóc sang giai đoạn sau khi giai đoạn trước chưa hoàn tất.
- **Minimal Code Blast Radius:** Chỉ chỉnh sửa các file thuộc phạm vi task hiện tại. Không tự ý refactor các module không liên quan nếu không có trong kế hoạch đã duyệt.
- **Evidence-Based Delivery:** Không bao giờ báo cáo hoàn thành chỉ dựa trên phỏng đoán; mọi kết quả phải được chứng minh bằng log kiểm thử hoặc screenshot trình duyệt.

---

## 2. Phase Breakdown

### Phase 1: Planning (Kiến trúc & Kế hoạch)
- **Role:** Planner / System Architect.
- **Action:**
  1. Đọc hiểu yêu cầu người dùng, kiểm tra mã nguồn hiện có và các file cấu hình liên quan.
  2. Tạo hoặc cập nhật trực tiếp file `.antigravity/implementation_plan.md` trong thư mục dự án (đồng thời đồng bộ với Artifact nếu cần) theo định dạng chuẩn để người dùng dễ dàng theo dõi lịch sử kế hoạch và các thay đổi phần mềm tại 1 file duy nhất:
     - **Objective:** Mục tiêu ngắn gọn của task.
     - **Files Affected:** Danh sách các file dự kiến tạo mới hoặc sửa đổi.
     - **Implementation Steps:** Danh sách các đầu việc tuần tự (kèm checklist `[ ]`).
     - **Test & Verification Strategy:** Lệnh test sẽ chạy, kịch bản test UI/Browser cụ thể.
  3. **Checkpoint:** Dừng lại, lưu kế hoạch vào `.antigravity/implementation_plan.md` (kèm Artifact) và yêu cầu người dùng duyệt trước khi thực thi bất kỳ thay đổi nào trên codebase.

### Phase 2: Coding (Triển khai mã nguồn)
- **Role:** Software Engineer.
- **Pre-condition:** Chỉ thực thi khi `.antigravity/implementation_plan.md` đã được người dùng chấp thuận.
- **Action:**
  1. Triển khai code theo đúng thứ tự checklist trong kế hoạch.
  2. Giữ nguyên coding conventions, naming styles và typing annotations hiện hữu của dự án.
  3. Không tự ý cài đặt thêm dependency nặng trừ khi đã ghi rõ trong kế hoạch.
  4. Cập nhật trạng thái checklist `[x]` trong `.antigravity/implementation_plan.md` khi từng bước hoàn tất.

### Phase 3: Testing & Verification (Kiểm thử & Khắc phục)
- **Role:** QA Engineer & DevOps.
- **Execution Checklist:**
  1. **Static Analysis & Unit Tests:**
     - Chạy linter, typecheck và unit test suites:
       * *Node/React/TS:* `npm run lint`, `npm run typecheck`, `npm test`
       * *Python:* `pytest -v`, `mypy .`, `flake8`
     - Tất cả các lệnh trên phải trả về exit code `0`.
  2. **Browser & Visual Verification (áp dụng cho các tác vụ Web/UI):**
     - Khởi chạy development server trên local port (nếu chưa chạy).
     - Sử dụng Browser Sub-agent điều hướng đến localhost, thao tác đúng kịch bản (click, fill form, submit).
     - Chụp ảnh màn hình (screenshot) lưu vào thư mục `.antigravity/artifacts/` để làm minh chứng trạng thái UI hợp lệ.
     - Kiểm tra DevTools Console log để đảm bảo không phát sinh uncaught exception hay lỗi 500 từ API.
  3. **Self-Healing Loop (Vòng lặp tự sửa lỗi):**
     - Nếu phát sinh lỗi (test fail, console error, layout vỡ):
       * Đọc trực tiếp stack trace hoặc console error.
       * Tự động quay lại file mã nguồn để sửa lỗi.
       * Chạy lại test suite để xác minh.
     - **Giới hạn thử lại:** Tối đa 3 lần lặp. Nếu sau 3 lần vẫn lỗi, dừng lại và chuyển trạng thái sang báo cáo sự cố (Escalation).

### Phase 4: Handover & Reporting (Bàn giao)
- **Role:** Orchestrator.
- **Action:**
  1. Đóng dev server và dọn dẹp các tiến trình nền tạm thời.
  2. Xuất báo cáo tóm tắt ngắn gọn trong chat response:
     - Bảng tóm tắt các file đã thay đổi (`File`, `Action`, `Summary of changes`).
     - Kết quả test suites (số lượng test passed/failed).
     - Đính kèm hình ảnh screenshot hoặc trích dẫn log kiểm thử thành công.

---

## 3. Emergency & Guardrails
- **Cấm:** Không bao giờ chạy các lệnh xóa file hàng loạt nguy hiểm (`rm -rf *`, `git reset --hard`) mà không có sự xác nhận trực tiếp của người dùng.
- **Secret Protection:** Tuyệt đối không ghi thông tin nhạy cảm, API keys, JWT secret hay token vào source code hoặc git repository; luôn sử dụng biến môi trường (`.env`).
