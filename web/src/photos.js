/* Ảnh minh hoạ từ Unsplash (giấy phép Unsplash: dùng miễn phí, không cần ghi nguồn).
   Mỗi ảnh được ưu tiên đọc từ web/public/images/<tên>.jpg nếu đã tải về
   bằng scripts/download-images.ps1; nếu chưa có thì tải trực tiếp từ Unsplash. */
export const PHOTOS = {
  hero: "photo-1514513452089-17f8a9771ee8",
  auth: "photo-1536925155833-43e9c2b2f499",
  exams: "photo-1606326608606-aa0b62935f2b",
  learning: "photo-1513475382585-d06e58bcb0e0",
  vocabulary: "photo-1457369804613-52c61a468e7d",
  history: "photo-1454165804606-c3d57bc86b40",
  "exam-full": "photo-1534644107580-3a4dbd494a95",
  "exam-mini": "photo-1501504905252-473c47e087f8",
  "exam-practice": "photo-1462642109801-4ac2971a3a51",
  "exam-listening": "photo-1505740420928-5e560c06d30e",
  "exam-reading": "photo-1544716278-ca5e3f4abd8c",
  "exam-grammar": "photo-1550592704-6c76defa9985",
  "part-1": "photo-1495707902641-75cac588d2e9",
  "part-2": "photo-1507537362848-9c7e70b7b5c1",
  "part-3": "photo-1517048676732-d65bc937f952",
  "part-4": "photo-1554446422-d05db23719d2",
  "part-5": "photo-1483546416237-76fd26bbcdd1",
  "part-6": "photo-1486312338219-ce68d2c6f44d",
  "part-7": "photo-1504711434969-e33886168f5c",
};

export const remoteUrl = (name, width = 1200) =>
  PHOTOS[name]
    ? `https://images.unsplash.com/${PHOTOS[name]}?auto=format&fit=crop&w=${width}&q=72`
    : null;

export const localUrl = (name) => `/images/${name}.jpg`;

/* Chọn ảnh cho một đề thi dựa vào tên và loại đề */
export function examPhoto(exam) {
  const t = (exam?.title || "").toLowerCase();
  if (/listening|nghe/.test(t)) return "exam-listening";
  if (/reading|đọc/.test(t)) return "exam-reading";
  if (/photo|part 1\b|mô tả tranh/.test(t)) return "part-1";
  if (/grammar|part 5|ngữ pháp/.test(t)) return "exam-grammar";
  if (/hội thoại|conversation|part 3/.test(t)) return "part-3";
  return (
    { FULL_TEST: "exam-full", MINI_TEST: "exam-mini", PRACTICE: "exam-practice" }[
      exam?.kind
    ] || "exam-practice"
  );
}
