import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Toaster } from "./components/Toaster";
import { api, ApiError, session } from "./services/api";
import { notify } from "./services/notifications";
import { Modal } from "./components/Modal";
import { BorrowerForm } from "./features/BorrowerForm";
import { Dashboard } from "./features/Dashboard";
import { Accounts } from "./features/Management";
import type { User } from "./types";
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [tab, setTab] = useState(() =>
      sessionStorage.getItem("tms-tab") === "dashboard"
        ? "dashboard"
        : "borrower",
    ),
    [modal, setModal] = useState(""),
    [ready, setReady] = useState(false),
    [showLoginPassword, setShowLoginPassword] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (modal !== "login") setShowLoginPassword(false);
  }, [modal]);
  const connectionRequest = useRef<ReturnType<typeof session> | null>(null);
  const checkConnection = useCallback(() => {
    // Share startup/retry/sign-in checks so their CSRF responses cannot race.
    connectionRequest.current ??= session()
      .catch((error) => {
        // A local reverse proxy can return an empty error response when the
        // backend is down. Keep meaningful server errors; clarify only fallback text.
        if (error instanceof ApiError && error.message === "Request failed.") {
          throw new ApiError(error.status, "Please check your internet connection and try again.");
        }
        throw error;
      })
      .finally(() => {
        connectionRequest.current = null;
      });
    return connectionRequest.current;
  }, []);
  useEffect(() => {
    sessionStorage.setItem("tms-tab", tab);
  }, [tab]);
  useEffect(() => {
    if (ready) return;
    let active = true;
    let notified = false;
    let retryTimer: ReturnType<typeof setTimeout>;
    async function connect() {
      try {
        const s = await checkConnection();
        if (!active) return;
        setUser(s.user);
        setReady(true);
      } catch (error) {
        if (!active) return;
        const message = (error as Error).message;
        if (!notified) {
          notify(message);
          notified = true;
        }
        retryTimer = setTimeout(connect, 3000);
      }
    }
    connect();
    return () => { active = false; clearTimeout(retryTimer); };
  }, [ready, checkConnection]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    let checking = false;
    async function checkSession() {
      if (checking) return;
      checking = true;
      try {
        const result = await session();
        if (active && !result.user) {
          setUser(null);
          setTab("borrower");
          setModal("");
          notify("Your session ended. Please sign in again.");
        }
      } catch {
        // A temporary connection failure does not establish that a session ended.
      } finally {
        checking = false;
      }
    }
    const timer = setInterval(checkSession, 30000);
    window.addEventListener("focus", checkSession);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", checkSession);
    };
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let lastActivity = Date.now();
    let sending = false;
    const activity = () => { lastActivity = Date.now(); };
    const heartbeat = async () => {
      if (sending) return;
      sending = true;
      try {
        await api("/auth/heartbeat", { method: "POST", body: JSON.stringify({
          active: document.visibilityState === "visible" && Date.now() - lastActivity < 5 * 60000,
        }) });
      } catch { /* Missing heartbeat will eventually mark this session offline. */ }
      finally { sending = false; }
    };
    const visibility = () => { if (document.visibilityState === "visible") activity(); void heartbeat(); };
    const events = ["pointerdown", "pointermove", "keydown", "scroll"] as const;
    for (const event of events) window.addEventListener(event, activity, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    void heartbeat();
    const timer = setInterval(() => { void heartbeat(); }, 30000);
    return () => {
      clearInterval(timer);
      for (const event of events) window.removeEventListener(event, activity);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [user?.id]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (!ready) {
        // Establish the session/CSRF token before login after an outage.
        await checkConnection();
        setReady(true);
      }
      const result = await api<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(values)),
      });
      setUser(result.user);
      setModal("");
      notify(`Welcome back ${result.user.name}!`, "success");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setTab("borrower");
      setModal("");
      notify("Logged out.", "info");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Toaster />
      <header className="app-header text-white shadow-lg sticky top-0 z-30 bg-[#002366]">
        <div className="nav-inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <img
            src="/assets/altech-logo.webp"
            decoding="async"
            alt="ALTECH - Your Key to Automation"
            className="brand-logo h-12 w-auto object-contain max-w-[230px]"
          />
          <div className="nav-controls flex items-center gap-2 sm:gap-3">
            <div className="tab-switcher bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700">
              {[
                {
                  key: "borrower",
                  label: "Borrower Request",
                  icon: "file-pen",
                },
                {
                  key: "dashboard",
                  label: "Tools Dashboard",
                  icon: "chart-line",
                },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-label={t.label}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${tab === t.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:text-white"}`}
                >
                  <i className={"fas fa-" + t.icon} />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
            {user ? (
              <div className="flex items-center gap-2">
                {user.role !== "User" && (
                  <button
                    className="nav-button text-amber-300"
                    onClick={() => setModal("users")}
                    aria-label="Manage users"
                  >
                    <i className="fas fa-user-shield" />
                    <span className="hidden md:inline ml-1">Members</span>
                  </button>
                )}
                <button
                  onClick={() => setModal("password")}
                  className={`nav-button whitespace-normal break-words text-left ${user.role === "Developer" ? "text-purple-300" : user.role === "Admin" ? "text-amber-300" : "text-emerald-300"}`}
                  title="Change your password"
                  aria-label={`${user.name}. Change your password`}
                >
                  {user.name}
                </button>
                <button
                  className="nav-button text-rose-300"
                  onClick={logout}
                  aria-label="Logout"
                >
                  <i className="fas fa-right-from-bracket" />
                  <span className="hidden sm:inline ml-1">Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="responsive-main max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full">
        {tab === "borrower" ? (
          <BorrowerForm
            notify={notify}
            onSubmitted={() => {}}
          />
        ) : user ? (
          <Dashboard key={user.id} user={user} notify={notify} />
        ) : (
          <div hidden={modal === "login"} className="auth-access-card bg-slate-900/10 border border-white/20 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-lg">
            <i className="fas fa-user-lock text-amber-400 text-3xl mb-3" />
            <h3 className="font-bold text-white text-base">
              Authentication Required
            </h3>
            <p className="text-xs text-slate-200 mt-1 mb-5">
              Please log in with your credentials to access your authorized
              requests and tools dashboard.
            </p>
            <button className="btn-primary" onClick={() => setModal("login")}>
              Login
            </button>
          </div>
        )}
      </main>
      <footer className="mt-auto py-4 text-center text-xs font-medium text-white bg-[#002366]">
        © Copyright 2026
      </footer>
      {modal === "login" && (
        <Modal
          title="Portal Sign In"
          titleCentered
          frosted
          onClose={() => setModal("")}
        >
          <form onSubmit={login} className="space-y-4 w-full max-w-xs mx-auto">
            <label className="field-label">
              Username
              <span className="login-input-surface block mt-1">
              <input
                className="input"
                name="username"
                required
                autoComplete="username"
                maxLength={64}
              />
              </span>
            </label>
            <div>
              <label className="field-label" htmlFor="sign-in-password">Password</label>
              <div className="login-input-surface relative mt-1">
                <input
                  id="sign-in-password"
                  className="input pr-10"
                  name="password"
                  required
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={128}
                />
                <button
                  type="button"
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  aria-pressed={showLoginPassword}
                  aria-controls="sign-in-password"
                  className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-500 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600 rounded-r-lg"
                  onClick={() => setShowLoginPassword((visible) => !visible)}
                >
                  <i className={`fas ${showLoginPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" />
                </button>
              </div>
            </div>
            <button className="btn-primary block mx-auto" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "users" && user && user.role !== "User" && (
        <Accounts
          current={user}
          notify={notify}
          onClose={() => setModal("")}
        />
      )}{" "}
      {modal === "password" && user && (
        <Modal title="Change Password" titleCentered onClose={() => setModal("")}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api("/auth/password", {
                  method: "POST",
                  body: JSON.stringify(Object.fromEntries(values)),
                });
                setModal("");
                notify("Password changed. Please sign in again on any other devices.", "success");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label">
              Current password
              <input
                name="currentPassword"
                className="input"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label className="field-label">
              New password
              <input
                name="newPassword"
                className="input"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <p className="text-xs text-slate-500">
              12–128 characters with uppercase, lowercase, number and symbol.
            </p>
            <div className="flex justify-end">
              <button className="btn-primary" disabled={busy}>
                Change Password
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
