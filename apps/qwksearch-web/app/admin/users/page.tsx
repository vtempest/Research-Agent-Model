"use client";

import { useCallback, useEffect, useState } from "react";
import { SubscriptionPlans } from "@/lib/config/site";

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAnonymous: boolean | null;
  image: string | null;
  trialAllowed: number;
  apiKey: string | null;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  createdAt: string | number;
  lastActiveAt: string | null;
  sessions: number;
  total: number;
  docs: number;
  chats: number;
  messages: number;
  favorites: number;
  uploads: number;
  googleDocs: number;
  skills: number;
}

interface UsersResponse {
  users: UserRow[];
  page: number;
  limit: number;
  pageCount: number;
  matchedUsers: number;
  totals: Record<string, number>;
}

/**
 * The usage counters, in table order. `key` matches both the API response
 * field and the `sort` parameter it accepts, so a header click maps straight
 * onto a server-side ORDER BY.
 */
const USAGE_COLUMNS = [
  { key: "docs", label: "Docs", hint: "REASON editor documents" },
  { key: "chats", label: "Chats", hint: "Saved chat threads" },
  { key: "messages", label: "Msgs", hint: "Chat turns sent" },
  { key: "favorites", label: "Saved", hint: "Favorited articles" },
  { key: "uploads", label: "Files", hint: "Uploaded files" },
  { key: "googleDocs", label: "GDocs", hint: "Google Docs sync links" },
  { key: "skills", label: "Skills", hint: "Agent skills configured" },
] as const;

const SUMMARY_TILES = [
  { key: "users", label: "Users" },
  { key: "sessions", label: "Sessions" },
  { key: "activity", label: "Saved items" },
  ...USAGE_COLUMNS.map(({ key, label }) => ({ key, label })),
] as const;

const PAGE_SIZE = 25;
const GB = 1073741824;

function fmtBytes(b: number) {
  if (b >= GB) return `${(b / GB).toFixed(1)} GB`;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

function fmtDate(v: string | number | null | undefined) {
  if (!v) return "—";
  const d = new Date(typeof v === "number" ? v * 1000 : v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
}

/** Compact "how long ago", so dormant accounts stand out while scanning. */
function fmtRelative(value: string | null) {
  if (!value) return "never";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function guessPlan(u: UserRow): string {
  const gb = u.storageQuotaBytes / GB;
  if (gb >= 50) return "Team";
  if (gb > 1) return "Pro";
  return "Free";
}

function PlanBadge({ plan }: { plan: string }) {
  const color =
    plan === "Team"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      : plan === "Pro"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{plan}</span>
  );
}

/** Zeroes are dimmed so the columns a user actually uses pop out of the grid. */
function UsageCell({ value }: { value: number }) {
  return value === 0 ? (
    <span className="text-gray-300 dark:text-gray-700">0</span>
  ) : (
    <span>{value.toLocaleString()}</span>
  );
}

function EditModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: (updated: UserRow | null) => void;
}) {
  const [name, setName] = useState(user.name);
  const [trialAllowed, setTrialAllowed] = useState(String(user.trialAllowed));
  const [storageGB, setStorageGB] = useState(String((user.storageQuotaBytes / GB).toFixed(1)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          trialAllowed: parseInt(trialAllowed, 10),
          storageQuotaBytes: Math.round(parseFloat(storageGB) * GB),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const { user: updated } = await res.json();
      onSaved({ ...user, ...updated });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      onSaved(null);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Edit user</h2>

        <div className="text-xs text-gray-500 font-mono break-all">{user.id}</div>
        <div className="text-sm">{user.email}</div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Display name
            </span>
            <input
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Trial credits
            </span>
            <input
              type="number"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={trialAllowed}
              onChange={(e) => setTrialAllowed(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Storage quota (GB)
            </span>
            <input
              type="number"
              step="0.1"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={storageGB}
              onChange={(e) => setStorageGB(e.target.value)}
            />
            <span className="text-xs text-gray-400">
              Using {fmtBytes(user.storageUsedBytes)} today
            </span>
          </label>
        </div>

        {error && <div className="text-sm text-red-500 font-mono">{error}</div>}

        <div className="flex items-center justify-between pt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                onClick={deleteUser}
                disabled={saving}
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Really delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-500 hover:underline"
            >
              Delete user
            </button>
          )}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm text-gray-500 hover:underline">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [hideAnonymous, setHideAnonymous] = useState(false);
  const [sort, setSort] = useState("joined");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<UserRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort,
        dir,
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (hideAnonymous) params.set("hideAnonymous", "true");
      const res = await fetch(`/api/admin/users?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setData(body);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, sort, dir, debouncedQ, hideAnonymous]);

  useEffect(() => {
    load();
  }, [load]);

  /** First click on a column sorts it descending; clicking it again flips. */
  function toggleSort(key: string) {
    if (sort === key) {
      setDir((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setDir(key === "name" || key === "email" ? "asc" : "desc");
    }
    setPage(1);
  }

  function onSaved(updated: UserRow | null) {
    if (!data || !editing) return;
    setData(
      updated
        ? { ...data, users: data.users.map((u) => (u.id === updated.id ? updated : u)) }
        : {
            ...data,
            users: data.users.filter((u) => u.id !== editing.id),
            matchedUsers: data.matchedUsers - 1,
          },
    );
  }

  const users = data?.users ?? [];
  const pageCount = data?.pageCount ?? 1;

  const planCounts = users.reduce<Record<string, number>>((acc, u) => {
    const plan = guessPlan(u);
    acc[plan] = (acc[plan] ?? 0) + 1;
    return acc;
  }, {});

  const header = (key: string, label: string, hint?: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      title={hint}
      className={`transition-colors hover:text-gray-900 dark:hover:text-gray-100 ${
        sort === key ? "text-gray-900 dark:text-gray-100 font-semibold" : ""
      }`}
    >
      {label}
      {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Users</h1>
          <p className="text-xs text-gray-500">
            Every account with what it has actually saved — documents, chats, messages, saved
            articles, uploads, Google Docs links and agent skills. Click a column to sort by it
            across all users.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Site-wide totals — deliberately unfiltered, as a stable reference. */}
      {data && (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {SUMMARY_TILES.map((tile) => (
            <div
              key={tile.key}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-center"
            >
              <div className="text-lg font-semibold tabular-nums">
                {(data.totals?.[tile.key] ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">{tile.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Plan mix on this page, from the storage quota each account carries. */}
      <div className="flex gap-2 flex-wrap">
        {SubscriptionPlans.map((plan) => (
          <div
            key={plan.name}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2"
          >
            <PlanBadge plan={plan.name} />
            <span className="font-semibold tabular-nums">{planCounts[plan.name] ?? 0}</span>
            <span className="text-gray-400">on this page · ${plan.price}/mo</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by name, email, or ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[220px] border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={hideAnonymous}
            onChange={(e) => {
              setHideAnonymous(e.target.checked);
              setPage(1);
            }}
          />
          Hide anonymous
        </label>
        {data && (
          <span className="text-sm text-gray-500">
            {data.matchedUsers.toLocaleString()} matching
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded text-sm font-mono">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[1100px] text-sm border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 font-normal">{header("name", "User")}</th>
              <th className="px-2 py-2 font-normal">Plan</th>
              <th className="px-2 py-2 font-normal">{header("joined", "Joined")}</th>
              <th className="px-2 py-2 font-normal">
                {header("lastActive", "Last active", "Newest session activity")}
              </th>
              <th className="px-2 py-2 text-right font-normal">
                {header("sessions", "Logins", "Session rows for this account")}
              </th>
              {USAGE_COLUMNS.map((column) => (
                <th key={column.key} className="px-2 py-2 text-right font-normal">
                  {header(column.key, column.label, column.hint)}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-normal">
                {header("total", "Total", "All saved items combined")}
              </th>
              <th className="px-2 py-2 text-right font-normal">
                {header("storage", "Storage", "Bytes stored against the quota")}
              </th>
              <th className="px-3 py-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={USAGE_COLUMNS.length + 7} className="px-3 py-8 text-center text-gray-400 text-xs">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={USAGE_COLUMNS.length + 7} className="px-3 py-8 text-center text-gray-400 text-xs">
                  No users match this filter.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.image}
                          alt=""
                          className="w-7 h-7 shrink-0 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="w-7 h-7 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center text-xs">
                          {(u.name || u.email || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[180px] flex items-center gap-1.5">
                          {u.name || "—"}
                          {u.isAnonymous && (
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px]">
                              anon
                            </span>
                          )}
                          {!u.emailVerified && !u.isAnonymous && (
                            <span className="px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-400 text-[10px]">
                              unverified
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[180px]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <PlanBadge plan={guessPlan(u)} />
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(u.createdAt)}
                  </td>
                  <td
                    className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap"
                    title={u.lastActiveAt ? fmtDate(u.lastActiveAt) : undefined}
                  >
                    {fmtRelative(u.lastActiveAt)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <UsageCell value={u.sessions} />
                  </td>
                  {USAGE_COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-2 text-right tabular-nums">
                      <UsageCell value={u[column.key]} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-medium tabular-nums">
                    <UsageCell value={u.total} />
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-gray-500 whitespace-nowrap">
                    {fmtBytes(u.storageUsedBytes)} / {fmtBytes(u.storageQuotaBytes)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditing(u)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Page {data?.page ?? page} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={loading || page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {editing && (
        <EditModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            onSaved(u);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
