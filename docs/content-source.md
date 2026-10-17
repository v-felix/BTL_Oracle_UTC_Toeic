# Nguồn nội dung và giới hạn sử dụng

## Dữ liệu đầu vào

- Nguồn do người dùng cung cấp: `src/test/dataTest.json`, gồm 103 thẻ cấp cha và 200 câu hỏi sau khi trải phẳng. Không đọc MongoDB hoặc dùng khóa/tài khoản cũ.
- Kết quả: `server/SeedData/content.json`. Giữ ID nhóm liên kết và thứ tự câu của nguồn; các đề rút gọn giữ đầy đủ câu của mỗi nhóm hội thoại/bài đọc, không cắt giữa nhóm.
- Ánh xạ Part theo thứ tự xuất hiện của trường `type` cấp cha; một số thẻ con có type = -1 nên không sử dụng trường đó để phân loại.
- Phân bố Part 1–7: **6 / 25 / 39 / 30 / 30 / 16 / 54**. Tổng **100 Listening + 100 Reading**.
- Chuyển HTML sang văn bản thuần; giữ xuống dòng, thứ tự đoạn và phân tách ô bảng bằng `|`. Không đưa HTML nguồn vào `innerHTML`.
- Tách tiền tố (A)/(B)/(C)/(D) thành khóa đáp án. Một lỗi nguồn ở **câu 76**: `(0) A description of an upcoming show` được chuẩn hóa thành nhãn **C** vì ba lựa chọn còn lại là A/B/D. Đáp án đúng D giữ nguyên. File nguồn không thay đổi.
- Với câu nghe chỉ có chữ cái lựa chọn, seed hiển thị “Nghe phương án A/B/C/D”; nội dung lời lựa chọn nằm trong audio. Transcript lưu trong explanation để chỉ hiển thị khi chữa bài.
- Nguồn thiếu giải thích chi tiết ở một số câu; seed ghi rõ thay vì tự tạo bằng chứng. EASY/MEDIUM/HARD là phân loại biên tập theo Part cho bản demo, chưa hiệu chuẩn thực nghiệm.

## Media offline

Toàn bộ URL ảnh/audio của nguồn được tải vào `server/Toeic.Api/wwwroot/media/`. Đường dẫn `kslearning/...` được phân giải thành `https://storage.googleapis.com/kslearning/...`. Tên tệp là 16 ký tự đầu SHA-256 của đường dẫn nguồn; phần mở rộng ảnh lấy theo chữ ký nội dung thay vì chỉ tin header Content-Type (một ảnh PNG được máy chủ nguồn khai báo là image/jpeg). Kết quả gồm 54 MP3 và 10 PNG. Seed chỉ tham chiếu `/media/<tên tệp>`.

Bộ đề và media được lấy từ nội dung đi kèm dự án của người dùng; chưa có thông tin giấy phép phân phối lại trong dữ liệu. Không tuyên bố đây là đề chính thức của ETS.

Tải thành công **64/64 tệp**, tổng **55,252,287 byte**. Không có URL tải lỗi trong bộ seed hoàn tất.

## Danh mục đề

| Mã | Loại | Câu | Phút |
|---|---|---:|---:|
| toeic-full-test-01 | FULL_TEST | 200 | 120 |
| toeic-mini-test-50 | MINI_TEST | 50 | 35 |
| listening-workout | PRACTICE | 100 | 45 |
| reading-workout | PRACTICE | 100 | 75 |
| grammar-focus | PRACTICE | 30 | 20 |
| photo-sprint | PRACTICE | 6 | 6 |
| reading-passages | PRACTICE | 54 | 45 |

Các đề mini/luyện dùng lại cùng ngân hàng 200 câu, không phải bộ đề độc lập. Full Test dùng 120 phút; thời gian mini/luyện là đề xuất cho tự học. Nội dung không mặc định rằng ứng dụng có tách riêng đồng hồ Listening/Reading.

## Bài học, từ vựng và điểm số

Có **7 bài học tiếng Việt**, mỗi bài tương ứng một Part, gồm mục tiêu, chiến thuật, ví dụ và thực hành. Có **45 từ/cụm từ công sở** với phiên âm, nghĩa, ví dụ và chủ đề. Bài học/từ vựng được biên soạn cho dự án, không sao chép từ một giáo trình ngoài. Phiên âm dùng cách đọc Anh-Anh phổ biến để hỗ trợ học tập.

Số câu đúng và tỷ lệ đúng là số liệu trực tiếp. Điểm quy đổi thang TOEIC 10–990 nếu có trong ứng dụng **chỉ tham khảo**, không phải bảng quy đổi chính thức, không thay thế chứng chỉ TOEIC. Điểm mini/practice không đại diện điểm thi chính thức.

## Kiểm tra tính toàn vẹn media

| URL nguồn | Tệp cục bộ | Byte | SHA-256 nội dung |
|---|---|---:|---|
| https://storage.googleapis.com/estudyme/dev/2022/06/27/1002434.mp3 | /media/efdec276f5cd3cf5.mp3 | 529596 | 8a4e6950f3ca418cf69db2ed395a10acd45808b66285b987b921fd1b50d7e892 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/10164366.mp3 | /media/e25978c31832c922.mp3 | 527220 | 8d1fe24cd9f61f4c2b838023f06fc77d5aad939e926acec51a22e1061532eef4 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/10205448.mp3 | /media/890f16975f1bd755.mp3 | 1549296 | 5fd74c9d3ac27a30159835b8e82a60a4010cbf9989bd6671cb2feaf027c81751 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/108125.mp3 | /media/95b721a8fa367b0d.mp3 | 1247580 | 77b6b30d6cd49209f3e1c4b20fad2d175f833aa5d90782bf29e31ac9c6a3816f |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/11063530.mp3 | /media/40ce1ec81c125c6e.mp3 | 2158448 | 846c77c2534f012c1a608108f616c115b26724b140e6c7130f7c517f2d013d90 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/15066364.mp3 | /media/739f11e375b56c58.mp3 | 503930 | c44751dec8ca4f9f257050370676112b9601266f25915bdecd858ef698502334 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/1770823.mp3 | /media/60a87854e374eb24.mp3 | 500800 | ec718aca0c0abfa49c8373c3e8e97f6141f6a8ad55393c1e57494863d908404f |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/22349070.mp3 | /media/59f52f864fb68266.mp3 | 450720 | 1677f8694e9e26ee8d795bf3f25ea072ddcbae614ab03c610cca624268567c9d |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/23344354.mp3 | /media/a440b6e1b1ae75d7.mp3 | 1355634 | 21d7e88a0eff9d45441f171e56c1a974cdf8acefea78ea6bc748b1956ed88aa7 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/2448937.mp3 | /media/86bc12178045afdc.mp3 | 484524 | 634d0fdeb0ea07a238c912ff71d0b61257b7a7b764c36a55f1fec9715f32b836 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/24580518.mp3 | /media/9b88624b13c452d7.mp3 | 1987550 | ef2ba952a76b86e7df449f45357c0e0609e10ee4ffd0afd5d4b3da7cccf2bb9d |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/27507251.mp3 | /media/c3954920dbff5f95.mp3 | 505808 | 0ff81c43f3be11e25ec10031f4a371c2706630383adad35cc985ff92e39e1ff4 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/2774499.mp3 | /media/b63dd4656f8bca4f.mp3 | 1336842 | afe330061814460459821b7767d9c10ee82362b9c3b19e0de118d5589a30ef82 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/27856133.mp3 | /media/a0d340cfefa75ce9.mp3 | 1968144 | 1b3b04052feb9eb9f10b92479ac76c127c1903c10497fbe059d9d26a48ad1e1b |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/27895551.mp3 | /media/406fee50c586d804.mp3 | 510190 | a59d145ec3037371873d6ebe5956d32e3c451d224a7155a9ee59c41ce5c5428c |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/30449101.mp3 | /media/7f3e513e5ae314e1.mp3 | 497988 | 385e9d89e95d6ee953420bf0c70167a9ed63e4da0e999c7a4fd0814f0db3f848 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/32703867.mp3 | /media/61953b22d042737b.mp3 | 1948738 | 90683e3939e670bd5f43bcb9e97a2b7e8afdaadee255edf02a274a27e8bd1553 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/32759585.mp3 | /media/7c7d0c843b803630.mp3 | 1665786 | 4d5c6af94c33384ad5760da76b09cb08f7891749239e6290a21246faea244304 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/34867286.mp3 | /media/f47d3632980fcce1.mp3 | 1658916 | 146764132cf58e87fba43c83f513704dcebda2f65a07f6ca5f8236475e7a8f3b |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/36169115.mp3 | /media/dccefbb57523d887.mp3 | 504556 | a913ca74aa0f4815af6278c8096547a8b67205b49be1b9a194e42ea0cfe62c4e |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/36497742.mp3 | /media/35ec7a6f53078764.mp3 | 525214 | 813e31ae70388edc10632b56504e75cda715ff4062ecb527dd0e61eb3f738bcc |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/37791141.mp3 | /media/c86661b0cd5814a2.mp3 | 1807262 | 05df800e7dcc6e1cd75cf48da7ab22a5450505a79779099ad3b9d414c7637831 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/38221030.mp3 | /media/8b0b7385101462eb.mp3 | 505808 | ea11c23a8bb43b228419feab140498cc49bf651adfb693ee2e5debdfb80dab37 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/4024783.mp3 | /media/353501330e007c79.mp3 | 509564 | 851ad6b80e7278311998c7c4b968311a2fc35f902504f373297375ceea6f85fe |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/40438651.mp3 | /media/0e0c038ab4e7cab3.mp3 | 1212084 | 6871de3140c7314631c086b9a5087cbb0403e0a46f5615827978e38158cd288e |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/46972225.mp3 | /media/07f6faecbb9c4202.mp3 | 415038 | 74aa88ef5ab4254bff2ac14b379279105ef094be6527516b3be724a6b18d7f31 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/48822592.mp3 | /media/0eedc523837f9c92.mp3 | 541490 | 01a6391e35ac0b5cef121e8d502bfddf133f5e32e50d8e9c36deaf53c5a008b0 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/51864012.mp3 | /media/7d87dfd55c54d80b.mp3 | 479516 | 2503c320f136670956cd98724efa51bb1532c3412ea9071579e30a281280c977 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/53517470.mp3 | /media/2a4a0fdcc4a33908.mp3 | 510816 | 8b9e06a8aef7a9bcc62d61ee8734676d1319648b2adc51caff6058bce840e69f |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/54931694.mp3 | /media/aabdd65082a12db3.mp3 | 552758 | 96c25485d8c68c533d029f4ce10eac06338532b3aabb2f5a8aa9034ffdd943a8 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/59488689.mp3 | /media/03143b0bf79e8f47.mp3 | 478264 | 2f1c326df8a1ca7130605d17a84ff3fec16f8fc4b5c511d02158a352e6159b9c |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/59643915.mp3 | /media/94a09386aefab898.mp3 | 1509624 | 9b72e863622d4566c77b0467dfee7bac611dbd400f301794812ee31fce6986e5 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/60344039.mp3 | /media/30adea38bd49e909.mp3 | 500598 | f29baa45d9209540845ad51901db82be05bea85cd804ca51077efa4e3f42e712 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/61516067.mp3 | /media/c22118fb0bcdbf59.mp3 | 2057662 | 89b21d8431dda846746f16794056f25ed399089209908a211c0bf36f99e59407 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/64542288.mp3 | /media/ab97010b517933ce.mp3 | 508312 | 3716ead9d720275e10da516d07ae0bb23e77cf352ff4e2ef9b206f99c433c403 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/65494038.mp3 | /media/b9b263ede34ecb11.mp3 | 493914 | b0abd5795785c1fdb81458098b7e9817a7c729a60177ad1582287d4f1b2efa77 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/66404242.mp3 | /media/906e169e1ea70f9a.mp3 | 1421406 | 912cb14786cd98c87e5ff6bd73b0bc83a51249ca1a24f9625ac87b3be870c5d9 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/69779558.mp3 | /media/08c51a8ad34267c3.mp3 | 510816 | 22ad96622d2add038ec9da29b934178b83e943d0b667433792f53ba529ae7a41 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/72357308.mp3 | /media/d1ebfa0b7f0fb0d8.mp3 | 479516 | 6329c9fddd2ef5ba3809faeedd53f8e76818c06a2685ad5df8e18be955a9b9bf |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/74068035.mp3 | /media/084bc74d85c5a249.mp3 | 1643256 | fb353ede0c6010e546b96f3b544b96d0d9cbbea4838809ba55f4d80b2d4b7f52 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/75499226.mp3 | /media/73b74730169dcbbf.mp3 | 508938 | 3c7f71aaa9a0e7c5cac299343ebab5b9fcdcebfa707d55d77feefb62f8d92415 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/78867473.mp3 | /media/593903fa655f49c0.mp3 | 1675620 | 13a56a8ffe476f68d5b130cacedec333173711701d7379e72108c9fbd837c475 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/79173467.mp3 | /media/26763b767314d7e2.mp3 | 1588968 | 4e27bc6042d85c0c85df01f0444db8dec8b556ea1f32502a2969af119c0ba03e |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/79834338.mp3 | /media/0da60a645742c4d6.mp3 | 2021354 | e22e90b3996eef5ef498f1b5eb801695e042ac59d1c06676b4c147dbf5a79af8 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/80409551.mp3 | /media/9b1e723914c3d218.mp3 | 2082702 | 1925f9132ccb5b782c2c0159480a80b04cc04bac7c95e95089a822ddd6f74e3b |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/9013217.mp3 | /media/dcec78d13b631da9.mp3 | 1836684 | 165a30680df3f6133dad26dccbbf34cbfe22c713f08017cebbc5c665a6d512ea |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/91254480.mp3 | /media/e53114016259eba3.mp3 | 516450 | d63bfd783b3076d78be3a88f8c2b5d1ad43abbe6b3c3903a00f7b37099af5762 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/92521012.mp3 | /media/0a82ec0c8e55c2c8.mp3 | 489636 | d5b093740bcae243b6942efdc392e83f2729d51ccad44c2582e3a45b01ef4c6a |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/93860120.mp3 | /media/b021fdc9152d39cc.mp3 | 1330578 | 4b173b68efed9da8e424db1dd5ddd7576d2b92835d9a4325c64aae55a725d63f |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/96373586.mp3 | /media/e56d31d0743a393e.mp3 | 520956 | e060413bae65acc15bf655f695818a3b813d1fd74538f591503a4d3554db5b80 |
| https://storage.googleapis.com/estudyme/dev/2022/06/27/99660487.mp3 | /media/153320e0360c383f.mp3 | 1312830 | 82686d8472db2ce00fcce8d86b3746ee2f331d295fb495111919c94d5e2a6afd |
| https://storage.googleapis.com/estudyme/dev/2022/06/28/4294338.png | /media/a01b9e36d81e660a.png | 26060 | 8721f0a2eb0706521533bdbd434429946fd550ec848604c32c6b0cd5d6397b04 |
| https://storage.googleapis.com/estudyme/dev/2022/07/01/32133498.mp3 | /media/3f4d38322d761452.mp3 | 511038 | 89e174d294fef0309811cb69973a4c65aa9b05163509dfbee1e13b872c88638b |
| https://storage.googleapis.com/estudyme/dev/2022/07/04/44763086.mp3 | /media/85f41c150dead583.mp3 | 511442 | 397fc85d85c92658a346897fa702a4f90140a515f0354402c2f56d13135a5845 |
| https://storage.googleapis.com/estudyme/dev/2022/07/04/78507086.mp3 | /media/c231fd721a826ffe.mp3 | 541490 | aa7942ef65355631be2e7aa2e06b2047e4f24b899754665a0f33dc731f71943f |
| https://storage.googleapis.com/kslearning/images/197646363-1620725907323-pic4.png | /media/41a692002c826e3a.png | 162489 | 08d8b4a1cdaa3aea00c8d3c1c61fca8a4cb872bd0f52a62577f2fda44b31e439 |
| https://storage.googleapis.com/kslearning/images/402218747-1620725955583-pic6.png | /media/1d48c49c5913db0a.png | 139480 | c60d3592dd307c01a561de6f79f3e96344b0a8a7e0ef18e0e1cdd589d6384ca8 |
| https://storage.googleapis.com/kslearning/images/418922160-1620725865601-pic1.png | /media/cf2ee7d5ad2d8de1.png | 125906 | f75f15298262f04df6d5b2acb35c12d9d6f126de4249860cc50fba117c090f05 |
| https://storage.googleapis.com/kslearning/images/432573172-1620725920118-pic5.png | /media/c1bd3073215ad846.png | 174728 | d2f4f288b638a3e81f36a1399a9c121b32fec412f7cd0a7563163bab073a1ab4 |
| https://storage.googleapis.com/kslearning/images/511506294-1620791494579-part3-1.png | /media/1abe5bfcb78bfc10.png | 141985 | ccc3337bb6fe33963dc8c219a915c6446e97f02429036edf5b3125d1710f75d2 |
| https://storage.googleapis.com/kslearning/images/553702711-1620791436005-part3-3.png | /media/47d8b1d74740097e.png | 132510 | e036a2887ea47602feec7c0e96baa7f729afa79e38a2129eb7d55d1e874c3108 |
| https://storage.googleapis.com/kslearning/images/813960684-1620791461246-part3-2.png | /media/ea21acc3ded281a9.png | 102417 | ba1e7399695b0462bd16eed68d9f36e6aa3a02f3b4b26039e357ed71210d8360 |
| https://storage.googleapis.com/kslearning/images/94371017-1620725885110-pic2.png | /media/780ec3c852bd6a52.png | 105011 | 2e4ffe26ea378878957c3856d1611ed0016cbe072e6674c9eaf29bf6988e1142 |
| https://storage.googleapis.com/kslearning/images/974773515-1620725896104-pic3.png | /media/9792a054ec44d762.png | 137831 | 0a4a57177e1747ca63e949662154947f089f55d506362c34224bc7f965f27405 |

## Ánh xạ type → Part

| Type nguồn | Part | Nhóm | Câu |
|---|---:|---:|---:|
| 1636615697542 | 1 | 6 | 6 |
| 1636615720709 | 2 | 25 | 25 |
| 1636615725762 | 3 | 13 | 39 |
| 1636615729794 | 4 | 10 | 30 |
| 1636615733972 | 5 | 30 | 30 |
| 1636615742506 | 6 | 4 | 16 |
| 1636615746924 | 7 | 15 | 54 |

## Ánh xạ câu gốc → câu seed

| Câu seed | ID câu nguồn | ID nhóm nguồn |
|---:|---|---|
| 1 | 62b694aebbc57b27fe10f7ae | 62b694aebbc57b27fe10f7ae |
| 2 | 62b694aebbc57b27fe10f7af | 62b694aebbc57b27fe10f7af |
| 3 | 62b694aebbc57b27fe10f7b0 | 62b694aebbc57b27fe10f7b0 |
| 4 | 62b694aebbc57b27fe10f7b1 | 62b694aebbc57b27fe10f7b1 |
| 5 | 62b694aebbc57b27fe10f7b2 | 62b694aebbc57b27fe10f7b2 |
| 6 | 62b694aebbc57b27fe10f7b3 | 62b694aebbc57b27fe10f7b3 |
| 7 | 62b694aebbc57b27fe10f7b4 | 62b694aebbc57b27fe10f7b4 |
| 8 | 62b694aebbc57b27fe10f7b5 | 62b694aebbc57b27fe10f7b5 |
| 9 | 62b694aebbc57b27fe10f7b6 | 62b694aebbc57b27fe10f7b6 |
| 10 | 62b694aebbc57b27fe10f7b7 | 62b694aebbc57b27fe10f7b7 |
| 11 | 62b694aebbc57b27fe10f7b8 | 62b694aebbc57b27fe10f7b8 |
| 12 | 62b694aebbc57b27fe10f7b9 | 62b694aebbc57b27fe10f7b9 |
| 13 | 62b694aebbc57b27fe10f7ba | 62b694aebbc57b27fe10f7ba |
| 14 | 62b694aebbc57b27fe10f7bb | 62b694aebbc57b27fe10f7bb |
| 15 | 62b694aebbc57b27fe10f7bc | 62b694aebbc57b27fe10f7bc |
| 16 | 62b694aebbc57b27fe10f7bd | 62b694aebbc57b27fe10f7bd |
| 17 | 62b694aebbc57b27fe10f7be | 62b694aebbc57b27fe10f7be |
| 18 | 62b694aebbc57b27fe10f7bf | 62b694aebbc57b27fe10f7bf |
| 19 | 62b694aebbc57b27fe10f7c0 | 62b694aebbc57b27fe10f7c0 |
| 20 | 62b694aebbc57b27fe10f7c1 | 62b694aebbc57b27fe10f7c1 |
| 21 | 62b694aebbc57b27fe10f7c2 | 62b694aebbc57b27fe10f7c2 |
| 22 | 62b694aebbc57b27fe10f7c3 | 62b694aebbc57b27fe10f7c3 |
| 23 | 62b694aebbc57b27fe10f7c4 | 62b694aebbc57b27fe10f7c4 |
| 24 | 62b694aebbc57b27fe10f7c5 | 62b694aebbc57b27fe10f7c5 |
| 25 | 62b694aebbc57b27fe10f7c6 | 62b694aebbc57b27fe10f7c6 |
| 26 | 62b694aebbc57b27fe10f7c7 | 62b694aebbc57b27fe10f7c7 |
| 27 | 62b694aebbc57b27fe10f7c8 | 62b694aebbc57b27fe10f7c8 |
| 28 | 62b694aebbc57b27fe10f7c9 | 62b694aebbc57b27fe10f7c9 |
| 29 | 62b694aebbc57b27fe10f7ca | 62b694aebbc57b27fe10f7ca |
| 30 | 62b694aebbc57b27fe10f7cb | 62b694aebbc57b27fe10f7cb |
| 31 | 62b694aebbc57b27fe10f7cc | 62b694aebbc57b27fe10f7cc |
| 32 | 62b694aebbc57b27fe10f815 | 62b694aebbc57b27fe10f7cd |
| 33 | 62b694aebbc57b27fe10f816 | 62b694aebbc57b27fe10f7cd |
| 34 | 62b694aebbc57b27fe10f817 | 62b694aebbc57b27fe10f7cd |
| 35 | 62b694aebbc57b27fe10f818 | 62b694aebbc57b27fe10f7ce |
| 36 | 62b694aebbc57b27fe10f819 | 62b694aebbc57b27fe10f7ce |
| 37 | 62b694aebbc57b27fe10f81a | 62b694aebbc57b27fe10f7ce |
| 38 | 62b694aebbc57b27fe10f81b | 62b694aebbc57b27fe10f7cf |
| 39 | 62b694aebbc57b27fe10f81c | 62b694aebbc57b27fe10f7cf |
| 40 | 62b694aebbc57b27fe10f81d | 62b694aebbc57b27fe10f7cf |
| 41 | 62b694aebbc57b27fe10f81e | 62b694aebbc57b27fe10f7d0 |
| 42 | 62b694aebbc57b27fe10f81f | 62b694aebbc57b27fe10f7d0 |
| 43 | 62b694aebbc57b27fe10f820 | 62b694aebbc57b27fe10f7d0 |
| 44 | 62b694afbbc57b27fe10f821 | 62b694aebbc57b27fe10f7d1 |
| 45 | 62b694afbbc57b27fe10f822 | 62b694aebbc57b27fe10f7d1 |
| 46 | 62b694afbbc57b27fe10f823 | 62b694aebbc57b27fe10f7d1 |
| 47 | 62b694afbbc57b27fe10f824 | 62b694aebbc57b27fe10f7d2 |
| 48 | 62b694afbbc57b27fe10f825 | 62b694aebbc57b27fe10f7d2 |
| 49 | 62b694afbbc57b27fe10f826 | 62b694aebbc57b27fe10f7d2 |
| 50 | 62b694afbbc57b27fe10f827 | 62b694aebbc57b27fe10f7d3 |
| 51 | 62b694afbbc57b27fe10f828 | 62b694aebbc57b27fe10f7d3 |
| 52 | 62b694afbbc57b27fe10f829 | 62b694aebbc57b27fe10f7d3 |
| 53 | 62b694afbbc57b27fe10f82a | 62b694aebbc57b27fe10f7d4 |
| 54 | 62b694afbbc57b27fe10f82b | 62b694aebbc57b27fe10f7d4 |
| 55 | 62b694afbbc57b27fe10f82c | 62b694aebbc57b27fe10f7d4 |
| 56 | 62b694afbbc57b27fe10f82d | 62b694aebbc57b27fe10f7d5 |
| 57 | 62b694afbbc57b27fe10f82e | 62b694aebbc57b27fe10f7d5 |
| 58 | 62b694afbbc57b27fe10f82f | 62b694aebbc57b27fe10f7d5 |
| 59 | 62b694afbbc57b27fe10f830 | 62b694aebbc57b27fe10f7d6 |
| 60 | 62b694afbbc57b27fe10f831 | 62b694aebbc57b27fe10f7d6 |
| 61 | 62b694afbbc57b27fe10f832 | 62b694aebbc57b27fe10f7d6 |
| 62 | 62b694afbbc57b27fe10f833 | 62b694aebbc57b27fe10f7d7 |
| 63 | 62b694afbbc57b27fe10f834 | 62b694aebbc57b27fe10f7d7 |
| 64 | 62b694afbbc57b27fe10f835 | 62b694aebbc57b27fe10f7d7 |
| 65 | 62b694afbbc57b27fe10f836 | 62b694aebbc57b27fe10f7d8 |
| 66 | 62b694afbbc57b27fe10f837 | 62b694aebbc57b27fe10f7d8 |
| 67 | 62b694afbbc57b27fe10f838 | 62b694aebbc57b27fe10f7d8 |
| 68 | 62b694afbbc57b27fe10f839 | 62b694aebbc57b27fe10f7d9 |
| 69 | 62b694afbbc57b27fe10f83a | 62b694aebbc57b27fe10f7d9 |
| 70 | 62b694afbbc57b27fe10f83b | 62b694aebbc57b27fe10f7d9 |
| 71 | 62b694afbbc57b27fe10f83c | 62b694aebbc57b27fe10f7da |
| 72 | 62b694afbbc57b27fe10f83d | 62b694aebbc57b27fe10f7da |
| 73 | 62b694afbbc57b27fe10f83e | 62b694aebbc57b27fe10f7da |
| 74 | 62b694afbbc57b27fe10f83f | 62b694aebbc57b27fe10f7db |
| 75 | 62b694afbbc57b27fe10f840 | 62b694aebbc57b27fe10f7db |
| 76 | 62b694afbbc57b27fe10f841 | 62b694aebbc57b27fe10f7db |
| 77 | 62b694afbbc57b27fe10f842 | 62b694aebbc57b27fe10f7dc |
| 78 | 62b694afbbc57b27fe10f843 | 62b694aebbc57b27fe10f7dc |
| 79 | 62b694afbbc57b27fe10f844 | 62b694aebbc57b27fe10f7dc |
| 80 | 62b694afbbc57b27fe10f845 | 62b694aebbc57b27fe10f7dd |
| 81 | 62b694afbbc57b27fe10f846 | 62b694aebbc57b27fe10f7dd |
| 82 | 62b694afbbc57b27fe10f847 | 62b694aebbc57b27fe10f7dd |
| 83 | 62b694afbbc57b27fe10f848 | 62b694aebbc57b27fe10f7de |
| 84 | 62b694afbbc57b27fe10f849 | 62b694aebbc57b27fe10f7de |
| 85 | 62b694afbbc57b27fe10f84a | 62b694aebbc57b27fe10f7de |
| 86 | 62b694afbbc57b27fe10f84b | 62b694aebbc57b27fe10f7df |
| 87 | 62b694afbbc57b27fe10f84c | 62b694aebbc57b27fe10f7df |
| 88 | 62b694afbbc57b27fe10f84d | 62b694aebbc57b27fe10f7df |
| 89 | 62b694afbbc57b27fe10f84e | 62b694aebbc57b27fe10f7e0 |
| 90 | 62b694afbbc57b27fe10f84f | 62b694aebbc57b27fe10f7e0 |
| 91 | 62b694afbbc57b27fe10f850 | 62b694aebbc57b27fe10f7e0 |
| 92 | 62b694afbbc57b27fe10f851 | 62b694aebbc57b27fe10f7e1 |
| 93 | 62b694afbbc57b27fe10f852 | 62b694aebbc57b27fe10f7e1 |
| 94 | 62b694afbbc57b27fe10f853 | 62b694aebbc57b27fe10f7e1 |
| 95 | 62b694afbbc57b27fe10f854 | 62b694aebbc57b27fe10f7e2 |
| 96 | 62b694afbbc57b27fe10f855 | 62b694aebbc57b27fe10f7e2 |
| 97 | 62b694afbbc57b27fe10f856 | 62b694aebbc57b27fe10f7e2 |
| 98 | 62b694afbbc57b27fe10f857 | 62b694aebbc57b27fe10f7e3 |
| 99 | 62b694afbbc57b27fe10f858 | 62b694aebbc57b27fe10f7e3 |
| 100 | 62b694afbbc57b27fe10f859 | 62b694aebbc57b27fe10f7e3 |
| 101 | 62b694aebbc57b27fe10f7e4 | 62b694aebbc57b27fe10f7e4 |
| 102 | 62b694aebbc57b27fe10f7e5 | 62b694aebbc57b27fe10f7e5 |
| 103 | 62b694aebbc57b27fe10f7e6 | 62b694aebbc57b27fe10f7e6 |
| 104 | 62b694aebbc57b27fe10f7e7 | 62b694aebbc57b27fe10f7e7 |
| 105 | 62b694aebbc57b27fe10f7e8 | 62b694aebbc57b27fe10f7e8 |
| 106 | 62b694aebbc57b27fe10f7e9 | 62b694aebbc57b27fe10f7e9 |
| 107 | 62b694aebbc57b27fe10f7ea | 62b694aebbc57b27fe10f7ea |
| 108 | 62b694aebbc57b27fe10f7eb | 62b694aebbc57b27fe10f7eb |
| 109 | 62b694aebbc57b27fe10f7ec | 62b694aebbc57b27fe10f7ec |
| 110 | 62b694aebbc57b27fe10f7ed | 62b694aebbc57b27fe10f7ed |
| 111 | 62b694aebbc57b27fe10f7ee | 62b694aebbc57b27fe10f7ee |
| 112 | 62b694aebbc57b27fe10f7ef | 62b694aebbc57b27fe10f7ef |
| 113 | 62b694aebbc57b27fe10f7f0 | 62b694aebbc57b27fe10f7f0 |
| 114 | 62b694aebbc57b27fe10f7f1 | 62b694aebbc57b27fe10f7f1 |
| 115 | 62b694aebbc57b27fe10f7f2 | 62b694aebbc57b27fe10f7f2 |
| 116 | 62b694aebbc57b27fe10f7f3 | 62b694aebbc57b27fe10f7f3 |
| 117 | 62b694aebbc57b27fe10f7f4 | 62b694aebbc57b27fe10f7f4 |
| 118 | 62b694aebbc57b27fe10f7f5 | 62b694aebbc57b27fe10f7f5 |
| 119 | 62b694aebbc57b27fe10f7f6 | 62b694aebbc57b27fe10f7f6 |
| 120 | 62b694aebbc57b27fe10f7f7 | 62b694aebbc57b27fe10f7f7 |
| 121 | 62b694aebbc57b27fe10f7f8 | 62b694aebbc57b27fe10f7f8 |
| 122 | 62b694aebbc57b27fe10f7f9 | 62b694aebbc57b27fe10f7f9 |
| 123 | 62b694aebbc57b27fe10f7fa | 62b694aebbc57b27fe10f7fa |
| 124 | 62b694aebbc57b27fe10f7fb | 62b694aebbc57b27fe10f7fb |
| 125 | 62b694aebbc57b27fe10f7fc | 62b694aebbc57b27fe10f7fc |
| 126 | 62b694aebbc57b27fe10f7fd | 62b694aebbc57b27fe10f7fd |
| 127 | 62b694aebbc57b27fe10f7fe | 62b694aebbc57b27fe10f7fe |
| 128 | 62b694aebbc57b27fe10f7ff | 62b694aebbc57b27fe10f7ff |
| 129 | 62b694aebbc57b27fe10f800 | 62b694aebbc57b27fe10f800 |
| 130 | 62b694aebbc57b27fe10f801 | 62b694aebbc57b27fe10f801 |
| 131 | 62b694afbbc57b27fe10f85a | 62b694aebbc57b27fe10f802 |
| 132 | 62b694afbbc57b27fe10f85b | 62b694aebbc57b27fe10f802 |
| 133 | 62b694afbbc57b27fe10f85c | 62b694aebbc57b27fe10f802 |
| 134 | 62b694afbbc57b27fe10f85d | 62b694aebbc57b27fe10f802 |
| 135 | 62b694afbbc57b27fe10f85e | 62b694aebbc57b27fe10f803 |
| 136 | 62b694afbbc57b27fe10f85f | 62b694aebbc57b27fe10f803 |
| 137 | 62b694afbbc57b27fe10f860 | 62b694aebbc57b27fe10f803 |
| 138 | 62b694afbbc57b27fe10f861 | 62b694aebbc57b27fe10f803 |
| 139 | 62b694afbbc57b27fe10f862 | 62b694aebbc57b27fe10f804 |
| 140 | 62b694afbbc57b27fe10f863 | 62b694aebbc57b27fe10f804 |
| 141 | 62b694afbbc57b27fe10f864 | 62b694aebbc57b27fe10f804 |
| 142 | 62b694afbbc57b27fe10f865 | 62b694aebbc57b27fe10f804 |
| 143 | 62b694afbbc57b27fe10f866 | 62b694aebbc57b27fe10f805 |
| 144 | 62b694afbbc57b27fe10f867 | 62b694aebbc57b27fe10f805 |
| 145 | 62b694afbbc57b27fe10f868 | 62b694aebbc57b27fe10f805 |
| 146 | 62b694afbbc57b27fe10f869 | 62b694aebbc57b27fe10f805 |
| 147 | 62b694afbbc57b27fe10f86a | 62b694aebbc57b27fe10f806 |
| 148 | 62b694afbbc57b27fe10f86b | 62b694aebbc57b27fe10f806 |
| 149 | 62b694afbbc57b27fe10f86c | 62b694aebbc57b27fe10f807 |
| 150 | 62b694afbbc57b27fe10f86d | 62b694aebbc57b27fe10f807 |
| 151 | 62b694afbbc57b27fe10f86e | 62b694aebbc57b27fe10f808 |
| 152 | 62b694afbbc57b27fe10f86f | 62b694aebbc57b27fe10f808 |
| 153 | 62b694afbbc57b27fe10f870 | 62b694aebbc57b27fe10f809 |
| 154 | 62b694afbbc57b27fe10f871 | 62b694aebbc57b27fe10f809 |
| 155 | 62b694afbbc57b27fe10f872 | 62b694aebbc57b27fe10f809 |
| 156 | 62b694afbbc57b27fe10f873 | 62b694aebbc57b27fe10f80a |
| 157 | 62b694afbbc57b27fe10f874 | 62b694aebbc57b27fe10f80a |
| 158 | 62b694afbbc57b27fe10f875 | 62b694aebbc57b27fe10f80b |
| 159 | 62b694afbbc57b27fe10f876 | 62b694aebbc57b27fe10f80b |
| 160 | 62b694afbbc57b27fe10f877 | 62b694aebbc57b27fe10f80b |
| 161 | 62b694afbbc57b27fe10f878 | 62b694aebbc57b27fe10f80c |
| 162 | 62b694afbbc57b27fe10f879 | 62b694aebbc57b27fe10f80c |
| 163 | 62b694afbbc57b27fe10f87a | 62b694aebbc57b27fe10f80c |
| 164 | 62b694afbbc57b27fe10f87b | 62b694aebbc57b27fe10f80c |
| 165 | 62b694afbbc57b27fe10f87c | 62b694aebbc57b27fe10f80d |
| 166 | 62b694afbbc57b27fe10f87d | 62b694aebbc57b27fe10f80d |
| 167 | 62b694afbbc57b27fe10f87e | 62b694aebbc57b27fe10f80d |
| 168 | 62b694afbbc57b27fe10f87f | 62b694aebbc57b27fe10f80d |
| 169 | 62b694afbbc57b27fe10f880 | 62b694aebbc57b27fe10f80e |
| 170 | 62b694afbbc57b27fe10f881 | 62b694aebbc57b27fe10f80e |
| 171 | 62b694afbbc57b27fe10f882 | 62b694aebbc57b27fe10f80e |
| 172 | 62b694afbbc57b27fe10f883 | 62b694aebbc57b27fe10f80f |
| 173 | 62b694afbbc57b27fe10f884 | 62b694aebbc57b27fe10f80f |
| 174 | 62b694afbbc57b27fe10f885 | 62b694aebbc57b27fe10f80f |
| 175 | 62b694afbbc57b27fe10f886 | 62b694aebbc57b27fe10f80f |
| 176 | 62b694afbbc57b27fe10f887 | 62b694aebbc57b27fe10f810 |
| 177 | 62b694afbbc57b27fe10f888 | 62b694aebbc57b27fe10f810 |
| 178 | 62b694afbbc57b27fe10f889 | 62b694aebbc57b27fe10f810 |
| 179 | 62b694afbbc57b27fe10f88a | 62b694aebbc57b27fe10f810 |
| 180 | 62b694afbbc57b27fe10f88b | 62b694aebbc57b27fe10f810 |
| 181 | 62b694afbbc57b27fe10f88c | 62b694aebbc57b27fe10f811 |
| 182 | 62b694afbbc57b27fe10f88d | 62b694aebbc57b27fe10f811 |
| 183 | 62b694afbbc57b27fe10f88e | 62b694aebbc57b27fe10f811 |
| 184 | 62b694afbbc57b27fe10f88f | 62b694aebbc57b27fe10f811 |
| 185 | 62b694afbbc57b27fe10f890 | 62b694aebbc57b27fe10f811 |
| 186 | 62b694afbbc57b27fe10f891 | 62b694aebbc57b27fe10f812 |
| 187 | 62b694afbbc57b27fe10f892 | 62b694aebbc57b27fe10f812 |
| 188 | 62b694afbbc57b27fe10f893 | 62b694aebbc57b27fe10f812 |
| 189 | 62b694afbbc57b27fe10f894 | 62b694aebbc57b27fe10f812 |
| 190 | 62b694afbbc57b27fe10f895 | 62b694aebbc57b27fe10f812 |
| 191 | 62b694afbbc57b27fe10f896 | 62b694aebbc57b27fe10f813 |
| 192 | 62b694afbbc57b27fe10f897 | 62b694aebbc57b27fe10f813 |
| 193 | 62b694afbbc57b27fe10f898 | 62b694aebbc57b27fe10f813 |
| 194 | 62b694afbbc57b27fe10f899 | 62b694aebbc57b27fe10f813 |
| 195 | 62b694afbbc57b27fe10f89a | 62b694aebbc57b27fe10f813 |
| 196 | 62b694afbbc57b27fe10f89b | 62b694aebbc57b27fe10f814 |
| 197 | 62b694afbbc57b27fe10f89c | 62b694aebbc57b27fe10f814 |
| 198 | 62b694afbbc57b27fe10f89d | 62b694aebbc57b27fe10f814 |
| 199 | 62b694afbbc57b27fe10f89e | 62b694aebbc57b27fe10f814 |
| 200 | 62b694afbbc57b27fe10f89f | 62b694aebbc57b27fe10f814 |
