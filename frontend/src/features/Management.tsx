import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../components/Modal";
import { api, report } from "../services/api";
import type { Tool, User } from "../types";
export function Catalog({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [tools, setTools] = useState<Tool[]>([]),
    [edit, setEdit] = useState<Tool | null>(null),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [qty, setQty] = useState(0),
    [busy, setBusy] = useState(false);
  const reload = () =>
    api<Tool[]>("/tools")
      .then(setTools)
      .catch((e) => notify(e.message));
  useEffect(() => {
    void reload();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(edit ? "/tools/" + edit.id : "/tools", {
        method: edit ? "PATCH" : "POST",
        body: JSON.stringify({ code, name, totalQty: qty }),
      });
      setEdit(null);
      setCode("");
      setName("");
      setQty(0);
      await reload();
      notify("Catalog saved.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify("Catalog file must be under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const { parseCatalog } = await import("../utils/catalog");
      const input = parseCatalog(await file.arrayBuffer());
      await api("/tools/import", {
        method: "POST",
        body: JSON.stringify({ tools: input }),
      });
      await reload();
      notify("Catalog imported; existing codes updated and new codes added.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal wide title="Tools Catalog" onClose={onClose}>
      <form className="grid grid-cols-1 sm:grid-cols-4 gap-2" onSubmit={submit}>
        <input
          aria-label="Tool code"
          required
          maxLength={64}
          className="input"
          placeholder="Tool Code / ID"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          aria-label="Tool name"
          required
          maxLength={200}
          className="input"
          placeholder="Tool / Equipment Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          aria-label="Total stock quantity"
          required
          className="input"
          type="number"
          min={0}
          max={1000000}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
        />
        <button disabled={busy} className="btn-primary">
          {edit ? "Save Tool" : "Add Tool"}
        </button>
      </form>
      {edit && (
        <button
          className="btn-secondary"
          onClick={() => {
            setEdit(null);
            setCode("");
            setName("");
            setQty(0);
          }}
        >
          Cancel Edit
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-secondary"
          onClick={() => report("tools").catch((e) => notify(e.message))}
        >
          Export Tools Catalog
        </button>
        <label className="btn-secondary cursor-pointer">
          Import Tools Catalog
          <input
            disabled={busy}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-slate-500">
          XLSX / XLS / CSV • up to 1,000 rows • upsert by tool code
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {["Code", "Tool / Equipment Name", "Total Stock", "Actions"].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.id}>
                <td>{t.code}</td>
                <td>{t.name}</td>
                <td>{t.total_qty}</td>
                <td className="space-x-2">
                  <button
                    disabled={busy}
                    className="text-indigo-600"
                    onClick={() => {
                      setEdit(t);
                      setCode(t.code);
                      setName(t.name);
                      setQty(t.total_qty);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    className="text-rose-600"
                    onClick={async () => {
                      if (!confirm(`Archive ${t.name}?`)) return;
                      try {
                        await api("/tools/" + t.id, { method: "DELETE" });
                        await reload();
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Archive
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tools.length && (
          <p className="empty">
            No tools in the catalog. Add a tool or import your catalog.
          </p>
        )}
      </div>
    </Modal>
  );
}
export function Accounts({
  current,
  onClose,
  notify,
}: {
  current: User;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const developer = current.role === "Developer";
  const [presence, setPresence] = useState<Record<string, "Online" | "Offline" | "Idle">>({});
  useEffect(() => {
    if (!developer) return;
    let mounted = true;
    let checking = false;
    async function refreshPresence() {
      if (checking) return;
      checking = true;
      try {
        const result = await api<{ id: string; presence: "Online" | "Offline" | "Idle" }[]>("/users/presence");
        if (mounted) setPresence(Object.fromEntries(result.map((u) => [u.id, u.presence])));
      } catch { if (mounted) setPresence({}); }
      finally { checking = false; }
    }
    void refreshPresence();
    const timer = setInterval(() => { void refreshPresence(); }, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, [developer]);
  const [users, setUsers] = useState<User[]>([]),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<User | null>(null),
    [newPassword, setNewPassword] = useState("");
  const reload = () =>
    api<User[]>("/users")
      .then(setUsers)
      .catch((e) => notify(e.message));
  useEffect(() => {
    void reload();
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      input = new FormData(form);
    setBusy(true);
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(input)),
      });
      form.reset();
      await reload();
      notify("Account created.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(user: User) {
    setBusy(true);
    try {
      await api("/users/" + user.id, {
        method: "PATCH",
        body: JSON.stringify({
          name: user.name,
          role: user.role,
          active: !!user.active,
        }),
      });
      await reload();
      notify("Account updated; its previous sessions were revoked.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={developer ? "Developer Account Control" : "User Accounts"}
      centered
      onClose={onClose}
    >
      <form
        onSubmit={create}
        className="account-create-form bg-slate-50 p-4 rounded-xl border space-y-3"
      >
        <h4 className="section-title">Add New Authorized Account</h4>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            name="username"
            className="input"
            required
            pattern="[a-zA-Z0-9_.\-]{3,64}"
            placeholder="Username"
            aria-label="New username"
          />
          <input
            name="password"
            className="input"
            required
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Password"
            aria-label="New account password"
          />
          <input
            name="name"
            className="input"
            required
            maxLength={150}
            placeholder="Full Name"
            aria-label="New account name"
          />
        </div>
        <p className="text-xs text-slate-500">
          Passwords require 12–128 characters, uppercase, lowercase, number and
          symbol.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <select
            name="role"
            aria-label="New account role"
            className="input w-auto"
          >
            <option>User</option>
            {developer && <option>Admin</option>}
            {developer && <option>Developer</option>}
          </select>
          <button className="btn-primary" disabled={busy}>
            Create Account
          </button>
        </div>
      </form>
      <div className="overflow-x-auto">
        <table className="data-table account-control-table">
          <thead>
            <tr>
              {["Username", "Name", "Role", "Active", ...(developer ? ["Status"] : []), "Account Actions"].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id}>
                <td>
                  {user.username}
                  {user.id === current.id ? " (You)" : ""}
                </td>
                <td>
                  <input
                    className="input"
                    disabled={!developer}
                    aria-label={`Name for ${user.username}`}
                    value={user.name}
                    onChange={(e) =>
                      setUsers(
                        users.map((u, n) =>
                          index === n ? { ...u, name: e.target.value } : u,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <select
                    className="input"
                    disabled={!developer || user.id === current.id}
                    aria-label={`Role for ${user.username}`}
                    value={user.role}
                    onChange={(e) =>
                      setUsers(
                        users.map((u, n) =>
                          index === n
                            ? { ...u, role: e.target.value as User["role"] }
                            : u,
                        ),
                      )
                    }
                  >
                    <option>Developer</option>
                    <option>Admin</option>
                    <option>User</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Active account ${user.username}`}
                    disabled={!developer || user.id === current.id}
                    checked={!!user.active}
                    onChange={(e) =>
                      setUsers(
                        users.map((u, n) =>
                          index === n
                            ? { ...u, active: e.target.checked ? 1 : 0 }
                            : u,
                        ),
                      )
                    }
                  />
                </td>
                {developer && (
                  <td>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title="Online: recent activity. Idle: no activity for 5 minutes. Offline: no heartbeat for 90 seconds or no valid session.">
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${presence[user.id] === "Online" ? "bg-emerald-500" : presence[user.id] === "Idle" ? "bg-amber-500" : presence[user.id] === "Offline" ? "bg-rose-500" : "bg-slate-300"}`} />
                      {presence[user.id] || "Unknown"}
                    </span>
                  </td>
                )}
                <td>
                  {developer && (
                    <button
                      className="btn-secondary"
                      disabled={!developer || busy || user.id === current.id}
                      onClick={() => update(user)}
                    >
                      Save
                    </button>
                  )}
                  {((developer && user.id !== current.id) ||
                    (!developer && user.role !== "Developer")) && (
                    <button
                      className="btn-secondary ml-1"
                      onClick={() => {
                        setTarget(user);
                        setNewPassword("");
                      }}
                    >
                      Reset Password
                    </button>
                  )}
                  {user.id !== current.id &&
                    user.role !== "Developer" &&
                    (developer || user.role === "User") && (
                      <button
                        className="btn-secondary ml-1"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete account ${user.username}? Request and audit history will be retained.`,
                            )
                          )
                            return;
                          setBusy(true);
                          try {
                            await api("/users/" + user.id, {
                              method: "DELETE",
                            });
                            await reload();
                            notify("Account deleted; sessions revoked.");
                          } catch (e) {
                            notify((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/users/" + target.id + "/password", {
                method: "POST",
                body: JSON.stringify({ newPassword }),
              });
              setTarget(null);
              notify("Password reset; sessions revoked.");
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="flex flex-wrap gap-2"
        >
          <label className="field-label">
            Reset password for {target.username}
            <input
              className="input"
              type="password"
              required
              minLength={12}
              maxLength={128}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button disabled={busy} className="btn-primary">
            Set Password
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setTarget(null)}
          >
            Cancel
          </button>
        </form>
      )}
    </Modal>
  );
}
