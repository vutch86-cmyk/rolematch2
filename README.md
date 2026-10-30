# RoleMatch - AI Resume Analysis & Matcher

RoleMatch 2 là hệ thống phân tích và khớp nối CV ứng viên với Mô tả công việc (JD) dựa trên trí tuệ nhân tạo.

## Hệ Thống Tài Liệu Dự Án (Project Documentation)

Hệ thống tài liệu của RoleMatch được duy trì trực tiếp dưới dạng "Documentation as Code" trong thư mục `docs/`:

1. **Hướng dẫn Ứng viên (Candidate User Guide):**
   - Tiếng Việt: `docs/HUONG_DAN_SU_DUNG_CHO_UNG_VIEN.md`
   - Tiếng Anh: `docs/CANDIDATE_USER_GUIDE_EN.md`
2. **Hướng dẫn Nhà tuyển dụng (Recruiter User Guide):**
   - Tiếng Việt: `docs/HUONG_DAN_SU_DUNG_CHO_NHA_TUYEN_DUNG.md`
   - Tiếng Anh: `docs/RECRUITER_USER_GUIDE_EN.md`
3. **Tài liệu Kỹ thuật Vận hành dành cho Admin & CTO:**
   - Tiếng Việt: `docs/ADMIN_TECHNICAL_GUIDE_VI.md`
   - Tiếng Anh: `docs/ADMIN_TECHNICAL_GUIDE_EN.md`
4. **Kiến trúc CI/CD & Mô hình Triển khai Production:**
   - Chi tiết: `docs/CICD_DEPLOYMENT_ARCHITECTURE.md`

- **Tích hợp UI**: Giao diện ứng dụng đóng gói trực tiếp nội dung các file Markdown này tại thời điểm build time (`import ... from '...md?raw'`) và hiển thị tương ứng theo ngôn ngữ giao diện (`vi` / `en`) qua trình đọc "Hướng dẫn sử dụng" / "User Guide".
- **Quy trình cập nhật**: Mọi thay đổi ảnh hưởng đến tính năng, thao tác người dùng hoặc kiến trúc hệ thống phải được cập nhật trực tiếp vào các file Markdown tương ứng trong `docs/` trong cùng commit/PR.
- **Đồng bộ giao diện**: Sau khi cập nhật file Markdown, cần chạy build (`npm run build`) và deploy lại ứng dụng để người dùng thấy phiên bản hướng dẫn mới trên giao diện.
