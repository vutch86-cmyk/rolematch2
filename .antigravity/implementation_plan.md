# Kế Hoạch Triển Khai & Nhật Ký Thay Đổi Phần Mềm (Implementation Plan & Change Log)

> **Mục đích:** File này lưu trữ tập trung seluruh kế hoạch triển khai (`Implementation Plan`), danh sách các file bị ảnh hưởng (`Files Affected`), trạng thái hoàn thành (`Implementation Steps`) và kết quả kiểm thử (`Test & Verification`) cho các tính năng và thay đổi của dự án **RoleMatch 2**.

---

## Đợt 2 (2026-10-28): Đồng bộ tính năng Input URL trích xuất JD cho Tab "Nhà Tuyển Dụng"
- **Trạng thái:** `HOÀN THÀNH (COMPLETED)`
- **Nhánh (Branch):** `staging`
- **Commit:** `586733e` — `feat(recruiter): sync JD URL extraction UI, drag-drop, and Markdown preview with Candidate tab`

### 1. Objective (Mục tiêu)
Hoàn thiện và đồng bộ hóa trải nghiệm **Input URL trích xuất Mô tả công việc (JD)** trên tab **"Nhà tuyển dụng"** (`src/components/BatchProcessingTab.tsx`) để hoạt động và hiển thị tương tự 100% với tab **"Ứng viên"** (`src/components/InputSection.tsx`):
- Cho phép Nhà tuyển dụng dán đường link tin tuyển dụng (LinkedIn, ITviec, TopCV, VietnamWorks, CareerViet, Glints...) để AI tự động trích xuất nội dung JD chuẩn Markdown (kèm cơ chế **Popup Đăng nhập + 1-Click đọc Clipboard** khi trang yêu cầu xác thực).
- Đồng bộ hóa bố cục khu vực nhập JD ở tab **Nhà tuyển dụng** với tab **Ứng viên**:
  - Thanh công cụ nút bấm đồng nhất: nút **"Dán Link JD / Import Link"** (`JdUrlTriggerButton`) + nút **"Tải tệp / Upload"** + thanh chọn mẫu JD thử nghiệm nhanh (`React JD`, `AI JD`).
  - Khung nhập URL (`JdUrlExtractor`) kết nối đầy đủ callback xử lý lỗi (`onError`), hiển thị thông báo lỗi trực tiếp ngay phía trên ô JD và badge hiển thị nguồn JD (`File: {jdFileName}`).
  - Khung soạn thảo JD tích hợp thanh **Integrated Card Header Toolbar** (hiển thị tiêu đề, nút chuyển đổi `Văn bản gốc / Xem trước Markdown`, bộ đếm số ký tự `{jdText.length.toLocaleString()} ký tự`), hỗ trợ kéo-thả tệp JD trực tiếp và lớp phủ loading khi đang trích xuất.

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/components/BatchProcessingTab.tsx` | **Modified** | Đồng bộ khu vực `1. Mô tả công việc (JD)` của Nhà tuyển dụng tương tự `InputSection.tsx`: tích hợp đầy đủ `JdUrlTriggerButton`, `JdUrlExtractor` (kèm `onError` & thông báo lỗi tại chỗ), badge `FileCheck`, hỗ trợ kéo-thả tệp JD (`handleJdDrop`, `extractJdFileText`), thanh Header Toolbar đếm ký tự & chuyển đổi chế độ xem trước Markdown (`<Markdown>{jdText}</Markdown>`). |
| `src/components/InputSection.tsx` | **Modified** | Bổ sung callback `onError` vào `JdUrlExtractor` và đồng bộ chế độ xem trước Markdown (`jdViewMode`) cho ô JD để hai tab Ứng viên & Nhà tuyển dụng nhất quán 100%. |
| `src/utils/jdUrlExtractorHelpers.test.ts` | **Modified** | Mở rộng kịch bản kiểm thử tích hợp số 6 để xác nhận tính đồng bộ UI/Props giữa `BatchProcessingTab.tsx` và `InputSection.tsx`. |
| `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md` & `docs/RECRUITER_USER_GUIDE_EN.md` | **Verified** | Đảm bảo tài liệu hướng dẫn Nhà tuyển dụng (Tiếng Việt & Tiếng Anh) phản ánh chính xác giao diện và thao tác trích xuất JD từ URL. |

### 3. Implementation Steps (Các bước triển khai)
- [x] **Bước 1:** Cập nhật khu vực **1. Mô Tả Công Việc (JD)** trong `src/components/BatchProcessingTab.tsx` để đồng bộ hoàn toàn với tab Ứng viên (cụm nút `JdUrlTriggerButton` + `Upload`, tách hàng nút JD mẫu, kết nối `onError`, hỗ trợ kéo-thả tệp JD, và thanh Header Toolbar có chế độ xem trước Markdown).
- [x] **Bước 2:** Đồng bộ hóa `src/components/InputSection.tsx` để truyền `onError` cho `JdUrlExtractor` và hỗ trợ xem trước Markdown cho JD tương ứng.
- [x] **Bước 3:** Cập nhật bộ kiểm thử `src/utils/jdUrlExtractorHelpers.test.ts` để kiểm tra hợp đồng giao diện (UI contract) trên cả 2 tab **Ứng viên** và **Nhà tuyển dụng**.
- [x] **Bước 4:** Thực thi kiểm thử tự động (`node --experimental-strip-types --test src/utils/jdUrlExtractorHelpers.test.ts` đạt `6/6 PASS`) và đẩy thay đổi lên nhánh `staging`.

### 4. Test & Verification Strategy (Kết quả kiểm thử)
- **Command:** `node --experimental-strip-types --test src/utils/jdUrlExtractorHelpers.test.ts`
- **Kết quả:** Exit code `0` (`6/6 tests passed`, `0 failed`).

---

## Đợt 1 (2026-10-28): Tính năng trích xuất JD từ URL tuyển dụng & Popup đăng nhập (Recruiter + Candidate + Backend API)
- **Trạng thái:** `HOÀN THÀNH (COMPLETED)`
- **Nhánh (Branch):** `staging`
- **Commit:** `9cab0d6` — `feat(jd-url): add job URL JD extraction with login popup and clipboard AI cleaning for Recruiter and Candidate`

### 1. Objective (Mục tiêu)
Bổ sung tính năng cho phép người dùng dán đường link tin tuyển dụng (LinkedIn, ITviec, TopCV, VietnamWorks, CareerViet, Glints...) để hệ thống tự động trích xuất nội dung JD chuẩn Markdown thay vì chỉ tải lên file JD. Trường hợp trang tuyển dụng yêu cầu đăng nhập hoặc chặn bot (Auth Wall / Cloudflare), hệ thống hiển thị **Popup hướng dẫn + Mở cửa sổ đăng nhập trực tiếp** và hỗ trợ **1-Click đọc Clipboard & lọc nội dung JD bằng AI**.

### 2. Files Affected (Danh sách file tạo mới & sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/components/JdUrlExtractor.tsx` | **Created** | Component UI tái sử dụng gồm nút `JdUrlTriggerButton`, thanh nhập URL trực tuyến và Modal xử lý khi trang yêu cầu đăng nhập (`window.open` popup, nút thử lại tự động, nút 1-Click lấy JD từ Clipboard qua `navigator.clipboard.readText()`, và ô dán thủ công dự phòng). |
| `src/utils/jdUrlExtractorHelpers.ts` | **Created** | Bộ hàm xử lý logic trích xuất JD: kiểm tra URL hợp lệ & chống SSRF (`validatePublicJobUrl`), nhận diện cổng tuyển dụng (`detectJobSiteName`), trích xuất LinkedIn Job ID (`extractLinkedInJobId`), bóc tách `schema.org/JobPosting` JSON-LD (`extractJsonLdJobPosting`), phát hiện Auth Wall / Cloudflare (`isLikelyAuthOrBotWall`), và làm sạch văn bản copy từ Popup (`cleanJdTextHeuristically`). |
| `src/utils/jdUrlExtractorHelpers.test.ts` | **Created** | Bộ Unit & Integration Test tự động kiểm tra toàn bộ các hàm xử lý URL, chống SSRF, nhận diện màn hình đăng nhập, làm sạch văn bản Clipboard và hợp đồng tích hợp UI/Server. |
| `server.ts` | **Modified** | Bổ sung 2 API endpoints: `POST /api/extract-jd-from-url` (tải trang, ưu tiên LinkedIn Guest Job API & JSON-LD, nhận diện Auth Wall, làm sạch JD bằng AI/Heuristic) và `POST /api/clean-pasted-jd` (lọc sạch nội dung JD từ văn bản người dùng copy trong cửa sổ đăng nhập). |
| `src/components/InputSection.tsx` | **Modified** | Tích hợp tính năng **Dán Link JD / Import Link** vào khu vực nhập JD trên giao diện **Ứng viên (Candidate)**. |
| `src/components/BatchProcessingTab.tsx` | **Modified** | Tích hợp tính năng **Dán Link JD / Import Link** vào khu vực nhập JD trên giao diện **Nhà tuyển dụng (Recruiter)**. |
| `docs/*.md` | **Modified** | Cập nhật tài liệu hướng dẫn sử dụng cho Nhà tuyển dụng và Ứng viên (Tiếng Việt & Tiếng Anh). |

### 3. Implementation Steps (Các bước triển khai)
- [x] **Bước 1:** Xây dựng các hàm helper kiểm tra URL, chống SSRF, phân tích HTML/JSON-LD, nhận diện Auth Wall và làm sạch văn bản trong `src/utils/jdUrlExtractorHelpers.ts`.
- [x] **Bước 2:** Triển khai 2 endpoints `POST /api/extract-jd-from-url` và `POST /api/clean-pasted-jd` trong `server.ts`.
- [x] **Bước 3:** Xây dựng component `src/components/JdUrlExtractor.tsx` hỗ trợ mở cửa sổ đăng nhập (`window.open`) và trích xuất 1-chạm từ Clipboard.
- [x] **Bước 4:** Tích hợp vào giao diện Ứng viên (`InputSection.tsx`) và Nhà tuyển dụng (`BatchProcessingTab.tsx`), cập nhật tài liệu `docs/` và viết bộ kiểm thử `src/utils/jdUrlExtractorHelpers.test.ts`.
