import type { User } from "../types";
let csrf = "";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function fetchResponse(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    // Cancellation is intentional; it is not a connectivity failure.
    if (error instanceof Error && error.name === "AbortError") throw error;
    // onLine cannot establish server reachability. A rejected fetch is the
    // signal even when the browser still reports an active connection.
    throw new ApiError(
      0,
      "Please check your internet connection and try again.",
    );
  }
}
export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET")
    headers.set("X-CSRF-Token", csrf);
  const response = await fetchResponse("/api" + url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: "Request failed." }));
    throw new ApiError(response.status, body.error);
  }
  const body = await response.json();
  if (body.csrf) csrf = body.csrf;
  return body;
}
export const session = () =>
  api<{ user: User | null; csrf: string }>("/auth/session");
export function multipart(
  payload: unknown,
  files: Record<string, Blob | null>,
) {
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  Object.entries(files).forEach(([kind, file]) => {
    if (file) form.set(kind, file, kind + ".png");
  });
  return form;
}
export async function report(kind: string) {
  const response = await fetchResponse("/api/reports/" + kind, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error((await response.json()).error);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `ALTECH_${kind}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
