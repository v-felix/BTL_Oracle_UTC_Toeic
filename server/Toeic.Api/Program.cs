using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Oracle.ManagedDataAccess.Client;
using System.Threading.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Toeic.Api;

var root = Directory.Exists("server/Toeic.Api") ? Path.GetFullPath("server/Toeic.Api") : Directory.GetCurrentDirectory();
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = root });
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
builder.Services.AddSingleton<Database>();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = "utc-toeic.csrf"; o.Cookie.SameSite = SameSiteMode.Strict; });
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "utc-toeic.session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(8); o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return c.Response.WriteAsJsonAsync(new { message = "Vui lòng đăng nhập để tiếp tục." }); };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return c.Response.WriteAsJsonAsync(new { message = "Bạn không có quyền thực hiện thao tác này." }); };
    o.Events.OnValidatePrincipal = async c =>
    {
        if (c.Principal?.Identity?.IsAuthenticated != true) return;
        await using var s = await c.HttpContext.RequestServices.GetRequiredService<Database>().Open(c.Principal.Id());
        var rows = await s.Query("SELECT u.active,r.code FROM toeic_users u JOIN toeic_roles r ON r.role_id=u.role_id WHERE u.user_id=:id", ("id", c.Principal.Id()));
        if (rows.Count == 0 || rows[0].Number("active") != 1 || rows[0].Text("code") != c.Principal.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value) c.RejectPrincipal();
    };
});
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Content", p => p.RequireRole("ADMIN", "CONTENT_ADMIN"));
    o.AddPolicy("Admin", p => p.RequireRole("ADMIN"));
    o.AddPolicy("Reports", p => p.RequireRole("ADMIN", "TEACHER", "CONTENT_ADMIN", "AUDITOR"));
});
builder.Services.AddRateLimiter(o => o.AddPolicy("auth", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })));
var app = builder.Build();
if (args.Contains("--seed")) { await Seed.Run(app.Services.GetRequiredService<Database>()); return; }
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (Exception ex)
    {
        if (ctx.Response.HasStarted) throw;
        var (status, message) = ex switch
        {
            ApiError e => (e.Status, e.Message),
            AntiforgeryValidationException => (400, "Phiên bảo vệ đã hết hạn. Tải lại trang rồi thử lại."),
            OracleException e when e.Number == 1 => (409, "Dữ liệu đã tồn tại. Kiểm tra tên đăng nhập, email hoặc mã đề."),
            OracleException e when e.Number == 2292 => (409, "Dữ liệu đã được sử dụng. Hãy lưu trữ hoặc vô hiệu hóa thay vì xóa."),
            OracleException e when e.Number is 2290 or 1400 or 12899 => (400, "Dữ liệu chưa đúng ràng buộc. Kiểm tra các trường nhập."),
            OracleException e when e.Number == 1403 => (404, "Không tìm thấy dữ liệu."),
            OracleException e when e.Number >= 20000 && e.Number < 20100 => (400, "Thao tác chưa hợp lệ: đề chưa xuất bản hoặc tài khoản bị khóa."),
            BadHttpRequestException => (400, "Nội dung gửi lên không hợp lệ."),
            _ => (500, "Không thể xử lý yêu cầu. Vui lòng thử lại.")
        };
        if (status >= 500) app.Logger.LogError(ex, "Request failed {TraceId}", ctx.TraceIdentifier);
        ctx.Response.StatusCode = status; await ctx.Response.WriteAsJsonAsync(new { message, traceId = ctx.TraceIdentifier });
    }
});
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff"; ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    if (ctx.Request.Path.StartsWithSegments("/api")) ctx.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseStaticFiles(); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && ctx.Request.Method is not ("GET" or "HEAD" or "OPTIONS"))
        await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);
    await next();
});
app.MapGet("/api/health", async (Database db) => { await using var s = await db.Open(); await s.Scalar("SELECT 1 FROM dual"); return Results.Ok(new { status = "ok", database = "Oracle 19c", serverTime = DateTime.UtcNow }); });
AuthEndpoints.Map(app); LearningEndpoints.Map(app); AdminEndpoints.Map(app);
app.MapFallback("/api/{**path}", () => Results.NotFound(new { message = "API không tồn tại." }));
var builtWeb = Path.GetFullPath(Path.Combine(root, "../../web/dist"));
if (Directory.Exists(builtWeb))
{
    var files = new PhysicalFileProvider(builtWeb);
    app.UseStaticFiles(new StaticFileOptions { FileProvider = files });
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = files });
}
else app.MapFallbackToFile("index.html");
await app.RunAsync();
