import React, { useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Headphones,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  CheckCircle2,
  Search,
  Play,
  Bookmark,
  GraduationCap,
  ChevronLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  Flame,
  Award,
  Layers,
  CalendarDays,
} from "lucide-react";
import { api, resetCsrf } from "./api";
import {
  useAuth,
  useToast,
  useApi,
  Loading,
  ErrorBox,
  Empty,
  PageHead,
  Modal,
  date,
  kindName,
  statusName,
  partNames,
} from "./ui";

export function ExamCard({ exam, index = 0 }) {
  return (
    <article className="exam-card">
      <div className={"exam-card-art art-" + (index % 4)}>
        <span className="exam-art-label">UTC / ENGLISH PRACTICE</span>
        <Headphones size={58} strokeWidth={1.2} />
        <span className="exam-art-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="exam-card-body">
        <span className="badge">{kindName(exam.kind)}</span>
        <h3>
          <Link to={"/exams/" + exam.examId}>{exam.title}</Link>
        </h3>
        <p>{exam.description}</p>
        <div className="exam-meta">
          <span>
            <Layers size={15} />
            {exam.questionCount} câu
          </span>
          <span>
            <Clock size={15} />
            {exam.durationMinutes} phút
          </span>
        </div>
        <Link className="exam-card-link" to={"/exams/" + exam.examId}>
          Xem chi tiết <ArrowUpRight size={18} />
        </Link>
      </div>
    </article>
  );
}
export function Home() {
  const { user } = useAuth();
  const stats = useApi("/catalog/stats"),
    exams = useApi("/exams");
  return (
    <>
      <PageHead
        eyebrow="MỖI NGÀY MỘT CHÚT, TƯƠNG LAI MỘT BƯỚC"
        title={
          user
            ? `Chào ${user.fullName.split(" ").pop()}, cùng học nhé!`
            : "Hành trình TOEIC, bắt đầu từ bạn."
        }
        description="Một không gian để ôn luyện có kế hoạch và nhìn thấy mình tiến bộ."
      />
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag">
            <span />
            YOUR NEXT CHAPTER STARTS HERE
          </span>
          <h2>
            Học có mục tiêu.
            <br />
            Thi thêm <em>tự tin.</em>
          </h2>
          <p>
            Luyện đủ 7 phần, làm đề theo thời gian thực và hiểu rõ từng đáp án.
            Từng bước nhỏ đều được ghi nhận.
          </p>
          <div className="hero-actions">
            <Link className="btn cream" to="/exams">
              Chọn đề thi ngay <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link light" to="/learning">
              Khám phá bài học <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-bottom">
            <span>01 — Học kiến thức</span>
            <span>02 — Luyện mỗi ngày</span>
            <span>03 — Đo tiến bộ</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="target-card">
            <span>MỤC TIÊU CỦA BẠN</span>
            <div className="score-orbit">
              <div>
                <strong>
                  {user?.targetScore || 650}
                  <small>+</small>
                </strong>
                <span>TOEIC SCORE</span>
              </div>
            </div>
            <div className="target-card-footer">
              <Target size={17} />
              <span>Bắt đầu từ hôm nay</span>
            </div>
          </div>
          <div className="floating-tag">
            <CheckCircle2 size={18} />
            Sẵn sàng cho bước tiếp theo
          </div>
          <span className="hero-spark">✳</span>
        </div>
      </section>
      <div className="stat-grid">
        {[
          [stats.data?.exams, "Đề thi sẵn sàng", Headphones, "sage"],
          [stats.data?.questions, "Câu hỏi theo 7 phần", Layers, "peach"],
          [stats.data?.lessons, "Bài học nền tảng", BookOpen, "lavender"],
          [stats.data?.words, "Từ vựng công sở", Bookmark, "sand"],
        ].map(([v, label, Icon, color]) => (
          <div className="stat-card" key={label}>
            <span className={"stat-icon " + color}>
              <Icon size={22} />
            </span>
            <div>
              <strong>{v ?? "—"}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>
      {stats.error && <ErrorBox message={stats.error} retry={stats.reload} />}{" "}
      {user ? (
        <Progress />
      ) : (
        <div className="notice-inline">
          <GraduationCap size={22} />
          <span>
            Tạo tài khoản để lưu bài đang làm, xem lịch sử và theo dõi tiến bộ.
          </span>
          <Link to="/register">
            Đăng ký miễn phí <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <section>
        <div className="section-head">
          <div>
            <span className="eyebrow">CHỌN NHỊP HỌC CỦA BẠN</span>
            <h2>Bắt đầu với một đề thi</h2>
          </div>
          <Link className="text-link" to="/exams">
            Xem tất cả <ArrowRight size={18} />
          </Link>
        </div>
        {exams.loading ? (
          <Loading />
        ) : exams.error ? (
          <ErrorBox message={exams.error} retry={exams.reload} />
        ) : (
          <div className="exam-grid">
            {exams.data?.slice(0, 3).map((e, i) => (
              <ExamCard key={e.examId} exam={e} index={i} />
            ))}
          </div>
        )}
      </section>
      <section className="learning-band">
        <div>
          <span className="eyebrow">LỘ TRÌNH RÕ RÀNG</span>
          <h2>7 phần thi. Một mục tiêu.</h2>
          <p>Hiểu cấu trúc trước, luyện đúng trọng tâm sau.</p>
          <Link className="btn secondary" to="/learning">
            Vào góc học tập <ArrowRight size={17} />
          </Link>
        </div>
        <div className="part-path">
          {partNames.map((name, i) => (
            <Link key={name} to="/learning">
              <b>{i + 1}</b>
              <span>{name}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
function Progress() {
  const { data, error, loading, reload } = useApi("/dashboard");
  const { user } = useAuth();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const best = data.summary.bestScore;
  return (
    <section className="progress-grid">
      <article className="panel">
        <div className="section-head compact">
          <h2>Nhịp học của bạn</h2>
          <span className="badge sage">
            <TrendingUp size={13} />
            Đang tiến bước
          </span>
        </div>
        <div className="personal-metrics">
          <div>
            <strong>{data.summary.completedCount}</strong>
            <span>Bài đã hoàn thành</span>
          </div>
          <div>
            <strong>
              {best}
              <small> / 990</small>
            </strong>
            <span>Điểm tốt nhất</span>
          </div>
          <div>
            <strong>
              {Math.round(data.summary.studySeconds / 60)}
              <small> phút</small>
            </strong>
            <span>Thời gian luyện tập</span>
          </div>
        </div>
        <div className="goal-caption">
          <span>Mục tiêu {user.targetScore} điểm</span>
          <b>{Math.min(100, Math.round((best / user.targetScore) * 100))}%</b>
        </div>
        <div className="progress-bar">
          <i
            style={{
              width: Math.min(100, (best / user.targetScore) * 100) + "%",
            }}
          />
        </div>
        {data.active.length > 0 && (
          <Link className="resume-strip" to={"/attempts/" + data.active[0].id}>
            <Play size={17} />
            Tiếp tục: {data.active[0].title}
            <ArrowRight size={17} />
          </Link>
        )}
      </article>
      <article className="panel daily-card">
        <div className="daily-icon">
          <Flame size={26} />
        </div>
        <span className="eyebrow">MỘT GỢI Ý NHỎ</span>
        <h3>Giữ nhịp, đừng vội.</h3>
        <p>
          {data.parts.length
            ? `Part ${[...data.parts].sort((a, b) => a.accuracy - b.accuracy)[0].partNo} là phần bạn có thể dành thêm thời gian. Hãy ôn một bài rồi thử lại.`
            : "Bắt đầu bằng một đề ngắn để tìm ra phần bạn cần luyện thêm."}
        </p>
        <Link to="/learning" className="text-link">
          Ôn tập hôm nay <ArrowRight size={16} />
        </Link>
      </article>
    </section>
  );
}
export function Exams() {
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState("");
  const state = useApi("/exams");
  const list = state.data?.filter(
    (e) =>
      (!kind || e.kind === kind) &&
      e.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        eyebrow="PRACTICE MAKES PROGRESS"
        title="Thư viện đề thi"
        description="Chọn một bài vừa sức. Hoàn thành một bước tiến mới."
      />
      <div className="filter-bar">
        <div className="tabs">
          {[
            ["", "Tất cả"],
            ["FULL_TEST", "Full test"],
            ["MINI_TEST", "Mini test"],
            ["PRACTICE", "Luyện từng phần"],
          ].map(([k, t]) => (
            <button
              className={kind === k ? "active" : ""}
              key={k}
              onClick={() => setKind(k)}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên đề thi…"
            aria-label="Tìm đề thi"
          />
        </label>
      </div>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorBox message={state.error} retry={state.reload} />
      ) : list.length ? (
        <>
          <p className="result-count">{list.length} đề thi phù hợp</p>
          <div className="exam-grid">
            {list.map((e, i) => (
              <ExamCard key={e.examId} exam={e} index={i} />
            ))}
          </div>
        </>
      ) : (
        <Empty
          title="Chưa tìm thấy đề phù hợp"
          text="Thử tên đề khác hoặc chọn bộ lọc Tất cả."
        />
      )}
    </>
  );
}
export function ExamDetail() {
  const { id } = useParams(),
    state = useApi("/exams/" + id),
    { user } = useAuth(),
    navigate = useNavigate(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  async function start() {
    if (!user) {
      navigate("/login", { state: { from: "/exams/" + id } });
      return;
    }
    setBusy(true);
    try {
      const a = await api("/attempts", {
        method: "POST",
        body: { examId: Number(id) },
      });
      navigate("/attempts/" + a.id);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  if (state.loading) return <Loading />;
  if (state.error)
    return <ErrorBox message={state.error} retry={state.reload} />;
  const { exam, parts, activeAttempt } = state.data;
  return (
    <>
      <Link className="back-link" to="/exams">
        <ChevronLeft size={17} />
        Thư viện đề thi
      </Link>
      <div className="detail-layout">
        <section>
          <span className="badge">{kindName(exam.kind)}</span>
          <h1 className="detail-title">{exam.title}</h1>
          <p className="detail-description">{exam.description}</p>
          <div className="detail-facts">
            <span>
              <Layers />
              {exam.questionCount} câu hỏi
            </span>
            <span>
              <Clock />
              {exam.durationMinutes} phút
            </span>
            <span>
              <ShieldCheck />
              Chấm điểm tự động
            </span>
          </div>
          <article className="panel">
            <h2>Cấu trúc bài thi</h2>
            <div className="structure-list">
              {parts.map((p) => (
                <div key={p.partNo}>
                  <span className="part-pill">Part {p.partNo}</span>
                  <span>{partNames[p.partNo - 1]}</span>
                  <b>{p.questionCount} câu</b>
                </div>
              ))}
            </div>
          </article>
        </section>
        <aside className="panel start-panel">
          <div className="start-icon">
            <Headphones size={38} />
          </div>
          <h2>Sẵn sàng bắt đầu?</h2>
          <p>Chọn một nơi yên tĩnh và kiểm tra âm thanh trước khi làm bài.</p>
          <ul className="check-list">
            <li>
              <CheckCircle2 size={17} />
              Đáp án được tự động lưu khi chọn.
            </li>
            <li>
              <CheckCircle2 size={17} />
              Có thể đánh dấu và quay lại câu hỏi.
            </li>
            <li>
              <CheckCircle2 size={17} />
              Hết giờ, bài sẽ được chấm theo đáp án đã lưu.
            </li>
            <li>
              <CheckCircle2 size={17} />
              Xem đáp án và giải thích sau khi nộp.
            </li>
          </ul>
          <button className="btn full" onClick={start} disabled={busy}>
            {busy
              ? "Đang mở đề…"
              : activeAttempt
                ? "Tiếp tục bài đang làm"
                : user
                  ? "Bắt đầu làm bài"
                  : "Đăng nhập để làm bài"}
            <ArrowRight size={17} />
          </button>
          <small>
            Điểm quy đổi mang tính tham khảo, không thay thế kết quả TOEIC chính
            thức.
          </small>
        </aside>
      </div>
    </>
  );
}
export function AuthPage({ register = false }) {
  const { user, setUser } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form);
    if (register && body.password !== body.confirmPassword) {
      setError("Mật khẩu nhập lại chưa khớp.");
      setBusy(false);
      return;
    }
    try {
      const result = await api("/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body,
      });
      resetCsrf();
      if (register) navigate("/login", { state: { registered: true } });
      else {
        setUser(result);
        navigate(
          location.state?.from?.startsWith("/") &&
            !location.state.from.startsWith("//")
            ? location.state.from
            : "/",
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link className="brand light-brand" to="/">
          <span className="brand-icon">
            <GraduationCap />
          </span>
          <span>
            UTC <b>TOEIC</b>
          </span>
        </Link>
        <div>
          <span className="hero-tag">A LITTLE EVERY DAY</span>
          <h1>
            Tự tin hơn,
            <br />
            từng ngày một.
          </h1>
          <p>
            Hành trình chinh phục TOEIC bắt đầu từ những lần bạn chọn không bỏ
            cuộc.
          </p>
          <div className="auth-parts">
            LISTENING <span>+</span> READING <span>=</span> YOUR NEXT STEP
          </div>
        </div>
        <small>Không gian ôn luyện dành cho sinh viên ĐHGTVT.</small>
      </aside>
      <main className="auth-main">
        <Link className="back-link" to="/">
          <ChevronLeft size={17} />
          Về trang chủ
        </Link>
        <div className="auth-form">
          <span className="eyebrow">WELCOME TO YOUR LEARNING SPACE</span>
          <h1>{register ? "Tạo tài khoản mới" : "Chào mừng bạn trở lại"}</h1>
          <p>
            {register
              ? "Bắt đầu hành trình học tập của riêng bạn."
              : "Đăng nhập để tiếp tục những bước tiến của mình."}
          </p>
          {user && (
            <p className="notice-inline">
              Bạn đang đăng nhập bằng {user.username}.{" "}
              <Link to="/">Về trang chủ</Link>
            </p>
          )}
          {location.state?.registered && (
            <p className="form-success">
              Đăng ký thành công. Hãy đăng nhập để bắt đầu.
            </p>
          )}
          <form onSubmit={submit}>
            {register && (
              <label>
                Họ và tên
                <input
                  name="fullName"
                  autoComplete="name"
                  required
                  maxLength={120}
                  placeholder="Nguyễn Minh Anh"
                />
              </label>
            )}
            <label>
              {register ? "Tên đăng nhập" : "Tên đăng nhập hoặc email"}
              <input
                name="username"
                autoComplete="username"
                required
                minLength={3}
                maxLength={register ? 40 : 150}
                pattern={register ? "[a-z0-9_]{3,40}" : undefined}
                placeholder={register ? "minhanh_utc" : "Nhập tên đăng nhập"}
              />
            </label>
            {register && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={150}
                  placeholder="ban@example.com"
                />
              </label>
            )}
            <label>
              Mật khẩu
              <div className="password-input">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={register ? 8 : 1}
                  maxLength={100}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? "Ít nhất 8 ký tự, có chữ và số" : "Nhập mật khẩu"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {show ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
            {register && (
              <label>
                Nhập lại mật khẩu
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn full" disabled={busy}>
              {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Bạn đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Đăng nhập" : "Đăng ký ngay"}
            </Link>
          </p>
          {!register && (
            <details className="demo-logins">
              <summary>Tài khoản mẫu để xem dự án</summary>
              <p>
                Học viên: <b>student</b> / Student@2026
                <br />
                Quản trị: <b>admin</b> / Admin@2026
              </p>
              <small>
                Dữ liệu tiến độ của tài khoản mẫu là dữ liệu minh họa.
              </small>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
export function Learning() {
  const s = useApi("/lessons");
  return (
    <>
      <PageHead
        eyebrow="BUILD YOUR FOUNDATION"
        title="Góc học tập"
        description="Hiểu cách làm trước khi làm nhiều. Bắt đầu từ phần bạn muốn tiến bộ."
      />
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorBox message={s.error} retry={s.reload} />
      ) : (
        <div className="lesson-grid">
          {s.data.map((x, i) => (
            <Link className="lesson-card" to={"/learning/" + x.id} key={x.id}>
              <div className={"lesson-icon art-" + (i % 4)}>
                {x.partNo <= 4 ? (
                  <Headphones size={28} />
                ) : (
                  <BookOpen size={28} />
                )}
              </div>
              <span className="eyebrow">
                PART {x.partNo} · {x.durationMinutes} PHÚT
              </span>
              <h2>{x.title}</h2>
              <p>{x.summary}</p>
              <span className="text-link">
                Mở bài học <ArrowRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
export function Lesson() {
  const { id } = useParams(),
    s = useApi("/lessons/" + id);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox message={s.error} retry={s.reload} />;
  const x = s.data;
  return (
    <>
      <Link to="/learning" className="back-link">
        <ChevronLeft size={17} />
        Góc học tập
      </Link>
      <article className="lesson-detail panel">
        <span className="eyebrow">
          PART {x.partNo} · {x.durationMinutes} PHÚT ĐỌC
        </span>
        <h1>{x.title}</h1>
        <p className="lead">{x.summary}</p>
        <div className="prose">
          {x.content.split(/\n\s*\n/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <Link className="btn" to="/exams">
          Áp dụng vào bài luyện <ArrowRight size={17} />
        </Link>
      </article>
    </>
  );
}
export function Vocabulary() {
  const [search, setSearch] = useState(""),
    [topic, setTopic] = useState(""),
    [saved, setSaved] = useState(false),
    [flipped, setFlipped] = useState({});
  const s = useApi("/vocabulary"),
    { user } = useAuth(),
    toast = useToast();
  const words = s.data?.filter(
    (w) =>
      (!topic || w.topic === topic) &&
      (!saved || w.saved) &&
      (w.word + " " + w.meaning).toLowerCase().includes(search.toLowerCase()),
  );
  async function save(w) {
    if (!user) {
      toast("Đăng nhập để lưu từ vào sổ tay.", "error");
      return;
    }
    try {
      await api("/vocabulary/" + w.id + "/save", {
        method: w.saved ? "DELETE" : "PUT",
      });
      s.setData((d) =>
        d.map((x) => (x.id === w.id ? { ...x, saved: !x.saved } : x)),
      );
    } catch (e) {
      toast(e.message, "error");
    }
  }
  return (
    <>
      <PageHead
        eyebrow="SMALL WORDS, BIG PROGRESS"
        title="Sổ tay từ vựng"
        description="Từ vựng công sở thường gặp, có ví dụ để bạn nhớ theo ngữ cảnh."
      />
      <div className="filter-bar">
        <div className="tabs">
          <button
            className={!saved ? "active" : ""}
            onClick={() => setSaved(false)}
          >
            Tất cả từ
          </button>
          <button
            className={saved ? "active" : ""}
            onClick={() => setSaved(true)}
          >
            Đã lưu
          </button>
        </div>
        <select
          aria-label="Lọc chủ đề"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="">Mọi chủ đề</option>
          {[...new Set(s.data?.map((x) => x.topic))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label className="search">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm từ hoặc nghĩa…"
            aria-label="Tìm từ vựng theo từ hoặc nghĩa"
          />
        </label>
      </div>
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorBox message={s.error} retry={s.reload} />
      ) : words.length ? (
        <div className="word-grid">
          {words.map((w) => (
            <article className="word-card" key={w.id}>
              <div className="word-head">
                <span className="badge">{w.topic}</span>
                <button
                  className={"icon-btn " + (w.saved ? "is-saved" : "")}
                  aria-label={w.saved ? "Bỏ lưu " + w.word : "Lưu " + w.word}
                  onClick={() => save(w)}
                >
                  <Bookmark
                    size={20}
                    fill={w.saved ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <h2>{w.word}</h2>
              <span className="phonetic">{w.pronunciation}</span>
              <p className="word-meaning">
                {flipped[w.id] ? "••••••" : w.meaning}
              </p>
              <blockquote>{w.example}</blockquote>
              <button
                className="text-link small"
                onClick={() => setFlipped((a) => ({ ...a, [w.id]: !a[w.id] }))}
              >
                {flipped[w.id]
                  ? "Hiện nghĩa để kiểm tra"
                  : "Ẩn nghĩa và tự nhớ lại"}
                <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={saved ? "Sổ tay đang trống" : "Chưa tìm thấy từ"}
          text={
            saved
              ? "Nhấn biểu tượng đánh dấu ở một từ để lưu lại."
              : "Thử tìm bằng từ khóa hoặc chủ đề khác."
          }
        />
      )}
    </>
  );
}
export function HistoryPage() {
  const s = useApi("/history");
  return (
    <>
      <PageHead
        eyebrow="EVERY ATTEMPT COUNTS"
        title="Hành trình của bạn"
        description="Mỗi lần làm bài đều là dữ liệu để lần sau tốt hơn."
      />
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorBox message={s.error} retry={s.reload} />
      ) : s.data.length ? (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Bài thi</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Nghe / Đọc</th>
                  <th>Tổng điểm</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.data.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      <small>{kindName(a.kind)}</small>
                    </td>
                    <td>{date(a.startedAt)}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (a.status === "IN_PROGRESS" ? "sand" : "sage")
                        }
                      >
                        {statusName(a.status)}
                      </span>
                    </td>
                    <td>
                      {a.status === "IN_PROGRESS"
                        ? "—"
                        : `${a.listeningScore} / ${a.readingScore}`}
                    </td>
                    <td>
                      <b>
                        {a.status === "IN_PROGRESS"
                          ? "—"
                          : a.listeningScore + a.readingScore}
                      </b>
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        to={
                          (a.status === "IN_PROGRESS"
                            ? "/attempts/"
                            : "/results/") + a.id
                        }
                      >
                        {a.status === "IN_PROGRESS"
                          ? "Tiếp tục"
                          : "Xem kết quả"}
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Empty
          title="Chưa có lượt làm bài"
          text="Chọn một đề ngắn và bắt đầu hành trình của bạn."
        >
          <Link className="btn" to="/exams">
            Khám phá đề thi
          </Link>
        </Empty>
      )}
    </>
  );
}
export function Profile() {
  const { user, setUser } = useAuth(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  async function profile(e) {
    e.preventDefault();
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const u = await api("/profile", {
        method: "PUT",
        body: { ...f, targetScore: Number(f.targetScore) },
      });
      setUser(u);
      toast("Đã cập nhật mục tiêu và thông tin.");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function password(e) {
    e.preventDefault();
    const form = e.currentTarget,
      body = Object.fromEntries(new FormData(form));
    if (body.newPassword !== body.confirm) {
      toast("Mật khẩu nhập lại chưa khớp.", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/profile/password", { method: "PUT", body });
      toast("Đã đổi mật khẩu.");
      form.reset();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="YOUR PERSONAL SPACE"
        title="Tài khoản của tôi"
        description="Một mục tiêu cụ thể giúp bạn nhìn rõ bước tiếp theo."
      />
      <div className="profile-grid">
        <section className="panel">
          <h2>Thông tin học viên</h2>
          <form onSubmit={profile} className="form-stack">
            <label>
              Họ và tên
              <input
                name="fullName"
                defaultValue={user.fullName}
                required
                maxLength={120}
              />
            </label>
            <label>
              Tên đăng nhập
              <input value={user.username} disabled />
            </label>
            <label>
              Email
              <input value={user.email} disabled />
            </label>
            <label>
              Mục tiêu TOEIC
              <input
                name="targetScore"
                type="number"
                min={10}
                max={990}
                defaultValue={user.targetScore}
                required
              />
            </label>
            <button disabled={busy} className="btn">
              Lưu thay đổi <CheckCircle2 size={17} />
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Đổi mật khẩu</h2>
          <p className="muted">
            Chọn mật khẩu có ít nhất 8 ký tự, bao gồm chữ và số.
          </p>
          <form onSubmit={password} className="form-stack">
            <label>
              Mật khẩu hiện tại
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={100}
                required
              />
            </label>
            <label>
              Nhập lại mật khẩu mới
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={100}
                required
              />
            </label>
            <button disabled={busy} className="btn secondary">
              Đổi mật khẩu
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
