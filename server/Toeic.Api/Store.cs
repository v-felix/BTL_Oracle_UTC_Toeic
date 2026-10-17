using System.Data;
using System.Globalization;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;

namespace Toeic.Api;

public sealed class Database(IConfiguration config)
{
    public async Task<Store> Open(long? actor = null)
    {
        var cs = config.GetConnectionString("Oracle");
        if (string.IsNullOrWhiteSpace(cs)) throw new ApiError(503, "Chưa cấu hình Oracle. Chạy npm run setup trước.");
        var connection = new OracleConnection(cs);
        try { await connection.OpenAsync(); connection.ClientId = actor?.ToString() ?? "anonymous"; await using var cmd = connection.CreateCommand(); cmd.CommandText = "ALTER SESSION SET CURRENT_SCHEMA=TOEIC_OWNER"; await cmd.ExecuteNonQueryAsync(); return new Store(connection); }
        catch { await connection.DisposeAsync(); throw; }
    }
}

public sealed class Store(OracleConnection connection) : IAsyncDisposable
{
    public OracleConnection Connection { get; } = connection;
    public OracleTransaction? Transaction { get; private set; }
    public void Begin() => Transaction ??= Connection.BeginTransaction(IsolationLevel.ReadCommitted);
    public async Task Commit() { if (Transaction is not null) { await Transaction.CommitAsync(); await Transaction.DisposeAsync(); Transaction = null; } }
    public OracleCommand Command(string sql, params (string, object?)[] values)
    {
        var cmd = Connection.CreateCommand(); cmd.BindByName = true; cmd.CommandText = sql; cmd.Transaction = Transaction;
        foreach (var (key, value) in values)
        {
            var p = new OracleParameter { ParameterName = key, Value = value ?? DBNull.Value };
            if (value is string text && System.Text.Encoding.UTF8.GetByteCount(text) > 3500) p.OracleDbType = OracleDbType.Clob;
            cmd.Parameters.Add(p);
        }
        return cmd;
    }
    public async Task<int> Exec(string sql, params (string, object?)[] values) { await using var cmd = Command(sql, values); return await cmd.ExecuteNonQueryAsync(); }
    public async Task<long> Insert(string sql, params (string, object?)[] values)
    {
        await using var cmd = Command(sql + " RETURNING " + IdColumn(sql) + " INTO :new_id", values);
        cmd.Parameters.Add("new_id", OracleDbType.Int64).Direction = ParameterDirection.Output;
        await cmd.ExecuteNonQueryAsync(); return long.Parse(cmd.Parameters["new_id"].Value.ToString()!, CultureInfo.InvariantCulture);
    }
    static string IdColumn(string sql)
    {
        var table = sql.Split(' ', StringSplitOptions.RemoveEmptyEntries)[2].Split('(')[0].ToLowerInvariant();
        return table switch { "toeic_users" => "user_id", "toeic_groups" => "group_id", "toeic_questions" => "question_id", "toeic_exams" => "exam_id", "toeic_lessons" => "lesson_id", "toeic_vocabulary" => "word_id", _ => throw new InvalidOperationException("Unsupported identity table") };
    }
    public async Task<List<Dictionary<string, object?>>> Query(string sql, params (string, object?)[] values)
    {
        await using var cmd = Command(sql, values); await using var reader = await cmd.ExecuteReaderAsync();
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                object? value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                if (value is OracleClob clob) { value = clob.Value; clob.Dispose(); }
                if (value is DateTime date) value = DateTime.SpecifyKind(date, DateTimeKind.Utc);
                row[Camel(reader.GetName(i))] = value;
            }
            rows.Add(row);
        }
        return rows;
    }
    public async Task<Dictionary<string, object?>> One(string sql, params (string, object?)[] values) => (await Query(sql, values)).FirstOrDefault() ?? throw new ApiError(404, "Không tìm thấy dữ liệu.");
    public async Task<long> Scalar(string sql, params (string, object?)[] values) { await using var cmd = Command(sql, values); var value = await cmd.ExecuteScalarAsync(); return value is null or DBNull ? 0 : Convert.ToInt64(value); }
    public async Task<long> Start(long user, long exam)
    {
        await using var cmd = Command("BEGIN pkg_toeic.start_attempt(:u,:e,:result); END;", ("u", user), ("e", exam));
        cmd.Parameters.Add("result", OracleDbType.Int64).Direction = ParameterDirection.Output;
        await cmd.ExecuteNonQueryAsync(); return long.Parse(cmd.Parameters["result"].Value.ToString()!, CultureInfo.InvariantCulture);
    }
    public Task<int> Submit(long user, long attempt) => Exec("BEGIN pkg_toeic.submit_attempt(:u,:a); END;", ("u", user), ("a", attempt));
    static string Camel(string value) { var words = value.ToLowerInvariant().Split('_'); return words[0] + string.Concat(words.Skip(1).Select(x => char.ToUpperInvariant(x[0]) + x[1..])); }
    public async ValueTask DisposeAsync() { if (Transaction is not null) { await Transaction.RollbackAsync(); await Transaction.DisposeAsync(); } await Connection.DisposeAsync(); }
}

public sealed class ApiError(int status, string message) : Exception(message) { public int Status { get; } = status; }
public static class Values
{
    public static long Id(this System.Security.Claims.ClaimsPrincipal user) => long.Parse(user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
    public static long Number(this Dictionary<string, object?> row, string key) => Convert.ToInt64(row[key]);
    public static string Text(this Dictionary<string, object?> row, string key) => row.GetValueOrDefault(key)?.ToString() ?? "";
    public static void Require([System.Diagnostics.CodeAnalysis.DoesNotReturnIf(false)] bool condition, string message) { if (!condition) throw new ApiError(400, message); }
    public static string Clean(string? value, int max, string name, bool required = true) { var text = (value ?? "").Trim(); Require((!required || text.Length > 0) && text.Length <= max, $"{name} phải có độ dài {(required ? 1 : 0)}–{max} ký tự."); return text; }
}
