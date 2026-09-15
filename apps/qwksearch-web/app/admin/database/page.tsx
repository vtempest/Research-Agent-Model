"use client";

import { useCallback, useEffect, useState } from "react";

interface EditableField {
  name: string;
  label: string;
  type: "string" | "number" | "boolean";
  hint?: string;
}

interface TableDescriptor {
  key: string;
  label: string;
  description: string;
  primaryKey: string;
  columns: string[];
  truncated: string[];
  editable: EditableField[];
  destructive: boolean;
  rows: number;
}

interface MaintenanceDescriptor {
  key: string;
  label: string;
  description: string;
}

interface RegistryResponse {
  tables: TableDescriptor[];
  maintenance: MaintenanceDescriptor[];
}

type Row = Record<string, unknown>;

interface RowsResponse {
  table: Omit<TableDescriptor, "rows">;
  rows: Row[];
  page: number;
  limit: number;
  matchedRows: number;
  pageCount: number;
}

const PAGE_SIZE = 25;

/**
 * Renders a cell without ever printing `[object Object]`: JSON columns come
 * back parsed, and timestamp columns come back as an ISO string or a number of
 * seconds depending on the drizzle mode.
 */
function renderCell(value: unknown, truncate: boolean) {
  if (value === null || value === undefined) return <span className="text-gray-300 dark:text-gray-700">—</span>;
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (truncate && text.length > 60) {
    return <span title={text}>{text.slice(0, 60)}…</span>;
  }
  return text;
}

function RowEditor({
  table,
  row,
  onClose,
  onChanged,
}: {
  table: Omit<TableDescriptor, "rows">;
  row: Row;
  onClose: () => void;
  onChanged: (row: Row | null) => void;
}) {
  const id = String(row[table.primaryKey] ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      table.editable.map((field) => [field.name, row[field.name] === null || row[field.name] === undefined ? "" : String(row[field.name])]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/database/${table.key}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      onChanged(body.row as Row);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/database/${table.key}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      onChanged(null);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // A destructive table cascades into a lot of user-visible data, so the row
  // id has to be retyped before the delete button becomes usable.
  const deleteArmed = !table.destructive || confirmText === id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold">{table.label} row</h2>
          <div className="text-xs text-gray-500 font-mono break-all">
            {table.primaryKey} = {id}
          </div>
        </div>

        {table.editable.length === 0 ? (
          <p className="text-sm text-gray-500">
            This table is read-only. Rows can be inspected and deleted, but not edited.
          </p>
        ) : (
          <div className="space-y-3">
            {table.editable.map((field) => (
              <label key={field.name} className="block">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {field.label}
                </span>
                {field.type === "boolean" ? (
                  <select
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
                    value={values[field.name] === "true" ? "true" : "false"}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={values[field.name] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                  />
                )}
                {field.hint && <span className="text-xs text-gray-400">{field.hint}</span>}
              </label>
            ))}
          </div>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500">Full row</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-gray-50 dark:bg-gray-950 p-3 text-[11px]">
            {JSON.stringify(row, null, 2)}
          </pre>
        </details>

        {error && <div className="text-sm text-red-500 font-mono">{error}</div>}

        <div className="flex items-center justify-between pt-2 gap-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2 flex-1">
              {table.destructive && (
                <input
                  placeholder={`Type ${id} to confirm`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="min-w-0 flex-1 border border-red-300 dark:border-red-800 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800"
                />
              )}
              <button
                onClick={remove}
                disabled={saving || !deleteArmed}
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 whitespace-nowrap"
              >
                Delete row
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
              Delete row
            </button>
          )}

          {table.editable.length > 0 && !confirmDelete && (
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
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDatabasePage() {
  const [registry, setRegistry] = useState<RegistryResponse | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<RowsResponse | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRegistry = useCallback(async () => {
    setRegistryError(null);
    try {
      const res = await fetch("/api/admin/database");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setRegistry(body);
    } catch (e: any) {
      setRegistryError(e.message);
    }
  }, []);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const loadRows = useCallback(async () => {
    if (!selected) return;
    setLoadingRows(true);
    setRowsError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/admin/database/${selected}?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setRows(body);
    } catch (e: any) {
      setRowsError(e.message);
    } finally {
      setLoadingRows(false);
    }
  }, [selected, page, debouncedQ]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function runMaintenance(key: string, label: string) {
    setRunning(key);
    setActionError(null);
    setActionResult(null);
    try {
      const res = await fetch("/api/admin/database/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: key }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details ?? body?.error ?? `HTTP ${res.status}`);
      setActionResult(
        `${label}: ${body.detail ?? `${Number(body.affected ?? 0).toLocaleString()} row${body.affected === 1 ? "" : "s"} affected`}`,
      );
      // Counts moved, so the table grid is stale — and so is the open table.
      await Promise.all([loadRegistry(), loadRows()]);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setRunning(null);
    }
  }

  function onRowChanged(updated: Row | null) {
    if (!rows || !editing) return;
    const pk = rows.table.primaryKey;
    setRows(
      updated
        ? {
            ...rows,
            rows: rows.rows.map((r) => (r[pk] === editing[pk] ? { ...r, ...updated } : r)),
          }
        : {
            ...rows,
            rows: rows.rows.filter((r) => r[pk] !== editing[pk]),
            matchedRows: rows.matchedRows - 1,
          },
    );
    loadRegistry();
  }

  function selectTable(key: string) {
    setSelected((current) => (current === key ? null : key));
    setRows(null);
    setPage(1);
    setQ("");
    setDebouncedQ("");
  }

  const table = rows?.table;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Database</h1>
        <p className="text-xs text-gray-500">
          Direct read and write access to the application tables, for admins only. Only the fields
          listed as editable can be written — everything else in this view is read-and-delete.
        </p>
      </div>

      {registryError && (
        <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded text-sm font-mono">
          {registryError}
        </div>
      )}

      {/* Table picker with live row counts. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {(registry?.tables ?? []).map((t) => (
          <button
            key={t.key}
            onClick={() => selectTable(t.key)}
            title={t.description}
            className={`text-left border rounded-lg px-3 py-2 transition-colors ${
              selected === t.key
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
            }`}
          >
            <div className="text-lg font-semibold tabular-nums">{t.rows.toLocaleString()}</div>
            <div className="text-xs text-gray-500 truncate">{t.label}</div>
            <div className="text-[10px] text-gray-400">
              {t.editable.length > 0 ? `${t.editable.length} editable` : "read-only"}
            </div>
          </button>
        ))}
      </div>

      {/* Maintenance */}
      <section className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Maintenance</h2>
          <p className="text-xs text-gray-500">
            Each cleanup only touches rows that are already dead — expired, or pointing at a parent
            that no longer exists — so running one twice is a no-op.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(registry?.maintenance ?? []).map((action) => (
            <button
              key={action.key}
              onClick={() => runMaintenance(action.key, action.label)}
              disabled={running !== null}
              title={action.description}
              className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-40"
            >
              {running === action.key ? "Running…" : action.label}
            </button>
          ))}
        </div>
        {actionResult && <p className="text-xs text-green-600 dark:text-green-400">{actionResult}</p>}
        {actionError && <p className="text-xs text-red-500 font-mono">{actionError}</p>}
      </section>

      {/* Row browser */}
      {selected && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <h2 className="text-sm font-semibold">{table?.label ?? selected}</h2>
              <p className="text-xs text-gray-500">{table?.description}</p>
            </div>
            <input
              type="search"
              placeholder="Search rows…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={loadRows}
              disabled={loadingRows}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
            >
              {loadingRows ? "Loading…" : "Refresh"}
            </button>
            {rows && (
              <span className="text-xs text-gray-500">
                {rows.matchedRows.toLocaleString()} matching
              </span>
            )}
          </div>

          {rowsError && (
            <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded text-sm font-mono">
              {rowsError}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  {(table?.columns ?? []).map((column) => (
                    <th key={column} className="px-3 py-2 font-normal whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {!rows || rows.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(table?.columns.length ?? 1) + 1}
                      className="px-3 py-8 text-center text-gray-400 text-xs"
                    >
                      {loadingRows ? "Loading…" : "No rows match this filter."}
                    </td>
                  </tr>
                ) : (
                  rows.rows.map((row, index) => (
                    <tr
                      key={String(row[rows.table.primaryKey] ?? index)}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    >
                      {rows.table.columns.map((column) => (
                        <td
                          key={column}
                          className="px-3 py-2 text-xs whitespace-nowrap max-w-[280px] truncate"
                        >
                          {renderCell(row[column], rows.table.truncated.includes(column))}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setEditing(row)}
                          className="text-xs text-blue-500 hover:underline"
                        >
                          {rows.table.editable.length > 0 ? "Edit" : "Inspect"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {rows && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Page {rows.page} of {rows.pageCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={loadingRows || page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={loadingRows || page >= rows.pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {editing && table && (
        <RowEditor
          table={table}
          row={editing}
          onClose={() => setEditing(null)}
          onChanged={onRowChanged}
        />
      )}
    </div>
  );
}
