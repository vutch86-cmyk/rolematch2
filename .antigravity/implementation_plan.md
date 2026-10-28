# Kế Hoạch Triển Khai & Nhật Ký Thay Đổi Phần Mềm (Implementation Plan & Change Log)

> **Mục đích:** File này lưu trữ tập trung toàn bộ kế hoạch triển khai (`Implementation Plan`), danh sách các file bị ảnh hưởng (`Files Affected`), trạng thái hoàn thành (`Implementation Steps`) và kết quả kiểm thử (`Test & Verification`) cho các tính năng và thay đổi của dự án **RoleMatch 2** sau khi đã được người dùng duyệt (`Approved`) để commit vào nhánh `staging`.

---

## Đợt 5 (2026-10-28): Phase 1 - Bước 1.1: Giải trình Điểm số Đa chiều & Nâng cấp Bảng Đối chiếu Thực chiến (`KeywordMatchTab.tsx`)
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
Nâng cấp toàn diện chiều sâu phân tích tại **Tab 1 — Chỉ Số Khớp & Từ Khóa JD** (`src/components/KeywordMatchTab.tsx`) theo lộ trình `product_roadmap.md`:
1. **Giải trình Điểm số Đa chiều (`Score Breakdown & Rationale` + `projectedOverallScore`)**: Hiển thị lý do đạt điểm, yếu tố kéo điểm xuống dưới từng thanh chỉ số (`keywordRationale`, `skillRationale`, `experienceRationale`, `overallRationale`) và **Điểm tiềm năng sau tối ưu (`projectedOverallScore`)** (`X% ➔ Y% (+Z%)`).
2. **Phân tách Tiêu chí Bắt buộc (`Must-Have / Knock-out`) vs. Điểm cộng (`Nice-to-Have`)**: Đánh dấu rõ `isMustHave`, bổ sung thanh thống kê độ phủ tiêu chí Bắt buộc (`matchedMustHave / totalMustHave`) và bộ lọc nhanh theo nhóm tiêu chí.
3. **Nâng cấp Bảng Đối chiếu JD vs CV (`comparisonTable`) Thực chiến**: Bổ sung **Vị trí chèn đề xuất (`targetSection`)** và **Câu văn mẫu gợi ý chèn ngay (`suggestedPhrasing`)** kèm nút **Chép câu mẫu 1-Click**, đồng thời tương thích ngược 100% với lịch sử lưu trong `localStorage`.

### 2. Files Affected (Danh sách file tạo mới & sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/types.ts` | **Modified** | Mở rộng `JDKeyword` (`isMustHave`), `ComparisonRow` (`isMustHave`, `targetSection`, `suggestedPhrasing`) và `CompatibilityScores` (`projectedOverallScore`, `keywordRationale`, `skillRationale`, `experienceRationale`, `overallRationale`). |
| `src/utils/keywordMatchHelpers.ts` | **Created** | Bộ hàm chuẩn hóa dữ liệu `feature1` (`normalizeFeature1Data`, `enrichCompatibilityScores`, `resolveProjectedOverallScore`, `inferTargetSection`, `inferSuggestedPhrasing`) hỗ trợ đầy đủ cả kết quả AI mới lẫn bản ghi lịch sử cũ. |
| `server.ts` | **Modified** | Cập nhật `analysisResponseSchema`, `buildPrompt`, `runAuditorStep`, `runSynthesizerStep`, `createFallbackAnalysis` và nâng `analysisPromptVersion` lên `phase1-step1.1-v1`. |
| `src/components/KeywordMatchTab.tsx` | **Modified** | Hiển thị thẻ Điểm tiềm năng sau tối ưu, giải trình điểm số dưới 4 thanh chỉ số, thanh theo dõi & bộ lọc Must-Have vs Nice-to-Have, vị trí chèn (`targetSection`) và câu mẫu gợi ý (`suggestedPhrasing`) kèm nút Copy 1-Click. |
| `src/utils/i18n.ts` | **Modified** | Bổ sung nhãn song ngữ Việt - Anh (`vi` / `en`) cho các thành phần UI mới trong `keywordTab`. |
| `src/utils/exportMarkdown.ts` | **Modified** | Cập nhật `generateMarkdownReport` xuất kèm giải trình điểm số, điểm tiềm năng, phân loại Must-Have và câu văn mẫu gợi ý. |
| `src/utils/keywordMatchHelpers.test.ts` | **Created** | Bộ Unit & Contract Test kiểm thử toàn diện Bước 1.1. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Mở rộng interfaces trong `src/types.ts` và xây dựng `src/utils/keywordMatchHelpers.ts`.
- [x] **Bước 2:** Nâng cấp schema & prompt AI trong `server.ts` (`phase1-step1.1-v1`).
- [x] **Bước 3:** Nâng cấp giao diện `src/components/KeywordMatchTab.tsx`, `src/utils/i18n.ts` và `src/utils/exportMarkdown.ts`.
- [x] **Bước 4:** Chạy bộ kiểm thử tự động `node --experimental-strip-types --test src/utils/keywordMatchHelpers.test.ts src/utils/jdTitleExtractor.test.ts src/utils/jdUrlExtractorHelpers.test.ts` đạt `15/15 PASS` (`exit code 0`).

---

## Đợt 4 (2026-10-28): Khắc phục lỗi kẹt biến `currentRoleTitle` khi đổi link JD & Hiển thị cố định nút "Sửa tên" trong Lịch Sử Phân Tích
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Khắc phục triệt để lỗi biến `currentRoleTitle` trong `src/App.tsx` giữ lại tiêu đề của báo cáo cũ (`"Vị trí IT Roadmap & Strategy - ..."`) khi người dùng chuyển sang phân tích một đường link JD mới.
- Hiển thị cố định nút **`✏️ Sửa tên`** trên mỗi thẻ lịch sử trong `src/components/HistorySidebar.tsx` (loại bỏ `opacity-0` và `right-18` bị nhãn `[Đang xem]` che khuất).
- Bổ sung trích xuất trực tiếp `companyName` và `jobTitle` từ AI trong `server.ts` (`/api/analyze-cv`, `/api/extract-jd-from-url`, `/api/clean-pasted-jd`) và xóa bỏ đoạn code cũ ghép `Vị trí ${jdKeywords[0]} - ${username}`.

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/App.tsx` | **Modified** | Reset `currentRoleTitle` ngay khi nội dung `jdText` thay đổi; ưu tiên nhận `companyName` + `jobTitle` từ AI kết hợp `extractJobMetaFromJdText`; bổ sung `useEffect` chuẩn hóa lại lịch sử khi `currentUser` tải xong. |
| `src/components/HistorySidebar.tsx` | **Modified** | Đưa nút **`✏️ Sửa tên`** (có cả icon và chữ) + nút xóa ra thanh công cụ hiển thị cố định trên thẻ lịch sử, không bị nhãn `[Đang xem]` đè khuất; tự động gọi `enrichAndMigrateHistoryItem` khi hiển thị. |
| `src/utils/jdTitleExtractor.ts` | **Modified** | Mở rộng `isLegacyKeywordHistoryTitle` và `stripLegacyUsernameSuffix` nhận diện mọi tiêu đề bắt đầu bằng `"Vị trí ..."` hoặc bị kẹt tên chéo giữa các lần phân tích. |
| `server.ts` | **Modified** | Bổ sung `companyName` và `jobTitle` vào `analysisResponseSchema`, prompt phân tích CV và prompt trích xuất JD từ URL; xóa bỏ đoạn code ghép `Vị trí ${jdKeywords[0]} - ${username}`. |
| `src/types.ts` | **Modified** | Bổ sung `companyName?: string` và `jobTitle?: string` vào `CompleteCVAnalysisResponse`. |
| `src/utils/jdTitleExtractor.test.ts` | **Modified** | Bổ sung kiểm thử cho kịch bản sửa lỗi bản ghi bị kẹt tên chéo và kiểm tra hiển thị nút `"Sửa tên"` trên UI. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Reset `currentRoleTitle` khi đổi JD và tích hợp `companyName` + `jobTitle` từ AI (`server.ts`, `src/App.tsx`, `src/utils/jdTitleExtractor.ts`).
- [x] **Bước 2:** Thiết kế lại nút **`✏️ Sửa tên`** hiển thị rõ ràng, cố định trên từng thẻ lịch sử (`src/components/HistorySidebar.tsx`).
- [x] **Bước 3:** Chạy bộ kiểm thử tự động `node --experimental-strip-types --test src/utils/jdTitleExtractor.test.ts src/utils/jdUrlExtractorHelpers.test.ts` đạt `11/11 PASS` (`exit code 0`).

---

## Đợt 3 (2026-10-28): Chuẩn hóa Tên Hiển Thị & Thông Tin Công Ty / Vị Trí trong Lịch Sử Phân Tích Ứng Viên
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Phương án 1 đã duyệt`
- **Nhánh (Branch):** `staging`

### 1. Nguyên nhân hiện trạng & Mục tiêu (Root Cause & Objective)
- **Nguyên nhân hiện trạng:**
  - Trong `src/App.tsx` (dòng 352–367), khi ứng viên phân tích CV + JD tự tải lên hoặc dán link, biến `currentRoleTitle` đang rỗng (`''`).
  - Hệ thống lấy nhầm từ khóa kỹ năng đầu tiên (`data.feature1.jdKeywords[0].keyword`, ví dụ: `"IT roadmap"`, `"ITIL standards..."`) ghép vào chữ `"Vị trí "` và nối thêm hậu tố `- <username>` (`- vuta`), tạo ra những tên vô nghĩa như **`Vị trí IT roadmap - vuta`**.
- **Mục tiêu cải tiến (Objective):**
  - Chuẩn hóa định dạng tên hiển thị trong **Lịch Sử Phân Tích** (`HistorySidebar.tsx`) thành **`[Tên Công ty] - [Vị trí ứng tuyển]`** (hoặc **`[Vị trí ứng tuyển]`** nếu trong JD không nêu tên công ty), loại bỏ hậu tố `- <username>` dư thừa.
  - Tự động trích xuất chính xác `companyName` (Tên công ty) và `jobTitle` (Vị trí ứng tuyển) từ nội dung JD, kết quả AI, và link/tệp JD.
  - Hỗ trợ **đổi tên nhanh (Inline Rename)** ngay trên thẻ lịch sử để ứng viên tự gắn nhãn ghi nhớ (ví dụ: thêm mức lương, cơ sở làm việc) và **tự động nâng cấp (Auto-migrate)** các bản ghi lịch sử cũ đã lưu trong `localStorage`.

### 2. Các Phương Án Đề Xuất (Options to Approve)
1. **Phương án 1 (Khuyên dùng — Format `[Company Name] - [Vị trí ứng tuyển]` + Badge trực quan + Cho phép đổi tên nhanh):**
   - **Tiêu đề chính:** `[Company Name] - [Vị trí ứng tuyển]` (ví dụ: `FPT Software - Head of IT Infrastructure`). Nếu JD không có tên công ty thì hiển thị gọn `[Vị trí ứng tuyển]` (không ghép từ khóa kỹ năng, không ghép `- vuta`).
   - **Hiển thị trực quan trên thẻ History Card:** Hiển thị rõ badge `🏢 Công ty` và `💼 Vị trí` tách biệt, kết hợp nút **Đổi tên nhanh (`✏️`)** ngay trên thẻ để ứng viên có thể tự sửa tên gợi nhớ bất kỳ lúc nào.
   - **Tự động sửa lại (Auto-migrate) lịch sử cũ:** Tự động đọc lại `jdText` của các bản ghi cũ đang lưu trong máy (như 4 bản ghi trong ảnh chụp của bạn) để cập nhật lại đúng `Company + Vị trí ứng tuyển`.
2. **Phương án 2 (Cơ bản — Chỉ đổi chuỗi tiêu đề thành `[Company Name] - [Vị trí ứng tuyển]`):**
   - Giữ nguyên giao diện thẻ lịch sử hiện tại, chỉ sửa thuật toán trích xuất tên bản ghi thành `[Company Name] - [Vị trí ứng tuyển]` và tự động chuẩn hóa các bản ghi cũ trong `localStorage`.

### 3. Files Affected (Danh sách file dự kiến sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/utils/jdTitleExtractor.ts` | **Create** | Bộ hàm trích xuất thông minh `companyName` và `jobTitle` từ văn bản JD (`jdText`), nhãn nguồn file/URL (`jdFileName`), và chuẩn hóa các tiêu đề lịch sử cũ bị lỗi (`Vị trí <keyword> - <username>`). |
| `src/utils/jdTitleExtractor.test.ts` | **Create** | Bộ Unit Test kiểm thử trích xuất `Company Name` + `Job Title` trên nhiều định dạng JD tiếng Việt/tiếng Anh (LinkedIn, ITviec, TopCV, file PDF/DOCX) và kiểm thử auto-migration lịch sử cũ. |
| `src/types.ts` | **Modify** | Bổ sung các trường tùy chọn `companyName?: string` và `jobTitle?: string` vào `HistoryItem` và `CompleteCVAnalysisResponse`. |
| `src/App.tsx` | **Modify** | Thay thế logic đặt tên lịch sử cũ (`jdKeywords[0] - username`) bằng `formatCandidateHistoryTitle({ companyName, jobTitle })`, tự động migrate các bản ghi lịch sử cũ trong `localStorage`, và thêm hàm `handleRenameHistoryItem`. |
| `src/components/HistorySidebar.tsx` | **Modify** | Nâng cấp giao diện thẻ lịch sử hiển thị rõ `Company Name` + `Vị trí ứng tuyển`, hỗ trợ tìm kiếm theo tên công ty/vị trí và chỉnh sửa tên trực tiếp (nếu chọn Phương án 1). |

### 4. Implementation Steps (Các bước triển khai tuần tự)
- [x] **Bước 1:** Xây dựng tiện ích `src/utils/jdTitleExtractor.ts` để bóc tách chính xác `Company Name` + `Job Title` từ văn bản JD / URL / File và hàm nâng cấp các bản ghi lịch sử cũ.
- [x] **Bước 2:** Cập nhật `src/types.ts`, `src/components/InputSection.tsx` và `src/App.tsx` để lưu `companyName`, `jobTitle`, tạo tiêu đề chuẩn `[Company Name] - [Vị trí ứng tuyển]` và tự động sửa lại các bản ghi lịch sử cũ trong `localStorage`.
- [x] **Bước 3:** Cập nhật `src/components/HistorySidebar.tsx` để hiển thị rõ ràng `Company Name` + `Vị trí ứng tuyển` kèm badge Công ty/Vị trí và tính năng Đổi tên nhanh (`✏️`) trực tiếp trên thẻ lịch sử.
- [x] **Bước 4:** Viết và chạy bộ kiểm thử tự động `src/utils/jdTitleExtractor.test.ts` đảm bảo pass 100% (`exit code 0`).

### 5. Test & Verification Strategy (Chiến lược kiểm thử)
- Chạy `node --experimental-strip-types --test src/utils/jdTitleExtractor.test.ts` và `node --experimental-strip-types --test src/utils/jdUrlExtractorHelpers.test.ts` (đảm bảo exit code `0`).

---

## Đợt 2 (2026-10-28): Đồng bộ tính năng Input URL trích xuất JD cho Tab "Nhà Tuyển Dụng"
- **Trạng thái:** `HOÀN THÀNH (COMPLETED)`
- **Nhánh (Branch):** `staging`
- **Commit:** `586733e` — `feat(recruiter): sync JD URL extraction UI, drag-drop, and Markdown preview with Candidate tab`

### 1. Objective (Mục tiêu)
Hoàn thiện và đồng bộ hóa trải nghiệm **Input URL trích xuất Mô tả công việc (JD)** trên tab **"Nhà tuyển dụng"** (`src/components/BatchProcessingTab.tsx`) để hoạt động và hiển thị tương tự 100% với tab **"Ứng viên"** (`src/components/InputSection.tsx`).

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/components/BatchProcessingTab.tsx` | **Modified** | Đồng bộ khu vực `1. Mô tả công việc (JD)` của Nhà tuyển dụng tương tự `InputSection.tsx`: tích hợp đầy đủ `JdUrlTriggerButton`, `JdUrlExtractor` (kèm `onError` & thông báo lỗi tại chỗ), badge `FileCheck`, hỗ trợ kéo-thả tệp JD (`handleJdDrop`, `extractJdFileText`), thanh Header Toolbar đếm ký tự & chuyển đổi chế độ xem trước Markdown (`<Markdown>{jdText}</Markdown>`). |
| `src/components/InputSection.tsx` | **Modified** | Bổ sung callback `onError` vào `JdUrlExtractor` và đồng bộ chế độ xem trước Markdown (`jdViewMode`) cho ô JD để hai tab Ứng viên & Nhà tuyển dụng nhất quán 100%. |
| `src/utils/jdUrlExtractorHelpers.test.ts` | **Modified** | Mở rộng kịch bản kiểm thử tích hợp số 6 để xác nhận tính đồng bộ UI/Props giữa `BatchProcessingTab.tsx` và `InputSection.tsx`. |
| `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md` & `docs/RECRUITER_USER_GUIDE_EN.md` | **Verified** | Đảm bảo tài liệu hướng dẫn Nhà tuyển dụng (Tiếng Việt & Tiếng Anh) phản ánh chính xác giao diện và thao tác trích xuất JD từ URL. |

### 3. Implementation Steps (Các bước triển khai)
- [x] **Bước 1:** Cập nhật khu vực **1. Mô Tả Công Việc (JD)** trong `src/components/BatchProcessingTab.tsx` để đồng bộ hoàn toàn với tab Ứng viên.
- [x] **Bước 2:** Đồng bộ hóa `src/components/InputSection.tsx` để truyền `onError` cho `JdUrlExtractor` và hỗ trợ xem trước Markdown cho JD tương ứng.
- [x] **Bước 3:** Cập nhật bộ kiểm thử `src/utils/jdUrlExtractorHelpers.test.ts` để kiểm tra hợp đồng giao diện (UI contract) trên cả 2 tab **Ứng viên** và **Nhà tuyển dụng**.
- [x] **Bước 4:** Thực thi kiểm thử tự động (`node --experimental-strip-types --test src/utils/jdUrlExtractorHelpers.test.ts` đạt `6/6 PASS`) và đẩy thay đổi lên nhánh `staging`.

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
| `server.ts` | **Modified** | Bổ sung 2 API endpoints: `POST /api/extract-jd-from-url` và `POST /api/clean-pasted-jd`. |
| `src/components/InputSection.tsx` | **Modified** | Tích hợp tính năng **Dán Link JD / Import Link** vào khu vực nhập JD trên giao diện **Ứng viên (Candidate)**. |
| `src/components/BatchProcessingTab.tsx` | **Modified** | Tích hợp tính năng **Dán Link JD / Import Link** vào khu vực nhập JD trên giao diện **Nhà tuyển dụng (Recruiter)**. |
| `docs/*.md` | **Modified** | Cập nhật tài liệu hướng dẫn sử dụng cho Nhà tuyển dụng và Ứng viên (Tiếng Việt & Tiếng Anh). |
