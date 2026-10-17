using System.Text.Json;
using Microsoft.AspNetCore.Identity;

namespace Toeic.Api;

public static class Seed
{
    public static async Task Run(Database database)
    {
        await using var s = await database.Open();
        if (await s.Scalar("SELECT COUNT(*) FROM toeic_users") > 0) { Console.WriteLine("Seed already exists; nothing changed."); return; }
        using var data = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "SeedData/content.json")));
        s.Begin();
        var roles = new[] { ("STUDENT", "Học viên"), ("TEACHER", "Giảng viên"), ("CONTENT_ADMIN", "Biên tập viên"), ("ADMIN", "Quản trị viên"), ("AUDITOR", "Kiểm toán viên") };
        for (var i = 0; i < roles.Length; i++) await s.Exec("INSERT INTO toeic_roles(role_id,code,name) VALUES(:id,:code,:name)", ("id", i + 1), ("code", roles[i].Item1), ("name", roles[i].Item2));
        var users = new[] { ("admin", "Quản trị UTC", 4), ("student", "Nguyễn Minh Anh", 1), ("teacher", "Giảng viên mẫu", 2), ("editor", "Biên tập UTC", 3), ("auditor", "Kiểm toán mẫu", 5), ("linh", "Trần Khánh Linh", 1), ("nam", "Phạm Hoàng Nam", 1), ("ha", "Lê Thu Hà", 1), ("duc", "Vũ Minh Đức", 1), ("trang", "Đỗ Huyền Trang", 1) };
        var hasher = new PasswordHasher<string>();
        for (var i = 0; i < users.Length; i++) await s.Exec("INSERT INTO toeic_users(user_id,username,email,password_hash,full_name,role_id,target_score) VALUES(:id,:username,:email,:hash,:name,:role,:target)", ("id", i + 1), ("username", users[i].Item1), ("email", users[i].Item1 + "@example.test"), ("hash", hasher.HashPassword(users[i].Item1, i == 0 ? "Admin@2026" : "Student@2026")), ("name", users[i].Item2), ("role", users[i].Item3), ("target", 650 + (i % 3) * 100));
        foreach (var x in data.RootElement.GetProperty("groups").EnumerateArray()) await s.Exec("INSERT INTO toeic_groups(group_id,part_no,title,passage,audio_url,image_url) VALUES(:id,:part,:title,:passage,:audio,:image)", ("id", N(x, "id")), ("part", N(x, "partNo")), ("title", T(x, "title")), ("passage", T(x, "passage")), ("audio", T(x, "audioUrl")), ("image", T(x, "imageUrl")));
        foreach (var x in data.RootElement.GetProperty("questions").EnumerateArray())
        {
            await s.Exec("INSERT INTO toeic_questions(question_id,group_id,prompt,explanation,correct_choice,difficulty) VALUES(:id,:group_id,:prompt,:explanation,:correct,:difficulty)", ("id", N(x, "id")), ("group_id", N(x, "groupId")), ("prompt", string.IsNullOrWhiteSpace(T(x, "prompt")) ? "Chọn phương án phù hợp nhất." : T(x, "prompt")), ("explanation", T(x, "explanation")), ("correct", T(x, "correctChoice")), ("difficulty", T(x, "difficulty")));
            foreach (var choice in x.GetProperty("choices").EnumerateArray()) await s.Exec("INSERT INTO toeic_choices(question_id,choice_key,choice_text) VALUES(:id,:key,:text)", ("id", N(x, "id")), ("key", T(choice, "key")), ("text", string.IsNullOrWhiteSpace(T(choice, "text")) ? "(" + T(choice, "key") + ")" : T(choice, "text")));
        }
        foreach (var x in data.RootElement.GetProperty("exams").EnumerateArray())
        {
            await s.Exec("INSERT INTO toeic_exams(exam_id,slug,title,description,duration_minutes,kind,status) VALUES(:id,:slug,:title,:description,:minutes,:kind,:status)", ("id", N(x, "id")), ("slug", T(x, "slug")), ("title", T(x, "title")), ("description", T(x, "description")), ("minutes", N(x, "durationMinutes")), ("kind", T(x, "kind")), ("status", T(x, "status")));
            var position = 0; foreach (var q in x.GetProperty("questionIds").EnumerateArray()) await s.Exec("INSERT INTO toeic_exam_items(exam_id,question_id,position) VALUES(:e,:q,:p)", ("e", N(x, "id")), ("q", q.GetInt64()), ("p", ++position));
        }
        foreach (var x in data.RootElement.GetProperty("lessons").EnumerateArray()) await s.Exec("INSERT INTO toeic_lessons(lesson_id,part_no,title,summary,content,duration_minutes) VALUES(:id,:part,:title,:summary,:content,:minutes)", ("id", N(x, "id")), ("part", N(x, "partNo")), ("title", T(x, "title")), ("summary", T(x, "summary")), ("content", T(x, "content")), ("minutes", N(x, "durationMinutes")));
        foreach (var x in data.RootElement.GetProperty("vocabulary").EnumerateArray()) await s.Exec("INSERT INTO toeic_vocabulary(word_id,word,pronunciation,meaning,example,topic) VALUES(:id,:word,:pronunciation,:meaning,:example,:topic)", ("id", N(x, "id")), ("word", T(x, "word")), ("pronunciation", T(x, "pronunciation")), ("meaning", T(x, "meaning")), ("example", T(x, "example")), ("topic", T(x, "topic")));
        int[] listening = [5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 135, 140, 145, 150, 155, 160, 165, 170, 180, 185, 190, 195, 200, 210, 220, 225, 230, 235, 240, 245, 250, 255, 260, 270, 275, 280, 285, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 345, 350, 360, 365, 370, 375, 380, 390, 395, 400, 405, 410, 420, 425, 430, 435, 440, 450, 455, 460, 470, 475, 480, 485, 490, 495, 495, 495, 495, 495, 495, 495, 495];
        int[] reading = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 95, 100, 110, 115, 120, 125, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 210, 220, 225, 230, 235, 240, 250, 255, 260, 270, 275, 280, 285, 290, 295, 300, 305, 310, 320, 325, 330, 335, 340, 345, 350, 355, 360, 365, 370, 375, 380, 385, 390, 395, 400, 405, 410, 415, 420, 425, 430, 435, 440, 445, 450, 455, 465, 470, 480, 485, 490, 495, 495, 495, 495];
        for (var raw = 0; raw <= 100; raw++) foreach (var sec in new[] { "LISTENING", "READING" }) await s.Exec("INSERT INTO toeic_score_scale(section,raw_score,scaled_score) VALUES(:s,:r,:v)", ("s", sec), ("r", raw), ("v", sec == "LISTENING" ? listening[raw] : reading[raw]));
        for (var i = 1; i <= 8; i++) await s.Exec("INSERT INTO toeic_saved_words(user_id,word_id) VALUES(:u,:w)", ("u", i < 6 ? 2 : 6), ("w", i));
        var published = await s.Query("SELECT exam_id FROM toeic_exams WHERE status='PUBLISHED' ORDER BY exam_id");
        for (var i = 0; i < 10; i++)
        {
            long user = i < 6 ? 2 : 6 + (i % 4); var exam = published[i % published.Count].Number("examId"); var attempt = await s.Start(user, exam);
            await s.Exec("UPDATE toeic_answers SET selected_choice=CASE WHEN MOD(position,:divisor)=0 THEN CASE WHEN correct_choice='A' THEN 'B' ELSE 'A' END ELSE correct_choice END WHERE attempt_id=:id", ("divisor", 2 + i % 5), ("id", attempt));
            await s.Submit(user, attempt);
            await s.Exec("UPDATE toeic_attempts SET started_at=SYS_EXTRACT_UTC(SYSTIMESTAMP)-NUMTODSINTERVAL(:days,'DAY'),expires_at=SYS_EXTRACT_UTC(SYSTIMESTAMP)-NUMTODSINTERVAL(:days,'DAY')+NUMTODSINTERVAL(120,'MINUTE'),submitted_at=SYS_EXTRACT_UTC(SYSTIMESTAMP)-NUMTODSINTERVAL(:days,'DAY')+NUMTODSINTERVAL(18,'MINUTE'),elapsed_seconds=1080 WHERE attempt_id=:id", ("days", 12 - i), ("id", attempt));
        }
        await s.Commit(); Console.WriteLine("Seed complete: roles, users, content, score scale and 10 demo attempts.");
    }
    static string T(JsonElement x, string key) => x.TryGetProperty(key, out var v) && v.ValueKind != JsonValueKind.Null ? v.GetString() ?? "" : "";
    static long N(JsonElement x, string key) => x.GetProperty(key).GetInt64();
}
