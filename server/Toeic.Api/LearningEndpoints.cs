using System.Text.Json;
using static Toeic.Api.Values;
namespace Toeic.Api;

public record StartInput(long ExamId);
public record AnswerInput(long QuestionId, string? Choice, bool Marked);
public record AnswersInput(List<AnswerInput> Answers);
public static class LearningEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/catalog/stats", async (Database db) =>
        {
            await using var s = await db.Open(); return Results.Ok(await s.One("SELECT (SELECT COUNT(*) FROM toeic_exams WHERE status='PUBLISHED') exams,(SELECT COUNT(*) FROM toeic_questions WHERE active=1) questions,(SELECT COUNT(*) FROM toeic_lessons) lessons,(SELECT COUNT(*) FROM toeic_vocabulary) words FROM dual"));
        });
        app.MapGet("/api/exams", async (string? search, string? kind, int? part, Database db) =>
        {
            await using var s = await db.Open(); return Results.Ok(await s.Query("SELECT e.* FROM vw_toeic_exam_summary e WHERE e.status='PUBLISHED' AND (:search IS NULL OR LOWER(e.title) LIKE :search) AND (:kind IS NULL OR e.kind=:kind) AND (:part IS NULL OR EXISTS(SELECT 1 FROM toeic_exam_items i JOIN toeic_questions q ON q.question_id=i.question_id JOIN toeic_groups g ON g.group_id=q.group_id WHERE i.exam_id=e.exam_id AND g.part_no=:part)) ORDER BY e.exam_id", ("search", string.IsNullOrWhiteSpace(search) ? null : "%" + search.ToLowerInvariant() + "%"), ("kind", kind), ("part", part)));
        });
        app.MapGet("/api/exams/{id:long}", async (long id, HttpContext ctx, Database db) =>
        {
            await using var s = await db.Open(); var exam = await s.One("SELECT * FROM vw_toeic_exam_summary WHERE exam_id=:id AND status='PUBLISHED'", ("id", id));
            var parts = await s.Query("SELECT g.part_no,COUNT(*) question_count FROM toeic_exam_items i JOIN toeic_questions q ON q.question_id=i.question_id JOIN toeic_groups g ON g.group_id=q.group_id WHERE i.exam_id=:id GROUP BY g.part_no ORDER BY g.part_no", ("id", id));
            long? activeAttempt = null; if (ctx.User.Identity?.IsAuthenticated == true) { var rows = await s.Query("SELECT attempt_id FROM toeic_attempts WHERE user_id=:u AND exam_id=:e AND status='IN_PROGRESS'", ("u", ctx.User.Id()), ("e", id)); if (rows.Count > 0) activeAttempt = rows[0].Number("attemptId"); }
            return Results.Ok(new { exam, parts, activeAttempt });
        });
        app.MapGet("/api/lessons", async (Database db) => { await using var s = await db.Open(); return Results.Ok(await s.Query("SELECT lesson_id id,part_no,title,summary,duration_minutes FROM toeic_lessons ORDER BY part_no,lesson_id")); });
        app.MapGet("/api/lessons/{id:long}", async (long id, Database db) => { await using var s = await db.Open(); return Results.Ok(await s.One("SELECT lesson_id id,part_no,title,summary,content,duration_minutes FROM toeic_lessons WHERE lesson_id=:id", ("id", id))); });
        app.MapGet("/api/vocabulary", async (string? search, string? topic, bool? saved, HttpContext ctx, Database db) =>
        {
            await using var s = await db.Open(); long user = ctx.User.Identity?.IsAuthenticated == true ? ctx.User.Id() : 0;
            return Results.Ok(await s.Query("SELECT v.word_id id,v.word,v.pronunciation,v.meaning,v.example,v.topic,CASE WHEN w.word_id IS NULL THEN 0 ELSE 1 END saved FROM toeic_vocabulary v LEFT JOIN toeic_saved_words w ON w.word_id=v.word_id AND w.user_id=:u WHERE (:search IS NULL OR LOWER(v.word) LIKE :search OR LOWER(v.meaning) LIKE :search) AND (:topic IS NULL OR v.topic=:topic) AND (:saved=0 OR w.word_id IS NOT NULL) ORDER BY v.word", ("u", user), ("search", string.IsNullOrWhiteSpace(search) ? null : "%" + search.ToLowerInvariant() + "%"), ("topic", string.IsNullOrWhiteSpace(topic) ? null : topic), ("saved", saved == true ? 1 : 0)));
        });
        app.MapPut("/api/vocabulary/{id:long}/save", async (long id, HttpContext ctx, Database db) =>
        { await using var s = await db.Open(ctx.User.Id()); s.Begin(); await s.One("SELECT word_id FROM toeic_vocabulary WHERE word_id=:id", ("id", id)); await s.Exec("MERGE INTO toeic_saved_words w USING (SELECT :u user_id,:w word_id FROM dual) x ON(w.user_id=x.user_id AND w.word_id=x.word_id) WHEN NOT MATCHED THEN INSERT(user_id,word_id) VALUES(x.user_id,x.word_id)", ("u", ctx.User.Id()), ("w", id)); await s.Commit(); return Results.Ok(new { saved = true }); }).RequireAuthorization();
        app.MapDelete("/api/vocabulary/{id:long}/save", async (long id, HttpContext ctx, Database db) => { await using var s = await db.Open(ctx.User.Id()); s.Begin(); await s.Exec("DELETE FROM toeic_saved_words WHERE user_id=:u AND word_id=:w", ("u", ctx.User.Id()), ("w", id)); await s.Commit(); return Results.Ok(new { saved = false }); }).RequireAuthorization();
        app.MapPost("/api/attempts", async (StartInput input, HttpContext ctx, Database db) =>
        { await using var s = await db.Open(ctx.User.Id()); s.Begin(); var id = await s.Start(ctx.User.Id(), input.ExamId); await s.Commit(); return Results.Created($"/api/attempts/{id}", new { id }); }).RequireAuthorization();
        app.MapGet("/api/attempts/{id:long}", async (long id, HttpContext ctx, Database db) =>
        {
            await using var s = await db.Open(ctx.User.Id()); s.Begin(); var attempt = await GetAttempt(s, ctx.User.Id(), id, true);
            if (attempt.Text("status") == "IN_PROGRESS" && attempt.Number("expired") == 1) { await s.Submit(ctx.User.Id(), id); attempt = await GetAttempt(s, ctx.User.Id(), id); }
            var questions = await s.Query("SELECT question_id id,position,part_no,group_id,prompt,passage,choices_json,audio_url,image_url,selected_choice,marked,correct_choice,explanation,is_correct FROM toeic_answers WHERE attempt_id=:id ORDER BY position", ("id", id));
            var complete = attempt.Text("status") != "IN_PROGRESS";
            foreach (var q in questions) { q["choices"] = JsonSerializer.Deserialize<JsonElement>(q.Text("choicesJson")); q.Remove("choicesJson"); if (!complete) { q.Remove("correctChoice"); q.Remove("explanation"); q.Remove("isCorrect"); } }
            var parts = complete ? await s.Query("SELECT part_no,COUNT(*) total,SUM(is_correct) correct FROM toeic_answers WHERE attempt_id=:id GROUP BY part_no ORDER BY part_no", ("id", id)) : [];
            await s.Commit(); return Results.Ok(new { attempt, questions, parts });
        }).RequireAuthorization();
        app.MapPut("/api/attempts/{id:long}/answers", async (long id, AnswersInput input, HttpContext ctx, Database db) =>
        {
            Require(input.Answers is not null && input.Answers.Count <= 200, "Tối đa 200 câu trả lời trong một lần lưu.");
            Require(input.Answers!.Select(a => a.QuestionId).Distinct().Count() == input.Answers.Count, "Mỗi câu hỏi chỉ được gửi một đáp án.");
            await using var s = await db.Open(ctx.User.Id()); s.Begin(); var attempt = await GetAttempt(s, ctx.User.Id(), id, true);
            if (attempt.Text("status") == "IN_PROGRESS" && attempt.Number("expired") == 1) { await s.Submit(ctx.User.Id(), id); await s.Commit(); return Results.Ok(new { status = "EXPIRED" }); }
            if (attempt.Text("status") != "IN_PROGRESS") throw new ApiError(409, "Bài đã nộp, không thể sửa đáp án.");
            var valid = await s.Query("SELECT question_id,choices_json FROM toeic_answers WHERE attempt_id=:id", ("id", id));
            foreach (var a in input.Answers)
            {
                var question = valid.Find(q => q.Number("questionId") == a.QuestionId); Require(question is not null, "Câu hỏi không thuộc lượt thi này.");
                using var choices = JsonDocument.Parse(question!.Text("choicesJson"));
                Require(a.Choice is null || choices.RootElement.EnumerateArray().Any(c => c.GetProperty("key").GetString() == a.Choice), "Lựa chọn trả lời không hợp lệ.");
                await s.Exec("UPDATE toeic_answers SET selected_choice=:choice,marked=:marked WHERE attempt_id=:id AND question_id=:q", ("choice", a.Choice), ("marked", a.Marked ? 1 : 0), ("id", id), ("q", a.QuestionId));
            }
            await s.Commit(); return Results.Ok(new { status = "IN_PROGRESS", savedAt = DateTime.UtcNow });
        }).RequireAuthorization();
        app.MapPost("/api/attempts/{id:long}/submit", async (long id, HttpContext ctx, Database db) =>
        { await using var s = await db.Open(ctx.User.Id()); s.Begin(); await GetAttempt(s, ctx.User.Id(), id, true); await s.Submit(ctx.User.Id(), id); await s.Commit(); return Results.Ok(new { id }); }).RequireAuthorization();
        app.MapGet("/api/history", async (HttpContext ctx, Database db) =>
        { await using var s = await db.Open(ctx.User.Id()); await FinalizeExpired(s, ctx.User.Id()); return Results.Ok(await s.Query("SELECT a.attempt_id id,e.title,e.kind,a.status,a.started_at,a.submitted_at,a.listening_score,a.reading_score,a.correct_count,a.total_count,a.elapsed_seconds FROM toeic_attempts a JOIN toeic_exams e ON e.exam_id=a.exam_id WHERE a.user_id=:u ORDER BY a.started_at DESC", ("u", ctx.User.Id()))); }).RequireAuthorization();
        app.MapGet("/api/dashboard", async (HttpContext ctx, Database db) =>
        {
            await using var s = await db.Open(ctx.User.Id()); await FinalizeExpired(s, ctx.User.Id());
            var summary = await s.One("SELECT COUNT(*) completed_count,NVL(MAX(listening_score+reading_score),0) best_score,NVL(ROUND(AVG(listening_score+reading_score)),0) average_score,NVL(SUM(elapsed_seconds),0) study_seconds FROM toeic_attempts WHERE user_id=:u AND status<>'IN_PROGRESS'", ("u", ctx.User.Id()));
            var recent = await s.Query("SELECT a.attempt_id id,e.title,e.kind,a.listening_score,a.reading_score,a.correct_count,a.total_count,a.started_at FROM toeic_attempts a JOIN toeic_exams e ON e.exam_id=a.exam_id WHERE a.user_id=:u AND a.status<>'IN_PROGRESS' ORDER BY a.started_at DESC FETCH FIRST 8 ROWS ONLY", ("u", ctx.User.Id()));
            var parts = await s.Query("SELECT b.part_no,COUNT(*) total,NVL(SUM(b.is_correct),0) correct,ROUND(100*AVG(b.is_correct)) accuracy FROM toeic_answers b JOIN toeic_attempts a ON a.attempt_id=b.attempt_id WHERE a.user_id=:u AND a.status<>'IN_PROGRESS' GROUP BY b.part_no ORDER BY b.part_no", ("u", ctx.User.Id()));
            var active = await s.Query("SELECT a.attempt_id id,e.title,a.expires_at FROM toeic_attempts a JOIN toeic_exams e ON e.exam_id=a.exam_id WHERE a.user_id=:u AND a.status='IN_PROGRESS' ORDER BY a.started_at DESC", ("u", ctx.User.Id()));
            return Results.Ok(new { summary, recent, parts, active });
        }).RequireAuthorization();
    }
    static Task<Dictionary<string, object?>> GetAttempt(Store s, long user, long id, bool locked = false) => s.One("SELECT a.attempt_id id,a.exam_id,a.status,a.started_at,a.expires_at,a.submitted_at,a.listening_score,a.reading_score,a.correct_count,a.total_count,a.elapsed_seconds,e.title,e.kind,SYS_EXTRACT_UTC(SYSTIMESTAMP) server_time,CASE WHEN a.expires_at<=SYS_EXTRACT_UTC(SYSTIMESTAMP) THEN 1 ELSE 0 END expired FROM toeic_attempts a JOIN toeic_exams e ON e.exam_id=a.exam_id WHERE a.attempt_id=:id AND a.user_id=:u" + (locked ? " FOR UPDATE OF a.status" : ""), ("id", id), ("u", user));
    static async Task FinalizeExpired(Store s, long user)
    { var rows = await s.Query("SELECT attempt_id FROM toeic_attempts WHERE user_id=:u AND status='IN_PROGRESS' AND expires_at<=SYS_EXTRACT_UTC(SYSTIMESTAMP)", ("u", user)); if (rows.Count == 0) return; s.Begin(); foreach (var row in rows) await s.Submit(user, row.Number("attemptId")); await s.Commit(); }
}
