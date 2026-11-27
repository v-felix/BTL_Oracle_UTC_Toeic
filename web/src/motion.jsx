import React, { useEffect, useRef, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* Các khối sẽ hiện dần khi cuộn tới */
const REVEAL_SELECTOR = [
  ".page-head",
  ".section-head",
  ".stat-card",
  ".panel",
  ".exam-card",
  ".lesson-card",
  ".word-card",
  ".learning-band",
  ".part-path > a",
  ".result-overview",
  ".part-result-grid > div",
  ".review-item",
  ".detail-facts",
  ".empty",
  ".database-banner",
  ".notice-inline",
].join(",");

/* Tự gắn hiệu ứng hiện dần cho nội dung trong vùng chứa, kể cả nội dung tải sau */
export function useAutoReveal(rootRef, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    const tag = (el) => {
      if (el.dataset.reveal) return;
      el.dataset.reveal = "1";
      const siblings = el.parentElement
        ? [...el.parentElement.children].filter((x) => x.matches(REVEAL_SELECTOR))
        : [el];
      const i = Math.max(0, siblings.indexOf(el));
      el.style.setProperty("--reveal-delay", Math.min(i, 8) * 70 + "ms");
      io.observe(el);
    };
    const scan = (node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(REVEAL_SELECTOR)) tag(node);
      node.querySelectorAll(REVEAL_SELECTOR).forEach(tag);
    };
    scan(root);
    const mo = new MutationObserver((list) => {
      for (const m of list) m.addedNodes.forEach(scan);
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, deps);
}

/* Số chạy từ 0 tới giá trị thật */
export function CountUp({ value, duration = 1100 }) {
  const [shown, setShown] = useState(
    typeof value === "number" && !reduced() ? 0 : value,
  );
  const ref = useRef(null);
  useEffect(() => {
    if (typeof value !== "number" || reduced()) {
      setShown(value);
      return;
    }
    let frame,
      start,
      started = false;
    const run = () => {
      started = true;
      const step = (t) => {
        start ??= t;
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(value * eased));
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    const el = ref.current;
    let io;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !started) {
          run();
          io.disconnect();
        }
      });
      io.observe(el);
    } else run();
    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
    };
  }, [value, duration]);
  return (
    <span ref={ref} className="count-up">
      {shown ?? "—"}
    </span>
  );
}

/* Theo dõi trang đã cuộn hay chưa (để đổ bóng cho header) */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > offset);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [offset]);
  return scrolled;
}

/* Chữ hiện lên từng từ từ sau một "mặt nạ" */
export function RevealText({ text, delay = 0, step = 55 }) {
  const words = String(text ?? "").split(" ");
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span className="rw">
            <span style={{ "--d": delay + i * step + "ms" }}>{w}</span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </>
  );
}
