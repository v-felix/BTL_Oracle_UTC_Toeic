# Đối chiếu yêu cầu BTL Oracle UTC năm học 2026-2027

Nguồn: mục III “YÊU CẦU NỘI DUNG”, trang 2-3 của `De Thi Oracle UTC_CQ 2026.pdf`. Đề tài phù hợp số **21: Xây dựng cơ sở dữ liệu hệ thống website ôn luyện chứng chỉ tiếng Anh TOEIC cho sinh viên trường ĐHGTVT**.

| Mục | Điểm | Yêu cầu trong đề | Sản phẩm và cách kiểm chứng |
| --- | ---: | --- | --- |
| 1 | 0,5 | Giới thiệu đề tài; thực thể; quan hệ | Báo cáo mô tả người dùng, vai trò, đề, nhóm câu, câu hỏi, lựa chọn, lượt thi, đáp án, bài học, từ vựng, từ đã lưu, audit, thang điểm. ERD và các khóa ngoại phải khớp `database/01_schema.sql`. |
| 2 | 1,5 | Bảng, PK, liên kết, ràng buộc; **ít nhất 5 bản ghi mỗi bảng** | `01_schema.sql`, package `02_packages.sql`, dữ liệu seed; chạy Q17 trong `10_queries.sql`. Cần mọi bảng nghiệp vụ đều có `row_count>=5`, kể cả bảng vai trò, lượt thi, đáp án, từ đã lưu và audit. Kiểm tra PK/FK/CHECK/UNIQUE bằng metadata Oracle. |
| 3 | 1,5 | Cơ bản, lồng, nhóm, thống kê; **ít nhất 10 truy vấn** | `database/10_queries.sql` có **20** truy vấn được đánh số Q01-Q20, gồm JOIN, IN, NOT EXISTS, AVG/MIN/MAX/STDDEV, GROUP BY/HAVING, CTE, DENSE_RANK/LAG, CASE/NULLIF, view và hàm PL/SQL. Lưu kết quả chạy, giải thích ít nhất 10 truy vấn. |
| 4 | 4,5 | Instance: start/shutdown/read only/restricted; tablespace và datafile; segment/extent; người dùng/quyền/chức danh | `database/admin/00` đến `04`, file dọn `90`, và `docs/oracle-administration.md`. Trình diễn thủ công trong cửa sổ bảo trì. Ghi lại trước/sau và hoàn nguyên READ WRITE/ALLOWED. Không coi việc chỉ viết script là đã trình diễn. |
| 5 | 1,0 | Minh họa backup và recovery database | Data Pump `20`-`23` phục hồi schema vào `TOEIC_RESTORE`; RMAN `30` backup lạnh, `31` validate, `32` mẫu phục hồi vật lý NOARCHIVELOG. Nêu rõ phạm vi logic/vật lý và kết quả đã chạy thực tế. Nếu GV yêu cầu recovery vật lý toàn DB, thực hành trên instance/VM cách ly và bổ sung log, không dùng log Data Pump để nhận là đã restore cả database. |
| 6 | 1,0 | Ứng dụng web đơn giản kết nối Oracle, hiển thị và CRUD | React frontend + API kết nối Oracle. Demo đăng nhập/phân quyền, danh mục đề/câu hỏi/bài học/từ vựng, CRUD quản trị, làm bài có thời hạn, nộp/chấm điểm, xem lịch sử/kết quả. Kiểm chứng dữ liệu tồn tại trong Oracle thật. Đề không bắt buộc .NET, Java hay APEX; giữ React là phù hợp. |
| **Tổng** | **10,0** | | |

## Điều kiện hình thức và nộp bài

- Phần báo cáo có **tối thiểu 15 trang Word**; không dựa vào số trang của PDF đề thi hoặc chỉ số trang mã nguồn để thay thế.
- Có bìa, mục lục, giới thiệu, phân tích/ERD, thiết kế/DDL/dữ liệu, truy vấn, quản trị, backup/recovery, ứng dụng, kiểm thử, kết luận/tài liệu tham khảo và **bảng phân công từng thành viên**.
- Nhóm tối đa 5 sinh viên; một đề tài cho một nhóm và không trùng đề tài với nhóm khác. Nhóm tự xác nhận với giảng viên.
- Nộp bản mềm Word tập hợp vào Drive và chia sẻ cho giảng viên; in một quyển bản cứng cho nhóm và mang máy chạy Oracle để trình diễn.
- Hạn nộp file mềm: **trước ngày thi 3 ngày**. Chưa có lịch thi trong dữ liệu dự án nên không tự suy ra ngày hạn cụ thể.
- Đề nêu trừ điểm định dạng, thiếu phân công; có mức phạt cho nộp muộn/vi phạm nhóm. Đối chiếu trực tiếp PDF trước khi nộp.
- Mỗi sinh viên có thể được hỏi 1-3 câu về toàn bộ báo cáo; đề nêu trả lời được +1 và không trả lời được -2.

## Bảng phân công chờ nhóm bổ sung

Người dùng yêu cầu bổ sung thông tin sau. Các ô dưới đây cố ý để trống; chỉ ghi phần việc thực tế đã thực hiện của từng thành viên.

| STT | Họ và tên | MSSV | Nội dung phụ trách | Tỷ lệ đóng góp | Xác nhận |
| --- | --- | --- | --- | --- | --- |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

Lớp: __________. Giảng viên: __________. Ngày bảo vệ: __________.

## Checklist minh chứng trước khi nộp

- [ ] Bổ sung đầy đủ bìa và phân công; bỏ dòng thành viên không sử dụng.
- [ ] Bản Word được render kiểm tra hình thức và có tối thiểu 15 trang phần báo cáo.
- [ ] Chạy Q17, xác nhận đủ 5 dòng trở lên cho mọi bảng; không dùng `NUM_ROWS` thay `COUNT(*)`.
- [ ] Lưu log 20 truy vấn hoặc tối thiểu 10 truy vấn có đủ loại yêu cầu.
- [ ] Trình diễn/chụp kết quả quản trị và trạng thái hoàn nguyên.
- [ ] Backup và phục hồi có log, nêu rõ loại, mốc dữ liệu, giới hạn NOARCHIVELOG.
- [ ] Website kết nối Oracle thật; thử luồng người học và quản trị.
- [ ] Kiểm tra bản mềm, quyền chia sẻ Drive, bản in và hạn nộp theo lịch thi chính thức.

Checklist để người thực hiện đánh dấu theo bằng chứng, không tự đánh dấu hoàn thành dựa trên sự tồn tại của tệp.
