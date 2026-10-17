using System.Net.Mail;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using static Toeic.Api.Values;

namespace Toeic.Api;

public record LoginInput(string Username, string Password);
public record RegisterInput(string Username, string Email, string Password, string FullName);
public record ProfileInput(string FullName, int TargetScore);
public record PasswordInput(string CurrentPassword, string NewPassword);
public static class AuthEndpoints
{
    public const string UserSql = "SELECT u.user_id id,u.username,u.email,u.full_name,u.target_score,u.active,r.code role,r.name role_name FROM toeic_users u JOIN toeic_roles r ON r.role_id=u.role_id ";
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/auth/csrf", (HttpContext ctx, IAntiforgery af) => Results.Ok(new { token = af.GetAndStoreTokens(ctx).RequestToken }));
        app.MapGet("/api/auth/me", async (HttpContext ctx, Database db) => { await using var s = await db.Open(ctx.User.Id()); return Results.Ok(await s.One(UserSql + "WHERE u.user_id=:id", ("id", ctx.User.Id()))); }).RequireAuthorization();
        app.MapPost("/api/auth/register", async (RegisterInput input, Database db) =>
        {
            var username = Clean(input.Username, 40, "Tên đăng nhập").ToLowerInvariant();
            Require(Regex.IsMatch(username, "^[a-z0-9_]{3,40}$"), "Tên đăng nhập gồm 3–40 chữ thường, số hoặc dấu gạch dưới.");
            var email = Clean(input.Email, 150, "Email").ToLowerInvariant(); Require(MailAddress.TryCreate(email, out var parsed) && parsed.Address == email, "Email không hợp lệ.");
            CheckPassword(input.Password); var name = Clean(input.FullName, 120, "Họ tên");
            await using var s = await db.Open(); s.Begin(); var hash = new PasswordHasher<string>().HashPassword(username, input.Password);
            var id = await s.Insert("INSERT INTO toeic_users(username,email,password_hash,full_name,role_id) VALUES(:username,:email,:hash,:name,(SELECT role_id FROM toeic_roles WHERE code='STUDENT'))", ("username", username), ("email", email), ("hash", hash), ("name", name));
            await s.Exec("INSERT INTO toeic_audit(actor,action,entity,entity_id) VALUES(:actor,'REGISTER','USER',:id)", ("actor", id.ToString()), ("id", id));
            await s.Commit(); return Results.Created("/api/auth/me", new { message = "Đăng ký thành công. Bạn có thể đăng nhập." });
        }).RequireRateLimiting("auth");
        app.MapPost("/api/auth/login", async (LoginInput input, HttpContext ctx, Database db) =>
        {
            var username = Clean(input.Username, 150, "Tên đăng nhập").ToLowerInvariant(); Clean(input.Password, 200, "Mật khẩu");
            await using var s = await db.Open(); var rows = await s.Query(UserSql + "WHERE u.username=:name OR u.email=:name", ("name", username));
            if (rows.Count != 1) throw new ApiError(401, "Tên đăng nhập hoặc mật khẩu chưa đúng.");
            var user = rows[0]; var stored = await s.One("SELECT password_hash FROM toeic_users WHERE user_id=:id", ("id", user.Number("id")));
            if (new PasswordHasher<string>().VerifyHashedPassword(username, stored.Text("passwordHash"), input.Password) == PasswordVerificationResult.Failed) throw new ApiError(401, "Tên đăng nhập hoặc mật khẩu chưa đúng.");
            if (user.Number("active") != 1) throw new ApiError(403, "Tài khoản đã bị vô hiệu hóa.");
            var claims = new[] { new Claim(ClaimTypes.NameIdentifier, user.Text("id")), new Claim(ClaimTypes.Name, user.Text("fullName")), new Claim(ClaimTypes.Role, user.Text("role")) };
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
            return Results.Ok(user);
        }).RequireRateLimiting("auth");
        app.MapPost("/api/auth/logout", async (HttpContext ctx) => { await ctx.SignOutAsync(); return Results.Ok(new { message = "Đã đăng xuất." }); }).RequireAuthorization();
        app.MapPut("/api/profile", async (ProfileInput input, HttpContext ctx, Database db) =>
        {
            var name = Clean(input.FullName, 120, "Họ tên"); Require(input.TargetScore is >= 10 and <= 990, "Mục tiêu từ 10 đến 990 điểm.");
            await using var s = await db.Open(ctx.User.Id()); s.Begin(); await s.Exec("UPDATE toeic_users SET full_name=:name,target_score=:target WHERE user_id=:id", ("name", name), ("target", input.TargetScore), ("id", ctx.User.Id())); await s.Commit(); return Results.Ok(await s.One(UserSql + "WHERE u.user_id=:id", ("id", ctx.User.Id())));
        }).RequireAuthorization();
        app.MapPut("/api/profile/password", async (PasswordInput input, HttpContext ctx, Database db) =>
        {
            CheckPassword(input.NewPassword); Require(!string.IsNullOrEmpty(input.CurrentPassword), "Nhập mật khẩu hiện tại.");
            await using var s = await db.Open(ctx.User.Id()); s.Begin(); var row = await s.One("SELECT username,password_hash FROM toeic_users WHERE user_id=:id FOR UPDATE", ("id", ctx.User.Id())); var hasher = new PasswordHasher<string>();
            if (hasher.VerifyHashedPassword(row.Text("username"), row.Text("passwordHash"), input.CurrentPassword) == PasswordVerificationResult.Failed) throw new ApiError(400, "Mật khẩu hiện tại chưa đúng.");
            await s.Exec("UPDATE toeic_users SET password_hash=:hash WHERE user_id=:id", ("hash", hasher.HashPassword(row.Text("username"), input.NewPassword)), ("id", ctx.User.Id())); await s.Commit(); return Results.Ok(new { message = "Đã đổi mật khẩu." });
        }).RequireAuthorization().RequireRateLimiting("auth");
    }
    static void CheckPassword(string? password) => Require(password is { Length: >= 8 and <= 100 } && password.Any(char.IsLetter) && password.Any(char.IsDigit), "Mật khẩu gồm 8–100 ký tự, có chữ và số.");
}
