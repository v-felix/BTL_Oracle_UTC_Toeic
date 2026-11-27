import React, { useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Database,
  Users,
  Layers,
  BookOpen,
  Headphones,
  ShieldCheck,
  Activity,
  Upload,
  ArrowUpRight,
} from "lucide-react";
import { api } from "./api";
import {
  useAuth,
  useApi,
  useToast,
  Loading,
  ErrorBox,
  Empty,
  PageHead,
  Modal,
  date,
  statusName,
  kindName,
  partNames,
} from "./ui";
export function Admin() {
  const { section = "overview" } = useParams(),
    { user } = useAuth();
  const tabs = [
    ["overview", "Tổng quan"],
    ...(["ADMIN", "CONTENT_ADMIN"].includes(user.role)
      ? [
          ["exams", "Đề thi"],
          ["questions", "Câu hỏi"],
          ["lessons", "Bài học"],
          ["vocabulary", "Từ vựng"],
        ]
      : []),
    ...(user.role === "ADMIN"
      ? [
          ["users", "Người dùng"],
          ["database", "Oracle"],
          ["audit", "Nhật ký"],
        ]
      : []),
  ];
  if (!tabs.some((t) => t[0] === section))
    return <Empty title="Bạn chưa có quyền cho chức năng này" />;
  return (
    <>
      <PageHead
        eyebrow="Quản trị"
        title="Quản trị hệ thống"
        description="Quản lý nội dung học tập và theo dõi hoạt động của học viên."
      />
      <nav className="admin-tabs">
        {tabs.map(([key, title]) => (
          <NavLink
            key={key}
            end
            to={key === "overview" ? "/admin" : "/admin/" + key}
          >
            {title}
          </NavLink>
        ))}
      </nav>
      {
        {
          overview: <AdminOverview />,
          exams: <AdminExams />,
          questions: <AdminQuestions />,
          lessons: <AdminContent type="lessons" />,
          vocabulary: <AdminContent type="vocabulary" />,
          users: <AdminUsers />,
          database: <AdminDatabase />,
          audit: <AdminAudit />,
        }[section]
      }
    </>
  );
}
function State({ state, children }) {
  return state.loading ? (
    <Loading />
  ) : state.error ? (
    <ErrorBox message={state.error} retry={state.reload} />
  ) : (
    children
  );
}
function AdminOverview() {
  const s = useApi("/admin/stats");
  return (
    <State state={s}>
      {s.data && (
        <>
          <div className="stat-grid">
            {[
              [s.data.totals.users, "Tài khoản", Users],
              [s.data.totals.exams, "Đề thi", Headphones],
              [s.data.totals.questions, "Câu hỏi", Layers],
              [s.data.totals.completedAttempts, "Lượt hoàn thành", Activity],
            ].map(([n, t, Icon]) => (
              <article className="stat-card" key={t}>
                <span className="stat-icon sage">
                  <Icon size={22} />
                </span>
                <div>
                  <strong>{n}</strong>
                  <span>{t}</span>
                </div>
              </article>
            ))}
          </div>
          <section className="panel table-panel">
            <h2>Hoạt động gần đây</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Học viên</th>
                    <th>Đề thi</th>
                    <th>Điểm</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {s.data.recent.map((x) => (
                    <tr key={x.id}>
                      <td>{x.fullName}</td>
                      <td>{x.title}</td>
                      <td>
                        {x.listeningScore == null
                          ? "—"
                          : x.listeningScore + x.readingScore}
                      </td>
                      <td>{statusName(x.status)}</td>
                      <td>{date(x.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>Thành tích học viên</h2>
            <div className="leaderboard">
              {s.data.leaderboard.map((x, i) => (
                <div key={x.userId}>
                  <b>{i + 1}</b>
                  <span>
                    {x.fullName}
                    <small>{x.completedCount} bài hoàn thành</small>
                  </span>
                  <strong>{x.bestScore}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </State>
  );
}
function AdminExams() {
  const s = useApi("/admin/exams"),
    pool = useApi("/admin/questions"),
    toast = useToast();
  const [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const fresh = {
    title: "",
    description: "",
    durationMinutes: 30,
    kind: "MINI_TEST",
    status: "DRAFT",
    questionIds: [],
  };
  async function edit(x) {
    try {
      setError("");
      setEditing(x ? await api("/admin/exams/" + x.examId) : fresh);
    } catch (e) {
      toast(e.message, "error");
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/exams" + (editing.examId ? "/" + editing.examId : ""), {
        method: editing.examId ? "PUT" : "POST",
        body: { ...editing, durationMinutes: Number(editing.durationMinutes) },
      });
      setEditing(null);
      s.reload();
      toast("Đã lưu đề thi.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(x) {
    if (!window.confirm("Xóa đề chưa sử dụng hoặc lưu trữ đề đã có lượt thi?"))
      return;
    try {
      const r = await api("/admin/exams/" + x.examId, { method: "DELETE" });
      toast(r.archived ? "Đã chuyển đề vào lưu trữ." : "Đã xóa đề.");
      s.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  }
  function set(key, value) {
    setEditing((x) => ({ ...x, [key]: value }));
  }
  function toggle(id) {
    setEditing((x) => ({
      ...x,
      questionIds: x.questionIds.includes(id)
        ? x.questionIds.filter((n) => n !== id)
        : [...x.questionIds, id],
    }));
  }
  return (
    <>
      <div className="section-head">
        <h2>Danh sách đề thi</h2>
        <button className="btn" onClick={() => edit(null)}>
          <Plus size={17} />
          Tạo đề mới
        </button>
      </div>
      <State state={s}>
        <div className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tên đề</th>
                  <th>Loại</th>
                  <th>Số câu</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.data?.map((x) => (
                  <tr key={x.examId}>
                    <td>
                      <strong>{x.title}</strong>
                    </td>
                    <td>{kindName(x.kind)}</td>
                    <td>{x.questionCount}</td>
                    <td>{x.durationMinutes} phút</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (x.status === "PUBLISHED" ? "sage" : "sand")
                        }
                      >
                        {statusName(x.status)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-btn"
                          onClick={() => edit(x)}
                          aria-label={"Sửa " + x.title}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => remove(x)}
                          aria-label={"Xóa " + x.title}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </State>
      {editing && (
        <Modal
          title={editing.examId ? "Chỉnh sửa đề thi" : "Tạo đề thi"}
          onClose={() => !busy && setEditing(null)}
          wide
        >
          <form onSubmit={save} className="modal-body form-stack">
            <div className="form-grid">
              <label>
                Tên đề
                <input
                  required
                  maxLength={200}
                  value={editing.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </label>
              <label>
                Thời lượng (phút)
                <input
                  required
                  type="number"
                  min={1}
                  max={240}
                  value={editing.durationMinutes}
                  onChange={(e) => set("durationMinutes", e.target.value)}
                />
              </label>
              <label>
                Loại đề
                <select
                  value={editing.kind}
                  onChange={(e) => set("kind", e.target.value)}
                >
                  {["MINI_TEST", "FULL_TEST", "PRACTICE"].map((k) => (
                    <option value={k} key={k}>
                      {kindName(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trạng thái
                <select
                  value={editing.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {["DRAFT", "PUBLISHED", "ARCHIVED"].map((k) => (
                    <option value={k} key={k}>
                      {statusName(k)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Mô tả
              <textarea
                maxLength={2000}
                value={editing.description || ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>
            <div className="selection-header">
              <strong>Chọn câu hỏi ({editing.questionIds.length}/200)</strong>
              <button
                type="button"
                className="text-link"
                onClick={() => set("questionIds", [])}
              >
                Bỏ chọn tất cả
              </button>
            </div>
            <div className="part-shortcuts">
              {partNames.map((p, i) => (
                <button
                  type="button"
                  key={p}
                  onClick={() =>
                    set(
                      "questionIds",
                      [
                        ...new Set([
                          ...editing.questionIds,
                          ...(pool.data || [])
                            .filter((q) => q.partNo === i + 1 && q.active)
                            .map((q) => q.id),
                        ]),
                      ].sort((a, b) => a - b),
                    )
                  }
                >
                  + Part {i + 1}
                </button>
              ))}
            </div>
            <input
              aria-label="Tìm câu hỏi"
              placeholder="Tìm nội dung câu hỏi…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="muted small">
              Câu hỏi xuất hiện theo thứ tự chọn. Khi xuất bản, phải chọn đủ các
              câu cùng nhóm nghe/đọc. Full test dùng cấu trúc 200 câu chuẩn.
            </p>
            <div className="question-picker">
              {pool.loading ? (
                <Loading />
              ) : pool.error ? (
                <ErrorBox message={pool.error} retry={pool.reload} />
              ) : (
                pool.data
                  ?.filter(
                    (q) =>
                      q.active &&
                      q.prompt.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((q) => (
                    <label key={q.id}>
                      <input
                        type="checkbox"
                        checked={editing.questionIds.includes(q.id)}
                        onChange={() => toggle(q.id)}
                      />
                      <span className="badge">P{q.partNo}</span>
                      <span>
                        <b>#{q.id}</b> {q.prompt}
                        <small>{q.groupTitle}</small>
                      </span>
                    </label>
                  ))
              )}
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Hủy
              </button>
              <button className="btn" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu đề thi"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function AdminQuestions() {
  const [part, setPart] = useState(""),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const s = useApi("/admin/questions" + (part ? "?part=" + part : "")),
    groups = useApi("/admin/groups"),
    toast = useToast();
  const fresh = {
    groupId: null,
    partNo: 5,
    groupTitle: "Nhóm câu hỏi mới",
    passage: "",
    audioUrl: "",
    imageUrl: "",
    prompt: "",
    explanation: "",
    correctChoice: "A",
    difficulty: "MEDIUM",
    choices: ["A", "B", "C", "D"].map((key) => ({ key, text: "" })),
  };
  const set = (k, v) => setEditing((x) => ({ ...x, [k]: v }));
  async function edit(x) {
    try {
      setError("");
      setEditing(x ? await api("/admin/questions/" + x.id) : fresh);
    } catch (e) {
      toast(e.message, "error");
    }
  }
  async function pickGroup(value) {
    if (!value) {
      setEditing((x) => ({
        ...x,
        groupId: null,
        groupTitle: "Nhóm câu hỏi mới",
        passage: "",
        audioUrl: "",
        imageUrl: "",
      }));
      return;
    }
    try {
      const group = groups.data.find((x) => x.id === Number(value)),
        all = await api("/admin/questions?part=" + group.partNo),
        first = all.find((x) => x.groupId === group.id);
      const full = first ? await api("/admin/questions/" + first.id) : {};
      setEditing((x) => ({
        ...x,
        groupId: group.id,
        partNo: group.partNo,
        groupTitle: group.title,
        passage: full.passage || "",
        audioUrl: full.audioUrl || "",
        imageUrl: full.imageUrl || "",
        choices: (group.partNo === 2
          ? ["A", "B", "C"]
          : ["A", "B", "C", "D"]
        ).map(
          (key) => x.choices.find((c) => c.key === key) || { key, text: "" },
        ),
      }));
    } catch (e) {
      toast(e.message, "error");
    }
  }
  async function upload(e, key) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api("/admin/media", { method: "POST", body: form });
      set(key, result.url);
      toast("Đã tải tệp lên.");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/questions" + (editing.id ? "/" + editing.id : ""), {
        method: editing.id ? "PUT" : "POST",
        body: { ...editing, partNo: Number(editing.partNo) },
      });
      setEditing(null);
      s.reload();
      groups.reload();
      toast("Đã lưu câu hỏi.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(x) {
    if (
      !window.confirm(
        "Xóa câu chưa sử dụng hoặc vô hiệu hóa câu đã có liên kết?",
      )
    )
      return;
    try {
      await api("/admin/questions/" + x.id, { method: "DELETE" });
      s.reload();
      toast("Đã xử lý câu hỏi.");
    } catch (e) {
      toast(e.message, "error");
    }
  }
  return (
    <>
      <div className="filter-bar">
        <select
          aria-label="Lọc Part"
          value={part}
          onChange={(e) => setPart(e.target.value)}
        >
          <option value="">Tất cả Part</option>
          {partNames.map((p, i) => (
            <option key={p} value={i + 1}>
              Part {i + 1}
            </option>
          ))}
        </select>
        <label className="search">
          <Search size={17} />
          <input
            placeholder="Tìm nội dung câu hỏi…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="btn" onClick={() => edit(null)}>
          <Plus size={17} />
          Thêm câu hỏi
        </button>
      </div>
      <State state={s}>
        <div className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Part</th>
                  <th>Câu hỏi</th>
                  <th>Mức độ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.data
                  ?.filter((x) =>
                    x.prompt.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((x) => (
                    <tr key={x.id}>
                      <td>#{x.id}</td>
                      <td>{x.partNo}</td>
                      <td className="question-cell">
                        <strong>{x.prompt}</strong>
                        <small>
                          {x.groupTitle}
                          {!x.active ? " · Đã vô hiệu hóa" : ""}
                        </small>
                      </td>
                      <td>
                        {
                          { EASY: "Dễ", MEDIUM: "Vừa", HARD: "Khó" }[
                            x.difficulty
                          ]
                        }
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-btn"
                            onClick={() => edit(x)}
                            aria-label={"Sửa câu " + x.id}
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => remove(x)}
                            aria-label={"Xóa câu " + x.id}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </State>
      {editing && (
        <Modal
          title={
            editing.id ? "Chỉnh sửa câu hỏi #" + editing.id : "Thêm câu hỏi"
          }
          onClose={() => !busy && setEditing(null)}
          wide
        >
          <form className="modal-body form-stack" onSubmit={save}>
            <p className="form-warning">
              Câu thuộc đề công khai cần chuyển đề về bản nháp trước khi sửa.
              Sửa tư liệu nhóm sẽ áp dụng cho mọi câu trong nhóm.
            </p>
            <div className="form-grid">
              <label>
                Nhóm câu hỏi
                <select
                  value={editing.groupId || ""}
                  onChange={(e) => pickGroup(e.target.value)}
                >
                  <option value="">Tạo nhóm mới</option>
                  {groups.data?.map((g) => (
                    <option value={g.id} key={g.id}>
                      P{g.partNo} · {g.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Part
                <select
                  value={editing.partNo}
                  disabled={!!editing.groupId}
                  onChange={(e) =>
                    setEditing((x) => ({
                      ...x,
                      partNo: Number(e.target.value),
                      choices: (Number(e.target.value) === 2
                        ? ["A", "B", "C"]
                        : ["A", "B", "C", "D"]
                      ).map(
                        (key) =>
                          x.choices.find((c) => c.key === key) || {
                            key,
                            text: "",
                          },
                      ),
                    }))
                  }
                >
                  {partNames.map((p, i) => (
                    <option value={i + 1} key={p}>
                      Part {i + 1} · {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Tên nhóm
              <input
                required
                value={editing.groupTitle}
                maxLength={200}
                onChange={(e) => set("groupTitle", e.target.value)}
              />
            </label>
            <label>
              Tư liệu bài đọc / hướng dẫn
              <textarea
                rows={5}
                value={editing.passage || ""}
                onChange={(e) => set("passage", e.target.value)}
              />
            </label>
            <div className="form-grid">
              {[
                ["audioUrl", "Âm thanh", ".mp3,.wav"],
                ["imageUrl", "Hình ảnh", ".png,.jpg,.jpeg,.webp"],
              ].map(([key, label, accept]) => (
                <label key={key}>
                  {label}
                  <input
                    value={editing[key] || ""}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder="/media/… hoặc HTTPS"
                  />
                  <input
                    type="file"
                    accept={accept}
                    onChange={(e) => upload(e, key)}
                    disabled={busy}
                  />
                </label>
              ))}
            </div>
            <label>
              Nội dung câu hỏi
              <textarea
                required
                rows={2}
                maxLength={10000}
                value={editing.prompt}
                onChange={(e) => set("prompt", e.target.value)}
              />
            </label>
            <div className="form-grid">
              {editing.choices.map((c, i) => (
                <label key={c.key}>
                  Lựa chọn {c.key}
                  <input
                    required
                    maxLength={1000}
                    value={c.text}
                    onChange={(e) =>
                      set(
                        "choices",
                        editing.choices.map((item, j) =>
                          j === i ? { ...item, text: e.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className="form-grid">
              <label>
                Đáp án đúng
                <select
                  value={editing.correctChoice}
                  onChange={(e) => set("correctChoice", e.target.value)}
                >
                  {editing.choices.map((c) => (
                    <option key={c.key}>{c.key}</option>
                  ))}
                </select>
              </label>
              <label>
                Mức độ
                <select
                  value={editing.difficulty}
                  onChange={(e) => set("difficulty", e.target.value)}
                >
                  <option value="EASY">Dễ</option>
                  <option value="MEDIUM">Vừa</option>
                  <option value="HARD">Khó</option>
                </select>
              </label>
            </div>
            <label>
              Giải thích
              <textarea
                rows={4}
                value={editing.explanation || ""}
                onChange={(e) => set("explanation", e.target.value)}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Hủy
              </button>
              <button className="btn" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu câu hỏi"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function AdminContent({ type }) {
  const isLesson = type === "lessons",
    s = useApi(isLesson ? "/admin/lessons" : "/vocabulary"),
    toast = useToast();
  const [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fields = isLesson
    ? [
        ["title", "Tên bài học"],
        ["partNo", "Part", "number"],
        ["durationMinutes", "Thời lượng (phút)", "number"],
        ["summary", "Tóm tắt", "textarea"],
        ["content", "Nội dung bài học", "textarea"],
      ]
    : [
        ["word", "Từ vựng"],
        ["pronunciation", "Phiên âm"],
        ["meaning", "Nghĩa tiếng Việt"],
        ["example", "Câu ví dụ", "textarea"],
        ["topic", "Chủ đề"],
      ];
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/" + type + (editing.id ? "/" + editing.id : ""), {
        method: editing.id ? "PUT" : "POST",
        body: isLesson
          ? {
              ...editing,
              partNo: Number(editing.partNo),
              durationMinutes: Number(editing.durationMinutes),
            }
          : editing,
      });
      setEditing(null);
      s.reload();
      toast("Đã lưu nội dung.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(x) {
    if (!window.confirm("Bạn muốn xóa nội dung này?")) return;
    try {
      await api("/admin/" + type + "/" + x.id, { method: "DELETE" });
      s.reload();
      toast("Đã xóa.");
    } catch (e) {
      toast(e.message, "error");
    }
  }
  return (
    <>
      <div className="section-head">
        <h2>{isLesson ? "Bài học" : "Từ vựng"}</h2>
        <button
          className="btn"
          onClick={() => {
            setError("");
            setEditing(
              isLesson
                ? {
                    title: "",
                    partNo: 5,
                    durationMinutes: 10,
                    summary: "",
                    content: "",
                  }
                : {
                    word: "",
                    pronunciation: "",
                    meaning: "",
                    example: "",
                    topic: "",
                  },
            );
          }}
        >
          <Plus size={17} />
          Thêm mới
        </button>
      </div>
      <State state={s}>
        <div className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{isLesson ? "Bài học" : "Từ vựng"}</th>
                  <th>{isLesson ? "Part" : "Nghĩa"}</th>
                  <th>{isLesson ? "Thời lượng" : "Chủ đề"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.data?.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <strong>{isLesson ? x.title : x.word}</strong>
                    </td>
                    <td>{isLesson ? x.partNo : x.meaning}</td>
                    <td>{isLesson ? x.durationMinutes + " phút" : x.topic}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setError("");
                            setEditing(x);
                          }}
                          aria-label="Sửa nội dung"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => remove(x)}
                          aria-label="Xóa nội dung"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </State>
      {editing && (
        <Modal
          title={
            (editing.id ? "Chỉnh sửa " : "Thêm ") +
            (isLesson ? "bài học" : "từ vựng")
          }
          onClose={() => !busy && setEditing(null)}
          wide={isLesson}
        >
          <form onSubmit={save} className="modal-body form-stack">
            {fields.map(([key, label, inputType]) => (
              <label key={key}>
                {label}
                {inputType === "textarea" ? (
                  <textarea
                    required={key === "content"}
                    rows={key === "content" ? 14 : 3}
                    value={editing[key] || ""}
                    onChange={(e) =>
                      setEditing((x) => ({ ...x, [key]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    required={!["pronunciation"].includes(key)}
                    type={inputType || "text"}
                    min={1}
                    max={key === "partNo" ? 7 : 240}
                    value={editing[key] || ""}
                    onChange={(e) =>
                      setEditing((x) => ({ ...x, [key]: e.target.value }))
                    }
                  />
                )}
              </label>
            ))}
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
              <button className="btn" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu nội dung"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function AdminUsers() {
  const s = useApi("/admin/users"),
    toast = useToast(),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/users/" + editing.id, {
        method: "PUT",
        body: {
          ...editing,
          active: !!editing.active,
          targetScore: Number(editing.targetScore),
        },
      });
      setEditing(null);
      s.reload();
      toast("Đã cập nhật tài khoản.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <State state={s}>
      <div className="panel table-panel">
        <h2>Quản lý tài khoản</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.data?.map((x) => (
                <tr key={x.id}>
                  <td>
                    <strong>{x.fullName}</strong>
                    <small>@{x.username}</small>
                  </td>
                  <td>{x.email}</td>
                  <td>{x.roleName}</td>
                  <td>
                    <span className={"badge " + (x.active ? "sage" : "sand")}>
                      {x.active ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setError("");
                        setEditing(x);
                      }}
                      aria-label={"Sửa " + x.username}
                    >
                      <Pencil size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <Modal
          title={"Tài khoản @" + editing.username}
          onClose={() => !busy && setEditing(null)}
        >
          <form className="modal-body form-stack" onSubmit={save}>
            <label>
              Họ tên
              <input
                value={editing.fullName}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, fullName: e.target.value }))
                }
                required
                maxLength={120}
              />
            </label>
            <label>
              Vai trò
              <select
                value={editing.role}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, role: e.target.value }))
                }
              >
                {[
                  ["STUDENT", "Học viên"],
                  ["TEACHER", "Giảng viên"],
                  ["CONTENT_ADMIN", "Biên tập viên"],
                  ["ADMIN", "Quản trị viên"],
                  ["AUDITOR", "Kiểm toán viên"],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mục tiêu
              <input
                type="number"
                min={10}
                max={990}
                value={editing.targetScore}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, targetScore: e.target.value }))
                }
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!editing.active}
                onChange={(e) =>
                  setEditing((x) => ({ ...x, active: e.target.checked }))
                }
              />
              Cho phép đăng nhập
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button disabled={busy} className="btn">
                {busy ? "Đang lưu…" : "Lưu tài khoản"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </State>
  );
}
function AdminDatabase() {
  const s = useApi("/admin/database");
  return (
    <State state={s}>
      {s.data && (
        <>
          <section className="database-banner">
            <Database size={35} />
            <div>
              <h2>
                {s.data.instance[0]?.databaseName} · Oracle{" "}
                {s.data.instance[0]?.version}
              </h2>
              <p>
                {s.data.instance[0]?.openMode} /{" "}
                {s.data.instance[0]?.instanceStatus} /{" "}
                {s.data.instance[0]?.logMode}
              </p>
            </div>
            <span className="badge sage">Kết nối thực tế</span>
          </section>
          <p className="muted">
            Trang này chỉ đọc thông tin. Các thao tác quản trị instance và phục
            hồi được thực hành qua bộ SQL/RMAN trong dự án.
          </p>
          <div className="profile-grid">
            <section className="panel table-panel">
              <h2>14 bảng nghiệp vụ</h2>
              <table>
                <thead>
                  <tr>
                    <th>Bảng</th>
                    <th>Số bản ghi thực tế</th>
                  </tr>
                </thead>
                <tbody>
                  {s.data.tables.map((t) => (
                    <tr key={t.tableName}>
                      <td>
                        <code>{t.tableName}</code>
                      </td>
                      <td>{t.rowCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="panel table-panel">
              <h2>Datafile của TOEIC_DATA</h2>
              {s.data.files.map((f) => (
                <div key={f.fileName} className="datafile">
                  <strong>{f.tablespaceName}</strong>
                  <code>{f.fileName}</code>
                  <p>
                    {f.sizeMb} MB · Autoextend {f.autoextensible} · Max{" "}
                    {f.maxMb} MB
                  </p>
                </div>
              ))}
              <h2>Phân quyền ứng dụng</h2>
              <p className="muted">
                TOEIC_APP sử dụng role TOEIC_RUNTIME và quyền trên các đối tượng
                được cấp; không sử dụng SYS hoặc SYSTEM.
              </p>
              <p>{s.data.grants.length} quyền trên bảng, view và package.</p>
            </section>
          </div>
          <section className="panel table-panel">
            <h2>Segment và extent</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>Loại</th>
                    <th>MB</th>
                    <th>Extent</th>
                  </tr>
                </thead>
                <tbody>
                  {s.data.segments.map((x) => (
                    <tr key={x.segmentName}>
                      <td>
                        <code>{x.segmentName}</code>
                      </td>
                      <td>{x.segmentType}</td>
                      <td>{x.sizeMb}</td>
                      <td>{x.extents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </State>
  );
}
function AdminAudit() {
  const s = useApi("/admin/audit");
  return (
    <State state={s}>
      <div className="panel table-panel">
        <h2>100 hoạt động gần nhất</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {s.data?.map((x) => (
                <tr key={x.id}>
                  <td>{date(x.createdAt)}</td>
                  <td>{x.actor || "Bootstrap"}</td>
                  <td>
                    <span className="badge">{x.action}</span>
                  </td>
                  <td>
                    {x.entity} #{x.entityId}
                  </td>
                  <td>{x.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </State>
  );
}
