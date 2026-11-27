import React, { useState } from "react";
import { localUrl, remoteUrl } from "./photos";

/* Bảng màu nhận diện: xanh navy học thuật, đỏ nhấn, xám trung tính */
export const C = {
  navy: "#0B1F4B",
  navyDeep: "#071537",
  navySoft: "#1B3270",
  red: "#D7262E",
  white: "#FFFFFF",
  mist: "#EEF1F6",
};

export function LogoMark({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="logo-mark"
    >
      <rect width="40" height="40" fill={C.navy} />
      <rect y="34" width="40" height="6" fill={C.red} />
      <text
        x="20"
        y="24"
        textAnchor="middle"
        fill={C.white}
        fontFamily="Inter, Arial, sans-serif"
        fontWeight="800"
        fontSize="13.5"
        letterSpacing="0.3"
      >
        UTC
      </text>
    </svg>
  );
}

export function Wordmark({ light = false }) {
  return (
    <span className={"wordmark" + (light ? " light" : "")}>
      <LogoMark />
      <span className="wordmark-text">
        <b>UTC TOEIC</b>
        <small>Trường ĐH Giao thông vận tải</small>
      </span>
    </span>
  );
}

/* Hoạ tiết đường ray hội tụ — gợi chất "giao thông" một cách tiết chế */
export function TrackPattern({ className = "", overlay = false }) {
  const lines = 18;
  return (
    <svg
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      className={"track-pattern " + className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="track-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={C.navyDeep} stopOpacity="0.95" />
          <stop offset="0.55" stopColor={C.navy} stopOpacity="0.25" />
          <stop offset="1" stopColor={C.navy} stopOpacity="0" />
        </linearGradient>
      </defs>
      {!overlay && <rect width="1200" height="600" fill={C.navy} />}
      <g stroke={C.white} strokeOpacity={overlay ? 0.14 : 0.1} strokeWidth="1.2" fill="none">
        {Array.from({ length: lines }, (_, i) => {
          const x = -500 + (i * 2300) / (lines - 1);
          return (
            <line
              key={i}
              x1={x}
              y1="600"
              x2="960"
              y2="250"
              pathLength="1"
              className="track-line"
              style={{ "--i": i }}
            />
          );
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const t = (i + 1) / 10;
          const y = 600 - 350 * (1 - Math.pow(1 - t, 2));
          return (
            <line
              key={"h" + i}
              x1="0"
              y1={y}
              x2="1200"
              y2={y}
              strokeOpacity={0.05}
            />
          );
        })}
      </g>
      <g className="track-rings">
        <circle cx="960" cy="250" r="150" fill="none" stroke={C.white} strokeOpacity="0.08" />
        <circle cx="960" cy="250" r="270" fill="none" stroke={C.white} strokeOpacity="0.05" />
        <circle cx="960" cy="250" r="390" fill="none" stroke={C.white} strokeOpacity="0.035" />
      </g>
      <circle cx="960" cy="250" r="5" fill={C.red} className="track-signal" />
      {!overlay && <rect width="1200" height="600" fill="url(#track-fade)" />}
    </svg>
  );
}

/* Ảnh thu nhỏ cho thẻ đề thi và bài học — hoạ tiết đường nét trên nền navy */
export function CardArt({ variant = 0, label = "", number }) {
  const v = ((variant % 4) + 4) % 4;
  const patterns = [
    /* Sóng âm — nghe */
    <g key="a" fill="none" stroke={C.white} strokeOpacity="0.22" strokeWidth="1.5">
      {[40, 80, 120, 160, 200, 240].map((r) => (
        <path key={r} d={`M300 ${110 - r} A${r} ${r} 0 0 1 300 ${110 + r}`} />
      ))}
    </g>,
    /* Dòng chữ — đọc */
    <g key="b" fill={C.white} fillOpacity="0.14">
      {[34, 56, 78, 100, 122, 144, 166, 188].map((y, i) => (
        <rect key={y} x="190" y={y} width={i % 3 === 2 ? 120 : 180} height="7" />
      ))}
    </g>,
    /* Lưới điểm — tổng hợp */
    <g key="c" fill={C.white} fillOpacity="0.2">
      {Array.from({ length: 8 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => (
          <circle key={r + "-" + c} cx={200 + c * 20} cy={30 + r * 22} r="2" />
        )),
      )}
    </g>,
    /* Đường chéo — luyện tập */
    <g key="d" stroke={C.white} strokeOpacity="0.14" strokeWidth="1.5">
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1={160 + i * 18} y1="220" x2={260 + i * 18} y2="0" />
      ))}
    </g>,
  ];
  const bg = [C.navy, C.navySoft, C.navyDeep, C.navy][v];
  return (
    <svg
      viewBox="0 0 400 220"
      className="card-art"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="220" fill={bg} />
      {patterns[v]}
      <rect x="24" y="24" width="28" height="4" fill={C.red} />
      {label && (
        <text
          x="24"
          y="50"
          fill={C.white}
          fontFamily="Inter, Arial, sans-serif"
          fontWeight="600"
          fontSize="12"
          letterSpacing="1.6"
        >
          {label}
        </text>
      )}
      {number != null && (
        <text
          x="24"
          y="196"
          fill={C.white}
          fontFamily="Inter, Arial, sans-serif"
          fontWeight="700"
          fontSize="56"
          letterSpacing="-2"
        >
          {number}
        </text>
      )}
    </svg>
  );
}

/* Biểu tượng trạng thái trống — nét mảnh, trung tính */
export function EmptyArt() {
  return (
    <svg viewBox="0 0 64 64" className="empty-art" aria-hidden="true">
      <rect x="10" y="8" width="36" height="46" fill="none" stroke={C.navy} strokeWidth="2.5" />
      <line x1="18" y1="20" x2="38" y2="20" stroke={C.navy} strokeWidth="2.5" />
      <line x1="18" y1="28" x2="38" y2="28" stroke={C.navy} strokeWidth="2.5" />
      <line x1="18" y1="36" x2="30" y2="36" stroke={C.navy} strokeWidth="2.5" />
      <circle cx="44" cy="44" r="10" fill={C.white} stroke={C.red} strokeWidth="2.5" />
      <line x1="51" y1="51" x2="58" y2="58" stroke={C.red} strokeWidth="2.5" />
    </svg>
  );
}

/* Ảnh chụp: ưu tiên bản đã tải về máy, sau đó Unsplash, cuối cùng là hoạ tiết dự phòng */
export function Photo({ name, alt = "", className = "", width = 1200, fallback = null, eager = false }) {
  const sources = [localUrl(name), remoteUrl(name, width)].filter(Boolean);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  if (step >= sources.length) return fallback;
  return (
    <img
      className={"photo " + (loaded ? "is-loaded " : "") + className}
      src={sources[step]}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(false);
        setStep((x) => x + 1);
      }}
    />
  );
}
