import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Providers, Layout, Guard, Empty } from "./ui";
import {
  Home,
  Exams,
  ExamDetail,
  AuthPage,
  Learning,
  Lesson,
  Vocabulary,
  HistoryPage,
  Profile,
} from "./pages";
import { ExamSession, Result } from "./session";
import { Admin } from "./admin";
import "./styles.css";
const page = (child) => <Layout>{child}</Layout>;
function App() {
  return (
    <Providers>
      <Routes>
        <Route path="/" element={page(<Home />)} />
        <Route path="/exams" element={page(<Exams />)} />
        <Route path="/exams/:id" element={page(<ExamDetail />)} />
        <Route path="/learning" element={page(<Learning />)} />
        <Route path="/learning/:id" element={page(<Lesson />)} />
        <Route path="/vocabulary" element={page(<Vocabulary />)} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route
          path="/history"
          element={page(
            <Guard>
              <HistoryPage />
            </Guard>,
          )}
        />
        <Route
          path="/profile"
          element={page(
            <Guard>
              <Profile />
            </Guard>,
          )}
        />
        <Route
          path="/attempts/:id"
          element={
            <Guard>
              <ExamSession />
            </Guard>
          }
        />
        <Route
          path="/results/:id"
          element={page(
            <Guard>
              <Result />
            </Guard>,
          )}
        />
        <Route
          path="/admin/:section?"
          element={page(
            <Guard roles={["ADMIN", "CONTENT_ADMIN", "TEACHER", "AUDITOR"]}>
              <Admin />
            </Guard>,
          )}
        />
        <Route
          path="*"
          element={page(
            <Empty
              title="Không tìm thấy trang"
              text="Đường dẫn có thể đã thay đổi."
            >
              <a className="btn" href="/">
                Về trang chủ
              </a>
            </Empty>,
          )}
        />
      </Routes>
    </Providers>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
