using System.Text.Json;
using static Toeic.Api.Values;
namespace Toeic.Api;

public record ChoiceInput(string Key, string Text);
public record ExamInput(string Title, string? Description, int DurationMinutes, string Kind, string Status, List<long> QuestionIds);
public record QuestionInput(long? GroupId, int PartNo, string? GroupTitle, string? Passage, string? AudioUrl, string? ImageUrl, string Prompt, string? Explanation, string CorrectChoice, string Difficulty, List<ChoiceInput> Choices);
public record UserInput(string FullName, string Role, bool Active, int TargetScore);
public record LessonInput(int PartNo, string Title, string? Summary, string Content, int DurationMinutes);
public record WordInput(string Word, string? Pronunciation, string Meaning, string? Example, string Topic);
public static class AdminEndpoints
{
    public static void Map(WebApplication app)
    {
        var reports = app.MapGroup("/api/admin").RequireAuthorization("Reports");
        reports.MapGet("/stats", async (Database db) =>
        {
            await using var s = await db.Open(); var totals = await s.One("SELECT (SELECT COUNT(*) FROM toeic_users) users,(SELECT COUNT(*) FROM toeic_exams) exams,(SELECT COUNT(*) FROM toeic_questions) questions,(SELECT COUNT(*) FROM toeic_attempts WHERE status<>'IN_PROGRESS') completed_attempts FROM dual");
            var recent = await s.Query("SELECT a.attempt_id id,u.full_name,e.title,a.listening_score,a.reading_score,a.status,a.started_at FROM toeic_attempts a JOIN toeic_users u ON u.user_id=a.user_id JOIN toeic_exams e ON e.exam_id=a.exam_id ORDER BY a.started_at DESC FETCH FIRST 10 ROWS ONLY");
            var leaderboard = await s.Query("SELECT * FROM vw_toeic_user_progress WHERE completed_count>0 ORDER BY best_score DESC FETCH FIRST 5 ROWS ONLY"); return Results.Ok(new { totals, recent, leaderboard });
        });
        var admin = app.MapGroup("/api/admin").RequireAuthorization("Admin");
        admin.MapGet("/users", async (Database db) => { await using var s = await db.Open(); return Results.Ok(await s.Query(AuthEndpoints.UserSql + "ORDER BY u.user_id")); });
        admin.MapPut("/users/{id:long}", async (long id, UserInput input, HttpContext ctx, Database db) =>
        {
            Require(input.TargetScore is >= 10 and <= 990, "Mục tiêu phải từ 10 đến 990."); Require(id != ctx.User.Id() || (input.Active && input.Role == "ADMIN"), "Bạn không thể tự khóa hoặc hạ quyền tài khoản đang sử dụng.");
            await using var s = await db.Open(ctx.User.Id()); s.Begin(); await s.One("SELECT user_id FROM toeic_users WHERE user_id=:id FOR UPDATE", ("id", id));
            var role = await s.One("SELECT role_id FROM toeic_roles WHERE code=:code", ("code", input.Role));
            await s.Exec("UPDATE toeic_users SET full_name=:name,role_id=:role,active=:active,target_score=:target WHERE user_id=:id", ("name", Clean(input.FullName, 120, "Họ tên")), ("role", role.Number("roleId")), ("active", input.Active ? 1 : 0), ("target", input.TargetScore), ("id", id));
            await s.Exec("INSERT INTO toeic_audit(actor,action,entity,entity_id) VALUES(:actor,'UPDATE','USER',:id)", ("actor", ctx.User.Id().ToString()), ("id", id)); await s.Commit(); return Results.Ok(new { id });
        });
        admin.MapGet("/database", async (Database db) =>
        {
            await using var s = await db.Open(); var instance = await s.Query("SELECT * FROM vw_toeic_instance"); var files = await s.Query("SELECT * FROM vw_toeic_datafiles"); var segments = await s.Query("SELECT * FROM vw_toeic_segments");
            var tables = await s.Query("SELECT * FROM vw_toeic_table_counts ORDER BY table_name");
            var grants = await s.Query("SELECT * FROM vw_toeic_privileges"); return Results.Ok(new { instance, files, segments, tables, grants });
        });
        admin.MapGet("/audit", async (Database db) => { await using var s = await db.Open(); return Results.Ok(await s.Query("SELECT audit_id id,actor,action,entity,entity_id,detail,created_at FROM toeic_audit ORDER BY audit_id DESC FETCH FIRST 100 ROWS ONLY")); });
        var content = app.MapGroup("/api/admin").RequireAuthorization("Content");
        content.MapGet("/exams", async (Database db) => { await using var s = await db.Open(); return Results.Ok(await s.Query("SELECT * FROM vw_toeic_exam_summary ORDER BY exam_id DESC")); });
        content.MapGet("/exams/{id:long}", async (long id, Database db) => { await using var s = await db.Open(); var exam = await s.One("SELECT * FROM vw_toeic_exam_summary WHERE exam_id=:id", ("id", id)); var items = await s.Query("SELECT question_id FROM toeic_exam_items WHERE exam_id=:id ORDER BY position", ("id", id)); exam["questionIds"] = items.Select(x => x.Number("questionId")); return Results.Ok(exam); });
        content.MapPost("/exams", async (ExamInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveExam(null, input, ctx.User.Id(), db) }));
        content.MapPut("/exams/{id:long}", async (long id, ExamInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveExam(id, input, ctx.User.Id(), db) }));
        content.MapDelete("/exams/{id:long}", async (long id, HttpContext ctx, Database db) =>
        {
            await using var s = await db.Open(ctx.User.Id()); s.Begin(); await s.One("SELECT exam_id FROM toeic_exams WHERE exam_id=:id FOR UPDATE", ("id", id));
            var used = await s.Scalar("SELECT COUNT(*) FROM toeic_attempts WHERE exam_id=:id", ("id", id)); await s.Exec(used > 0 ? "UPDATE toeic_exams SET status='ARCHIVED' WHERE exam_id=:id" : "DELETE FROM toeic_exams WHERE exam_id=:id", ("id", id)); await s.Commit(); return Results.Ok(new { archived = used > 0 });
        });
        content.MapGet("/questions", async (string? search, int? part, Database db) =>
        {
            await using var s = await db.Open(); var rows = await s.Query("SELECT q.question_id id,q.group_id,g.part_no,g.title group_title,q.prompt,q.difficulty,q.active FROM toeic_questions q JOIN toeic_groups g ON g.group_id=q.group_id WHERE (:part IS NULL OR g.part_no=:part) AND (:search IS NULL OR DBMS_LOB.INSTR(LOWER(q.prompt),:search)>0) ORDER BY g.part_no,q.question_id FETCH FIRST 1000 ROWS ONLY", ("part", part), ("search", string.IsNullOrWhiteSpace(search) ? null : search.ToLowerInvariant())); return Results.Ok(rows);
        });
        content.MapGet("/groups", async (Database db) => { await using var s = await db.Open(); return Results.Ok(await s.Query("SELECT group_id id,part_no,title FROM toeic_groups ORDER BY part_no,group_id")); });
        content.MapGet("/questions/{id:long}", async (long id, Database db) =>
        { await using var s = await db.Open(); var row = await s.One("SELECT q.question_id id,q.group_id,q.prompt,q.explanation,q.correct_choice,q.difficulty,g.part_no,g.title group_title,g.passage,g.audio_url,g.image_url FROM toeic_questions q JOIN toeic_groups g ON g.group_id=q.group_id WHERE q.question_id=:id", ("id", id)); row["choices"] = await s.Query("SELECT choice_key key,choice_text text FROM toeic_choices WHERE question_id=:id ORDER BY choice_key", ("id", id)); return Results.Ok(row); });
        content.MapPost("/questions", async (QuestionInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveQuestion(null, input, ctx.User.Id(), db) }));
        content.MapPut("/questions/{id:long}", async (long id, QuestionInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveQuestion(id, input, ctx.User.Id(), db) }));
        content.MapDelete("/questions/{id:long}", async (long id, HttpContext ctx, Database db) =>
        {
            await using var s = await db.Open(ctx.User.Id()); s.Begin(); await s.One("SELECT question_id FROM toeic_questions WHERE question_id=:id FOR UPDATE", ("id", id));
            if (await s.Scalar("SELECT COUNT(*) FROM toeic_exam_items i JOIN toeic_exams e ON e.exam_id=i.exam_id WHERE i.question_id=:id AND e.status='PUBLISHED'", ("id", id)) > 0) throw new ApiError(409, "Hãy chuyển đề chứa câu hỏi sang bản nháp trước.");
            var used = await s.Scalar("SELECT (SELECT COUNT(*) FROM toeic_exam_items WHERE question_id=:id)+(SELECT COUNT(*) FROM toeic_answers WHERE question_id=:id) FROM dual", ("id", id));
            await s.Exec(used > 0 ? "UPDATE toeic_questions SET active=0 WHERE question_id=:id" : "DELETE FROM toeic_questions WHERE question_id=:id", ("id", id)); await s.Commit(); return Results.Ok(new { archived = used > 0 });
        });
        content.MapGet("/lessons", async (Database db) => { await using var s = await db.Open(); return Results.Ok(await s.Query("SELECT lesson_id id,part_no,title,summary,content,duration_minutes FROM toeic_lessons ORDER BY lesson_id")); });
        content.MapPost("/lessons", async (LessonInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveLesson(null, input, ctx.User.Id(), db) }));
        content.MapPut("/lessons/{id:long}", async (long id, LessonInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveLesson(id, input, ctx.User.Id(), db) }));
        content.MapDelete("/lessons/{id:long}", async (long id, HttpContext ctx, Database db) => { await using var s = await db.Open(ctx.User.Id()); s.Begin(); Require(await s.Exec("DELETE FROM toeic_lessons WHERE lesson_id=:id", ("id", id)) > 0, "Bài học không tồn tại."); await s.Commit(); return Results.Ok(new { id }); });
        content.MapPost("/vocabulary", async (WordInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveWord(null, input, ctx.User.Id(), db) }));
        content.MapPut("/vocabulary/{id:long}", async (long id, WordInput input, HttpContext ctx, Database db) => Results.Ok(new { id = await SaveWord(id, input, ctx.User.Id(), db) }));
        content.MapDelete("/vocabulary/{id:long}", async (long id, HttpContext ctx, Database db) => { await using var s = await db.Open(ctx.User.Id()); s.Begin(); Require(await s.Exec("DELETE FROM toeic_vocabulary WHERE word_id=:id", ("id", id)) > 0, "Từ không tồn tại."); await s.Commit(); return Results.Ok(new { id }); });
        content.MapPost("/media", async (HttpRequest request, IWebHostEnvironment env) =>
        {
            Require(request.HasFormContentType, "Hãy chọn tệp để tải lên.");
            var form = await request.ReadFormAsync(); var file = form.Files.GetFile("file"); Require(file is not null && file.Length is >= 12 and <= 20971520, "Tệp phải có nội dung hợp lệ và tối đa 20 MB.");
            var ext = Path.GetExtension(file!.FileName).ToLowerInvariant(); Require(new[] { ".mp3", ".wav", ".png", ".jpg", ".jpeg", ".webp" }.Contains(ext), "Chỉ chấp nhận MP3, WAV, PNG, JPG, WEBP.");
            var signature = new byte[12]; await using (var stream = file.OpenReadStream()) { await stream.ReadExactlyAsync(signature); }
            var valid = ext switch
            {
                ".mp3" => (signature[0] == 0xff && (signature[1] & 0xe0) == 0xe0) || System.Text.Encoding.ASCII.GetString(signature, 0, 3) == "ID3",
                ".wav" => System.Text.Encoding.ASCII.GetString(signature, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(signature, 8, 4) == "WAVE",
                ".png" => signature.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                ".jpg" or ".jpeg" => signature[0] == 255 && signature[1] == 216 && signature[2] == 255,
                ".webp" => System.Text.Encoding.ASCII.GetString(signature, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(signature, 8, 4) == "WEBP",
                _ => false
            }; Require(valid, "Nội dung tệp không đúng định dạng.");
            var folder = Path.Combine(env.ContentRootPath, "wwwroot", "uploads"); Directory.CreateDirectory(folder); var name = Guid.NewGuid().ToString("N") + ext; await using (var target = File.Create(Path.Combine(folder, name))) await file.CopyToAsync(target); return Results.Ok(new { url = "/uploads/" + name });
        }).DisableAntiforgery(); // Custom global X-CSRF-TOKEN validation above remains enabled.
    }
    static async Task<long> SaveExam(long? id, ExamInput x, long actor, Database db)
    {
        var title = Clean(x.Title, 200, "Tên đề"); Require(x.DurationMinutes is >= 1 and <= 240, "Thời gian từ 1 đến 240 phút."); Require(new[] { "FULL_TEST", "MINI_TEST", "PRACTICE" }.Contains(x.Kind), "Loại đề không hợp lệ."); Require(new[] { "DRAFT", "PUBLISHED", "ARCHIVED" }.Contains(x.Status), "Trạng thái không hợp lệ."); Require(x.QuestionIds is not null && x.QuestionIds.Count <= 200 && x.QuestionIds.Distinct().Count() == x.QuestionIds.Count, "Đề tối đa 200 câu không trùng lặp.");
        await using var s = await db.Open(actor); s.Begin(); if (id.HasValue) await s.One("SELECT exam_id FROM toeic_exams WHERE exam_id=:id FOR UPDATE", ("id", id));
        var pool = await s.Query("SELECT q.question_id id,q.group_id,q.active,g.part_no FROM toeic_questions q JOIN toeic_groups g ON g.group_id=q.group_id");
        Require(x.QuestionIds!.All(q => pool.Any(p => p.Number("id") == q && p.Number("active") == 1)), "Có câu hỏi không tồn tại hoặc đã vô hiệu hóa.");
        if (x.Status == "PUBLISHED")
        {
            Require(x.QuestionIds.Count > 0, "Cần thêm câu hỏi trước khi xuất bản."); var chosen = pool.Where(p => x.QuestionIds.Contains(p.Number("id"))).ToList();
            foreach (var group in chosen.Select(p => p.Number("groupId")).Distinct()) Require(chosen.Count(p => p.Number("groupId") == group) == pool.Count(p => p.Number("groupId") == group && p.Number("active") == 1), "Phải chọn đủ các câu thuộc cùng một bài nghe hoặc bài đọc.");
            if (x.Kind == "FULL_TEST") { int[] counts = [6, 25, 39, 30, 30, 16, 54]; Require(Enumerable.Range(1, 7).All(p => chosen.Count(q => q.Number("partNo") == p) == counts[p - 1]), "Full test phải có 200 câu theo cấu trúc 6/25/39/30/30/16/54."); }
        }
        var values = new (string, object?)[] { ("title", title), ("description", Clean(x.Description, 2000, "Mô tả", false)), ("minutes", x.DurationMinutes), ("kind", x.Kind), ("status", x.Status) };
        var exam = id ?? await s.Insert("INSERT INTO toeic_exams(title,description,duration_minutes,kind,status,slug) VALUES(:title,:description,:minutes,:kind,:status,:slug)", values.Append(("slug", (object?)("de-" + Guid.NewGuid().ToString("N")[..12]))).ToArray());
        if (id.HasValue) await s.Exec("UPDATE toeic_exams SET title=:title,description=:description,duration_minutes=:minutes,kind=:kind,status=:status WHERE exam_id=:id", values.Append(("id", (object?)id)).ToArray());
        await s.Exec("DELETE FROM toeic_exam_items WHERE exam_id=:id", ("id", exam)); var position = 0; foreach (var q in x.QuestionIds) await s.Exec("INSERT INTO toeic_exam_items(exam_id,question_id,position) VALUES(:e,:q,:p)", ("e", exam), ("q", q), ("p", ++position)); await s.Commit(); return exam;
    }
    static async Task<long> SaveQuestion(long? id, QuestionInput x, long actor, Database db)
    {
        Require(x.PartNo is >= 1 and <= 7, "Part phải từ 1 đến 7."); Require(new[] { "EASY", "MEDIUM", "HARD" }.Contains(x.Difficulty), "Mức độ không hợp lệ.");
        Require(x.Choices is not null && x.Choices.Count == (x.PartNo == 2 ? 3 : 4) && x.Choices.Select(c => c.Key).Distinct().Count() == x.Choices.Count, "Cần 3 lựa chọn ở Part 2, các phần khác cần 4 lựa chọn không trùng."); Require(x.Choices!.All(c => new[] { "A", "B", "C", "D" }.Contains(c.Key)) && x.Choices.Any(c => c.Key == x.CorrectChoice), "Đáp án đúng phải có trong danh sách lựa chọn.");
        await using var s = await db.Open(actor); s.Begin(); if (id.HasValue) await s.One("SELECT question_id FROM toeic_questions WHERE question_id=:id FOR UPDATE", ("id", id));
        if (id.HasValue && await s.Scalar("SELECT COUNT(*) FROM toeic_exam_items i JOIN toeic_exams e ON e.exam_id=i.exam_id WHERE i.question_id=:id AND e.status='PUBLISHED'", ("id", id)) > 0) throw new ApiError(409, "Chuyển các đề chứa câu hỏi sang bản nháp trước khi sửa.");
        long group;
        if (x.GroupId.HasValue)
        {
            group = x.GroupId.Value; var g = await s.One("SELECT part_no FROM toeic_groups WHERE group_id=:id FOR UPDATE", ("id", group)); Require(g.Number("partNo") == x.PartNo, "Part phải khớp nhóm câu hỏi.");
            if (await s.Scalar("SELECT COUNT(*) FROM toeic_questions q JOIN toeic_exam_items i ON i.question_id=q.question_id JOIN toeic_exams e ON e.exam_id=i.exam_id WHERE q.group_id=:g AND e.status='PUBLISHED'", ("g", group)) > 0) throw new ApiError(409, "Nhóm đang thuộc đề công khai. Chuyển đề về bản nháp trước khi sửa nhóm.");
            await s.Exec("UPDATE toeic_groups SET title=:title,passage=:passage,audio_url=:audio,image_url=:image WHERE group_id=:id", ("title", Clean(x.GroupTitle, 200, "Tên nhóm")), ("passage", Clean(x.Passage, 40000, "Đoạn văn", false)), ("audio", Media(x.AudioUrl)), ("image", Media(x.ImageUrl)), ("id", group));
        }
        else group = await s.Insert("INSERT INTO toeic_groups(part_no,title,passage,audio_url,image_url) VALUES(:part,:title,:passage,:audio,:image)", ("part", x.PartNo), ("title", Clean(x.GroupTitle, 200, "Tên nhóm")), ("passage", Clean(x.Passage, 40000, "Đoạn văn", false)), ("audio", Media(x.AudioUrl)), ("image", Media(x.ImageUrl)));
        var values = new (string, object?)[] { ("group_id", group), ("prompt", Clean(x.Prompt, 10000, "Câu hỏi")), ("explanation", Clean(x.Explanation, 20000, "Giải thích", false)), ("correct", x.CorrectChoice), ("difficulty", x.Difficulty) };
        var question = id ?? await s.Insert("INSERT INTO toeic_questions(group_id,prompt,explanation,correct_choice,difficulty) VALUES(:group_id,:prompt,:explanation,:correct,:difficulty)", values);
        if (id.HasValue) await s.Exec("UPDATE toeic_questions SET group_id=:group_id,prompt=:prompt,explanation=:explanation,correct_choice=:correct,difficulty=:difficulty WHERE question_id=:id", values.Append(("id", (object?)id)).ToArray());
        await s.Exec("DELETE FROM toeic_choices WHERE question_id=:id", ("id", question)); foreach (var c in x.Choices) await s.Exec("INSERT INTO toeic_choices(question_id,choice_key,choice_text) VALUES(:id,:key,:text)", ("id", question), ("key", c.Key), ("text", Clean(c.Text, 1000, "Lựa chọn"))); await s.Commit(); return question;
    }
    static string Media(string? value) { var text = Clean(value, 1000, "Media URL", false); Require(text.Length == 0 || text.StartsWith("/media/") || text.StartsWith("/uploads/") || (Uri.TryCreate(text, UriKind.Absolute, out var uri) && uri.Scheme == "https"), "Media dùng đường dẫn nội bộ hoặc HTTPS."); return text; }
    static async Task<long> SaveLesson(long? id, LessonInput x, long actor, Database db)
    {
        Require(x.PartNo is >= 1 and <= 7 && x.DurationMinutes is >= 1 and <= 240, "Part hoặc thời lượng chưa hợp lệ."); await using var s = await db.Open(actor); s.Begin();
        var values = new (string, object?)[] { ("part", x.PartNo), ("title", Clean(x.Title, 200, "Tên bài")), ("summary", Clean(x.Summary, 1000, "Tóm tắt", false)), ("content", Clean(x.Content, 50000, "Nội dung")), ("minutes", x.DurationMinutes) };
        var result = id ?? await s.Insert("INSERT INTO toeic_lessons(part_no,title,summary,content,duration_minutes) VALUES(:part,:title,:summary,:content,:minutes)", values); if (id.HasValue) Require(await s.Exec("UPDATE toeic_lessons SET part_no=:part,title=:title,summary=:summary,content=:content,duration_minutes=:minutes WHERE lesson_id=:id", values.Append(("id", (object?)id)).ToArray()) > 0, "Bài học không tồn tại."); await s.Commit(); return result;
    }
    static async Task<long> SaveWord(long? id, WordInput x, long actor, Database db)
    {
        await using var s = await db.Open(actor); s.Begin(); var values = new (string, object?)[] { ("word", Clean(x.Word, 100, "Từ vựng")), ("pronunciation", Clean(x.Pronunciation, 200, "Phiên âm", false)), ("meaning", Clean(x.Meaning, 500, "Nghĩa")), ("example", Clean(x.Example, 1000, "Ví dụ", false)), ("topic", Clean(x.Topic, 100, "Chủ đề")) };
        var result = id ?? await s.Insert("INSERT INTO toeic_vocabulary(word,pronunciation,meaning,example,topic) VALUES(:word,:pronunciation,:meaning,:example,:topic)", values); if (id.HasValue) Require(await s.Exec("UPDATE toeic_vocabulary SET word=:word,pronunciation=:pronunciation,meaning=:meaning,example=:example,topic=:topic WHERE word_id=:id", values.Append(("id", (object?)id)).ToArray()) > 0, "Từ không tồn tại."); await s.Commit(); return result;
    }
}
