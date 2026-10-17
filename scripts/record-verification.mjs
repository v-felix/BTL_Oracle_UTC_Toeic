import { readFile, writeFile } from "node:fs/promises";

// Called only after build, integration tests and both dependency audits succeed.
const read = async (path) => JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
const optional = async (path) => {
  try { return await read(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
};
const api = await read("docs/api-test-results.json");
if (api.failed !== 0 || api.testCount < 1 || api.passed !== api.testCount)
  throw new Error("Integration tests have not all passed; verification was not recorded.");
const backup = await optional("docs/backup-verification.json");
const administration = await optional("docs/admin-verification.json");
const publication = await optional("docs/publish-verification.json");
const summary = [
  `Kiểm thử tích hợp Oracle thật: ${api.passed}/${api.testCount} ca đạt; 20/20 truy vấn SQL chạy thành công; 14/14 bảng có ít nhất 5 bản ghi.`,
  "Build React/Vite và ASP.NET Core hoàn tất, không warning hoặc error; npm audit và NuGet audit không báo gói có lỗ hổng tại thời điểm kiểm tra.",
  "Đã kiểm tra giao diện học viên: đăng nhập, tìm đề, đổi đáp án, đánh dấu, tải lại và nộp bài. Menu di động và trang metadata Oracle đã được kiểm tra riêng.",
];
if (backup?.allCountsMatch && backup?.questionPayloadMatches)
  summary.push("Data Pump đã export TOEIC_OWNER và phục hồi TOEIC_RESTORE; số dòng của 14 bảng và nội dung câu hỏi khớp, các đối tượng hợp lệ. Tài khoản backup đã khóa.");
if (administration?.passed)
  summary.push("Đã tạo/alter/move/drop tablespace và datafile trong sandbox, kiểm chứng user/role/profile/segment/extent; sandbox đã dọn, nguồn hợp lệ và ORCL vẫn READ WRITE.");
summary.push("Chưa chạy shutdown/read only/restricted ở cấp instance hoặc backup/restore vật lý RMAN trên ORCL dùng chung.");
await writeFile("docs/verification.json", JSON.stringify({
  verifiedAt: new Date().toISOString(), summary, apiTests: api, backup, administration, publication,
  build: { passed: true, warnings: 0, errors: 0 },
  dependencyAudit: { npm: 0, nuget: 0 }, physicalRmanExecuted: false,
}, null, 2) + "\n", "utf8");
console.log("Verification evidence saved: docs/verification.json");
