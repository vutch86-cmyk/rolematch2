# Hướng dẫn sử dụng RoleMatch dành cho Nhà tuyển dụng

> **Mục tiêu:** giúp nhà tuyển dụng đọc đúng báo cáo phân tích AI và đưa ra quyết định có kiểm chứng.

## 1. RoleMatch hỗ trợ việc gì?

RoleMatch hỗ trợ nhà tuyển dụng:

- Phân tích nhiều CV theo cùng một mô tả công việc (JD).
- Xếp hạng các hồ sơ đã phân tích thành công.
- Tóm tắt mức độ phù hợp, điểm mạnh, khoảng trống và các nội dung cần xác minh.
- Lưu, mở lại và xuất kết quả phân tích mà không cần chạy lại AI.

AI là công cụ hỗ trợ sàng lọc và chuẩn bị phỏng vấn, không thay thế quyết định của nhà tuyển dụng hoặc hội đồng tuyển dụng.

## 2. Quy trình sử dụng nhanh

1. Chuyển sang chế độ **Nhà tuyển dụng / Recruiter**.
2. Cung cấp JD rõ ràng (dán trực tiếp, tải tệp, hoặc dùng nút **Dán Link JD / Import Link** để trích xuất tự động từ liên kết tuyển dụng; nếu trang yêu cầu đăng nhập như LinkedIn/ITviec, hệ thống sẽ mở cửa sổ đăng nhập và hỗ trợ lọc JD 1-chạm từ Clipboard) và tải lên các CV cần phân tích.
3. Chọn **Bắt Đầu Phân Tích / Start Analysis**.
4. Kiểm tra số hồ sơ thành công, lỗi và không có điểm hợp lệ.
5. Đọc tổng quan batch để hiểu phân bố kết quả.
6. Mở từng ứng viên để kiểm tra bằng chứng, khoảng trống và nghi ngờ chính.
7. Dùng các điểm cần xác minh để chuẩn bị phỏng vấn có cấu trúc.
8. Ghi nhận quyết định của con người và lý do; sau đó lưu batch hoặc xuất báo cáo.

## 3. Chuẩn bị dữ liệu trước khi phân tích

### 3.1. Chuẩn bị JD

JD càng rõ thì kết quả càng hữu ích. Trước khi tải lên, nên kiểm tra:

- Chức danh và phạm vi công việc có nhất quán hay không.
- Các yêu cầu bắt buộc có được tách khỏi tiêu chí “có thì tốt” hay không.
- Kinh nghiệm được mô tả bằng trách nhiệm, phạm vi và kết quả mong đợi, không chỉ bằng số năm.
- Kỹ năng, công cụ, ngành nghề và ngoại ngữ có thực sự cần thiết cho công việc hay không.
- JD không chứa tiêu chí phân biệt đối xử hoặc thông tin không liên quan đến năng lực thực hiện công việc.

Nếu JD quá rộng, quá ngắn hoặc có các yêu cầu mâu thuẫn, AI có thể tạo ra kết quả thiếu phân hóa hoặc khó giải thích.

### 3.2. Chuẩn bị CV

- Bảo đảm tệp có thể đọc được và không bị khóa hoặc hỏng.
- Với CV dạng scan, cần kiểm tra chất lượng nhận dạng văn bản.
- Tránh tải lên dữ liệu cá nhân nhạy cảm không cần thiết cho tuyển dụng.
- Nếu hệ thống báo lỗi xử lý, hãy kiểm tra lại định dạng và tải lại hồ sơ; lỗi hệ thống không phải là đánh giá tiêu cực về ứng viên.

## 4. Hiểu đúng điểm số và mức độ phù hợp

### 4.1. Bốn nhóm điểm

| Chỉ số | Ý nghĩa | Không nên suy diễn |
|---|---|---|
| **Overall Score** | Mức độ phù hợp tổng thể của CV đối với JD đang dùng, từ 0–100 | Không phải xác suất ứng viên sẽ thành công hoặc được tuyển |
| **Keyword Alignment** | Mức độ tương đồng về từ khóa, kỹ năng và thuật ngữ giữa CV với JD | Điểm thấp không luôn đồng nghĩa thiếu năng lực; CV có thể dùng từ đồng nghĩa hoặc cách diễn đạt khác |
| **Experience Fit** | Mức độ phù hợp về kinh nghiệm, trách nhiệm, ngành nghề và kết quả đã thể hiện | Không xác nhận tính trung thực của nội dung CV |
| **Skills Fit** | Mức độ phù hợp của kỹ năng chuyên môn và kỹ năng mềm được JD yêu cầu | Việc một kỹ năng xuất hiện trong CV chưa đủ chứng minh mức độ thành thạo |

**Overall Score** là điểm phù hợp tổng thể do AI đánh giá trực tiếp từ toàn bộ CV và JD. Điểm này không được tính bằng trung bình cộng của **Keyword Alignment**, **Experience Fit** và **Skills Fit**. Vì hệ thống hiện chưa áp dụng công thức trọng số cố định, nhà tuyển dụng cần đọc thêm bằng chứng phù hợp, yêu cầu còn thiếu và khuyến nghị AI trước khi ra quyết định.

### 4.2. Mức độ phù hợp

| Overall Score | Mức hiển thị | Cách sử dụng phù hợp |
|---:|---|---|
| 85–100 | **Phù hợp rất cao / Very High** | Ưu tiên đọc bằng chứng và kiểm tra các yêu cầu bắt buộc trước khi mời phỏng vấn |
| 70–84 | **Phù hợp cao / High** | Hồ sơ có nhiều tín hiệu phù hợp nhưng vẫn cần xem các khoảng trống cụ thể |
| 50–69 | **Phù hợp trung bình / Medium** | Cần đánh giá kỹ khả năng chuyển đổi kỹ năng và các tiêu chí còn thiếu |
| Dưới 50 | **Phù hợp thấp / Low** | Có nhiều chênh lệch với JD; chỉ giảm ưu tiên sau khi nhà tuyển dụng kiểm tra nguyên nhân |
| Không có điểm hợp lệ | **Chưa có dữ liệu / Not available** | Đọc thủ công hoặc xử lý/chạy lại; không coi là 0 điểm |

Điểm số chỉ có ý nghĩa trong bối cảnh của **chính JD và batch đang được phân tích**. Không so sánh trực tiếp điểm của hai ứng viên được chấm theo hai JD khác nhau.

### 4.3. Cách đọc chênh lệch giữa các điểm

- **Keyword cao, Experience thấp:** CV dùng đúng ngôn ngữ của JD nhưng bằng chứng về phạm vi công việc hoặc kết quả còn yếu.
- **Experience cao, Keyword thấp:** ứng viên có kinh nghiệm liên quan nhưng cách trình bày chưa bám thuật ngữ của JD; cần xem kỹ kỹ năng chuyển đổi.
- **Skills cao, Overall thấp:** kỹ năng phù hợp nhưng có thể thiếu yêu cầu khác như mức độ seniority, ngành nghề, kết quả hoặc tiêu chí bắt buộc.
- **Overall cao nhưng có yêu cầu rất quan trọng còn thiếu:** không nên tự động mời phỏng vấn; cần xác minh tiêu chí đó trước.

## 5. Đọc trang tổng quan của batch

### 5.1. Các số liệu tổng quan

Trang tổng quan hiển thị:

- Tổng số hồ sơ đã xử lý.
- Số hồ sơ được đề xuất phỏng vấn.
- Số hồ sơ cần xem xét thêm.
- Số hồ sơ không được ưu tiên.
- Số hồ sơ chưa có quyết định.
- Số hồ sơ xử lý thất bại.
- Điểm trung bình và điểm cao nhất trong các hồ sơ thành công có điểm hợp lệ.

Các tỷ lệ đề xuất và mức độ phù hợp được tính trên nhóm hồ sơ phân tích thành công. Vì vậy, trước khi đọc tỷ lệ, cần kiểm tra số hồ sơ lỗi hoặc không có điểm.

### 5.2. Biểu đồ phân bố đề xuất

Biểu đồ chia ứng viên thành bốn nhóm:

- **YES — Đề xuất phỏng vấn:** AI nhận thấy đủ tín hiệu để ưu tiên bước tiếp theo.
- **MAYBE — Cần xem xét và xác minh thêm:** có tiềm năng nhưng còn điểm quan trọng chưa rõ.
- **NO — Không ưu tiên:** mức phù hợp hiện tại thấp hơn các hồ sơ khác hoặc còn khoảng trống đáng kể.
- **Chưa có quyết định:** kết quả không có đủ dữ liệu quyết định.

Đây là đề xuất sàng lọc của AI, không phải quyết định tuyển dụng cuối cùng. Có thể chọn từng nhóm trên biểu đồ để lọc danh sách ứng viên.

### 5.3. Biểu đồ mức độ phù hợp

Biểu đồ cho biết batch đang tập trung ở nhóm Very High, High, Medium, Low hay chưa có điểm. Có thể dùng nó để kiểm tra chất lượng đầu vào:

- Nếu gần như tất cả hồ sơ đều Very High hoặc YES, JD có thể quá rộng hoặc chưa phân biệt rõ yêu cầu bắt buộc.
- Nếu gần như tất cả hồ sơ đều Low hoặc NO, JD có thể quá khắt khe, không đúng nguồn ứng viên hoặc batch không phù hợp với vị trí.
- Nếu nhiều hồ sơ không có dữ liệu, cần kiểm tra lỗi tệp, trích xuất nội dung hoặc quá trình phân tích.

### 5.4. Top 10 ứng viên

Biểu đồ Top 10 chỉ lấy các hồ sơ phân tích thành công và có Overall Score hợp lệ, sau đó xếp theo điểm giảm dần. Khi di chuột hoặc chọn một ứng viên, nhà tuyển dụng có thể xem thêm mức phù hợp và các điểm thành phần.

Thứ hạng là công cụ ưu tiên đọc hồ sơ, không phải thứ tự tuyển dụng tự động. Khi lưu batch, thứ hạng tại thời điểm lưu được giữ lại để mở lại mà không cần chạy AI.

## 6. Đọc báo cáo chi tiết của một ứng viên

Nên đọc theo thứ tự từ A đến F. Chế độ mở rộng giúp tăng không gian hiển thị khi cần đọc báo cáo dài.

### A. Tóm tắt tổng quan / Executive Summary

Phần này gồm tên ứng viên, thứ hạng, Overall Score, mức độ phù hợp, đề xuất AI và lý do đề xuất.

Hãy dùng phần A để phân luồng nhanh, sau đó tiếp tục kiểm tra phần C, E và F trước khi quyết định. Một câu lý do ngắn không thể thay thế bằng chứng chi tiết.

### B. Chi tiết điểm số / Score Breakdown

Phần này đặt Keyword Alignment, Experience Fit và Skills Fit cạnh nhau để giúp nhận ra điểm mạnh/yếu tương đối.

Khi một điểm lệch đáng kể so với hai điểm còn lại, hãy tìm nguyên nhân ở phần **JD Match Evidence & Gaps** và **Requirement Match**. Không tự suy ra năng lực thật chỉ từ độ cao của một cột điểm.

### C. Độ phù hợp JD và khoảng trống / JD Match Evidence & Gaps

Phần này gồm:

- **JD Match Strength:** tín hiệu hoặc bằng chứng nổi bật nhất cho thấy CV phù hợp với JD.
- **Unproven JD Requirements:** yêu cầu của JD mà AI chưa tìm thấy bằng chứng đủ rõ trong CV.

“Chưa có bằng chứng” không đồng nghĩa với “ứng viên không có năng lực”. Có ba khả năng thường gặp:

1. Ứng viên thực sự chưa có kinh nghiệm đó.
2. Ứng viên có kinh nghiệm nhưng không trình bày trong CV.
3. CV dùng cách diễn đạt khác khiến AI không nhận diện đầy đủ.

Do đó, mỗi khoảng trống quan trọng nên được chuyển thành câu hỏi xác minh thay vì kết luận loại ứng viên.

### D. Sàng lọc nhanh / Recruiter Quick Scan

Phần này mô phỏng góc nhìn đọc nhanh của nhà tuyển dụng:

- **Ấn tượng 10 giây đầu tiên.**
- **Điểm mạnh nổi bật khi đọc nhanh.**
- **Nghi ngờ chính.**
- **Yếu tố làm mất điểm nhanh nhất.**

Các mục trên phản ánh tín hiệu sàng lọc và chất lượng truyền đạt của CV. “Nghi ngờ” là giả thuyết cần kiểm chứng, không phải một sự thật đã được xác nhận.

### E. Yêu cầu và độ khớp / Requirement Match

Đây là phần quan trọng nhất để kiểm tra tính giải thích của kết quả. Mỗi dòng bao gồm:

- Yêu cầu trong JD.
- Mức độ quan trọng: **Rất quan trọng**, **Quan trọng** hoặc **Có lợi thế**.
- Bằng chứng tìm thấy trong CV.
- Khoảng trống hoặc nội dung cần làm rõ.
- Trạng thái: **Đã khớp**, **Cần bổ sung** hoặc **Còn thiếu**.

Nên đọc theo thứ tự ưu tiên:

1. **Rất quan trọng + Còn thiếu.**
2. **Rất quan trọng + Cần bổ sung.**
3. Chất lượng bằng chứng của các yêu cầu rất quan trọng đã khớp.
4. Các tiêu chí quan trọng và có lợi thế.

Hệ thống đưa các yêu cầu rất quan trọng còn thiếu lên trước và cho phép lọc theo trạng thái. Đừng chỉ kiểm tra xem một từ khóa có xuất hiện hay không; hãy đọc bằng chứng để xem ứng viên đã làm gì, ở phạm vi nào và tạo ra kết quả gì.

### F. Các điểm cần xác minh trong phỏng vấn / Interview Follow-up Points

Danh sách này được tổng hợp từ câu hỏi làm rõ, khoảng trống trong bảng yêu cầu và các điểm AI cho rằng cần cải thiện hoặc xác minh.

Hãy sử dụng chúng như câu hỏi phỏng vấn, không phải lời buộc tội. Một câu hỏi tốt nên yêu cầu ứng viên mô tả:

- Bối cảnh và mục tiêu.
- Vai trò và hành động cụ thể của chính họ.
- Công cụ hoặc phương pháp đã sử dụng.
- Phạm vi như quy mô đội nhóm, khách hàng, hệ thống hoặc ngân sách.
- Kết quả đo lường được và bài học rút ra.

Ví dụ: thay vì hỏi “Bạn không có kinh nghiệm quản lý đội nhóm đúng không?”, hãy hỏi “Bạn có thể mô tả một tình huống đã điều phối một nhóm, quy mô nhóm, trách nhiệm của bạn và kết quả đạt được không?”.

## 7. Đọc khuyến nghị YES, MAYBE và NO

| Khuyến nghị | Cách hiểu | Hành động phù hợp |
|---|---|---|
| **YES** | Có tín hiệu phù hợp tương đối rõ | Kiểm tra yêu cầu bắt buộc và bằng chứng trước khi mời phỏng vấn |
| **MAYBE** | Có tiềm năng nhưng còn khoảng trống hoặc nghi ngờ quan trọng | Xác minh bằng screening call, câu hỏi bổ sung hoặc đọc CV thủ công |
| **NO** | Mức phù hợp hiện tại thấp hoặc có chênh lệch lớn | Xem lý do và bằng chứng; chỉ giảm ưu tiên sau khi con người xác nhận |
| **Không có quyết định** | AI không tạo được quyết định hợp lệ | Đánh giá thủ công hoặc chạy lại nếu phù hợp |

Không dùng YES như một sự bảo đảm và không dùng NO làm căn cứ duy nhất để loại hồ sơ.

## 8. So sánh ứng viên

Có thể chọn tối đa 3 ứng viên để so sánh. Bảng/biểu đồ so sánh gồm Overall, Keyword, Experience, Skills, mức phù hợp, khuyến nghị AI, điểm mạnh, nghi ngờ, yếu tố mất điểm và các yêu cầu JD chưa được chứng minh.

Khi so sánh:

- Chỉ so sánh ứng viên trong cùng một JD.
- Ưu tiên yêu cầu bắt buộc và chất lượng bằng chứng hơn chênh lệch vài điểm tổng.
- Một ứng viên có Overall thấp hơn vẫn có thể phù hợp hơn nếu chứng minh tốt tiêu chí không thể thương lượng.
- Ghi lại lý do con người chọn hoặc không chọn để quyết định có thể được kiểm tra lại.

## 9. Gợi ý quy trình ra quyết định

### Chuyển sang vòng tiếp theo

Có thể cân nhắc khi ứng viên là YES hoặc MAYBE mạnh, các yêu cầu rất quan trọng đã khớp bằng bằng chứng đáng tin cậy và không còn nghi ngờ nghiêm trọng chưa được xử lý.

### Giữ để xác minh

Phù hợp khi ứng viên có điểm tốt nhưng còn yêu cầu rất quan trọng ở trạng thái Cần bổ sung/Còn thiếu, hoặc Experience Fit chưa được chứng minh rõ. Dùng screening call hoặc phỏng vấn cấu trúc để làm rõ.

### Đánh giá thủ công

Bắt buộc với hồ sơ xử lý thất bại, không có điểm hợp lệ hoặc báo cáo thiếu dữ liệu quan trọng.

### Giảm ưu tiên

Chỉ nên thực hiện sau khi nhà tuyển dụng đã kiểm tra JD, lý do AI, bằng chứng CV và các yêu cầu bắt buộc. Không tự động loại chỉ vì điểm thấp hoặc khuyến nghị NO.

## 10. Lưu, mở lại và xuất báo cáo

- Chọn **Lưu đợt này / Save Current Batch** sau khi hoàn tất phân tích.
- Batch đã lưu chứa thông tin batch, thứ hạng, điểm số, toàn bộ phân tích và trạng thái xử lý.
- Khi mở lại trong **Đợt tuyển dụng đã lưu / Saved Batches**, hệ thống sử dụng kết quả đã lưu và không chạy lại AI.
- Chọn **Xuất Báo Cáo (Markdown) / Export Leaderboard (Markdown)** khi cần chia sẻ hoặc lưu trữ báo cáo.
- Dùng **Full Report** để mở báo cáo đầy đủ của một ứng viên.

Khi chia sẻ hoặc xuất báo cáo, cần tuân thủ chính sách bảo mật CV và chỉ cấp quyền cho người có trách nhiệm trong quy trình tuyển dụng.

## 11. Xử lý trạng thái bất thường

| Trạng thái | Ý nghĩa | Việc cần làm |
|---|---|---|
| **Completed** | Phân tích thành công và có điểm hợp lệ | Tiếp tục đọc bằng chứng và khoảng trống |
| **No Score** | Đã xử lý nhưng không có Overall Score hợp lệ; hồ sơ không được xếp hạng | Đọc thủ công, kiểm tra dữ liệu hoặc chạy lại |
| **Failed** | Lỗi trích xuất hoặc lỗi xử lý AI | Kiểm tra tệp, thử tải lại/chạy lại; tuyệt đối không xem đây là kết quả đánh giá ứng viên |
| **Not Available / Chưa có dữ liệu** | Chỉ số cụ thể không có dữ liệu hợp lệ | Không thay bằng 0; xác minh từ CV hoặc phỏng vấn |

## 12. Sử dụng AI có trách nhiệm

- Quyết định cuối cùng luôn do con người chịu trách nhiệm.
- Đánh giá mọi ứng viên theo cùng JD và cùng bộ tiêu chí liên quan đến công việc.
- Không sử dụng giới tính, tuổi, dân tộc, tôn giáo, khuyết tật, tình trạng hôn nhân, ảnh chân dung, địa chỉ hoặc thuộc tính nhạy cảm khác để ra quyết định.
- Xác minh các tuyên bố quan trọng bằng CV gốc, phỏng vấn, bài đánh giá phù hợp hoặc tham chiếu được phép.
- Nhận biết AI có thể sai hoặc bỏ sót do chất lượng JD, định dạng CV, lỗi trích xuất hay cách diễn đạt.
- Lưu lý do quyết định của nhà tuyển dụng, đặc biệt khi quyết định khác với khuyến nghị AI.
- Chỉ thu thập, lưu trữ và chia sẻ dữ liệu ứng viên cần thiết theo chính sách bảo mật của tổ chức.

## 13. Checklist trước khi đưa ra quyết định

- [ ] JD đã tách rõ yêu cầu bắt buộc và tiêu chí có lợi thế.
- [ ] Hồ sơ không ở trạng thái Failed hoặc No Score chưa được xử lý.
- [ ] Đã đọc bằng chứng, không chỉ nhìn Overall Score hoặc thứ hạng.
- [ ] Đã kiểm tra tất cả yêu cầu **Rất quan trọng + Còn thiếu/Cần bổ sung**.
- [ ] Đã phân biệt “không có bằng chứng trong CV” với “không có năng lực”.
- [ ] Các nghi ngờ quan trọng đã được chuyển thành câu hỏi xác minh trung lập.
- [ ] Ứng viên được so sánh theo cùng JD và cùng tiêu chí.
- [ ] Không sử dụng thuộc tính nhạy cảm hoặc thông tin không liên quan đến công việc.
- [ ] Quyết định cuối cùng và lý do của con người đã được ghi nhận.

## 14. Ví dụ đọc một báo cáo

Giả sử ứng viên có:

- Overall Score: 78 — Phù hợp cao.
- Keyword Alignment: 90.
- Experience Fit: 62.
- Skills Fit: 80.
- Khuyến nghị: MAYBE.
- Một yêu cầu rất quan trọng về quản lý đội nhóm đang ở trạng thái Cần bổ sung.

Cách đọc phù hợp:

1. CV dùng ngôn ngữ và kỹ năng khá sát JD.
2. Bằng chứng về kinh nghiệm thực thi hoặc kết quả chưa mạnh bằng mức khớp từ khóa.
3. Điểm 78 không xóa bỏ khoảng trống ở yêu cầu quản lý đội nhóm.
4. Nhà tuyển dụng nên đọc bằng chứng liên quan, sau đó hỏi về quy mô nhóm, vai trò trực tiếp, tình huống quản lý và kết quả.
5. Chỉ quyết định chuyển vòng sau khi đã xác minh tiêu chí bắt buộc đó.

## 15. Thuật ngữ ngắn

- **JD:** Mô tả công việc dùng làm chuẩn đối chiếu.
- **Batch:** Một đợt phân tích gồm một JD và nhiều CV.
- **Evidence:** Nội dung trong CV được AI dùng làm bằng chứng cho một yêu cầu.
- **Gap:** Yêu cầu chưa có hoặc chưa đủ bằng chứng trong CV.
- **Rank:** Thứ tự ưu tiên theo Overall Score trong cùng batch.
- **Recommendation:** Đề xuất sàng lọc YES/MAYBE/NO của AI, không phải quyết định cuối cùng.
