import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudOff,
  Send,
  Headphones,
  GraduationCap,
  Award,
  Target,
  BookOpen,
} from "lucide-react";
import { api } from "./api";
import {
  useApi,
  useToast,
  Loading,
  ErrorBox,
  PageHead,
  Modal,
  date,
  partNames,
} from "./ui";

export function ExamSession() {
  const { id } = useParams(),
    navigate = useNavigate(),
    toast = useToast(),
    s = useApi("/attempts/" + id);
  const [answers, setAnswers] = useState({}),
    [active, setActive] = useState(0),
    [remaining, setRemaining] = useState(0),
    [saveState, setSaveState] = useState("saved"),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const latest = useRef({}),
    queue = useRef(Promise.resolve()),
    deadline = useRef(0),
    offset = useRef(0),
    expirySent = useRef(false),
    dirty = useRef(false),
    mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!s.data) return;
    if (s.data.attempt.status !== "IN_PROGRESS") {
      navigate("/results/" + id, { replace: true });
      return;
    }
    const map = {};
    for (const q of s.data.questions)
      map[q.id] = {
        questionId: q.id,
        choice: q.selectedChoice || null,
        marked: !!q.marked,
      };
    latest.current = map;
    setAnswers(map);
    deadline.current = Date.parse(s.data.attempt.expiresAt);
    offset.current = Date.parse(s.data.attempt.serverTime) - Date.now();
    setRemaining(
      Math.max(
        0,
        Math.ceil((deadline.current - Date.now() - offset.current) / 1000),
      ),
    );
  }, [s.data, id]);
  const persist = useCallback(
    (map) => {
      dirty.current = true;
      setSaveState("saving");
      const request = () =>
        api("/attempts/" + id + "/answers", {
          method: "PUT",
          body: { answers: Object.values(map) },
        })
          .then((r) => {
            if (r.status !== "IN_PROGRESS") {
              navigate("/results/" + id, { replace: true });
              return;
            }
            if (mounted.current) {
              setSaveState("saved");
              if (map === latest.current) dirty.current = false;
            }
          })
          .catch((e) => {
            if (mounted.current) setSaveState("error");
            throw e;
          });
      const next = queue.current.catch(() => {}).then(request);
      queue.current = next;
      next.catch(() => {});
      return next;
    },
    [id, navigate],
  );
  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await queue.current.catch(() => {});
      if (dirty.current) await persist(latest.current);
      await api("/attempts/" + id + "/submit", { method: "POST" });
      dirty.current = false;
      navigate("/results/" + id, { replace: true });
    } catch (e) {
      toast(e.message, "error");
      setBusy(false);
      setConfirm(false);
      expirySent.current = false;
    }
  }
  useEffect(() => {
    if (!s.data || s.data.attempt.status !== "IN_PROGRESS") return;
    const tick = () => {
      const value = Math.max(
        0,
        Math.ceil((deadline.current - Date.now() - offset.current) / 1000),
      );
      setRemaining(value);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [s.data]);
  useEffect(() => {
    if (
      s.data?.attempt.status === "IN_PROGRESS" &&
      deadline.current &&
      deadline.current - Date.now() - offset.current <= 0 &&
      remaining === 0 &&
      !expirySent.current
    ) {
      expirySent.current = true;
      finish();
    }
  }, [remaining, s.data]);
  useEffect(() => {
    const retry = () => {
      if (dirty.current) persist(latest.current).catch(() => {});
    };
    const before = (e) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", retry);
    window.addEventListener("beforeunload", before);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("beforeunload", before);
    };
  }, [persist]);
  function change(q, patch) {
    const next = {
      ...latest.current,
      [q.id]: { ...latest.current[q.id], questionId: q.id, ...patch },
    };
    latest.current = next;
    setAnswers(next);
    persist(next).catch(() => {});
  }
  async function exit() {
    setBusy(true);
    try {
      await queue.current.catch(() => {});
      if (dirty.current) await persist(latest.current);
      navigate("/exams");
    } catch (e) {
      toast(e.message, "error");
      setBusy(false);
    }
  }
  if (s.loading) return <Loading />;
  if (s.error)
    return (
      <div className="session-error">
        <ErrorBox message={s.error} retry={s.reload} />
        <Link to="/exams">Về thư viện đề thi</Link>
      </div>
    );
  if (!s.data?.questions.length) return <Loading />;
  const { attempt, questions } = s.data,
    q = questions[active],
    answered = Object.values(answers).filter((a) => a.choice).length,
    group = questions.filter((x) => x.groupId === q.groupId);
  const timer = `${String(Math.floor(remaining / 3600)).padStart(2, "0")}:${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <div className="exam-session">
      <header className="session-header">
        <button className="text-link" onClick={exit} disabled={busy}>
          <ChevronLeft size={20} />
          Thoát và lưu lại
        </button>
        <div>
          <span className="eyebrow">ĐANG LÀM BÀI</span>
          <h1>{attempt.title}</h1>
        </div>
        <div className={"session-timer " + (remaining < 300 ? "urgent" : "")}>
          <Clock size={22} />
          <b>{timer}</b>
        </div>
      </header>
      <div className="session-layout">
        <main className="question-area">
          <div className="question-top">
            <span className="badge">
              PART {q.partNo} · {partNames[q.partNo - 1]}
            </span>
            <span>
              {active + 1} / {questions.length}
            </span>
          </div>
          <div className="session-progress">
            <i style={{ width: (answered / questions.length) * 100 + "%" }} />
          </div>
          <article className="question-card">
            <div className="question-card-head">
              <span>CÂU {q.position}</span>
              <button
                className={
                  "text-link " + (answers[q.id]?.marked ? "flagged" : "")
                }
                onClick={() => change(q, { marked: !answers[q.id]?.marked })}
              >
                <Flag
                  size={17}
                  fill={answers[q.id]?.marked ? "currentColor" : "none"}
                />
                {answers[q.id]?.marked ? "Đã đánh dấu" : "Đánh dấu xem lại"}
              </button>
            </div>
            {(q.audioUrl || q.imageUrl || q.passage) && (
              <section className="question-material" key={q.groupId}>
                {group.length > 1 && (
                  <p className="material-label">
                    Tư liệu dùng chung cho câu {group[0].position}–
                    {group.at(-1).position}
                  </p>
                )}
                {q.audioUrl && (
                  <div className="audio-material">
                    <Headphones size={21} />
                    <audio controls preload="metadata" src={q.audioUrl}>
                      Trình duyệt không hỗ trợ âm thanh.
                    </audio>
                  </div>
                )}
                {q.imageUrl && (
                  <img
                    className="question-image"
                    src={q.imageUrl}
                    alt={"Hình minh họa câu " + q.position}
                  />
                )}{" "}
                {q.passage && <div className="passage">{q.passage}</div>}
              </section>
            )}
            <h2 className="question-prompt">{q.prompt}</h2>
            <fieldset className="answer-options">
              <legend className="sr-only">
                Chọn đáp án cho câu {q.position}
              </legend>
              {q.choices.map((c) => (
                <label
                  key={c.key}
                  className={answers[q.id]?.choice === c.key ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name={"question-" + q.id}
                    value={c.key}
                    checked={answers[q.id]?.choice === c.key}
                    onChange={() => change(q, { choice: c.key })}
                  />
                  <span className="choice-letter">{c.key}</span>
                  <span>{c.text || "(" + c.key + ")"}</span>
                  {answers[q.id]?.choice === c.key && (
                    <CheckCircle2 size={19} />
                  )}
                </label>
              ))}
            </fieldset>
          </article>
          <div className="question-navigation">
            <button
              className="btn secondary"
              onClick={() => setActive((a) => a - 1)}
              disabled={active === 0}
            >
              <ChevronLeft size={18} />
              Câu trước
            </button>
            <span>Chọn câu bất kỳ trong bảng điều hướng.</span>
            {active < questions.length - 1 ? (
              <button className="btn" onClick={() => setActive((a) => a + 1)}>
                Câu tiếp theo
                <ChevronRight size={18} />
              </button>
            ) : (
              <button className="btn" onClick={() => setConfirm(true)}>
                Nộp bài <Send size={17} />
              </button>
            )}
          </div>
        </main>
        <aside className="question-sidebar">
          <div className="panel">
            <div className="section-head compact">
              <h2>Phiếu trả lời</h2>
              <b>
                {answered}/{questions.length}
              </b>
            </div>
            <div className={"save-status " + saveState}>
              {saveState === "error" ? (
                <CloudOff size={17} />
              ) : (
                <Cloud size={17} />
              )}
              <span>
                {saveState === "saved"
                  ? "Tất cả đáp án đã lưu"
                  : saveState === "saving"
                    ? "Đang lưu đáp án…"
                    : "Chưa lưu được đáp án"}
              </span>
              {saveState === "error" && (
                <button
                  onClick={() =>
                    persist(latest.current).catch((e) =>
                      toast(e.message, "error"),
                    )
                  }
                >
                  Thử lại
                </button>
              )}
            </div>
            {Array.from(new Set(questions.map((x) => x.partNo))).map((part) => (
              <section className="question-part" key={part}>
                <h3>Part {part}</h3>
                <div className="question-grid">
                  {questions.map(
                    (item, index) =>
                      item.partNo === part && (
                        <button
                          key={item.id}
                          aria-label={"Đến câu " + item.position}
                          className={[
                            index === active ? "current" : "",
                            answers[item.id]?.choice ? "answered" : "",
                            answers[item.id]?.marked ? "marked" : "",
                          ].join(" ")}
                          onClick={() => setActive(index)}
                        >
                          {item.position}
                        </button>
                      ),
                  )}
                </div>
              </section>
            ))}
            <div className="question-legend">
              <span>
                <i className="done" />
                Đã trả lời
              </span>
              <span>
                <i className="mark" />
                Đánh dấu
              </span>
              <span>
                <i />
                Chưa chọn
              </span>
            </div>
            <button
              className="btn full"
              onClick={() => setConfirm(true)}
              disabled={busy}
            >
              Nộp bài <Send size={17} />
            </button>
          </div>
        </aside>
      </div>
      {confirm && (
        <Modal title="Nộp bài thi?" onClose={() => !busy && setConfirm(false)}>
          <div className="modal-body">
            <p>
              Bạn đã trả lời{" "}
              <b>
                {answered}/{questions.length}
              </b>{" "}
              câu hỏi.
            </p>
            {answered < questions.length && (
              <p className="form-warning">
                Còn {questions.length - answered} câu chưa trả lời. Các câu này
                được tính là chưa đúng.
              </p>
            )}
            <p>
              Sau khi nộp, bạn có thể xem điểm, đáp án và giải thích cho từng
              câu.
            </p>
            <div className="modal-actions">
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Tiếp tục làm
              </button>
              <button className="btn" disabled={busy} onClick={finish}>
                {busy ? "Đang lưu và chấm bài…" : "Xác nhận nộp bài"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Result() {
  const { id } = useParams(),
    s = useApi("/attempts/" + id),
    navigate = useNavigate();
  const [filter, setFilter] = useState("all"),
    [part, setPart] = useState("");
  useEffect(() => {
    if (s.data?.attempt.status === "IN_PROGRESS")
      navigate("/attempts/" + id, { replace: true });
  }, [s.data]);
  if (s.loading) return <Loading />;
  if (s.error) return <ErrorBox message={s.error} retry={s.reload} />;
  const { attempt: a, questions, parts } = s.data;
  if (a.status === "IN_PROGRESS") return <Loading />;
  const score = a.listeningScore + a.readingScore,
    items = questions.filter(
      (q) =>
        (!part || q.partNo === Number(part)) &&
        (filter === "all" ||
          (filter === "wrong" && !q.isCorrect) ||
          (filter === "marked" && q.marked)),
    );
  return (
    <>
      <PageHead
        eyebrow="ONE MORE STEP FORWARD"
        title="Bạn đã hoàn thành bài thi!"
        description={a.title}
      >
        <Link className="btn secondary" to="/exams">
          Luyện đề tiếp <ArrowRight size={17} />
        </Link>
      </PageHead>
      <section className="result-overview">
        <div className="result-score">
          <Award size={30} />
          <span>ĐIỂM QUY ĐỔI THAM KHẢO</span>
          <strong>
            {score}
            <small>/ 990</small>
          </strong>
          <p>
            {a.correctCount}/{a.totalCount} câu trả lời đúng
          </p>
        </div>
        <div className="result-metrics">
          <div>
            <Headphones />
            <span>
              Listening
              <strong>
                {a.listeningScore}
                <small> / 495</small>
              </strong>
            </span>
          </div>
          <div>
            <BookOpen />
            <span>
              Reading
              <strong>
                {a.readingScore}
                <small> / 495</small>
              </strong>
            </span>
          </div>
          <div>
            <Clock />
            <span>
              Thời gian làm
              <strong>
                {Math.floor(a.elapsedSeconds / 60)}
                <small> phút {a.elapsedSeconds % 60} giây</small>
              </strong>
            </span>
          </div>
          <p>
            {a.status === "EXPIRED"
              ? "Bài được chấm khi hết thời gian."
              : "Đã nộp lúc " + date(a.submittedAt)}
            <br />
            Điểm đề ngắn được chuẩn hóa theo từng kỹ năng; không phải kết quả
            thi TOEIC chính thức.
          </p>
        </div>
      </section>
      <section className="panel part-results">
        <h2>Nhìn rõ từng phần</h2>
        <div className="part-result-grid">
          {parts.map((p) => (
            <div key={p.partNo}>
              <span>Part {p.partNo}</span>
              <b>
                {p.correct}/{p.total}
              </b>
              <div className="progress-bar">
                <i style={{ width: (p.correct / p.total) * 100 + "%" }} />
              </div>
              <small>
                {Math.round((p.correct / p.total) * 100)}% chính xác
              </small>
            </div>
          ))}
        </div>
      </section>
      <div className="section-head">
        <div>
          <span className="eyebrow">HIỂU ĐỂ TIẾN BỘ</span>
          <h2>Xem lại đáp án</h2>
        </div>
        <div className="inline-fields">
          <select
            value={part}
            onChange={(e) => setPart(e.target.value)}
            aria-label="Lọc Part"
          >
            <option value="">Tất cả Part</option>
            {parts.map((p) => (
              <option key={p.partNo} value={p.partNo}>
                Part {p.partNo}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc kết quả"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Tất cả câu hỏi</option>
            <option value="wrong">Câu sai / bỏ trống</option>
            <option value="marked">Câu đã đánh dấu</option>
          </select>
        </div>
      </div>
      <div className="review-list">
        {items.length ? (
          items.map((q) => (
            <details
              key={q.id}
              className={
                "review-item " + (q.isCorrect ? "correct" : "incorrect")
              }
            >
              <summary>
                <span className="review-number">{q.position}</span>
                <div>
                  <strong>{q.prompt}</strong>
                  <small>
                    Part {q.partNo} · Bạn chọn:{" "}
                    {q.selectedChoice || "Chưa chọn"} · Đáp án đúng:{" "}
                    {q.correctChoice}
                  </small>
                </div>
                <span className="badge">
                  {q.isCorrect
                    ? "Đúng"
                    : q.selectedChoice
                      ? "Chưa đúng"
                      : "Bỏ trống"}
                </span>
              </summary>
              <div className="review-body">
                {q.audioUrl && (
                  <audio controls preload="none" src={q.audioUrl} />
                )}{" "}
                {q.imageUrl && (
                  <img
                    className="question-image"
                    src={q.imageUrl}
                    alt={"Hình câu " + q.position}
                  />
                )}{" "}
                {q.passage && <div className="passage">{q.passage}</div>}
                <div className="review-choices">
                  {q.choices.map((c) => (
                    <p
                      key={c.key}
                      className={
                        c.key === q.correctChoice
                          ? "correct-answer"
                          : c.key === q.selectedChoice
                            ? "wrong-answer"
                            : ""
                      }
                    >
                      <b>{c.key}.</b> {c.text}
                      {c.key === q.correctChoice && <CheckCircle2 size={17} />}
                    </p>
                  ))}
                </div>
                <div className="explanation">
                  <strong>Giải thích</strong>
                  <p>
                    {q.explanation ||
                      "Đáp án đúng là " +
                        q.correctChoice +
                        ". Hãy xem lại nội dung bài nghe hoặc đoạn đọc."}
                  </p>
                </div>
              </div>
            </details>
          ))
        ) : (
          <p className="muted">Không có câu hỏi trong bộ lọc này.</p>
        )}
      </div>
    </>
  );
}
