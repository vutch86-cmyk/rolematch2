# Hướng Dẫn & Kịch Bản Điều Phối Buổi Thử Nghiệm Usability (Đợt 0: Prototype Sandbox)

> **Tài liệu tham chiếu:** `docs/USABILITY_TESTING_GUIDE.md`  
> **Phiên bản:** 1.0 (Tháng 11/2026 — Đã tinh chỉnh theo chuẩn User Research)  
> **Đối tượng tham gia:** Product Owner (PO) / Người thử nghiệm độc lập  
> **Mục tiêu:** Kiểm chứng 4 năng lực cốt lõi: **Hiểu đúng $\rightarrow$ Tìm đúng $\rightarrow$ Sửa đúng $\rightarrow$ Khôi phục được**, tuyệt đối không mớm lời hay chỉ sẵn vị trí nút bấm.

---

## 1. Nguyên Tắc Điều Phối (Facilitator Rules)

1. **Không giải thích thay giao diện:** Để PO tự tìm kiếm và thao tác. Nếu PO hỏi *"Bấm vào đâu?"*, hãy hỏi lại: *"Theo anh/chị thì trên màn hình chỗ nào sẽ giúp anh/chị làm việc này?"*.
2. **Tách hành vi người dùng khỏi xác nhận kỹ thuật:**
   - PO tập trung vào nhiệm vụ nghiệp vụ (hiểu, chọn, sửa).
   - Người quan sát (Facilitator) kiểm tra ngầm các tiêu chí kỹ thuật (văn bản khác không bị sửa nhầm, trạng thái state chính xác).
3. **Chuẩn bị trạng thái đầu vào (Starting States):**
   - Reset hoặc nạp đúng trạng thái trước khi giao câu hỏi cho từng nhóm nhiệm vụ. Thời gian chuẩn bị này không tính vào thời gian làm bài của PO.
4. **Phân loại vấn đề chuẩn xác:**
   - 🔴 **Blocker (Nghiêm trọng):** Sửa nhầm đoạn, mất dữ liệu, xuất file chứa placeholder chưa điền, hoặc không thể hoàn thành nhiệm vụ. (Chỉ cần xảy ra 1 lần là Blocker).
   - 🟡 **Friction (Gây vướng):** Hoàn thành được nhưng bối rối về nhãn, khó tìm thao tác, mất ngữ cảnh hoặc phải cần gợi ý.
   - 🟢 **Thông suốt:** Tự hoàn thành và hiểu đúng kết quả (Đọc kỹ đề xuất trên 10 giây được xem là sự thận trọng bình thường khi duyệt CV, không tính là lỗi).

---

## 2. Kịch Bản Chi Tiết & Bảng Đánh Giá 8 Nhiệm Vụ

### Nhóm 1: Đọc Hiểu & Định Hướng (Nhiệm vụ 1 – 3)
*Trạng thái đầu vào: Bấm nút `Reset` để đưa Sandbox về trạng thái kết quả ban đầu.*

#### Nhiệm vụ 1: Hiểu tổng quan
- **Câu giao nhiệm vụ:** *"Hồ sơ này cần cải thiện điều gì trước tiên?"*
- **Quan sát người dùng:**
  - Có nhận biết câu kết luận AI và 3 Quick Wins hay chỉ nhìn mỗi số điểm 78?
  - Có nhận ra khoảng trống 2 yêu cầu Cloud chưa được thể hiện không?
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

#### Nhiệm vụ 2: Thao tác Quick Win
- **Câu giao nhiệm vụ:** *"Hãy xử lý vấn đề quan trọng nhất mà hệ thống khuyến nghị."*
- **Quan sát người dùng:**
  - Bấm vào Quick Win nào trên Hero Card?
  - Khi màn hình cuộn xuống, có nhận ra đoạn CV đang highlight và thẻ đề xuất bên phải đang liên kết với nhau không?
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

#### Nhiệm vụ 3: Tra cứu trên Evidence Map
- **Câu giao nhiệm vụ:** *"Tìm một yêu cầu bắt buộc mà hồ sơ này chưa chứng minh được."*
- **Quan sát người dùng:**
  - Có dùng bộ lọc `Bắt buộc` / `Chưa thấy` hoặc chọn nhóm năng lực để xem căn cứ không?
  - Có phân biệt được "Chưa thấy bằng chứng trong CV" khác với "Ứng viên thiếu năng lực" không?
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

---

### Nhóm 2: Độ Chính Xác & Xử Lý Số Liệu (Nhiệm vụ 4 – 5)
*Trạng thái đầu vào: Đảm bảo các đề xuất đang ở trạng thái Chờ xử lý (`pending`).*

#### Nhiệm vụ 4: Kiểm chứng câu nguồn trùng nhau
- **Câu giao nhiệm vụ:** *"Chỉ sửa thành tích ở dự án thứ nhất (Fintech Corp), không chạm vào dự án thứ hai."*
- **Quan sát người dùng:** PO chọn đúng Quick Win 1 và hiểu đoạn nào sắp được sửa.
- **Xác nhận của người quan sát:** Kiểm tra đoạn thứ hai (E-commerce Retail) xem câu văn có được bảo toàn nguyên vẹn 100% không.
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

#### Nhiệm vụ 5: Tình huống "Không có số liệu"
- **Câu giao nhiệm vụ:** *"Bạn không nhớ con số tối ưu tải trang là bao nhiêu %. Hãy hoàn thiện câu một cách trung thực."*
- **Quan sát người dùng:**
  - Có tìm thấy lựa chọn `Tôi không có số liệu (Dùng câu định tính)` mà không cảm thấy bị ép phải bịa số không?
  - Câu mới áp dụng có sạch sẽ, không còn sót placeholder `[X%]` không?
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

---

### Nhóm 3: Kiểm Soát Văn Bản & An Toàn Dữ Liệu (Nhiệm vụ 6 – 8)

#### Nhiệm vụ 6: Sửa tay trực tiếp & Kháng ghi đè
*Trạng thái đầu vào: Đoạn nguồn Job 1 đang có đề xuất chờ duyệt.*
- **Câu giao nhiệm vụ:** *"Hãy tự sửa đoạn mô tả công việc này theo cách của bạn, rồi kiểm tra đề xuất AI liên quan còn phù hợp không."*
- **Quan sát người dùng:**
  - PO có tìm được cách tự sửa văn bản không?
  - Khi lưu sửa tay, PO có đọc và hiểu nhãn `Cần kiểm tra lại` (needs_review) cùng lý do cảnh báo không?
  - Có an tâm là AI không tự động ghi đè lên câu mình vừa sửa không?
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

#### Nhiệm vụ 7: Hoàn tác đa bước (Undo / Redo)
*Trạng thái đầu vào: Đã thực hiện ít nhất 2 thay đổi (VD: áp dụng 1 đề xuất + sửa tay 1 đoạn).*
- **Câu giao nhiệm vụ:** *"Hãy quay lại trước hai thay đổi vừa rồi, sau đó phục hồi lại một thay đổi."*
- **Quan sát người dùng:**
  - Có dùng nút Undo/Redo hoặc phím tắt `Ctrl + Z` / `Ctrl + Y` thuận lợi không?
  - Có tin tưởng là nội dung không bị mất chữ ngoài ý muốn không?
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

#### Nhiệm vụ 8: Xuất bản & Chặn Placeholder
*Trạng thái đầu vào: Bản nháp cố ý để sót 1 đoạn chứa placeholder `[X%]` chưa điền.*
- **Câu giao nhiệm vụ:** *"Hãy xuất bản CV để gửi đi ứng tuyển."*
- **Quan sát người dùng:**
  - Khi hệ thống chặn xuất, PO có hiểu lý do vì sao bị chặn không?
  - PO có nhìn thấy danh sách vị trí cụ thể và bấm nút `Đến sửa ➔` để nhảy đến đúng đoạn thiếu không?
- **Ghi nhận:** [ ] Thông suốt | [ ] Friction | [ ] Blocker — Thời gian: ____s — Ghi chú: ___________________

---

## 3. Hai Tình Huống Biên & Hướng Dẫn Thử Trên Điện Thoại Thật

### 3.1. Thử hai tình huống biên (Edge Cases)
1. **Bấm áp dụng lại:**
   - Sau khi PO đã áp dụng Quick Win 1, yêu cầu PO bấm lại vào Quick Win 1 trên Hero Card.
   - *Kỳ vọng:* Thẻ hiển thị rõ nhãn xanh *"Đề xuất này đã được áp dụng vào bản nháp"*, nút chèn bị khóa, không nhân đôi câu.
2. **Tải lại trang (F5):**
   - Giải thích rõ với PO: *Đây là tính năng lưu tạm phiên làm việc (Session Persistence) trên trình duyệt này để chống mất bài khi lỡ tay F5, chưa phải là tính năng đồng bộ đám mây vĩnh viễn*.
   - Cho PO bấm F5: Kiểm tra các câu đã sửa và dữ liệu đang gõ dở có được khôi phục nguyên vẹn không.

### 3.2. Kiểm tra trên điện thoại thật (Mobile Test)
1. **Kết nối:** Máy tính chạy dev server (`npm run dev`), điện thoại kết nối cùng mạng Wi-Fi và truy cập qua IP máy tính:
   `http://<IP_MÁY_TÍNH>:3000/?sandbox=google-ux` (Server RoleMatch đã cấu hình lắng nghe trên `0.0.0.0:3000`).
2. **Kiểm tra bàn phím:** Khi chạm vào ô nhập `[X%]`, bàn phím ảo bật lên có che mất nút `Áp dụng` không?
3. **Kiểm tra Bottom Sheet:** Cuộn ngón tay bên trong Sheet đề xuất có làm trang nền phía sau bị cuộn giật không? Đóng Sheet rồi mở lại, dữ liệu đang gõ dở có còn nguyên không?
