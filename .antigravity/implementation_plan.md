# Kế Hoạch Triển Khai & Nhật Ký Thay Đổi Phần Mềm (Implementation Plan & Change Log)

> **Mục đích:** File này lưu trữ tập trung toàn bộ kế hoạch triển khai (`Implementation Plan`), danh sách các file bị ảnh hưởng (`Files Affected`), trạng thái hoàn thành (`Implementation Steps`) và kết quả kiểm thử (`Test & Verification`) cho các tính năng và thay đổi của dự án **RoleMatch 2** sau khi đã được người dùng duyệt (`Approved`) để commit vào nhánh `staging`.

---

## Đợt 14 (2026-10-30): Triển khai PHASE 3 — Nâng Cấp Chiều Sâu Cho Module Nhà Tuyển Dụng (Recruiter Module 2.0)
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Triển khai trọn vẹn 3 trụ cột nâng cấp của **Phase 3: Nâng Cấp Chiều Sâu Cho Module Nhà Tuyển Dụng (Recruiter Module 2.0)** theo đúng lộ trình sản phẩm:
  1. **Tùy biến Trọng số Chấm điểm & Xếp hạng Động (Custom Scoring Weights & Recalculate Leaderboard):**
     - Cho phép HR tự do phân bổ tỷ trọng phần trăm giữa Từ khóa, Kỹ năng và Kinh nghiệm (hoặc chọn 3 preset mẫu: Cân bằng 33/34/33, Ưu tiên Kinh nghiệm 20/30/50, Ưu tiên Kỹ thuật 20/50/30, hoặc Custom).
     - Module `recruiterScoringHelpers.ts` tự động tính toán điểm có trọng số (`weightedScore`) và tái sắp xếp bảng xếp hạng tức thì mà không tốn thêm quota AI.
     - Tích hợp giao diện cấu hình chuyên nghiệp `ScoringWeightsKnockoutPanel.tsx` với các thanh trượt và nút chuẩn hóa 100%.
  2. **Tiêu chí Loại trực tiếp Minh bạch (Hard Knockout Criteria):**
     - Cho phép HR thiết lập ngưỡng điểm sàn tối thiểu (Overall, Skills, Experience) hoặc cờ bắt buộc đáp ứng các kỹ năng cốt lõi (`requireMustHaveSkills`).
     - Tự động gắn nhãn bị loại sàn (`isKnockedOut`) kèm lý do cụ thể (`knockoutReason`) và đưa xuống cuối bảng xếp hạng, bảo vệ tổ chức khỏi việc tuyển nhầm ứng viên thiếu kỹ năng sống còn.
  3. **Ma trận So sánh Chuyên sâu Top 5 & Bộ Kịch bản Phỏng vấn HR (Deep-Dive Comparison Matrix & HR Interview Kit):**
     - Mở rộng năng lực so sánh lên tới 5 ứng viên cùng lúc (nút nhanh *So sánh Top 3* và *So sánh Top 5*).
     - Component `DeepDiveComparisonMatrix.tsx` đối chiếu đa chiều: Biểu đồ thành phần 5 màu, bảng đối chiếu 7 trục sâu (Tầm vóc Seniority, Lợi thế nổi bật vs Mối e ngại lớn nhất của HR, Lỗ hổng JD).
     - Bộ kịch bản phỏng vấn thẩm định độc quyền cho HR: Tự động tổng hợp câu hỏi theo khoảng trống của từng ứng viên kèm checklist *"Điều HR cần nghe (What to listen for)"* và *"Cờ đỏ Red Flags cần cảnh giác"*.
     - Hỗ trợ xuất Báo Cáo So Sánh ra file Markdown (`.md`) hoặc sao chép 1-click vào clipboard (`recruiterComparisonExport.ts`).
  4. **Quản lý Pipeline Tuyển dụng, Bảng Kanban & Ghi chú Nội bộ (Hiring Pipeline & Internal Notes):**
     - Theo dõi vòng đời tuyển dụng của ứng viên qua 5 giai đoạn chuẩn hóa: `INBOX` (Mới nạp), `SHORTLIST` (Sơ tuyển), `INTERVIEW` (Phỏng vấn), `OFFER` (Đề nghị tuyển dụng), `REJECTED` (Từ chối).
     - Chuyển đổi linh hoạt 1-click giữa chế độ xem Bảng Xếp Hạng (Leaderboard) và Bảng Kanban 5 cột (`RecruiterKanbanBoard.tsx`).
     - Modal ghi chú nội bộ bảo mật (`CandidateNotesModal.tsx`): Đánh giá 1–5 sao (⭐), gắn nhãn phân loại (`Top Candidate`, `Tech Lead`, `Culture Fit`...), và ghi chép thẩm định nội bộ.
     - Xây dựng endpoint `PUT /api/recruiter/batches/:id` trên `server.ts` để đồng bộ tức thì mọi cập nhật pipeline, ghi chú, rating, tags, trọng số và knockout criteria vào Firestore và local snapshot cache.
  5. **Đồng bộ hóa Tài liệu Hướng Dẫn:**
     - Cập nhật `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md` và `docs/RECRUITER_USER_GUIDE_EN.md` với toàn bộ hướng dẫn sử dụng Phase 3.
     - Cập nhật `docs/ADMIN_TECHNICAL_GUIDE_VI.md` và `docs/ADMIN_TECHNICAL_GUIDE_EN.md` bổ sung endpoint `PUT /api/recruiter/batches/:id` và cấu trúc dữ liệu mở rộng.

### 2. Files Affected (Danh sách file tạo mới & sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/types.ts` | **Modified** | Định nghĩa `ScoringWeights`, `KnockoutCriteria`, `PipelineStage`, mở rộng `SavedBatchCandidate` (`pipelineStage`, `notes`, `rating`, `tags`, `weightedScore`, `isKnockedOut`, `knockoutReason`) và `RecruiterBatchSummary`. |
| `src/utils/recruiterScoringHelpers.ts` | **Created** | Module tính điểm có trọng số, đánh giá vi phạm tiêu chí knock-out và thuật toán tái xếp hạng leaderboard. |
| `src/utils/recruiterScoringHelpers.test.ts` | **Created** | Bộ 9 unit tests kiểm thử toàn diện thuật toán trọng số, knockout criteria và xếp hạng. |
| `src/utils/recruiterPipelineHelpers.ts` | **Created** | Module cấu hình 5 pipeline stages, thống kê ứng viên theo stage, preset tags và helper lọc pipeline. |
| `src/utils/recruiterPipelineHelpers.test.ts` | **Created** | Bộ 6 unit tests kiểm thử pipeline counts, phân loại stage và lọc danh sách. |
| `src/utils/recruiterComparisonExport.ts` | **Created** | Helper xuất Báo Cáo So Sánh Chuyên Sâu dạng Markdown đa chiều & tiện ích tải file. |
| `src/utils/recruiterComparisonExport.test.ts` | **Created** | Bộ 2 unit tests kiểm tra tính toàn vẹn và song ngữ Việt - Anh của báo cáo so sánh. |
| `src/components/ScoringWeightsKnockoutPanel.tsx` | **Created** | Giao diện điều khiển Trọng Số & Knock-out với thanh trượt và presets. |
| `src/components/CandidateNotesModal.tsx` | **Created** | Modal ghi chú nội bộ bảo mật cho HR, chấm sao 1-5, gắn nhãn tags và chọn stage. |
| `src/components/RecruiterKanbanBoard.tsx` | **Created** | Bảng Kanban Tuyển Dụng 5 cột trực quan với kéo chuyển và xem nhanh. |
| `src/components/DeepDiveComparisonMatrix.tsx` | **Created** | Ma trận so sánh chuyên sâu lên tới 5 ứng viên, biểu đồ 5 màu, bảng đối chiếu 7 trục và HR Interview Kit. |
| `src/components/BatchProcessingTab.tsx` | **Modified** | Tích hợp thanh tác vụ Recruiter 2.0, chuyển đổi Leaderboard/Kanban, bộ lọc pipeline, thẻ ứng viên cải tiến và đồng bộ snapshot tự động. |
| `src/components/SaveBatchModal.tsx` | **Modified** | Bổ sung lưu trữ cấu hình weights, knockoutCriteria, pipelineStage, notes, rating, tags vào snapshot đợt tuyển dụng. |
| `server.ts` | **Modified** | Hỗ trợ lưu trữ các trường Phase 3 vào Firestore và bổ sung endpoint `PUT /api/recruiter/batches/:id`. |
| `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md` | **Modified** | Cập nhật hướng dẫn sử dụng tính năng Phase 3 (Trọng số, Knockout, Pipeline, Kanban, So sánh 5 ứng viên và HR Kit). |
| `docs/RECRUITER_USER_GUIDE_EN.md` | **Modified** | Bản dịch tiếng Anh đồng bộ hướng dẫn Nhà tuyển dụng cho Phase 3. |
| `docs/ADMIN_TECHNICAL_GUIDE_VI.md` & `EN.md` | **Modified** | Bổ sung API `PUT /api/recruiter/batches/:id` và cấu trúc dữ liệu Phase 3. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Mở rộng kiểu dữ liệu trong `src/types.ts`.
- [x] **Bước 2:** Xây dựng `recruiterScoringHelpers.ts` và unit test `recruiterScoringHelpers.test.ts` (9/9 PASS).
- [x] **Bước 3:** Xây dựng `recruiterPipelineHelpers.ts` và unit test `recruiterPipelineHelpers.test.ts` (6/6 PASS).
- [x] **Bước 4:** Xây dựng `recruiterComparisonExport.ts` và unit test `recruiterComparisonExport.test.ts` (2/2 PASS).
- [x] **Bước 5:** Xây dựng 4 component giao diện Recruiter 2.0: `ScoringWeightsKnockoutPanel.tsx`, `CandidateNotesModal.tsx`, `RecruiterKanbanBoard.tsx`, `DeepDiveComparisonMatrix.tsx`.
- [x] **Bước 6:** Nâng cấp `BatchProcessingTab.tsx` và `SaveBatchModal.tsx` kết nối trọn vẹn luồng dữ liệu Recruiter 2.0.
- [x] **Bước 7:** Nâng cấp backend persistence và thêm endpoint `PUT /api/recruiter/batches/:id` trong `server.ts`.
- [x] **Bước 8:** Cập nhật tài liệu hướng dẫn nhà tuyển dụng (`docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md`, `docs/RECRUITER_USER_GUIDE_EN.md`) và tài liệu kỹ thuật admin.
- [x] **Bước 9:** Chạy kiểm thử chuỗi 3 lệnh tiêu chuẩn:
  * `npm run lint` (`tsc --noEmit`): Exit 0 (0 errors).
  * `npm test` (`vitest run`): Exit 0 (14/14 test suites, 108/108 tests passed).
  * `npm run build` (`vite build && esbuild`): Exit 0 (Frontend & Backend dist bundle build thành công).
- [x] **Bước 10:** Chạy cổng an toàn Cloudflare Security Audit Gate: PASS 100% (`validate-coverage-ledger.test.cjs` & `validate-findings.test.cjs`).

---

## Đợt 13 (2026-10-30): Triển khai PHASE 2 — Tiện Ích Hoàn Thiện Hồ Sơ & Đồng Bộ Đám Mây Cho Ứng Viên
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Triển khai trọn vẹn 3 trụ cột của **Phase 2: Tiện Ích Hoàn Thiện Hồ Sơ & Đồng Bộ Đám Mây Cho Ứng Viên** theo đúng lộ trình sản phẩm:
  1. **Chế độ Chấm điểm lại nhanh & So sánh Trước vs. Sau (Quick Re-evaluate / Before vs. After):**
     - Cho phép ứng viên sửa trực tiếp văn bản CV trong ô soạn thảo hoặc nạp bản CV gợi ý từ AI rồi bấm "Chấm điểm lại nhanh" với cùng JD.
     - Hiển thị bảng so sánh Trước vs. Sau: bước nhảy điểm tổng thể (Delta `+X%`), 4 trục điểm thành phần, danh sách Red Flags đã khắc phục (`resolvedRedFlags`), và các điểm mạnh mới bổ sung (`newStrengths`).
     - Cho phép lưu đè bản phân tích tối ưu vào màn hình chính và tự động gắn nhãn `Re-evaluated` trong lịch sử.
  2. **Bộ Tiện ích Xuất Báo Cáo Đa Định Dạng & Bản Nháp CV Chuẩn ATS:**
     - Tích hợp modal xuất tài liệu chuyên nghiệp (`ExportReportModal.tsx`) với nút "Xuất Báo Cáo" trên thanh công cụ.
     - Báo Cáo Toàn Diện (Senior HR Audit): Xuất Word (`.docx`), PDF (`.pdf`), hoặc Markdown (`.md`) bao gồm trọn vẹn cả 4 tabs.
     - Bản Nháp CV Tối Ưu: Xuất Word (`.docx`) chuẩn ATS 1 cột, PDF in ấn, hoặc Text (`.txt`).
  3. **Đồng bộ Lịch sử Phân tích lên Cloud Database (Cloud Sync):**
     - Xây dựng 5 endpoint `/api/candidate/history` (GET, POST, PUT, DELETE) trên `server.ts` với lưu trữ Firestore `candidate_history` và local cache `data/candidate_history.json`.
     - Tự động đồng bộ 2 chiều (`candidateHistoryHelpers.ts`): Tự hòa trộn lịch sử đám mây với `localStorage` khi đăng nhập, đẩy bản ghi mới/offline lên đám mây, fallback mượt mà khi mất mạng.
     - Nâng cấp `HistorySidebar.tsx`: Nút "Đồng bộ ngay", bộ lọc 4 nấc phân tầng điểm số (`≥80%`, `60–79%`, `<60%`), bộ lọc dropdown gom nhóm theo Công ty tuyển dụng, và huy hiệu `Cloud` / `Re-evaluated`.
  4. **Kiểm thử Bảo mật Cloudflare Security Audit Gate (`run-3`):**
     - Thực hiện kiểm thử an toàn các bề mặt thay đổi với `ATTACK-CLASSES.md`, `WEB-PROTOCOL-AND-AUTH.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`, và `CLIENT-SIDE.md`.
     - Chạy 2 script validator: `validate-findings.cjs` (PASS 0 findings) và `validate-coverage-ledger.cjs` (PASS 2 coverage units).

### 2. Files Affected (Danh sách file tạo mới & sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/types.ts` | **Modified** | Bổ sung các kiểu dữ liệu `ReEvaluationComparison`, `ReEvaluationScoreDelta`, `ExportDocumentType`, mở rộng `HistoryItem` (`updatedAt`, `isSynced`, `previousAnalysis`). |
| `server.ts` | **Modified** | Thêm 5 endpoint `/api/candidate/history` (GET, POST, PUT, DELETE), in-memory cache `candidateHistories`, local file `data/candidate_history.json`, và Firestore collection `candidate_history`. |
| `src/utils/quickReEvaluateHelpers.ts` | **Created** | Helper tính toán delta điểm số 4 trục, nhận diện Red Flags đã hóa giải và tiêu chí mới đáp ứng. |
| `src/utils/quickReEvaluateHelpers.test.ts` | **Created** | Bộ 4 unit tests kiểm tra tính chính xác và an toàn dữ liệu của helper chấm điểm lại. |
| `src/utils/candidateHistoryHelpers.ts` | **Created** | Helper quản lý hòa trộn dữ liệu local/cloud, gọi API đồng bộ, xóa, đổi tên lịch sử đám mây. |
| `src/utils/candidateHistoryHelpers.test.ts` | **Created** | Bộ 3 unit tests kiểm tra thuật toán hòa trộn (merge) và phát hiện bản ghi chưa đồng bộ. |
| `src/components/QuickReEvaluateModal.tsx` | **Created** | Giao diện Modal chấm điểm lại nhanh, chỉnh sửa văn bản CV, bảng so sánh Before vs. After trực quan. |
| `src/components/ExportReportModal.tsx` | **Created** | Giao diện Modal xuất tài liệu đa định dạng (Word .docx, PDF, Markdown, TXT) cho Báo cáo HR và Bản nháp CV ATS. |
| `src/components/HistorySidebar.tsx` | **Modified** | Bổ sung nút đồng bộ đám mây, bộ lọc theo phân tầng điểm số, dropdown lọc theo công ty, huy hiệu Cloud & Re-evaluated. |
| `src/App.tsx` | **Modified** | Kết nối luồng Cloud Sync tự động, nút "Chấm Điểm Lại", nút "Xuất Báo Cáo", tích hợp 2 Modal mới. |
| `src/utils/i18n.ts` | **Modified** | Bổ sung đầy đủ bộ thuật ngữ song ngữ Việt - Anh cho Phase 2 (`quickReEvaluate`, `exportReportModal`, `history`). |
| `docs/HUONG_DAN_SU_DUNG_CHO_UNG_VIEN.md` | **Modified** | Cập nhật hướng dẫn tính năng Chấm điểm lại nhanh, Trung tâm xuất báo cáo và Đồng bộ lịch sử đám mây. |
| `docs/CANDIDATE_USER_GUIDE_EN.md` | **Modified** | Bản dịch tiếng Anh đồng bộ 100% tài liệu hướng dẫn ứng viên. |
| `docs/ADMIN_TECHNICAL_GUIDE_VI.md` & `EN.md` | **Modified** | Bổ sung tài liệu cụm API `/api/candidate/history` và collection `candidate_history`. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Định nghĩa kiểu dữ liệu trong `src/types.ts` và xây dựng `candidateHistoryHelpers.ts` + `quickReEvaluateHelpers.ts`.
- [x] **Bước 2:** Triển khai bộ API `/api/candidate/history` trong `server.ts` với persistence Firestore và local cache file JSON.
- [x] **Bước 3:** Xây dựng 2 Modal giao diện `QuickReEvaluateModal.tsx` và `ExportReportModal.tsx`.
- [x] **Bước 4:** Nâng cấp `HistorySidebar.tsx` với bộ lọc Công ty, phân tầng điểm số, và huy hiệu Cloud Sync.
- [x] **Bước 5:** Tích hợp luồng Cloud Sync và các nút hành động mới trong `src/App.tsx`.
- [x] **Bước 6:** Cập nhật tài liệu hướng dẫn người dùng và quản trị trong `docs/`.
- [x] **Bước 7:** Chạy kiểm thử chuỗi 3 lệnh tiêu chuẩn:
  * `npm run lint` (`tsc --noEmit`): Exit 0 (0 errors).
  * `npm test` (`vitest run`): Exit 0 (11/11 test suites, 91/91 tests passed).
  * `npm run build` (`vite build && esbuild`): Exit 0 (Frontend & Backend dist bundle build thành công).
- [x] **Bước 8:** Chạy cổng an toàn Cloudflare Security Audit Gate (`run-3`): PASS 100% (0 findings, 2 coverage units valid).

---

## Đợt 12 (2026-10-30): Rà Soát & Cập Nhật Toàn Bộ Tài Liệu Hướng Dẫn (`docs/`) Đồng Bộ 100% với Codebase Bước 1.1 -> 1.4
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Sẵn sàng duyệt commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Tiếp thu yêu cầu rà soát và cập nhật toàn bộ tài liệu hướng dẫn người dùng và quản trị hệ thống trong thư mục `docs/` tương ứng với các thay đổi mã nguồn từ Bước 1.1 đến Bước 1.4:
  1. **Tài liệu Hướng dẫn Ứng viên (`HUONG_DAN_SU_DUNG_CHO_UNG_VIEN.md` & `CANDIDATE_USER_GUIDE_EN.md`):**
     - Đồng bộ quy trình 4 tab kết quả độc lập: Tab 1 `Góc Nhìn HR & Rủi Ro`, Tab 2 `Chỉ Số Khớp & Từ Khóa JD`, Tab 3 `Tối ưu & Viết lại CV`, Tab 4 `Cẩm Nang Phỏng Vấn (5–10 câu)`.
     - Cập nhật chi tiết Bước 1.1: Giải trình điểm số đa chiều (4 rationales), điểm tiềm năng sau tối ưu (`projectedOverallScore`), phân loại tiêu chí Bắt buộc (`Must-Have`) vs Điểm cộng (`Nice-to-Have`), vị trí chèn (`targetSection`) và câu mẫu gợi ý (`suggestedPhrasing`) kèm nút chép 1-Click.
     - Cập nhật chi tiết Bước 1.2: Tóm tắt mở đầu 2 bản may đo (50–200 từ, tối đa 250 từ cho Senior/Quản lý) kèm huy hiệu đếm từ động 4 phân tầng; đánh giá cấu trúc 4 phần CV với điểm hoàn thiện, nhận xét, đề xuất và mẫu câu tham khảo trực tiếp (chống bịa đặt); bullet points chuẩn STAR/XYZ với nhãn từ khóa JD và gợi ý số liệu.
     - Cập nhật chi tiết Bước 1.3: Đánh giá tầm vóc 4 trục (Cấp bậc, Quy mô dự án, Phạm vi lãnh đạo, Khớp ngành); Ma trận rủi ro hồ sơ & chiến lược hóa giải (Red Flags, e ngại HR, xử lý trên CV và phỏng vấn).
     - Bổ sung chương mới hoàn chỉnh cho Bước 1.4: Cẩm nang phỏng vấn thực chiến với bộ 5–10 câu hỏi xoáy sâu (3 nhóm danh mục), ý đồ sâu xa của Nhà tuyển dụng, khung trả lời STAR bám sát dữ liệu thật của CV và cạm bẫy cần tránh.
     - Cập nhật chuẩn hóa định dạng Lịch sử `[Company Name] - [Job Title]` kèm nút `✏️ Sửa tên`.
  2. **Tài liệu Hướng dẫn Nhà tuyển dụng (`HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md` & `RECRUITER_USER_GUIDE_EN.md`):**
     - Cập nhật hướng dẫn khai thác chế độ xem chi tiết ứng viên (Candidate Deep-Dive) với đầy đủ 4 tab phân tích.
     - Hướng dẫn thẩm định hồ sơ qua Đánh giá tầm vóc 4 trục và Ma trận rủi ro.
     - Hướng dẫn sử dụng Cẩm nang Phỏng vấn 5–10 câu STAR để xây dựng kịch bản phỏng vấn có cấu trúc cao, bám sát khoảng trống thực tế của ứng viên.
  3. **Tài liệu Kỹ thuật Quản trị (`ADMIN_TECHNICAL_GUIDE_VI.md` & `ADMIN_TECHNICAL_GUIDE_EN.md`):**
     - Đồng bộ schema response gồm 4 features (`feature1` đến `feature4`) và top-level metadata (`companyName`, `jobTitle`).
     - Cập nhật bảng thành phần kết quả, giải thích cấu trúc dữ liệu mới và nguyên tắc bảo vệ dữ liệu Grounded Anti-Hallucination.
  4. **Kiểm tra & Sửa lỗi kiểu dữ liệu:** Sửa tham số `false` thành `'vi'` trong test case 4 của `src/utils/interviewPrepHelpers.test.ts`, đưa `npm run lint` về 0 errors tuyệt đối.

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `docs/HUONG_DAN_SU_DUNG_CHO_UNG_VIEN.md` | **Modified** | Cập nhật cấu trúc 4 tab, Đánh giá tầm vóc 4 trục, Ma trận rủi ro, Giải trình điểm, Điểm tiềm năng, Tóm tắt 50–200 từ, Đánh giá cấu trúc 4 phần, và Cẩm nang phỏng vấn STAR. |
| `docs/CANDIDATE_USER_GUIDE_EN.md` | **Modified** | Bản dịch tiếng Anh chuyên nghiệp đồng bộ 100% với nội dung tiếng Việt của Hướng dẫn Ứng viên. |
| `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md` | **Modified** | Cập nhật hướng dẫn khai thác 4 tab chi tiết, thẩm định tầm vóc 4 trục, ma trận rủi ro và ứng dụng bộ câu hỏi STAR vào phỏng vấn. |
| `docs/RECRUITER_USER_GUIDE_EN.md` | **Modified** | Bản tiếng Anh đồng bộ hướng dẫn Nhà tuyển dụng. |
| `docs/ADMIN_TECHNICAL_GUIDE_VI.md` | **Modified** | Cập nhật response schema 4 features, bảng thành phần kết quả và nguyên tắc Grounded Anti-Hallucination. |
| `docs/ADMIN_TECHNICAL_GUIDE_EN.md` | **Modified** | Bản tiếng Anh đồng bộ tài liệu kiến trúc kỹ thuật admin/CTO. |
| `src/utils/interviewPrepHelpers.test.ts` | **Modified** | Sửa kiểu tham số `'vi'` trong `normalizeFeature4Data` giúp `tsc --noEmit` pass 0 lỗi. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Rà soát mã nguồn Bước 1.1 -> 1.4 và lập danh mục toàn bộ các cập nhật tính năng.
- [x] **Bước 2:** Cập nhật tài liệu Ứng viên tiếng Việt (`HUONG_DAN_SU_DUNG_CHO_UNG_VIEN.md`) và tiếng Anh (`CANDIDATE_USER_GUIDE_EN.md`).
- [x] **Bước 3:** Cập nhật tài liệu Nhà tuyển dụng tiếng Việt (`HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md`) và tiếng Anh (`RECRUITER_USER_GUIDE_EN.md`).
- [x] **Bước 4:** Cập nhật tài liệu Kỹ thuật Quản trị tiếng Việt (`ADMIN_TECHNICAL_GUIDE_VI.md`) và tiếng Anh (`ADMIN_TECHNICAL_GUIDE_EN.md`).
- [x] **Bước 5:** Khắc phục lỗi kiểu dữ liệu trong `src/utils/interviewPrepHelpers.test.ts`.
- [x] **Bước 6:** Chạy kiểm thử chuỗi 3 lệnh tiêu chuẩn:
  * `npm run lint` (`tsc --noEmit`): Exit 0 (0 errors).
  * `npm test` (`vitest run`): Exit 0 (9/9 test suites, 84/84 tests passed).
  * `npm run build` (`vite build && esbuild`): Exit 0 (Frontend & Backend dist bundle build thành công).
- [x] **Bước 7:** Chạy cổng an toàn Security Audit Gate: PASS 100%.

---

## Đợt 11 (2026-10-29): Triển khai Cơ chế Phân tầng Độ dài Tóm tắt Mở đầu (50–200 từ, tối đa 250 từ cho Senior/Quản lý) & Huy hiệu Đếm từ Động
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Tiếp thu phản hồi thực tế của người dùng về tình trạng đoạn tóm tắt mở đầu bị ngắn (< 50 từ) và nhu cầu mở rộng dung lượng linh hoạt cho hồ sơ cấp Senior / Quản lý:
  1. **Khung dung lượng linh hoạt 50–200 từ (tối đa 250 từ):** Nới lỏng giới hạn cứng 150 từ trước đó, cho phép các ứng viên giàu kinh nghiệm diễn đạt sâu sắc hơn mà không bị gò bó hoặc lấn chiếm diện tích phần Kinh nghiệm.
  2. **Huy hiệu đếm từ động 4 phân tầng trên giao diện:**
     - `< 50 từ`: Báo vàng hổ phách `X từ • Hơi ngắn (<50 từ)`.
     - `50 – 180 từ`: Báo xanh lá `X từ • Độ dài lý tưởng (50–180 từ)`.
     - `181 – 250 từ`: Báo xanh ngọc `X từ • Phù hợp Quản lý / Senior (181–250 từ)`.
     - `> 250 từ`: Báo cam `X từ • Hơi dài (>250 từ)`.
  3. **Ràng buộc cứng trong Gemini Schema & Prompt (`server.ts`):** Thêm thuộc tính `description` bắt buộc 50–200 từ cho trường `pitch` trong cả 2 bản Technical & Management, nâng cache key lên `phase1-step1.2-v2`.
  4. **Lớp bảo vệ dữ liệu tự động (`bulletRewriteHelpers.ts`):** Hàm `ensureSubstantivePitch()` tự động phát hiện các câu ngắn (< 50 từ) và bổ sung cam kết cùng phương pháp làm việc sát với công ty mục tiêu, nâng lên mức chuẩn 65–85 từ.

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/components/BulletPointRewriteTab.tsx` | **Modified** | Cập nhật huy hiệu đếm từ động với 4 dải phân tầng và mã màu tương ứng. |
| `src/utils/bulletRewriteHelpers.ts` | **Modified** | Thêm hàm `ensureSubstantivePitch()` tự động bảo vệ độ dài và cập nhật `normalizeFeature2Data`. |
| `src/utils/bulletRewriteHelpers.test.ts` | **Modified** | Thêm test case 6 kiểm tra việc đưa câu ngắn < 50 từ lên chuẩn 50–200 từ. |
| `src/utils/i18n.ts` | **Modified** | Cập nhật mô tả tóm tắt mở đầu sang khung 50–200 từ (cả tiếng Việt và tiếng Anh). |
| `server.ts` | **Modified** | Cập nhật schema description, prompt hướng dẫn AI và nâng cache key lên `phase1-step1.2-v2`. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Cập nhật helper `ensureSubstantivePitch` trong `bulletRewriteHelpers.ts`.
- [x] **Bước 2:** Cập nhật huy hiệu đếm từ phân tầng trong `BulletPointRewriteTab.tsx`.
- [x] **Bước 3:** Cập nhật schema description và prompt trong `server.ts` cùng cache version `phase1-step1.2-v2`.
- [x] **Bước 4:** Cập nhật bộ dịch thuật ngữ trong `i18n.ts`.
- [x] **Bước 5:** Bổ sung unit test 6 trong `bulletRewriteHelpers.test.ts`.
- [x] **Bước 6:** Chạy kiểm thử chuỗi 3 lệnh tiêu chuẩn:
  * `npm run lint` (`tsc --noEmit`): Exit 0 (0 errors).
  * `npm test` (`vitest run`): Exit 0 (7/7 test suites, 71/71 tests passed).
  * `npm run build` (`vite build && esbuild`): Exit 0 (Frontend & Backend dist bundle build thành công).
- [x] **Bước 7:** Chạy cổng an toàn Security Audit Gate: PASS 100% (0 findings, 2 coverage units valid).

---

## Đợt 10 (2026-10-29): Chuẩn hóa Thuật ngữ Tuyển dụng Chuẩn Văn phòng, Bổ sung Mẫu câu Tham khảo Grounded từ CV & Tinh chỉnh Tóm tắt 50–150 từ
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Tiếp thu phản hồi thực tế của người dùng đối với Bước 1.2 nhằm tăng tính chuyên nghiệp và khả năng ứng dụng thực tế của kết quả phân tích CV:
  1. **Chuẩn hóa bộ thuật ngữ chuyên nghiệp (Corporate HR):** Thay thế các từ ví von đời thường ("May đo", "Khám bệnh") thành ngôn ngữ tuyển dụng chuẩn mực văn phòng:
     - "Tóm Tắt Hồ Sơ Định Vị Theo Vị Trí" (Targeted Professional Summary).
     - "Đánh Giá Cấu Trúc Từng Phần CV" (Section-by-Section Structural Review).
     - "ĐỀ XUẤT ĐIỀU CHỈNH:" (thay vì Hướng khắc phục).
     - "Độ hoàn thiện" (thay vì Điểm hoàn thiện).
     - Trạng thái thẻ: `Tốt (Đạt chuẩn)`, `Cần cải thiện`, `Cần bổ sung gấp`.
  2. **Bổ sung 1–2 mẫu câu tham khảo trực tiếp (Suggested Snippets):** Dưới mỗi phần Đề xuất điều chỉnh, hệ thống cung cấp 1–2 mẫu câu văn viết sẵn sát ngữ cảnh kèm nút sao chép một chạm để ứng viên có thể chèn trực tiếp vào CV.
  3. **Nguyên tắc chống bịa đặt (Anti-Hallucination Guard):** Thiết lập chỉ dẫn nghiêm ngặt trong AI prompt và backend schema: *BẮT BUỘC phải dựa trên thông tin thực tế từ CV của ứng viên (kinh nghiệm, kỹ năng, dự án sẵn có), TUYỆT ĐỐI KHÔNG tự ý sáng tạo hay bịa đặt kinh nghiệm/kỹ năng/số liệu ngoài CV*.
  4. **Dung lượng Tóm tắt mở đầu chuẩn 50–150 từ:** Nâng cấp bộ đếm từ và prompt hướng dẫn sinh đoạn mở đầu hoàn chỉnh (50–150 từ, khoảng 3–4 câu substantive) định vị năng lực thực tế của ứng viên với vị trí và công ty mục tiêu.

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/types.ts` | **Modified** | Bổ sung trường `suggestedSnippets?: string[]` vào interface `SectionAuditItem`. |
| `src/utils/i18n.ts` | **Modified** | Cập nhật bộ từ ngữ chuyên nghiệp và nhãn đa ngữ cho suggested snippets, word counter, độ hoàn thiện. |
| `src/components/BulletPointRewriteTab.tsx` | **Modified** | Cập nhật tiêu đề, bộ đếm từ 50–150 từ, hiển thị hộp mẫu câu tham khảo kèm nút copy 1 chạm độc lập. |
| `src/utils/bulletRewriteHelpers.ts` | **Modified** | Cấu hình nhãn trạng thái mới, tóm tắt dự phòng 50–150 từ, logic fallback cho 1–2 mẫu câu tham khảo từ CV. |
| `src/utils/bulletRewriteHelpers.test.ts` | **Modified** | Cập nhật bộ 5 tests kiểm tra contract schema và suggested snippets (pass 100%). |
| `src/utils/exportMarkdown.ts` | **Modified** | Đồng bộ định dạng xuất Markdown bao gồm các mẫu câu tham khảo từ CV. |
| `server.ts` | **Modified** | Cập nhật Gemini response schema, prompt chống bịa đặt thông tin và fallback generator. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Cập nhật kiểu dữ liệu TypeScript trong `src/types.ts` và backend schema trong `server.ts`.
- [x] **Bước 2:** Cập nhật helper `bulletRewriteHelpers.ts` và bộ dịch thuật ngữ `i18n.ts`.
- [x] **Bước 3:** Nâng cấp giao diện `BulletPointRewriteTab.tsx` hỗ trợ sao chép mẫu câu tham khảo và đếm từ 50–150 từ.
- [x] **Bước 4:** Cập nhật file xuất báo cáo `exportMarkdown.ts`.
- [x] **Bước 5:** Bổ sung ràng buộc nghiêm ngặt trong AI prompt của `server.ts` ngăn chặn bịa đặt kinh nghiệm.
- [x] **Bước 6:** Chạy kiểm thử chuỗi 3 lệnh tiêu chuẩn:
  * `npm run lint` (`tsc --noEmit`): Exit 0 (0 errors).
  * `npm test` (`vitest run`): Exit 0 (7/7 test suites, 70/70 tests passed).
  * `npm run build` (`vite build && esbuild`): Exit 0 (Frontend & Backend dist bundle build thành công).
- [x] **Bước 7:** Chạy cổng an toàn Security Audit Gate: PASS 100% (0 findings, 2 coverage units valid).

---

## Đợt 9 (2026-10-29): Khắc phục Triệt để Lỗi Google Cloud Build pack build & Bổ sung Cổng Kiểm tra Lint/Test/Build Toàn diện
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Phân tích và khắc phục triệt để các nguyên nhân gốc rễ khiến Google Cloud Buildpack (`gcr.io/k8s-skaffold/pack`) báo lỗi `step exited with non-zero status: 1` sau khi merge vào nhánh `main`.
- **Nguyên nhân 1 (`server.ts` TS2304 / ReferenceError):** Sửa lỗi khai báo biến không tồn tại `extractedJobTitle`, `extractedCompanyName` trong `createFallbackAnalysis` và unescaped template variables `${companyName}`, `${jobTitle}` trong `buildPrompt`.
- **Nguyên nhân 2 (`package.json` Build Dependency):** Chuyển `esbuild` từ `devDependencies` sang `dependencies` để Google Cloud Buildpack khi cài đặt ở chế độ `NODE_ENV=production` vẫn luôn có sẵn `esbuild` để thực thi script build backend.
- **Nguyên nhân 3 (`tsc --noEmit` Typecheck Failure):** Sửa lỗi type cast tại `CandidateGuideDrawer.tsx` và `RecruiterGuideDrawer.tsx`, đưa `npm run lint` về trạng thái `0 errors` tuyệt đối.
- **Nguyên nhân 4 (`vitest run` Test Suite Discovery):** Đồng bộ các file test tiện ích trong `src/utils/` sang `import { test } from 'vitest'` và cấu hình loại trừ `.antigravity/**` trong `vite.config.ts`, giúp `npm test` chạy thông suốt 70/70 tests (7 test suites).

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `server.ts` | **Modified** | Loại bỏ `extractedJobTitle` và `extractedCompanyName` không xác định; đổi `${companyName} - ${jobTitle}` thành chuỗi an toàn `"[Company Name] - [Job Title]"`. |
| `package.json` | **Modified** | Chuyển `esbuild: ^0.25.0` sang `dependencies` phục vụ production buildpack. |
| `src/components/CandidateGuideDrawer.tsx` | **Modified** | Ép kiểu `HTMLElement[]` giải quyết triệt để lỗi TS2322 và TS2339. |
| `src/components/RecruiterGuideDrawer.tsx` | **Modified** | Ép kiểu `HTMLElement[]` giải quyết triệt để lỗi TS2322 và TS2339. |
| `vite.config.ts` | **Modified** | Cấu hình `test: { exclude: ['**/node_modules/**', '**/.antigravity/**'] }`. |
| `src/utils/*.test.ts` | **Modified** | Cập nhật 4 file test sang `import { test } from 'vitest'` để tương thích 100% với `npm test`. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Sửa lỗi biến và template interpolation trong `server.ts`.
- [x] **Bước 2:** Chuyển `esbuild` vào `dependencies` trong `package.json`.
- [x] **Bước 3:** Khắc phục lỗi kiểu dữ liệu tại 2 Drawer components.
- [x] **Bước 4:** Đồng bộ runner `vitest` trong `vite.config.ts` và các file test.
- [x] **Bước 5:** Chạy kiểm thử chuỗi 3 lệnh tiêu chuẩn:
  * `npm run lint` (`tsc --noEmit`): Exit 0 (0 errors).
  * `npm test` (`vitest run`): Exit 0 (7/7 test files passed, 70/70 tests passed).
  * `npm run build` (`vite build && esbuild`): Exit 0 (Frontend & Backend dist bundle build thành công).
- [x] **Bước 6:** Chạy cổng an toàn Security Audit Gate: PASS 100% (0 findings, 2 units valid).

---

## Đợt 8 (2026-10-29): Triển khai Bước 1.2 — Audit Chi tiết Từng Mục CV & Viết sẵn Tóm tắt Mở đầu (Tab 2: BulletPointRewriteTab.tsx)
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Thực hiện trọn vẹn Bước 1.2 theo lộ trình `.antigravity/product_roadmap.md`: Nâng cấp Tab 2 (`BulletPointRewriteTab.tsx`) từ việc chỉ nhặt vài bullet lẻ tẻ thành công cụ khám bệnh cấu trúc hồ sơ toàn diện và cung cấp giải pháp viết lại may đo theo đúng JD của từng doanh nghiệp.
- **Trụ cột 1 — Viết sẵn Mở đầu CV May đo (Tailored Executive Pitch):** Tự động tạo 2 phiên bản mở đầu CV (3–4 câu) may đo theo `[Company Name] - [Vị trí ứng tuyển]` (Bản 1: Chuyên môn & Kỹ thuật sâu; Bản 2: Tác động Quản lý & Giá trị Kinh doanh), có nút Copy một chạm.
- **Trụ cột 2 — Khám bệnh Cấu trúc Từng Phần của CV (Section-by-Section CV Audit):** Chẩn đoán và chấm điểm (0–100), trạng thái (`Tốt` / `Cần cải thiện` / `Điểm yếu nghiêm trọng`), nhận xét thực trạng và hướng dẫn hành động cụ thể cho 4 phần trọng yếu: *Tóm tắt mở đầu*, *Kinh nghiệm làm việc*, *Cấu trúc Kỹ năng*, *Học vấn/Chứng chỉ & Định dạng chuẩn ATS*.
- **Trụ cột 3 — Nâng cấp Viết lại Bullet Point Chuẩn XYZ / STAR:** Mở rộng lên 5–8 bullet quan trọng nhất, hiển thị nhãn từ khóa JD đã lồng ghép (`embeddedKeywords`) và gợi ý chỗ điền số liệu định lượng thực tế (`metricPlaceholders`).
- Đồng bộ Backend AI Schema (`analysisResponseSchema`), Prompt hướng dẫn (`buildPrompt`), fallback generator và cache key (`phase1-step1.2-v1`) trong `server.ts`.
- Đồng bộ xuất báo cáo Markdown (`exportMarkdown.ts`) và dịch đa ngữ (`i18n.ts`).

### 2. Files Affected (Danh sách file tạo mới & sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `src/types.ts` | **Modified** | Định nghĩa các kiểu dữ liệu mới: `SectionAuditStatus`, `SectionAuditItem`, `SectionBySectionAudit`, `ExecutiveSummaryVersion`, `TailoredSummaryPitch`, và mở rộng `BulletRewriteItem` với `embeddedKeywords`, `metricPlaceholders`. |
| `src/utils/bulletRewriteHelpers.ts` | **Created** | Module helper chuẩn hóa dữ liệu (`normalizeFeature2Data`), suy luận dự phòng tóm tắt may đo (`inferTailoredSummaries`), khám bệnh cấu trúc (`inferSectionAudit`), và cấu hình màu sắc/nhãn (`getSectionStatusConfig`). |
| `src/utils/bulletRewriteHelpers.test.ts` | **Created** | Unit test và UI/Backend contract check toàn diện cho cả 3 trụ cột của Bước 1.2 (5 test cases, pass 100%). |
| `src/components/BulletPointRewriteTab.tsx` | **Modified** | Thiết kế lại giao diện hiện đại hiển thị đầy đủ 3 trụ cột: Banner tóm tắt mở đầu may đo với switcher 2 bản, lưới chẩn đoán 4 phần CV kèm thanh tiến độ điểm số, và bảng so sánh bullet point có nhãn từ khóa JD và gợi ý số liệu. |
| `src/App.tsx` | **Modified** | Truyền đầy đủ props `tailoredSummaries`, `sectionAudit`, `companyName`, `jobTitle`, `cvText`, `jdText` vào `BulletPointRewriteTab`. |
| `server.ts` | **Modified** | Nâng cấp `analysisResponseSchema` bổ sung schema cho `tailoredSummaries`, `sectionAudit`, `embeddedKeywords`, `metricPlaceholders`; nâng cấp prompt hướng dẫn AI; cập nhật `createFallbackAnalysis` và cache version `phase1-step1.2-v1`. |
| `src/utils/exportMarkdown.ts` | **Modified** | Cập nhật báo cáo Markdown tải về bao gồm cả 2 bản tóm tắt may đo và bảng khám bệnh 4 mục CV. |
| `src/utils/i18n.ts` | **Modified** | Bổ sung các bản dịch tiếng Việt và tiếng Anh cho tiêu đề, nhãn trạng thái và nút sao chép của Tab 2. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Định nghĩa schema và kiểu dữ liệu TypeScript trong `src/types.ts` và `server.ts`.
- [x] **Bước 2:** Xây dựng module helper `bulletRewriteHelpers.ts` và bộ unit test `bulletRewriteHelpers.test.ts`.
- [x] **Bước 3:** Cập nhật prompt tiếng Việt và tiếng Anh trong `server.ts` cùng fallback generator và cache version.
- [x] **Bước 4:** Nâng cấp UI component `BulletPointRewriteTab.tsx` và kết nối trong `src/App.tsx`.
- [x] **Bước 5:** Cập nhật `exportMarkdown.ts` và `i18n.ts`.
- [x] **Bước 6:** Chạy kiểm thử: `bulletRewriteHelpers.test.ts` (5/5 PASS), `keywordMatchHelpers.test.ts` (4/4 PASS), `jdTitleExtractor.test.ts` & `jdUrlExtractorHelpers.test.ts` (11/11 PASS).
- [x] **Bước 7:** Build kiểm tra: `vite build` (Exit code 0) & `esbuild server.ts` (Exit code 0).
- [x] **Bước 8:** Cổng bảo mật Security Audit Gate (`validate-findings.cjs` & `validate-coverage-ledger.cjs`): PASS 100% (0 confirmed vulnerabilities, 2 coverage units valid).

---

## Đợt 7 (2026-10-29): Tích hợp Cloudflare Security Audit Skill & Thiết lập Cổng Security Audit Gate cho rolematch2
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Nhập toàn bộ skill kiểm thử bảo mật chuyên sâu của Cloudflare (`security-audit`) vào repo tại `.antigravity/skills/security-audit/`.
- Thiết lập quy tắc định tuyến tự động tại `.antigravity/security-audit-routing.md` để chỉ chọn đúng companion file phù hợp với diff thay đổi (ví dụ: frontend dùng `CLIENT-SIDE.md`, tránh tốn token quét toàn bộ).
- Cập nhật `.antigravity/rules.md` với chốt chặn **Security Audit Gate** ở Phase 3 (bắt buộc trước khi xin duyệt commit `staging`).
- Vá lỗi tương thích Windows trên 2 validator Node.js (`validate-findings.cjs` và `validate-coverage-ledger.cjs`) hỗ trợ môi trường không có hằng số POSIX `O_NOFOLLOW | O_NONBLOCK`.
- Thực hiện chạy thử nghiệm quy trình audit thực tế trên các file frontend (`KeywordMatchTab.tsx`, `keywordMatchHelpers.ts`, `exportMarkdown.ts`, `i18n.ts`, `types.ts`) đạt kết quả PASS (0 confirmed vulnerabilities, 3 coverage units valid, 1 findings valid).

### 2. Files Affected (Danh sách file tạo mới & sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `.antigravity/rules.md` | **Modified** | Bổ sung mục 3 "Security Audit Gate" vào Phase 3 và cập nhật báo cáo bàn giao Phase 4. |
| `.antigravity/security-audit-routing.md` | **Created** | Bảng định tuyến diff thay đổi sang companion file kiểm thử bảo mật tương ứng và tiêu chuẩn pass/fail. |
| `.antigravity/skills/security-audit/*` | **Created** | Bộ skill Cloudflare Security Audit đầy đủ (SKILL.md, các companion markdown, report-schema.json, và 2 validator CJS đã vá tương thích Windows). |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Sao chép toàn bộ bộ skill bảo mật Cloudflare vào `.antigravity/skills/security-audit/`.
- [x] **Bước 2:** Xây dựng file định tuyến `.antigravity/security-audit-routing.md` và cập nhật `.antigravity/rules.md`.
- [x] **Bước 3:** Cập nhật hàm `readFileWithinLimit` trong 2 file validator để hỗ trợ kiểm tra symlink trên Windows.
- [x] **Bước 4:** Chạy kiểm thử xác thực cả 2 validator `validate-coverage-ledger.cjs` (3 units valid) và `validate-findings.cjs` (1 findings valid) đạt `PASS 100%`.

---

## Đợt 6 (2026-10-29): Khắc phục lỗi unescaped backticks trong `server.ts` làm gãy Google Cloud Build (PR #5) & Bổ sung Build/Syntax Guard Test
- **Trạng thái:** `HOÀN THÀNH (COMPLETED) — Approved to commit staging`
- **Nhánh (Branch):** `staging`

### 1. Objective (Mục tiêu)
- Sửa lỗi cú pháp unescaped backticks bên trong template literals `auditorPrompt` (dòng 6065–6066) và `synthesizerPrompt` (dòng 6195–6197) trong `server.ts` khiến `esbuild server.ts` và Google Cloud Buildpack (`Step #0 - "Buildpack"`) báo lỗi `exit status 1`.
- Chuẩn hóa đường dẫn import kiểu trong `src/utils/keywordMatchHelpers.ts` (`from '../types'`).
- Bổ sung chốt chặn kiểm tra cú pháp tự động (`module.stripTypeScriptTypes`) trong `src/utils/keywordMatchHelpers.test.ts` để tự động phát hiện mọi lỗi cú pháp TypeScript/template string trên `server.ts` trước khi commit.

### 2. Files Affected (Danh sách file sửa đổi)

| File | Hành động | Mô tả chi tiết |
| :--- | :--- | :--- |
| `server.ts` | **Modified** | Thay toàn bộ các dấu backtick nội bộ (`isMustHave`, `targetSection`, `suggestedPhrasing`...) tại dòng 6065–6066 và 6195–6197 bằng dấu nháy đơn (`'isMustHave'`, `'targetSection'`...) bên trong template literals. |
| `src/utils/keywordMatchHelpers.ts` | **Modified** | Chuẩn hóa `import type { ... } from '../types';` đồng nhất với toàn bộ codebase. |
| `src/utils/keywordMatchHelpers.test.ts` | **Modified** | Bổ sung **Permanent Build & Syntax Guard** dùng `module.stripTypeScriptTypes` kiểm tra cú pháp toàn bộ `server.ts`, `src/utils/exportMarkdown.ts` và `src/utils/i18n.ts`. |

### 3. Implementation Steps & Test Results
- [x] **Bước 1:** Thay thế unescaped backticks trong `auditorPrompt` và `synthesizerPrompt` tại `server.ts`.
- [x] **Bước 2:** Đồng bộ import trong `src/utils/keywordMatchHelpers.ts` và bổ sung Syntax Guard trong `src/utils/keywordMatchHelpers.test.ts`.
- [x] **Bước 3:** Chạy bộ kiểm thử tự động `node --experimental-strip-types --test src/utils/keywordMatchHelpers.test.ts src/utils/jdTitleExtractor.test.ts src/utils/jdUrlExtractorHelpers.test.ts` đạt `15/15 PASS` (`exit code 0`).

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
