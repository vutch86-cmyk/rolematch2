# RoleMatch2 - AI Resume Analysis & Matcher

RoleMatch2 là hệ thống phân tích và khớp nối CV ứng viên với Mô tả công việc (JD) dựa trên trí tuệ nhân tạo.

## Tài liệu Hướng dẫn Nhà tuyển dụng (Recruiter User Guide)

Tài liệu hướng dẫn dành cho Nhà tuyển dụng được duy trì trực tiếp dưới dạng "Documentation as Code":

- **Vị trí file nguồn**: `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md`
- **Tích hợp UI**: Giao diện ứng dụng đóng gói trực tiếp nội dung file Markdown này tại thời điểm build time (`import ... from '...md?raw'`) và hiển thị qua drawer "Hướng dẫn sử dụng" trong giao diện Nhà tuyển dụng.
- **Quy trình cập nhật**: Mọi thay đổi ảnh hưởng đến thao tác hoặc cách đọc báo cáo AI phải cập nhật trực tiếp file `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md` trong cùng commit/PR.
- **Đồng bộ giao diện**: Sau khi cập nhật file Markdown, cần chạy build (`npm run build`) và deploy lại ứng dụng để người dùng thấy phiên bản hướng dẫn mới trên giao diện.
