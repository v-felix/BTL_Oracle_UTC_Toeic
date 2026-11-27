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
  Volume2,
  Tags,
  BarChart3,
  ListChecks,
} from "lucide-react";
import { api, resetCsrf } from "./api";
import { CardArt, TrackPattern, Wordmark, Photo } from "./art";
import { examPhoto } from "./photos";
import { CountUp, RevealText } from "./motion";
import {
  useAuth,
  useToast,
  useApi,
  Loading,
  ErrorBox,
  Empty,
  PageHead,
  PageBanner,
  Modal,
  date,
  kindName,
  statusName,
  partNames,
} from "./ui";

const kindArt = { FULL_TEST: 2, MINI_TEST: 0, PRACTICE: 3 };
export function ExamCard({ exam, index = 0 }) {
  return (
    <article className="exam-card">
      <Link
        className="exam-card-art"
        to={"/exams/" + exam.examId}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Photo
          name={examPhoto(exam)}
          width={720}
          fallback={<CardArt variant={kindArt[exam.kind] ?? index} />}
        />
        <span className="card-chip">{kindName(exam.kind)}</span>
      </Link>
      <div className="exam-card-body">
        <div className="exam-meta">
          <span>
            <Layers size={15} />
            {exam.questionCount} câu hỏi
          </span>
          <span>
            <Clock size={15} />
            {exam.durationMinutes} phút
          </span>
        </div>
        <h3>
          <Link to={"/exams/" + exam.examId}>{exam.title}</Link>
        </h3>
        <p>{exam.description}</p>
        <Link
          className="exam-card-link"
          to={"/exams/" + exam.examId}
          aria-label={"Xem chi tiết " + exam.title}
        >
          Xem chi tiết <ArrowRight size={17} />
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
      <section className="hero">
        <Photo name="hero" className="hero-photo" width={1800} eager />
        <div className="hero-shade" />
        <TrackPattern overlay />
        <div className="halftone" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker">
              {user
                ? "Chào mừng trở lại, " + user.fullName.split(" ").pop()
                : "Hệ thống luyện thi TOEIC · ĐH Giao thông vận tải"}
            </span>
            <h1 aria-label="Luyện thi TOEIC có lộ trình, đo tiến bộ bằng dữ liệu">
              <span aria-hidden="true">
                <RevealText
                  text="Luyện thi TOEIC có lộ trình, đo tiến bộ bằng dữ liệu"
                  delay={150}
                />
              </span>
            </h1>
            <p>
              Ngân hàng 200 câu hỏi đủ 7 phần thi, làm bài theo thời gian thực
              và xem lại đáp án kèm giải thích cho từng câu.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-glow" to="/exams">
                Bắt đầu luyện đề <ArrowRight size={18} />
              </Link>
              <Link className="btn ghost-light" to="/learning">
                Xem học liệu
              </Link>
            </div>
          </div>
          <aside className="hero-panel" aria-label="Mục tiêu điểm">
            <span>Mục tiêu của bạn</span>
            <strong>
              <CountUp value={user?.targetScore || 650} />
              <small>/ 990</small>
            </strong>
            <ul>
              <li>
                <CheckCircle2 size={16} />
                Listening và Reading, 7 phần thi
              </li>
              <li>
                <CheckCircle2 size={16} />
                Chấm điểm tự động trên Oracle
              </li>
              <li>
                <CheckCircle2 size={16} />
                Lưu tiến độ, làm tiếp bất kỳ lúc nào
              </li>
            </ul>
            <Link to={user ? "/profile" : "/register"} className="text-link">
              {user ? "Cập nhật mục tiêu" : "Tạo tài khoản miễn phí"}
              <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      </section>
      <div className="stat-grid">
        {[
          [stats.data?.exams, "Đề thi sẵn sàng", Headphones, "sage"],
          [stats.data?.questions, "Câu hỏi, đủ 7 Part", Layers, "peach"],
          [stats.data?.lessons, "Bài học nền tảng", BookOpen, "lavender"],
          [stats.data?.words, "Từ vựng công sở", Bookmark, "sand"],
        ].map(([v, label, Icon, color], i) => (
          <div className="stat-card" key={label}>
            <span className={"stat-icon " + color}>
              <Icon size={20} />
            </span>

            <div>
              <strong>
                <CountUp value={v} />
              </strong>
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
            <span className="eyebrow">Luyện thi</span>
            <h2>Đề thi nổi bật</h2>
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
        <div className="halftone" aria-hidden="true" />
        <div className="learning-band-head">
          <span className="eyebrow">Cấu trúc bài thi</span>
          <h2>7 phần thi TOEIC Listening và Reading</h2>
          <p>
            Nắm cấu trúc và chiến lược của từng phần trước, sau đó luyện tập
            đúng trọng tâm.
          </p>
          <Link className="text-link" to="/learning">
            Vào học liệu <ArrowRight size={17} />
          </Link>
        </div>
        <div className="part-path">
          {partNames.map((name, i) => (
            <Link key={name} to="/learning">
              <b>Part {i + 1}</b>
              <span>{name}</span>
              <small>{i < 4 ? "Listening" : "Reading"}</small>
              <ArrowRight size={17} />
            </Link>
          ))}
          <Link to="/exams" className="part-path-all">
            <ArrowUpRight size={20} />
            <span>Luyện đề đủ 7 phần</span>
            <small>Full test 200 câu, 120 phút</small>
          </Link>
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
            Đang tiến bộ
          </span>
        </div>
        <div className="personal-metrics">
          <div>
            <strong>
              <CountUp value={data.summary.completedCount} />
            </strong>
            <span>Bài đã hoàn thành</span>
          </div>
          <div>
            <strong>
              <CountUp value={best} />
              <small> / 990</small>
            </strong>
            <span>Điểm tốt nhất</span>
          </div>
          <div>
            <strong>
              <CountUp value={Math.round(data.summary.studySeconds / 60)} />
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
        <span className="eyebrow">Gợi ý hôm nay</span>
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
      <PageBanner
        eyebrow="Luyện thi"
        title="Thư viện đề thi"
        description="Full test 200 câu, mini test và các bộ luyện theo từng phần. Chọn một bài vừa sức và bắt đầu."
        photo="exams"
      >
        {state.data && (
          <div className="banner-stats">
            {[
              [state.data.length, "đề đang mở"],
              [state.data.filter((e) => e.kind === "FULL_TEST").length, "full test"],
              [state.data.reduce((n, e) => n + e.questionCount, 0), "câu hỏi luyện tập"],
            ].map(([v, l]) => (
              <div key={l}>
                <strong>
                  <CountUp value={v} />
                </strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
        )}
      </PageBanner>
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
            <Headphones size={26} />
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
        <Photo name="auth" className="auth-photo" width={1400} eager />
        <div className="hero-shade" />
        <TrackPattern overlay />
        <div className="auth-story-content">
          <Link className="brand light-brand" to="/">
            <Wordmark light />
          </Link>
          <div>
            <span className="hero-kicker">Hệ thống luyện thi TOEIC</span>
            <h1>Mỗi lần luyện tập là một bước gần hơn tới mục tiêu.</h1>
            <p>
              Đăng nhập để tiếp tục bài đang làm, xem lại kết quả và theo dõi
              tiến bộ của bạn qua từng phần thi.
            </p>
          </div>
          <small>Dành cho sinh viên Trường Đại học Giao thông vận tải</small>
        </div>
      </aside>
      <main className="auth-main">
        <Link className="back-link" to="/">
          <ChevronLeft size={17} />
          Về trang chủ
        </Link>
        <div className="auth-form">
          <span className="eyebrow">{register ? "Đăng ký tài khoản" : "Đăng nhập"}</span>
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
      <PageBanner
        eyebrow="Học tập"
        title="Góc học tập"
        description="Chiến lược và lưu ý cho từng phần thi. Hiểu cách làm trước khi làm nhiều."
        photo="learning"
      >
        <div className="banner-stats">
          <div>
            <strong>4</strong>
            <span>phần Listening</span>
          </div>
          <div>
            <strong>3</strong>
            <span>phần Reading</span>
          </div>
          {s.data && (
            <div>
              <strong>
                <CountUp
                  value={s.data.reduce((n, x) => n + x.durationMinutes, 0)}
                />
              </strong>
              <span>phút đọc</span>
            </div>
          )}
        </div>
      </PageBanner>
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorBox message={s.error} retry={s.reload} />
      ) : (
        <div className="lesson-grid">
          {s.data.map((x, i) => (
            <Link className="lesson-card" to={"/learning/" + x.id} key={x.id}>
              <div className="lesson-icon">
                <Photo
                  name={"part-" + x.partNo}
                  width={720}
                  fallback={<CardArt variant={x.partNo <= 4 ? 0 : 1} />}
                />
                <span className="card-chip">
                  {x.partNo <= 4 ? "Listening" : "Reading"}
                </span>
                <b className="lesson-part">Part {x.partNo}</b>
              </div>
              <span className="eyebrow">
                {x.durationMinutes} phút ·{" "}
                {x.partNo <= 4 ? "Listening" : "Reading"}
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
        <div className="lesson-cover">
          <Photo name={"part-" + x.partNo} width={1400} eager />
        </div>

        <span className="eyebrow">
          Part {x.partNo} · {x.durationMinutes} phút đọc
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
const topicTones = ["navy", "red", "teal", "amber", "violet", "slate"];
function speak(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
export function Vocabulary() {
  const [search, setSearch] = useState(""),
    [topic, setTopic] = useState(""),
    [saved, setSaved] = useState(false),
    [hidden, setHidden] = useState({}),
    [hideAll, setHideAll] = useState(false);
  const s = useApi("/vocabulary"),
    { user } = useAuth(),
    toast = useToast();
  const topics = [...new Set(s.data?.map((x) => x.topic) || [])];
  const tone = (t) => topicTones[Math.max(0, topics.indexOf(t)) % topicTones.length];
  const words = s.data?.filter(
    (w) =>
      (!topic || w.topic === topic) &&
      (!saved || w.saved) &&
      (w.word + " " + w.meaning).toLowerCase().includes(search.toLowerCase()),
  );
  const savedCount = s.data?.filter((w) => w.saved).length || 0;
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
  const isHidden = (w) => (hidden[w.id] ?? hideAll);
  return (
    <>
      <PageBanner
        eyebrow="Học tập"
        title="Sổ tay từ vựng"
        description="Từ vựng công sở thường gặp trong TOEIC, có phiên âm, ví dụ và phát âm để bạn nhớ theo ngữ cảnh."
        photo="vocabulary"
      >
        {s.data && (
          <div className="banner-stats">
            <div>
              <strong>
                <CountUp value={s.data.length} />
              </strong>
              <span>từ vựng</span>
            </div>
            <div>
              <strong>
                <CountUp value={topics.length} />
              </strong>
              <span>chủ đề</span>
            </div>
            <div>
              <strong>
                <CountUp value={savedCount} />
              </strong>
              <span>đã lưu</span>
            </div>
          </div>
        )}
      </PageBanner>
      <div className="vocab-toolbar">
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
            <Bookmark size={15} /> Đã lưu ({savedCount})
          </button>
        </div>
        <label className="search">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm từ hoặc nghĩa…"
            aria-label="Tìm từ vựng"
          />
        </label>
        <button
          className={"btn small " + (hideAll ? "" : "secondary")}
          onClick={() => {
            setHideAll(!hideAll);
            setHidden({});
          }}
        >
          {hideAll ? <Eye size={16} /> : <EyeOff size={16} />}
          {hideAll ? "Hiện tất cả nghĩa" : "Chế độ tự kiểm tra"}
        </button>
      </div>
      <div className="topic-chips" role="group" aria-label="Lọc theo chủ đề">
        <button
          className={!topic ? "active" : ""}
          onClick={() => setTopic("")}
        >
          <Tags size={15} /> Mọi chủ đề
          <small>{s.data?.length ?? 0}</small>
        </button>
        {topics.map((t) => (
          <button
            key={t}
            className={"tone-" + tone(t) + (topic === t ? " active" : "")}
            onClick={() => setTopic(topic === t ? "" : t)}
          >
            <i />
            {t}
            <small>{s.data.filter((x) => x.topic === t).length}</small>
          </button>
        ))}
      </div>
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorBox message={s.error} retry={s.reload} />
      ) : words.length ? (
        <>
          <p className="result-count">{words.length} từ phù hợp</p>
          <div className="word-grid">
            {words.map((w) => (
              <article className={"word-card tone-" + tone(w.topic)} key={w.id}>
                <div className="word-head">
                  <span className="word-topic">{w.topic}</span>
                  <div className="word-actions">
                    <button
                      className="icon-btn"
                      aria-label={"Nghe phát âm " + w.word}
                      title="Nghe phát âm"
                      onClick={() =>
                        speak(w.word) ||
                        toast("Trình duyệt chưa hỗ trợ đọc phát âm.", "error")
                      }
                    >
                      <Volume2 size={18} />
                    </button>
                    <button
                      className={"icon-btn " + (w.saved ? "is-saved" : "")}
                      aria-label={w.saved ? "Bỏ lưu " + w.word : "Lưu " + w.word}
                      title={w.saved ? "Bỏ lưu" : "Lưu vào sổ tay"}
                      onClick={() => save(w)}
                    >
                      <Bookmark
                        size={18}
                        fill={w.saved ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>
                <h2>{w.word}</h2>
                <span className="phonetic">{w.pronunciation}</span>
                <button
                  className={"word-meaning" + (isHidden(w) ? " is-hidden" : "")}
                  onClick={() =>
                    setHidden((a) => ({ ...a, [w.id]: !isHidden(w) }))
                  }
                  aria-label={
                    isHidden(w) ? "Hiện nghĩa của " + w.word : "Ẩn nghĩa của " + w.word
                  }
                >
                  <span>{w.meaning}</span>
                  {isHidden(w) && <em>Nhấn để xem nghĩa</em>}
                </button>
                <blockquote>
                  {w.example}
                  <button
                    className="example-audio"
                    aria-label="Nghe câu ví dụ"
                    onClick={() => speak(w.example)}
                  >
                    <Volume2 size={14} />
                  </button>
                </blockquote>
              </article>
            ))}
          </div>
        </>
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
function ScoreChart({ items, target }) {
  if (items.length < 1) return null;
  const W = 720,
    H = 240,
    pad = { l: 44, r: 16, t: 18, b: 34 };
  const iw = W - pad.l - pad.r,
    ih = H - pad.t - pad.b;
  const step = iw / items.length;
  const bw = Math.min(46, step * 0.56);
  const y = (v) => pad.t + ih - (v / 990) * ih;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="score-chart"
      role="img"
      aria-label="Biểu đồ điểm các lượt đã hoàn thành"
    >
      {[0, 250, 500, 750, 990].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="axis">
            {v}
          </text>
        </g>
      ))}
      {items.map((a, i) => {
        const x = pad.l + step * i + (step - bw) / 2;
        return (
          <g key={a.id} className="bar" style={{ "--i": i }}>
            <rect x={x} y={y(a.total)} width={bw} height={pad.t + ih - y(a.total)} />
            <text x={x + bw / 2} y={y(a.total) - 6} textAnchor="middle" className="value">
              {a.total}
            </text>
            <text x={x + bw / 2} y={H - 12} textAnchor="middle" className="axis">
              {a.label}
            </text>
          </g>
        );
      })}
      {target ? (
        <g className="target">
          <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} />
          <text x={W - pad.r} y={y(target) - 6} textAnchor="end">
            Mục tiêu {target}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
export function HistoryPage() {
  const s = useApi("/history"),
    { user } = useAuth();
  const done = (s.data || []).filter((a) => a.status !== "IN_PROGRESS");
  const totals = done.map((a) => a.listeningScore + a.readingScore);
  const best = totals.length ? Math.max(...totals) : 0;
  const avg = totals.length
    ? Math.round(totals.reduce((x, y) => x + y, 0) / totals.length)
    : 0;
  const chart = [...done]
    .sort((x, y) => Date.parse(x.startedAt) - Date.parse(y.startedAt))
    .slice(-10)
    .map((a) => ({
      id: a.id,
      total: a.listeningScore + a.readingScore,
      label: new Date(a.startedAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
    }));
  const kindIcon = { FULL_TEST: Layers, MINI_TEST: Clock, PRACTICE: ListChecks };
  return (
    <>
      <PageBanner
        eyebrow="Kết quả học tập"
        title="Hành trình của bạn"
        description="Mỗi lần làm bài đều là dữ liệu để lần sau tốt hơn. Theo dõi điểm số và tiếp tục các bài đang làm."
        photo="history"
      >
        {s.data && (
          <div className="banner-stats">
            <div>
              <strong>
                <CountUp value={s.data.length} />
              </strong>
              <span>lượt làm bài</span>
            </div>
            <div>
              <strong>
                <CountUp value={best} />
              </strong>
              <span>điểm cao nhất</span>
            </div>
            <div>
              <strong>
                <CountUp value={avg} />
              </strong>
              <span>điểm trung bình</span>
            </div>
          </div>
        )}
      </PageBanner>
      {s.loading ? (
        <Loading />
      ) : s.error ? (
        <ErrorBox message={s.error} retry={s.reload} />
      ) : s.data.length ? (
        <>
          <div className="history-overview">
            <section className="panel chart-panel">
              <div className="section-head compact">
                <h2>
                  <BarChart3 size={20} /> Điểm các lượt gần đây
                </h2>
                <span className="muted small">Thang điểm 990</span>
              </div>
              {chart.length ? (
                <ScoreChart items={chart} target={user?.targetScore} />
              ) : (
                <p className="muted">Hoàn thành một bài để xem biểu đồ điểm.</p>
              )}
            </section>
            <section className="panel status-panel">
              <h2>Tình trạng</h2>
              {[
                ["Đã hoàn thành", s.data.filter((a) => a.status === "COMPLETED").length, "green"],
                ["Đang làm dở", s.data.filter((a) => a.status === "IN_PROGRESS").length, "amber"],
                ["Hết giờ", s.data.filter((a) => a.status === "EXPIRED").length, "red"],
              ].map(([label, n, c]) => (
                <div className={"status-row " + c} key={label}>
                  <span>
                    <i />
                    {label}
                  </span>
                  <b>{n}</b>
                  <div className="progress-bar">
                    <i style={{ width: (n / s.data.length) * 100 + "%" }} />
                  </div>
                </div>
              ))}
              {s.data.some((a) => a.status === "IN_PROGRESS") && (
                <Link
                  className="resume-strip"
                  to={"/attempts/" + s.data.find((a) => a.status === "IN_PROGRESS").id}
                >
                  <Play size={17} />
                  Làm tiếp bài dở gần nhất
                  <ArrowRight size={17} />
                </Link>
              )}
            </section>
          </div>
          <div className="panel table-panel">
            <h2>Tất cả lượt làm bài</h2>
            <div className="table-scroll">
              <table className="history-table">
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
                  {s.data.map((a) => {
                    const Icon = kindIcon[a.kind] || Layers;
                    const total = a.listeningScore + a.readingScore;
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="attempt-title">
                            <span className="attempt-icon">
                              <Icon size={18} />
                            </span>
                            <div>
                              <strong>{a.title}</strong>
                              <small>{kindName(a.kind)}</small>
                            </div>
                          </div>
                        </td>
                        <td>{date(a.startedAt)}</td>
                        <td>
                          <span
                            className={
                              "badge " +
                              (a.status === "IN_PROGRESS"
                                ? "sand"
                                : a.status === "EXPIRED"
                                  ? "danger"
                                  : "sage")
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
                          {a.status === "IN_PROGRESS" ? (
                            "—"
                          ) : (
                            <div className="score-cell">
                              <b>{total}</b>
                              <div className="progress-bar">
                                <i style={{ width: (total / 990) * 100 + "%" }} />
                              </div>
                            </div>
                          )}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
        eyebrow="Tài khoản"
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
