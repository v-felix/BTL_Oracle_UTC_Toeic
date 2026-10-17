import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
  GraduationCap,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import { api, resetCsrf } from "./api";
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
    <div className="loading">
      <LoaderCircle className="spin" size={25} />
      <span>Đang tải dữ liệu…</span>
    </div>
  );
}
export function ErrorBox({ message, retry }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={22} />
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
      <BookOpen size={34} />
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
  ["/exams", "Thư viện đề thi", Headphones],
  ["/learning", "Góc học tập", BookOpen],
  ["/vocabulary", "Sổ tay từ vựng", Library],
  ["/history", "Lịch sử làm bài", History],
];
export function Layout({ children }) {
  const { user, logout } = useAuth(),
    [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return (
    <div className="app-shell">
      {open && (
        <button
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu"
        />
      )}
      <aside id="main-navigation" className={"sidebar " + (open ? "open" : "")}>
        <Link to="/" className="brand">
          <span className="brand-icon">
            <GraduationCap size={25} />
          </span>
          <span>
            UTC <b>TOEIC</b>
            <small>HỌC ĐỀU · TIẾN XA</small>
          </span>
        </Link>
        <span className="nav-caption">KHÔNG GIAN HỌC TẬP</span>
        <nav>
          {links.map(([to, text, Icon]) => (
            <NavLink end={to === "/"} key={to} to={to}>
              <Icon size={20} />
              {text}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="tiny-dot" />
          Mỗi ngày một bước tiến<p>20 phút hôm nay, thêm tự tin ngày mai.</p>
          <Link to="/learning">
            Bắt đầu học <ArrowUpRight size={15} />
          </Link>
        </div>
        <nav className="sidebar-bottom">
          {user && user.role !== "STUDENT" && (
            <NavLink to="/admin">
              <ShieldCheck size={20} />
              Quản trị hệ thống
            </NavLink>
          )}
          <NavLink to="/profile">
            <Settings size={20} />
            Tài khoản của tôi
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          Đại học Giao thông vận tải
          <br />
          Dành cho hành trình TOEIC của bạn.
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Đóng menu điều hướng" : "Mở menu"}
            aria-expanded={open}
            aria-controls="main-navigation"
          >
            <Menu size={23} />
          </button>
          <div className="topbar-crumb">
            Không gian học tập <span>/</span>{" "}
            <b>
              {location.pathname.startsWith("/admin")
                ? "Quản trị"
                : links.find((x) =>
                    x[0] === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(x[0]),
                  )?.[1] || "UTC TOEIC"}
            </b>
          </div>
          <div className="topbar-right">
            <span className="live-indicator">
              <i />
              Sẵn sàng học tập
            </span>
            {user ? (
              <>
                <Link to="/profile" className="user-menu">
                  <span className="avatar">
                    {user.fullName?.split(" ").pop()?.[0] || "U"}
                  </span>
                  <span>
                    {user.fullName}
                    <small>{user.roleName}</small>
                  </span>
                </Link>
                <button className="icon-btn" title="Đăng xuất" onClick={logout}>
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="btn small" to="/login">
                Đăng nhập <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="footer">
          <span>© 2026 UTC TOEIC. Học tập có định hướng.</span>
          <span>Điểm thi thử dùng để tham khảo.</span>
        </footer>
      </div>
    </div>
  );
}
export function PageHead({ eyebrow, title, description, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
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
