let csrf;
export const resetCsrf = () => {
  csrf = undefined;
};
export async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...options.headers };
  if (!["GET", "HEAD"].includes(method)) {
    if (!csrf) {
      const r = await fetch("/api/auth/csrf", { credentials: "same-origin" });
      if (!r.ok)
        throw new Error("Không thể tạo phiên bảo vệ. Hãy thử tải lại trang.");
      csrf = (await r.json()).token;
    }
    headers["X-CSRF-TOKEN"] = csrf;
  }
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      method,
      body,
      headers,
      credentials: "same-origin",
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Không kết nối được máy chủ. Kiểm tra kết nối và thử lại.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.message ||
        (response.status === 429
          ? "Bạn thao tác quá nhanh. Vui lòng chờ một phút."
          : "Có lỗi xảy ra. Vui lòng thử lại."),
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
