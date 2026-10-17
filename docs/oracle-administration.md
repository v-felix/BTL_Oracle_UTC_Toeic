# Kịch bản quản trị Oracle cho BTL TOEIC UTC

Tài liệu này phục vụ phần quản trị 4,5 điểm và minh họa backup/recovery 1 điểm. Các tệp trong `database/admin` là kịch bản trình diễn có điều kiện chạy, kết quả kỳ vọng và cách đưa hệ thống về trạng thái hoạt động. Việc có kịch bản không đồng nghĩa thao tác đã được chạy. Chỉ đưa log và ảnh của lần chạy thực tế vào mục kết quả báo cáo.

## 1. Môi trường đã xác minh bằng truy vấn chỉ đọc

Ngày kiểm tra: 17/10/2026, múi giờ Việt Nam. Kết nối cục bộ `sqlplus / as sysdba` hoạt động với tài khoản Windows hiện tại.

| Thuộc tính | Giá trị quan sát |
| --- | --- |
| Phiên bản mục tiêu | Oracle Database 19c |
| Instance / database | `orcl` / `ORCL` |
| Kết nối ứng dụng | `localhost:1521/orcl` |
| Kiến trúc hiện tại | Non-CDB (`CDB=NO`) |
| Chế độ hiện tại | `READ WRITE`, `NOARCHIVELOG` |
| Schema nghiệp vụ | `TOEIC_OWNER` |
| Tablespace nghiệp vụ dự kiến | `TOEIC_DATA` |
| Tài khoản web / role | `TOEIC_APP` / `TOEIC_RUNTIME` |
| Datafile gốc đã quan sát | `D:\UTC\2026_2027_1\CSDL_ORACLE\ORADATA\ORCL` |
| `DB_CREATE_FILE_DEST` / FRA | Chưa cấu hình giá trị |

Instance còn có datafile của các tablespace khác tại các ổ/path khác. Không suy luận rằng mọi datafile của ORCL đều nằm trong thư mục gốc ở trên. Chạy `00_inspect.sql` và RMAN `REPORT SCHEMA` trước khi lập kế hoạch sao lưu/phục hồi.

Từ thư mục dự án, mở SQL*Plus:

```powershell
sqlplus / as sysdba
```

Trong SQL*Plus:

```sql
@database/admin/00_inspect.sql
```

SQL*Plus dùng OS authentication cho quản trị. Website dùng tài khoản riêng có quyền nghiệp vụ, không dùng SYS/SYSTEM. Trước khi chụp log, kiểm tra tên database, DBID, đường dẫn và quyền tài khoản. Không chụp mật khẩu hoặc tệp cấu hình chứa secret.

## 2. Danh mục thực hành

| File | Thao tác | Ảnh hưởng | Hoàn nguyên |
| --- | --- | --- | --- |
| `00_inspect.sql` | Instance, tablespace, datafile, tài khoản, quyền | Chỉ đọc | Không cần |
| `01_instance_modes.sql` | NOMOUNT/MOUNT/OPEN, ba shutdown, read only, restricted session | Dừng toàn bộ ORCL nhiều lần | Kết thúc `OPEN READ WRITE`, `LOGINS=ALLOWED` |
| `02_tablespace_sandbox.sql` | Tạo/thêm file/resize/move/autoextend/read only tablespace | Chỉ tablespace demo riêng | Move về path đầu, read write; dọn bằng file 90 |
| `03_storage_segments_extents.sql` | Segment, extent, free space, thống kê bảng | Chỉ đọc | Không cần |
| `04_users_roles.sql` | User, role, profile, quota, grant/revoke, lock/unlock | Chỉ user demo | Dọn bằng file 90 |
| `20_datapump_prepare.sql` | Directory và schema/tablespace nhận phục hồi | Tạo đối tượng riêng | Dọn clone bằng file 91 |
| `21_datapump_export.par` | Logical backup schema | Tạo dump/log | Giữ backup; nguồn không bị sửa |
| `22_datapump_import.par` | Import sang `TOEIC_RESTORE` | Tạo clone, không ghi đè nguồn | Dọn clone bằng file 91 |
| `23_datapump_verify.sql` | So sánh count, trạng thái object | Chỉ đọc | Không cần |
| `30_rman_cold_backup.rman` | Backup vật lý nhất quán | Dừng ORCL trong cửa sổ bảo trì | Mở lại DB sau backup |
| `31_rman_validate.rman` | Preview và đọc kiểm tra backup | Không restore datafile | Không cần |
| `32_rman_restore.template.rman` | Mẫu phục hồi toàn DB | Ghi đè datafile nếu chủ động mở comment | Không có rollback; chỉ thực hành trên instance cách ly |
| `90_cleanup_sandbox.sql` | Drop user/role/profile/tablespace demo | Xóa dữ liệu demo | Tạo lại demo nếu cần |
| `91_cleanup_restore.sql` | Drop clone phục hồi | Xóa clone | Import lại từ dump |

Không chạy gộp toàn bộ thư mục admin trong trình cài đặt. Các thao tác shutdown/read only/restore/drop cần được người thực hành chủ động chạy trong môi trường phù hợp.

## 3. Quản lý instance

Đóng website, SQL Developer và các kết nối khác trước khi chạy file 01; chỉ giữ một phiên SYSDBA. File yêu cầu gõ đúng `RUN_INSTANCE_DEMO` rồi mới thay đổi trạng thái.

| Trạng thái | Thành phần mở | Minh chứng |
| --- | --- | --- |
| NOMOUNT | Đọc tham số, tạo SGA/background processes | `V$INSTANCE.STATUS=STARTED` |
| MOUNT | Mở controlfile, biết cấu trúc DB | `V$INSTANCE.STATUS=MOUNTED`, `V$DATABASE.OPEN_MODE=MOUNTED` |
| OPEN | Mở datafiles và online redo logs | `STATUS=OPEN`, `OPEN_MODE=READ WRITE` |

`SHUTDOWN NORMAL` đợi người dùng ngắt kết nối; `TRANSACTIONAL` đợi giao dịch hoàn tất; `IMMEDIATE` ngắt phiên và rollback giao dịch chưa commit. NORMAL/TRANSACTIONAL có thể chờ lâu nếu còn session. `ABORT` chỉ dành cho tình huống khẩn cấp; không cần thực thi để đáp ứng yêu cầu BTL. Sau ABORT, phải mở DB cho instance recovery hoàn thành, rồi shutdown sạch trước khi cold backup. Xem [Oracle 19c: starting and shutting down](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/starting-up-and-shutting-down.html).

READ ONLY được minh họa bằng `STARTUP MOUNT` rồi `ALTER DATABASE OPEN READ ONLY`; khởi động lại để trả READ WRITE. Restricted session được bật/tắt bằng `ALTER SYSTEM ENABLE/DISABLE RESTRICTED SESSION`. Bật restricted session không tự ngắt các phiên đã tồn tại. Xem [Oracle 19c: ALTER SYSTEM](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ALTER-SYSTEM.html).

Nếu bị ngắt giữa chừng, kiểm tra `V$INSTANCE` trước: instance idle thì `STARTUP`; đang MOUNT thì `ALTER DATABASE OPEN`; đang OPEN READ ONLY thì shutdown sạch và `STARTUP`; sau cùng `ALTER SYSTEM DISABLE RESTRICTED SESSION`. Nếu có lỗi datafile/controlfile, xử lý nguyên nhân trước, không dùng `STARTUP FORCE` để bỏ qua lỗi.

Minh chứng cần lưu: từng trạng thái STARTED/MOUNTED/OPEN; READ ONLY rồi READ WRITE; RESTRICTED rồi ALLOWED; log ba kiểu shutdown. File 01 có sẵn các truy vấn sau mỗi bước.

## 4. Tablespace, datafile và cấu trúc lưu trữ

Tạo trước hai thư mục vật lý bằng PowerShell; đảm bảo tài khoản chạy dịch vụ Oracle có quyền ghi:

```powershell
New-Item -ItemType Directory -Force -Path 'D:\UTC\2026_2027_1\CSDL_Oracle\ORADATA\ORCL\toeic_admin_demo\moved'
```

Chạy file 02 để tạo `TOEIC_ADMIN_DEMO`, tách khỏi `TOEIC_DATA`. File thêm datafile thứ hai, tăng kích thước file đầu, tắt/bật AUTOEXTEND và di chuyển file đầu bằng lệnh Oracle, sau đó di chuyển về vị trí cũ. `ALTER DATABASE MOVE DATAFILE` quản lý sao chép/chuyển file và cập nhật tham chiếu; cần chỗ trống cho thao tác. Không kéo datafile đang mở bằng Explorer. Xem [Oracle 19c: quản lý datafile](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-data-files-and-temp-files.html).

`RESIZE` là kích thước tuyệt đối; giảm xuống dưới vùng đã sử dụng có thể thất bại. `MAXSIZE` là giới hạn mở rộng, không phải dung lượng hiện dùng. Chụp `DBA_TABLESPACES`, `DBA_DATA_FILES` trước/sau các bước. File 02 còn minh họa READ ONLY/READ WRITE ở phạm vi tablespace. Xem [Oracle 19c: quản lý tablespace](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-tablespaces.html).

Chạy file 04 để tạo bảng sandbox 5 dòng, sau đó file 03 để truy vấn `DBA_SEGMENTS`, `DBA_EXTENTS`, `DBA_FREE_SPACE`. Một segment gồm các extent; một extent gồm các block liên tiếp trong một datafile. LOB và index cũng có segment riêng. Bảng trống có thể chưa có segment do deferred segment creation. `DBA_TABLES.NUM_ROWS` là số liệu thống kê, không đảm bảo bằng số dòng hiện tại; Q17 dùng `COUNT(*)` để kiểm chứng dữ liệu.

Sau trình diễn, file 90 chỉ xóa user/role/profile/tablespace demo và có kiểm tra trước khi drop tablespace. Không dùng file này cho các schema/tablespace nghiệp vụ.

## 5. Người dùng, role, privilege và profile

Ứng dụng tách hai tầng quyền: role nghiệp vụ trong `TOEIC_ROLES` quyết định chức năng người học/quản trị; Oracle role `TOEIC_RUNTIME` quyết định quyền truy cập database của tài khoản kết nối web. Đổi role nghiệp vụ không tự biến người dùng website thành SYSDBA.

File 04 tạo `TOEIC_DEMO_PROFILE`, `TOEIC_DEMO_READER`, `TOEIC_DEMO`. Nhập mật khẩu tại `ACCEPT ... HIDE`; không ghi mật khẩu vào script hay command line. User chỉ có `CREATE SESSION`, `CREATE TABLE`, quota 5 MB tại tablespace demo và quyền SELECT một view qua role. Không cấp `DBA`, `SELECT ANY TABLE` hoặc `UNLIMITED TABLESPACE` cho user demo/web.

Trong phiên TOEIC_DEMO riêng, `SELECT COUNT(*) FROM TOEIC_OWNER.VW_TOEIC_EXAM_SUMMARY` thành công; đọc `TOEIC_OWNER.TOEIC_USERS` bị từ chối do thiếu object privilege. Ghi rõ đây là lỗi kỳ vọng trong báo cáo. File có REVOKE/GRANT role và LOCK/UNLOCK user. Giới hạn mật khẩu thuộc profile được minh họa; giới hạn tài nguyên như SESSIONS_PER_USER còn phụ thuộc `RESOURCE_LIMIT`. Kịch bản không tự bật tham số toàn instance.

Minh chứng: `DBA_USERS`, `DBA_ROLE_PRIVS`, `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`, `DBA_TS_QUOTAS`, `DBA_PROFILES`. Xem [Oracle 19c: quản lý user và bảo mật tài nguyên](https://docs.oracle.com/en/database/oracle/oracle-database/19/dbseg/managing-security-for-oracle-database-users.html).

## 6. Data Pump: backup và phục hồi logic có thể trình diễn

Data Pump phục hồi schema/đối tượng; nó không thay thế backup vật lý dùng để cứu instance hỏng. Dùng tài khoản `TOEIC_BACKUP` chuyên biệt, được cấp `CREATE SESSION`, các role Data Pump và quyền directory. Không dùng tài khoản này cho website. Oracle khuyến cáo không chạy Export bằng SYSDBA trong công việc thông thường; SQL*Plus `/ as sysdba` vẫn dùng cho bước chuẩn bị quản trị. Xem [Oracle 19c: Data Pump Export](https://docs.oracle.com/en/database/oracle/oracle-database/19/sutil/oracle-data-pump-export-utility.html).

1. Tạm dừng ghi từ website để đối chiếu bản nguồn với clone tại cùng mốc. Tạo thư mục `.local\oracle-backup\datapump` có quyền ghi cho dịch vụ Oracle. Chạy file 20 bằng SYSDBA. Nếu môi trường bootstrap đã tạo directory/clone cùng tên, kiểm tra đường dẫn thực tế trước; không ghi đè cấu hình không khớp.
2. Chạy export dưới đây. Utility hỏi mật khẩu trực tiếp; không thêm `/password` vào lệnh. File parfile đặt `FLASHBACK_TIME=SYSTIMESTAMP` để lấy một ảnh chụp logic nhất quán; cần đủ undo cho thời gian export. File dump không bị ghi đè khi chạy lại, nên đổi tên cặp dump/log cho lần mới.
3. Import vào clone trống; đọc log và chạy file 23 để so sánh dữ liệu, object INVALID và source schema references. Sau khi kiểm chứng mới tiếp tục ghi trên website.

```powershell
expdp TOEIC_BACKUP@localhost:1521/orcl PARFILE=database/admin/21_datapump_export.par
impdp TOEIC_BACKUP@localhost:1521/orcl PARFILE=database/admin/22_datapump_import.par
```

```sql
-- Trong SQL*Plus / as sysdba
@database/admin/23_datapump_verify.sql
```

`REMAP_SCHEMA=TOEIC_OWNER:TOEIC_RESTORE` và `REMAP_TABLESPACE=TOEIC_DATA:TOEIC_RESTORE_DATA` tách clone khỏi nguồn. File import loại USER/GRANT metadata; clone không cần tài khoản đăng nhập. `TRANSFORM=OID:N` tạo OID mới cho đối tượng nếu có. Data Pump không tự thay được mọi chuỗi schema nằm trong PL/SQL/view; vì thế có kiểm tra reference sau import. Xem [Oracle 19c: Data Pump Import](https://docs.oracle.com/en/database/oracle/oracle-database/19/sutil/datapump-import-utility.html).

Thành công cần cả log utility không có lỗi chưa giải thích, count khớp khi nguồn không đổi, và package/views/triggers hợp lệ. Chỉ có file dump chưa đủ chứng minh đã phục hồi. Dùng file 91 nếu cần dọn clone, giữ dump/log làm minh chứng. Có thể khóa `TOEIC_BACKUP` sau khi hoàn tất bằng quản trị viên; mở lại có kiểm soát khi sao lưu lần tiếp theo.

## 7. RMAN với chế độ NOARCHIVELOG hiện tại

Trong NOARCHIVELOG, backup vật lý hợp lệ phải nhất quán: shutdown sạch rồi mount để backup. Không thể lấy backup toàn DB đang mở theo kiểu ARCHIVELOG. Bản phục hồi mất các giao dịch sau mốc backup vì không có archived redo để tiến tới hiện tại. Xem [Oracle 19c: RMAN backup concepts](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/rman-backup-concepts.html).

File 30 dùng OS authentication (`rman target /`), `SHUTDOWN IMMEDIATE`, `STARTUP MOUNT`, backup database/SPFILE/current controlfile vào tên có `%U`, sau đó mở DB. Không đổi chế độ archive của instance. Tạo thư mục `.local\oracle-backup\rman` trước, kiểm tra đủ dung lượng cho **toàn bộ database**, và chỉ chạy trong cửa sổ bảo trì vì mọi schema đều bị gián đoạn. Hướng dẫn chính thức: [Oracle 19c: cold backup NOARCHIVELOG](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/getting-started-rman.html).

```powershell
rman target / cmdfile=database/admin/30_rman_cold_backup.rman log=.local/oracle-backup/rman/cold-backup.log
rman target / cmdfile=database/admin/31_rman_validate.rman log=.local/oracle-backup/rman/validate.log
```

Lưu DBID, thời điểm checkpoint/mốc backup, toàn bộ log, tên từng backup piece và vị trí SPFILE/controlfile. Giữ một bản sao backup ở thiết bị/máy khác; bản sao cùng ổ với datafile không bảo vệ được lỗi mất ổ. `RESTORE ... VALIDATE` đọc và kiểm tra backup nhưng không ghi đè datafile, cũng không phải một lần khôi phục thực tế.

File 32 là mẫu **đã comment** để DBA chuẩn bị một instance cách ly. Không uncomment và chạy trên ORCL dùng chung để lấy ảnh bài tập. Khi dùng backup controlfile, quy trình mẫu gồm NOMOUNT, restore đúng controlfile cùng bộ cold backup, mount, restore database, `RECOVER DATABASE NOREDO`, rồi `OPEN RESETLOGS`. `NOREDO` không khôi phục các giao dịch vốn không được lưu trong backup/incremental. Xem [Oracle 19c: RECOVER, ví dụ NOARCHIVELOG](https://docs.oracle.com/en/database/oracle/oracle-database/19/rcmrf/RECOVER.html).

Phục hồi toàn DB ghi đè datafile, không có rollback SQL. Trên máy cách ly phải dựng đủ các đường dẫn đã được `REPORT SCHEMA` ghi lại hoặc lập bản đồ `SET NEWNAME` phù hợp, bảo toàn backup gốc, và kiểm tra DBID. Sau RESETLOGS cần một cold backup mới. Chỉ ghi “đã thực hiện restore/recovery vật lý” sau khi có log thật; nếu mới chạy validate, báo cáo đúng “đã backup/validate, restore vật lý là kịch bản đề xuất”. Data Pump clone cung cấp một minh họa phục hồi logic độc lập mà không dừng instance.

## 8. Bộ minh chứng đề nghị cho buổi bảo vệ

- ERD, DDL, PK/FK/CHECK/UNIQUE và kết quả count tối thiểu 5 dòng mỗi bảng.
- Log `10_queries.sql`, giải thích truy vấn cơ bản/join/lồng/nhóm/HAVING/thống kê/analytic.
- Log hoặc ảnh từng chế độ instance; trạng thái cuối READ WRITE và ALLOWED.
- Ảnh tablespace/datafile trước/sau thao tác và kết quả segment/extent.
- Quyền user/role/profile, một lệnh được phép và một lệnh bị từ chối.
- Dump/export log, import log, kết quả clone count/object validity; RMAN backup/validate log nếu đã chạy.
- Video/ảnh luồng web đăng nhập, CRUD, làm bài, lưu đáp án, nộp/chấm điểm và lịch sử.

Mỗi minh chứng có ngày giờ, người thực hiện và diễn giải ngắn. Tách rõ “đã chạy” với “kết quả kỳ vọng”; để trống danh tính thành viên cho tới khi nhóm bổ sung.

## 9. Phạm vi kiểm chứng của bộ kịch bản

Khi soạn tài liệu, `00_inspect.sql` và `03_storage_segments_extents.sql` đã chạy thành công bằng SQL*Plus OS authentication trên ORCL. RMAN 19.3 đã kiểm tra cú pháp file 30, 31 và các lệnh mẫu file 32 bằng chế độ **CHECKSYNTAX**, không kết nối target để thực thi các lệnh đó. Chế độ này chỉ phân tích cú pháp; xem [Oracle 19c: RMAN CHECKSYNTAX](https://docs.oracle.com/en/database/oracle/oracle-database/19/rcmrf/RMAN.html).

Ngày 17/10/2026 đã chạy `npm run admin:demo`: tạo/add/resize/move datafile, tắt/bật autoextend, chuyển riêng tablespace demo READ ONLY rồi READ WRITE, tạo user/role/profile/quota, lock/unlock và revoke/grant. Phiên TOEIC_DEMO đọc được view được cấp quyền, bị ORA-00942 khi đọc TOEIC_USERS. Sau đó đã drop đúng user/role/profile/tablespace và datafile demo; 14 bảng nguồn vẫn tồn tại, không có object INVALID, ORCL vẫn READ WRITE. Xem `docs/admin-verification.json` và log được chỉ ra trong tệp. Script từ chối nếu các đối tượng hoặc datafile sandbox đã tồn tại.

Sau khi revoke rồi grant lại role, phải đặt lại `ALTER USER ... DEFAULT ROLE` để phiên mới kích hoạt role. File 04 đã bổ sung bước này và được chạy lại thành công. Không thay đổi RESOURCE_LIMIT toàn hệ thống.

Data Pump export/import clone đã được kiểm chứng riêng trong `docs/backup-verification.json`. Chưa thực hiện shutdown, đổi READ ONLY/RESTRICTED ở cấp instance hoặc backup/restore vật lý RMAN. READ ONLY của tablespace sandbox không đồng nghĩa READ ONLY của toàn database.
