import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  Headphones,
  Library,
  History,
  Settings,
  ShieldCheck,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { api, resetCsrf } from "./api";
import { Wordmark, EmptyArt, Photo, TrackPattern } from "./art";
import { useAutoReveal, useScrolled, RevealText } from "./motion";
export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);
export function Providers({ children }) {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      resetCsrf();
      toast("Đã đăng xuất.");
    } catch (e) {
      toast(e.message, "error");
    }
  }
  return (
    <AuthContext.Provider value={{ user, setUser, ready, logout }}>
      <ToastContext.Provider value={toast}>
        {children}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={"toast " + t.type}>
              {t.type === "error" ? (
                <AlertCircle size={19} />
              ) : (
                <CheckCircle2 size={19} />
              )}
              <span>{t.message}</span>
              <button
                onClick={() => setToasts((a) => a.filter((x) => x.id !== t.id))}
                aria-label="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
export function useApi(path, deps = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    api(path, { signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [path, version, ...deps]);
  return {
    data,
    error,
    loading,
    reload: () => setVersion((v) => v + 1),
    setData,
  };
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="loader" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>Đang tải dữ liệu…</span>
    </div>
  );
}
export function ErrorBox({ message, retry }) {
  return (
    <div className="error-box" role="alert">
      <span className="error-mark" aria-hidden="true">
        <AlertCircle size={22} />
      </span>
      <div>
        <strong>Chưa tải được dữ liệu</strong>
        <p>{message}</p>
        {retry && (
          <button className="btn small secondary" onClick={retry}>
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  text = "Dữ liệu sẽ xuất hiện ở đây khi bạn bắt đầu.",
  children,
}) {
  return (
    <div className="empty">
      <EmptyArt />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Guard({ children, roles }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return (
      <Empty
        title="Bạn chưa có quyền truy cập"
        text="Tài khoản hiện tại không có quyền mở trang này."
      />
    );
  return children;
}
const links = [
  ["/", "Tổng quan", LayoutDashboard],
  ["/exams", "Đề thi", Headphones],
  ["/learning", "Học liệu", BookOpen],
  ["/vocabulary", "Từ vựng", Library],
  ["/history", "Lịch sử làm bài", History],
];
export function Layout({ children }) {
  const { user, logout } = useAuth(),
    [open, setOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef(null);
  const scrolled = useScrolled();
  useAutoReveal(mainRef);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  const navItems = [
    ...links,
    ...(user && user.role !== "STUDENT"
      ? [["/admin", "Quản trị", ShieldCheck]]
      : []),
  ];
  const current = navItems.find((x) =>
    x[0] === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(x[0]),
  );
  const crumb = location.pathname.startsWith("/profile")
    ? "Tài khoản của tôi"
    : location.pathname.startsWith("/results")
      ? "Kết quả bài thi"
      : current?.[1];
  return (
    <div className="app-shell">
      <div className="utility-bar">
        <div className="container">
          <span>Trường Đại học Giao thông vận tải</span>
          <nav aria-label="Liên kết nhanh">
            <Link to="/learning">Học liệu</Link>
            <Link to="/vocabulary">Từ vựng</Link>
            {user ? (
              <button onClick={logout}>
                Đăng xuất <LogOut size={14} />
              </button>
            ) : (
              <Link to="/login">Đăng nhập</Link>
            )}
          </nav>
        </div>
      </div>
      <header className={"site-header" + (scrolled ? " scrolled" : "")}>
        <div className="container">
          <Link to="/" className="brand" aria-label="UTC TOEIC, về trang chủ">
            <Wordmark />
          </Link>
          <nav className="main-nav" aria-label="Điều hướng chính">
            {navItems.map(([to, text]) => (
              <NavLink end={to === "/"} key={to} to={to}>
                {text}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            {user ? (
              <Link to="/profile" className="user-menu">
                <span className="avatar">
                  {user.fullName?.split(" ").pop()?.[0] || "U"}
                </span>
                <span className="user-name">
                  {user.fullName}
                  <small>{user.roleName}</small>
                </span>
              </Link>
            ) : (
              <Link className="btn small" to="/login">
                Đăng nhập
              </Link>
            )}
            <button
              className="icon-btn mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Đóng menu điều hướng" : "Mở menu"}
              aria-expanded={open}
              aria-controls="mobile-navigation"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <button
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu"
        />
      )}
      <aside
        id="mobile-navigation"
        className={"mobile-drawer " + (open ? "open" : "")}
        aria-hidden={!open}
      >
        <nav>
          {navItems.map(([to, text, Icon], i) => (
            <NavLink
              end={to === "/"}
              key={to}
              to={to}
              tabIndex={open ? 0 : -1}
              style={{ "--i": i }}
            >
              <Icon size={19} />
              {text}
            </NavLink>
          ))}
          <NavLink to="/profile" tabIndex={open ? 0 : -1}>
            <Settings size={19} />
            Tài khoản của tôi
          </NavLink>
        </nav>
        {user && (
          <button className="btn secondary full" onClick={logout} tabIndex={open ? 0 : -1}>
            Đăng xuất <LogOut size={16} />
          </button>
        )}
      </aside>
      {location.pathname !== "/" && crumb && (
        <div className="breadcrumb">
          <div className="container">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <b>{crumb}</b>
          </div>
        </div>
      )}
      <main className="page-content" ref={mainRef}>
        <div className="container page-enter" key={location.pathname}>
          {children}
        </div>
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Wordmark light />
            <p>
              Hệ thống ôn luyện và thi thử TOEIC dành cho sinh viên Trường Đại
              học Giao thông vận tải.
            </p>
          </div>
          <div>
            <h4>Luyện thi</h4>
            <Link to="/exams">Thư viện đề thi</Link>
            <Link to="/history">Lịch sử làm bài</Link>
          </div>
          <div>
            <h4>Học tập</h4>
            <Link to="/learning">Học liệu theo Part</Link>
            <Link to="/vocabulary">Sổ tay từ vựng</Link>
          </div>
          <div>
            <h4>Tài khoản</h4>
            <Link to="/profile">Thông tin cá nhân</Link>
            {user ? (
              <button onClick={logout}>Đăng xuất</button>
            ) : (
              <Link to="/register">Đăng ký</Link>
            )}
          </div>
        </div>
        <div className="footer-legal">
          <div className="container">
            <span>© 2026 UTC TOEIC · Bài tập lớn môn Cơ sở dữ liệu Oracle</span>
            <span>
              Điểm quy đổi chỉ mang tính tham khảo, không thay thế kết quả
              TOEIC chính thức.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export function PageHead({ eyebrow, title, description, children }) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}
export function PageBanner({ eyebrow, title, description, photo, children }) {
  return (
    <section className="page-banner">
      <div className="page-banner-media">
        <Photo name={photo} width={1600} eager />
      </div>
      <div className="page-banner-shade" />
      <TrackPattern overlay className="page-banner-lines" />
      <div className="halftone" aria-hidden="true" />
      <div className="page-banner-inner">
        <div className="page-banner-copy">
          {eyebrow && <span className="hero-kicker">{eyebrow}</span>}
          <h1 aria-label={title}>
            <span aria-hidden="true">
              <RevealText text={title} delay={120} />
            </span>
          </h1>
          {description && <p>{description}</p>}
        </div>
        {children && <div className="page-banner-aside">{children}</div>}
      </div>
    </section>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    const f = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", f);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", f);
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export const date = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export const kindName = (k) =>
  ({
    FULL_TEST: "Full test",
    MINI_TEST: "Mini test",
    PRACTICE: "Luyện từng phần",
  })[k] || k;
export const statusName = (s) =>
  ({
    DRAFT: "Bản nháp",
    PUBLISHED: "Công khai",
    ARCHIVED: "Lưu trữ",
    IN_PROGRESS: "Đang làm",
    COMPLETED: "Đã hoàn thành",
    EXPIRED: "Hết giờ",
  })[s] || s;
export const partNames = [
  "Mô tả tranh",
  "Hỏi và đáp",
  "Hội thoại",
  "Bài nói ngắn",
  "Hoàn thành câu",
  "Hoàn thành đoạn văn",
  "Đọc hiểu",
];
