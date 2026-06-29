"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DrosiaMark } from "@/components/brand/Logo";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { CATEGORY_META, REPORT_CATEGORIES, isReportCategory } from "@/lib/categories";
import { reportAgeDays } from "@/lib/severity";
import type {
  AdminAuthorityRow,
  AdminDeliveryRow,
  AdminDisputeRow,
  AdminFlagRow,
  AdminReportRow,
  DeliveryHealth,
} from "@/lib/admin/types";

function authorityName(name: Record<string, string> | null): string {
  return name?.en ?? name?.el ?? "—";
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Drosia Admin board — desktop, English-only operator tool (A1–A6).
 * Moderation queue + report detail + approve/reject are wired to the real API
 * (/api/admin/*). Authority directory, delivery monitor and flags/disputes tabs
 * still show demo data (clearly labelled) — next to be wired.
 * The outbound authority email stays in the authority's locale, never English.
 */
type Screen = "queue" | "detail" | "authorities" | "delivery" | "flags";

const STATUS_PILL: Record<string, [string, string]> = {
  delivered: ["#EAFBF1", "#1B8B4A"],
  sent: ["#E0F3F5", "#00A6BC"],
  queued: ["#F0F4F5", "#5B7378"],
  bounced: ["#FDECEA", "#C0392B"],
  failed: ["#FDECEA", "#C0392B"],
  complained: ["#FFF1E6", "#C45D10"],
  "no email": ["#FDECEA", "#C0392B"],
};
const pill = (s: string) => STATUS_PILL[s] ?? ["#F0F4F5", "#5B7378"];

/** Report lifecycle states (report_status enum) → operator-facing label + colors. */
const REPORT_STATUS_META: Record<string, { label: string; bg: string; fg: string; dot: string; order: number }> = {
  submitted: { label: "Pending", bg: "#FFF4DC", fg: "#B7820E", dot: "#E6A817", order: 0 },
  in_review: { label: "In review", bg: "#E0F7FA", fg: "#00A6BC", dot: "#1ECAD9", order: 1 },
  notified: { label: "Notified", bg: "#E7F0FF", fg: "#2D6BD8", dot: "#3D7BF0", order: 2 },
  resolved: { label: "Resolved", bg: "#EAFBF1", fg: "#1B8B4A", dot: "#2ECC71", order: 3 },
  rejected: { label: "Rejected", bg: "#FDECEA", fg: "#C0392B", dot: "#E74C3C", order: 4 },
};
const statusMeta = (s: string) => REPORT_STATUS_META[s] ?? { label: s, bg: "#F0F4F5", fg: "#5B7378", dot: "#9DB1B5", order: 9 };

function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: m.bg, color: m.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function catDisplay(cat: string): string {
  if (isReportCategory(cat)) return `${CATEGORY_META[cat].emoji} ${CATEGORY_META[cat].label.en}`;
  return cat;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

/**
 * Report preview thumbnail. Renders the ANONYMIZED (public) photo when available;
 * falls back to the hatch placeholder while a report still awaits blur, or if the
 * image fails to load. Originals are never shown here (service-role only).
 */
function AdminPhoto({ src, className, badge }: { src: string | null; className: string; badge?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const show = !!src && !failed;
  return (
    <div className={`photo-placeholder relative overflow-hidden ${className}`}>
      {show && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {badge}
    </div>
  );
}

export function AdminBoard() {
  const [authed, setAuthed] = useState(false);
  const [screen, setScreen] = useState<Screen>("queue");
  const [flagTab, setFlagTab] = useState<"flags" | "disputes">("flags");

  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminReportRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      // No status filter — the overview board shows every report and filters client-side.
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = (await res.json()) as { reports?: AdminReportRow[] };
      setReports(data.reports ?? []);
    } catch {
      flash("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    // Load reports from the server on sign-in (external-system sync, not derived state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (authed) void fetchReports();
  }, [authed, fetchReports]);

  async function approve(row: AdminReportRow) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reports/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = (await res.json()) as { status?: string; delivery?: string; error?: string };
      if (!res.ok) {
        flash(data.error ?? "Approve failed");
      } else if (data.status === "notified") {
        flash(`✓ Approved · email sent · status → notified`);
      } else if (data.delivery === "awaiting_channel") {
        flash(`✓ Published (in_review) · awaiting authority email`);
      } else {
        flash(`✓ Published (in_review)${data.error ? ` · delivery: ${data.error}` : ""}`);
      }
      setScreen("queue");
      setSelected(null);
      await fetchReports();
    } catch {
      flash("Approve failed — network error");
    } finally {
      setBusy(false);
    }
  }

  async function reject(row: AdminReportRow, reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reports/reject", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, reason }),
      });
      const data = (await res.json()) as { error?: string };
      flash(res.ok ? "Report rejected" : data.error ?? "Reject failed");
      setScreen("queue");
      setSelected(null);
      await fetchReports();
    } catch {
      flash("Reject failed — network error");
    } finally {
      setBusy(false);
    }
  }

  async function updateReport(row: AdminReportRow, patch: { category?: string; description?: string | null }): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reports/update", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, ...patch }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        flash(data.error ?? "Update failed");
        return false;
      }
      flash("✓ Report updated");
      setSelected((cur) => (cur && cur.id === row.id ? { ...cur, ...patch } : cur));
      await fetchReports();
      return true;
    } catch {
      flash("Update failed — network error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setVisibility(row: AdminReportRow, hidden: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reports/visibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, hidden }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        flash(data.error ?? "Action failed");
        return;
      }
      flash(hidden ? "Report unpublished (hidden from public)" : "Report republished");
      setSelected((cur) => (cur && cur.id === row.id ? { ...cur, admin_hidden: hidden } : cur));
      await fetchReports();
    } catch {
      flash("Action failed — network error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReport(row: AdminReportRow) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reports/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        flash(data.error ?? "Delete failed");
        return;
      }
      flash("Report deleted permanently");
      setScreen("queue");
      setSelected(null);
      await fetchReports();
    } catch {
      flash("Delete failed — network error");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) return <SignIn onSignIn={() => setAuthed(true)} />;

  const pendingCount = reports.filter((r) => r.status === "submitted").length;
  const titles: Record<Screen, string> = {
    queue: "Reports Overview",
    detail: "Report Moderation Detail",
    authorities: "Authority Directory",
    delivery: "Delivery & Bounce Monitor",
    flags: "Flags & Disputes",
  };
  const nav: { key: Screen; icon: string; label: string; count?: number }[] = [
    { key: "queue", icon: "📋", label: "Reports", count: pendingCount },
    { key: "authorities", icon: "🏛", label: "Authority Directory" },
    { key: "delivery", icon: "📡", label: "Delivery & Bounce" },
    { key: "flags", icon: "⚐", label: "Flags & Disputes" },
  ];

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setAuthed(false);
    setScreen("queue");
  }

  return (
    <div lang="en" className="flex h-screen w-full bg-[#F4F8F9] font-sans text-[#0B2B30]">
      <aside className="flex w-[228px] flex-none flex-col bg-[#0B2B30] py-4 text-white">
        <div className="flex items-center gap-2.5 px-5 pb-4">
          <DrosiaMark className="h-7 w-auto text-[#1ECAD9]" />
          <span className="font-display text-[18px] font-black">Drosia</span>
        </div>
        {nav.map((n) => {
          const active = screen === n.key || (n.key === "queue" && screen === "detail");
          return (
            <button
              key={n.key}
              onClick={() => { setScreen(n.key); setSelected(null); }}
              className="mx-3 my-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left"
              style={{ background: active ? "#11363F" : "transparent" }}
            >
              <span className="w-5 text-center text-[16px]">{n.icon}</span>
              <span className="flex-1 text-[13px] font-bold" style={{ color: active ? "#fff" : "#9FC4C9" }}>
                {n.label}
              </span>
              {n.count != null && n.count > 0 && (
                <span className="tnum rounded-full bg-[#E74C3C] px-1.5 py-0.5 font-display text-[11px] font-extrabold text-white">
                  {n.count}
                </span>
              )}
            </button>
          );
        })}
        <div className="mt-auto flex items-center gap-2.5 border-t border-[#173B43] px-5 pt-3.5">
          <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#1ECAD9] font-display text-[13px] font-black text-[#0B2B30]">A</div>
          <div className="flex-1">
            <div className="text-[12px] font-bold">admin</div>
            <div className="text-[10px] text-[#6E8A90]">Operator</div>
          </div>
          <button onClick={logout} className="text-[14px] text-[#6E8A90]">⎋</button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[60px] flex-none items-center gap-4 border-b border-[#E3EDEE] bg-white px-6">
          <div className="font-display text-[18px] font-black">{titles[screen]}</div>
          <button onClick={fetchReports} className="ml-auto rounded-[9px] border border-[#E3EDEE] bg-[#F4F8F9] px-3 py-2 text-[12px] font-bold text-[#3F5F64]">
            ↻ Refresh
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {screen === "queue" && (
            <ReportsBoard
              reports={reports}
              loading={loading}
              onOpen={(r) => { setSelected(r); setScreen("detail"); }}
            />
          )}
          {screen === "detail" && selected && (
            <DetailView
              report={selected}
              busy={busy}
              onBack={() => { setScreen("queue"); setSelected(null); }}
              onApprove={() => approve(selected)}
              onReject={(reason) => reject(selected, reason)}
              onEdit={(patch) => updateReport(selected, patch)}
              onVisibility={(hidden) => setVisibility(selected, hidden)}
              onDelete={() => deleteReport(selected)}
            />
          )}
          {screen === "authorities" && <AuthoritiesView flash={flash} />}
          {screen === "delivery" && <DeliveryView flash={flash} />}
          {screen === "flags" && <FlagsView tab={flagTab} setTab={setFlagTab} flash={flash} />}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-[#0B2B30] px-5 py-3 text-[13px] font-bold text-white shadow-float">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- A1 Sign-in ---------- */
function SignIn({ onSignIn }: { onSignIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) onSignIn();
      else if (res.status === 429) setError("Too many attempts. Try later.");
      else setError("Incorrect password");
    } catch {
      setError("Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div lang="en" className="flex h-screen w-full items-center justify-center font-sans" style={{ background: "radial-gradient(120% 80% at 50% 0%,#E0F7FA,#F2FBFC)" }}>
      <div className="w-[360px] rounded-[20px] bg-white p-8 text-center shadow-float">
        <DrosiaMark className="mx-auto mb-2.5 h-14 w-auto text-primary" />
        <div className="font-display text-[24px] font-black text-[#0B2B30]">Drosia Admin</div>
        <div className="mb-5 text-[13px] text-[#9DB1B5]">Operator sign-in</div>
        <div className="mb-1.5 text-left text-[12px] font-bold text-[#5B7378]">Password</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mb-2 w-full rounded-[11px] border-[1.5px] border-[#E0EAEB] p-3 text-[15px] text-[#0B2B30] outline-none focus:border-primary"
        />
        {error && <div className="mb-2 text-[12px] font-bold text-[#C0392B]">{error}</div>}
        <button
          onClick={submit}
          disabled={busy}
          className="mt-1.5 w-full rounded-xl bg-primary py-3 font-display text-[15px] font-extrabold text-white shadow-btn disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="mt-4 text-[11px] text-[#9DB1B5]">Set ADMIN_PASSWORD in your env · HMAC cookie · no public sign-up.</div>
      </div>
    </div>
  );
}

/* ---------- Shared table primitives ---------- */
function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={`px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#9DB1B5] ${className}`}>{children}</div>;
}
function Pill({ status }: { status: string }) {
  const [bg, fg] = pill(status);
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: bg, color: fg }}>
      {status}
    </span>
  );
}

/* ---------- A2 Reports overview (start page) ---------- */
type StatusFilter = "all" | "submitted" | "in_review" | "notified" | "resolved" | "rejected";
type SortKey = "date" | "category" | "status" | "age";
type SortDir = "asc" | "desc";

const TIME_WINDOWS: { key: string; label: string; ms: number | null }[] = [
  { key: "all", label: "All time", ms: null },
  { key: "24h", label: "Last 24 hours", ms: 86_400_000 },
  { key: "7d", label: "Last 7 days", ms: 7 * 86_400_000 },
  { key: "30d", label: "Last 30 days", ms: 30 * 86_400_000 },
];

/** Lower-bound timestamp for a time-window key (null = no bound). Kept module-scope so the clock read stays out of render. */
function windowCutoff(windowKey: string): number | null {
  const ms = TIME_WINDOWS.find((w) => w.key === windowKey)?.ms ?? null;
  return ms == null ? null : Date.now() - ms;
}

const KPI_CARDS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "Total", color: "#0B2B30" },
  { key: "submitted", label: "Pending", color: "#B7820E" },
  { key: "in_review", label: "In review", color: "#00A6BC" },
  { key: "notified", label: "Notified", color: "#2D6BD8" },
  { key: "resolved", label: "Resolved", color: "#1B8B4A" },
  { key: "rejected", label: "Rejected", color: "#C0392B" },
];

function ReportsBoard({ reports, loading, onOpen }: { reports: AdminReportRow[]; loading: boolean; onOpen: (r: AdminReportRow) => void }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [windowKey, setWindowKey] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length, submitted: 0, in_review: 0, notified: 0, resolved: 0, rejected: 0 };
    for (const r of reports) if (r.status in c) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [reports]);

  const rows = useMemo(() => {
    const cutoff = windowCutoff(windowKey);
    const q = query.trim().toLowerCase();
    const filtered = reports.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (category !== "all" && r.category !== category) return false;
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      if (q) {
        const auth = (r.authority_name?.en ?? r.authority_name?.el ?? "").toLowerCase();
        const hay = `${r.public_token} ${r.description ?? ""} ${auth} ${catDisplay(r.category)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "age") cmp = reportAgeDays(a) - reportAgeDays(b);
      else if (sortKey === "category") cmp = catDisplay(a.category).localeCompare(catDisplay(b.category));
      else cmp = (statusMeta(a.status).order - statusMeta(b.status).order);
      return cmp * dir;
    });
  }, [reports, status, category, windowKey, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "category" || key === "status" ? "asc" : "desc");
    }
  }

  const hasFilters = status !== "all" || category !== "all" || windowKey !== "all" || query.trim() !== "";
  function clearFilters() {
    setStatus("all");
    setCategory("all");
    setWindowKey("all");
    setQuery("");
  }

  const cols = "52px 88px 1.4fr 1.4fr 116px 60px 86px";

  return (
    <div>
      {/* KPI summary — each card is a one-click status filter */}
      <div className="mb-4 grid grid-cols-6 gap-3">
        {KPI_CARDS.map((k) => {
          const active = status === k.key;
          return (
            <button
              key={k.key}
              onClick={() => setStatus(k.key)}
              className="rounded-xl border bg-white p-3.5 text-left transition-shadow hover:shadow-card"
              style={{ borderColor: active ? k.color : "#E3EDEE", boxShadow: active ? `inset 0 0 0 1px ${k.color}` : undefined }}
            >
              <div className="tnum font-display text-[24px] font-black" style={{ color: k.color }}>{counts[k.key] ?? 0}</div>
              <div className="text-[12px] text-[#5B7378]">{k.label}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar — search + faceted filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[#9DB1B5]">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search token, description, authority…"
            className="w-[280px] rounded-[9px] border border-[#E3EDEE] bg-white py-2 pl-8 pr-3 text-[13px] outline-none focus:border-primary"
          />
        </div>
        <FilterSelect value={category} onChange={setCategory} options={[
          { value: "all", label: "All types" },
          ...REPORT_CATEGORIES.map((c) => ({ value: c, label: catDisplay(c) })),
        ]} />
        <FilterSelect value={windowKey} onChange={setWindowKey} options={TIME_WINDOWS.map((w) => ({ value: w.key, label: w.label }))} />
        {hasFilters && (
          <button onClick={clearFilters} className="rounded-[9px] border border-[#E3EDEE] bg-white px-3 py-2 text-[12px] font-bold text-[#5B7378] hover:text-[#C0392B]">
            ✕ Clear filters
          </button>
        )}
        <span className="tnum ml-auto text-[12px] text-[#9DB1B5]">
          {rows.length} of {reports.length} report{reports.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <div className="text-[13px] text-[#9DB1B5]">Loading…</div>
      ) : !reports.length ? (
        <div className="rounded-xl border border-[#E3EDEE] bg-white p-8 text-center text-[13px] text-[#9DB1B5]">No reports yet.</div>
      ) : !rows.length ? (
        <div className="rounded-xl border border-[#E3EDEE] bg-white p-8 text-center text-[13px] text-[#9DB1B5]">No reports match the current filters.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E3EDEE] bg-white">
          <div className="grid border-b border-[#E3EDEE] bg-[#F7FBFC]" style={{ gridTemplateColumns: cols }}>
            <Th>Photo</Th>
            <Th>Token</Th>
            <SortHeader label="Type" col="category" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            <Th>Authority</Th>
            <SortHeader label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            <SortHeader label="Age" col="age" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            <SortHeader label="Date" col="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
          </div>
          {rows.map((r) => {
            const age = reportAgeDays(r);
            const ageColor = age >= 60 ? "#E74C3C" : age >= 7 ? "#E67E22" : "#1B8B4A";
            const authority = r.authority_name?.en ?? r.authority_name?.el;
            const pending = r.status === "submitted";
            return (
              <button
                key={r.id}
                onClick={() => onOpen(r)}
                className="grid w-full items-center border-b border-[#EEF4F4] text-left hover:bg-[#F4F8F9]"
                style={{ gridTemplateColumns: cols, background: pending ? "#FFFDF7" : "#fff" }}
              >
                <div className="px-3.5 py-2"><AdminPhoto src={r.photo_url} className="h-9 w-9 rounded-lg" /></div>
                <div className="truncate px-3.5 py-2.5 font-mono text-[11px] font-bold text-[#00A6BC]">{r.public_token.slice(0, 8)}</div>
                <div className="truncate px-3.5 py-2.5 text-[13px] font-bold">{catDisplay(r.category)}</div>
                <div className="truncate px-3.5 py-2.5 text-[12px]" style={{ color: authority ? "#0B2B30" : "#C0392B" }}>{authority ?? "⚠ unrouted"}</div>
                <div className="flex items-center gap-1 px-3.5 py-2.5">
                  <StatusBadge status={r.status} />
                  {r.admin_hidden && <span className="text-[10px] font-bold text-[#9DB1B5]" title="Hidden from public">· hidden</span>}
                </div>
                <div className="tnum px-3.5 py-2.5 font-display text-[13px] font-extrabold" style={{ color: ageColor }}>{age}d</div>
                <div className="tnum px-3.5 py-2.5 text-[11px] text-[#5B7378]">{shortDate(r.created_at)}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortHeader({ label, col, sortKey, sortDir, onSort }: { label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void }) {
  const active = sortKey === col;
  return (
    <button
      onClick={() => onSort(col)}
      className="flex items-center gap-1 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide hover:text-[#0B2B30]"
      style={{ color: active ? "#0B2B30" : "#9DB1B5" }}
    >
      {label}
      <span className="text-[8px]">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[9px] border border-[#E3EDEE] bg-white px-3 py-2 text-[13px] font-bold text-[#3F5F64] outline-none focus:border-primary"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ---------- A3 Detail (real data) ---------- */
function DetailView({
  report,
  busy,
  onBack,
  onApprove,
  onReject,
  onEdit,
  onVisibility,
  onDelete,
}: {
  report: AdminReportRow;
  busy: boolean;
  onBack: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onEdit: (patch: { category?: string; description?: string | null }) => Promise<boolean>;
  onVisibility: (hidden: boolean) => void;
  onDelete: () => void;
}) {
  const [reason, setReason] = useState("private_person");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const blurDone = report.photo_count > 0 && report.blur_done_count >= report.photo_count;
  const authority = report.authority_name?.en ?? report.authority_name?.el;
  const isPending = report.status === "submitted";
  // "Live" = currently on a public surface (published + not hidden). Only these
  // can be unpublished; hidden ones can be republished.
  const isPublished = ["in_review", "notified", "resolved"].includes(report.status);
  return (
    <div>
      <div className="mb-3.5 flex items-center gap-3">
        <button onClick={onBack} className="text-[13px] font-bold text-[#00A6BC]">‹ Back to reports</button>
        <StatusBadge status={report.status} />
        {report.admin_hidden && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F4F5] px-2.5 py-0.5 text-[11px] font-bold text-[#5B7378]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9DB1B5]" /> Hidden from public
          </span>
        )}
        <span className="tnum ml-auto text-[11px] text-[#9DB1B5]">
          Created {shortDate(report.created_at)}
          {report.notified_at ? ` · Notified ${shortDate(report.notified_at)}` : ""}
        </span>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
        <div className="rounded-xl border border-[#E3EDEE] bg-white p-4">
          <AdminPhoto
            src={report.photo_url}
            className="h-[300px] rounded-[10px]"
            badge={
              report.photo_url ? (
                <div className="absolute left-3 top-3 rounded-full bg-[#0B2B30]/80 px-2.5 py-1 text-[11px] font-bold text-white">🔒 Anonymized (public)</div>
              ) : (
                <div className="absolute left-3 top-3 rounded-full bg-[#0B2B30]/80 px-2.5 py-1 text-[11px] font-bold text-white">⏳ Awaiting anonymization</div>
              )
            }
          />
          {report.photo_count > 1 && (
            <div className="mt-2 text-[11px] text-[#9DB1B5]">+ {report.photo_count - 1} more photo{report.photo_count - 1 === 1 ? "" : "s"} on this report</div>
          )}
          <div className="mt-3 flex items-center gap-2.5">
            <span className="text-[11px] text-[#9DB1B5]">Original is service-role only (signed-URL view: next)</span>
            <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: blurDone ? "#EAFBF1" : "#FFF4DC", color: blurDone ? "#1B8B4A" : "#B7820E" }}>
              blur: {blurDone ? "done" : `${report.blur_done_count}/${report.photo_count}`}
            </span>
          </div>
          <div className="relative mt-3 h-[190px] overflow-hidden rounded-[10px] border border-[#E3EDEE]">
            <DrosiaMap
              points={[{ lat: report.lat, lng: report.lng, color: "#00A6BC", title: report.public_token }]}
              center={[report.lat, report.lng]}
              zoom={15}
              fitToMarkers={false}
              interactive={false}
              showAttribution={false}
              showZoomControl={false}
              className="absolute inset-0"
              ariaLabel="Report location map"
            />
            <span className="tnum absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#5B7378] shadow-card">
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Card>
            <div className="flex justify-between text-[12px] text-[#9DB1B5]">
              <span>{report.public_token}</span>
              <span className="tnum">{report.lat.toFixed(5)}, {report.lng.toFixed(5)}</span>
            </div>
            <div className="mt-2 font-display text-[15px] font-extrabold">{catDisplay(report.category)}</div>
            {report.description && <p className="mt-2 text-[13px] leading-relaxed text-[#3F5F64]">“{report.description}”</p>}
          </Card>
          <Card>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9DB1B5]">Auto-matched authority · ST_Contains</div>
            {authority ? (
              <div className="flex items-center gap-2.5">
                <div className="text-[20px]">🏛</div>
                <div className="flex-1">
                  <div className="font-display text-[14px] font-extrabold">{authority}</div>
                  <div className="text-[12px] text-[#5B7378]">
                    {report.authority_email ?? "⚠ no email — will hold as awaiting channel"} · {report.delivery_channel}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[13px] font-bold text-[#C0392B]">⚠ No authority matched — out of any coverage polygon.</div>
            )}
          </Card>
          {isPending && (
            <>
              <div className="flex gap-2.5">
                <button
                  onClick={onApprove}
                  disabled={busy || !blurDone}
                  title={blurDone ? "" : "Awaiting anonymization"}
                  className="flex-1 rounded-[11px] bg-success py-3 font-display text-[14px] font-extrabold text-white shadow-[0_6px_14px_rgba(46,204,113,0.3)] disabled:opacity-50"
                >
                  {busy ? "Working…" : "✓ Approve & send"}
                </button>
              </div>
              <Card>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9DB1B5]">Reject</div>
                <div className="flex gap-2.5">
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="flex-1 rounded-[9px] border border-[#E3EDEE] bg-white px-3 py-2 text-[13px]">
                    <option value="private_person">Shows private person/property</option>
                    <option value="spam_invalid">Spam / invalid</option>
                    <option value="out_of_scope">Out of scope</option>
                  </select>
                  <button
                    onClick={() => onReject(reason)}
                    disabled={busy}
                    className="rounded-[11px] border border-[#E74C3C] bg-white px-4 py-2 font-display text-[13px] font-extrabold text-[#C0392B] disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </Card>
            </>
          )}

          {/* Manage — available for EVERY status, including already-published reports. */}
          <Card>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-[#9DB1B5]">Manage report</div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setEditing(true)}
                disabled={busy}
                className="rounded-[10px] border border-[#E3EDEE] bg-white px-4 py-2 font-display text-[13px] font-extrabold text-[#0B2B30] hover:border-primary disabled:opacity-50"
              >
                ✎ Edit details
              </button>
              {isPublished && !report.admin_hidden && (
                <button
                  onClick={() => onVisibility(true)}
                  disabled={busy}
                  className="rounded-[10px] border border-[#E3EDEE] bg-white px-4 py-2 font-display text-[13px] font-extrabold text-[#B7820E] hover:border-[#E6A817] disabled:opacity-50"
                >
                  ⏸ Unpublish (hide)
                </button>
              )}
              {report.admin_hidden && (
                <button
                  onClick={() => onVisibility(false)}
                  disabled={busy}
                  className="rounded-[10px] border border-[#9FE0C0] bg-white px-4 py-2 font-display text-[13px] font-extrabold text-[#1B8B4A] hover:border-[#2ECC71] disabled:opacity-50"
                >
                  ▶ Republish
                </button>
              )}
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="ml-auto rounded-[10px] border border-[#E74C3C] bg-white px-4 py-2 font-display text-[13px] font-extrabold text-[#C0392B] hover:bg-[#FDECEA] disabled:opacity-50"
              >
                🗑 Delete
              </button>
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-[#9DB1B5]">
              {report.admin_hidden
                ? "Hidden from the public map, tracking page and scorecard. Republish to restore it."
                : isPublished
                  ? "Edit content, unpublish to pull it offline (reversible), or delete it permanently."
                  : report.status === "rejected"
                    ? "Rejected and not public. You can still edit or delete it permanently."
                    : "Edit content, or delete it permanently."}
            </p>
          </Card>
        </div>
      </div>

      {editing && (
        <ReportEditModal
          report={report}
          busy={busy}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            const ok = await onEdit(patch);
            if (ok) setEditing(false);
          }}
        />
      )}
      {confirmingDelete && (
        <DeleteConfirm
          token={report.public_token}
          busy={busy}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </div>
  );
}

/* ---------- Report edit + delete-confirm modals ---------- */
function ReportEditModal({
  report,
  busy,
  onClose,
  onSave,
}: {
  report: AdminReportRow;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: { category?: string; description?: string | null }) => void;
}) {
  const [category, setCategory] = useState(report.category);
  const [description, setDescription] = useState(report.description ?? "");
  const over = description.length > 500;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2B30]/40" onClick={onClose}>
      <div className="w-[520px] max-w-[92vw] overflow-hidden rounded-2xl bg-white shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-[#E3EDEE] px-5 py-4">
          <span className="text-[18px]">✎</span>
          <div className="font-display text-[16px] font-black">Edit report</div>
          <span className="ml-1 font-mono text-[12px] text-[#9DB1B5]">{report.public_token.slice(0, 8)}</span>
          <button onClick={onClose} className="ml-auto text-[18px] text-[#9DB1B5]">✕</button>
        </div>
        <div className="px-5 py-5">
          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] font-bold text-[#9DB1B5]">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-[9px] border border-[#E3EDEE] bg-white p-2.5 text-[13px] outline-none focus:border-primary"
            >
              {REPORT_CATEGORIES.map((c) => <option key={c} value={c}>{catDisplay(c)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-bold text-[#9DB1B5]">
              <span>Description</span>
              <span className="tnum" style={{ color: over ? "#C0392B" : "#9DB1B5" }}>{description.length}/500</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
              className="h-[110px] w-full rounded-[9px] border border-[#E3EDEE] p-2.5 text-[13px] outline-none focus:border-primary"
              style={{ borderColor: over ? "#E74C3C" : undefined }}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-[#E3EDEE] px-5 py-3.5">
          <button onClick={onClose} className="rounded-[10px] border border-[#E3EDEE] bg-white px-4 py-2.5 font-display text-[13px] font-extrabold text-[#5B7378]">Cancel</button>
          <button
            onClick={() => onSave({ category, description: description.trim() ? description.trim() : null })}
            disabled={busy || over}
            className="rounded-[10px] bg-primary px-5 py-2.5 font-display text-[13px] font-extrabold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({
  token,
  busy,
  onCancel,
  onConfirm,
}: {
  token: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2B30]/40" onClick={onCancel}>
      <div className="w-[440px] max-w-[92vw] overflow-hidden rounded-2xl bg-white shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5">
          <div className="font-display text-[16px] font-black text-[#C0392B]">Delete report permanently?</div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#5B7378]">
            Report <span className="font-mono font-bold text-[#0B2B30]">{token.slice(0, 8)}</span> and all of its
            photos, votes and delivery logs will be erased. This cannot be undone. To take it offline reversibly,
            use <span className="font-bold">Unpublish</span> instead.
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2.5 border-t border-[#E3EDEE] px-5 py-3.5">
          <button onClick={onCancel} className="rounded-[10px] border border-[#E3EDEE] bg-white px-4 py-2.5 font-display text-[13px] font-extrabold text-[#5B7378]">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-[10px] bg-[#E74C3C] px-5 py-2.5 font-display text-[13px] font-extrabold text-white disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-[#E3EDEE] bg-white p-4">{children}</div>;
}

function KPI({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-1 rounded-xl border border-[#E3EDEE] bg-white p-3.5">
      <div className="tnum font-display text-[26px] font-black" style={{ color }}>{value}</div>
      <div className="text-[12px] text-[#5B7378]">{label}</div>
    </div>
  );
}

/* ---------- A4 Authority Directory (real data) ---------- */
type AuthForm = {
  id?: string;
  name_en: string;
  name_el: string;
  email_official: string;
  delivery_channel: string;
  level: string;
  country_code: string;
  is_active: boolean;
  geom_wkt: string;
};
const emptyAuthForm: AuthForm = {
  name_en: "", name_el: "", email_official: "", delivery_channel: "email",
  level: "municipality", country_code: "GR", is_active: true, geom_wkt: "",
};

function AuthoritiesView({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<AdminAuthorityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);
  const [editing, setEditing] = useState<AuthForm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/authorities", { cache: "no-store" });
      const data = (await res.json()) as { authorities?: AdminAuthorityRow[] };
      setRows(data.authorities ?? []);
    } catch {
      flash("Failed to load authorities");
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(form: AuthForm) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/authorities", {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; warning?: string };
      if (!res.ok) flash(data.error ?? "Save failed");
      else flash(data.warning ? `Saved · ${data.warning}` : "Authority saved");
      setEditing(null);
      await load();
    } catch {
      flash("Save failed — network error");
    } finally {
      setBusy(false);
    }
  }

  const visible = missingOnly
    ? rows.filter((r) => !r.email_official).sort((a, b) => b.pending_count - a.pending_count)
    : rows;
  const cols = "1.6fr 1fr 70px 1.7fr 90px 80px 110px";

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <button onClick={() => setMissingOnly(false)} className="rounded-[9px] px-3 py-2 text-[12px] font-bold" style={{ background: missingOnly ? "#fff" : "#0B2B30", color: missingOnly ? "#5B7378" : "#fff", border: "1px solid #E3EDEE" }}>All authorities</button>
        <button onClick={() => setMissingOnly(true)} className="rounded-[9px] border px-3 py-2 text-[12px] font-bold" style={{ background: missingOnly ? "#FDECEA" : "#fff", borderColor: missingOnly ? "#F3B7AF" : "#E3EDEE", color: "#C0392B" }}>⚠ Missing email (by pending)</button>
        <button onClick={() => setEditing({ ...emptyAuthForm })} className="ml-auto rounded-[9px] bg-primary px-3.5 py-2 font-display text-[12px] font-extrabold text-white">+ New authority</button>
      </div>

      {loading ? (
        <div className="text-[13px] text-[#9DB1B5]">Loading…</div>
      ) : !visible.length ? (
        <div className="rounded-xl border border-[#E3EDEE] bg-white p-8 text-center text-[13px] text-[#9DB1B5]">No authorities.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E3EDEE] bg-white">
          <div className="grid border-b border-[#E3EDEE] bg-[#F7FBFC]" style={{ gridTemplateColumns: cols }}>
            <Th>Name</Th><Th>Level</Th><Th>Country</Th><Th>Email</Th><Th>Channel</Th><Th>Pending</Th><Th>Last status</Th>
          </div>
          {visible.map((a) => {
            const missing = !a.email_official;
            return (
              <button
                key={a.id}
                onClick={() => setEditing({
                  id: a.id, name_en: a.name_i18n?.en ?? "", name_el: a.name_i18n?.el ?? "",
                  email_official: a.email_official ?? "", delivery_channel: a.delivery_channel,
                  level: a.level, country_code: a.country_code, is_active: a.is_active, geom_wkt: "",
                })}
                className="grid w-full items-center border-b border-[#EEF4F4] text-left hover:bg-[#F4F8F9]"
                style={{ gridTemplateColumns: cols, background: missing || a.bounce_count > 0 ? "#FFFAF9" : "#fff" }}
              >
                <div className="px-3.5 py-2.5 text-[13px] font-bold">🏛 {authorityName(a.name_i18n)}{!a.has_geom && <span className="ml-1 text-[10px] font-bold text-[#C45D10]">· no polygon</span>}</div>
                <div className="px-3.5 py-2.5 text-[12px] text-[#5B7378]">{a.level}</div>
                <div className="px-3.5 py-2.5 text-[12px] text-[#5B7378]">{a.country_code}</div>
                <div className="px-3.5 py-2.5 text-[12px]" style={{ color: missing ? "#C0392B" : "#5B7378" }}>{a.email_official ?? "— missing —"}</div>
                <div className="px-3.5 py-2.5 text-[12px] text-[#5B7378]">{a.delivery_channel}</div>
                <div className="tnum px-3.5 py-2.5 font-display text-[13px] font-extrabold">{a.pending_count}</div>
                <div className="px-3.5 py-2.5">{a.last_delivery_status ? <Pill status={a.last_delivery_status} /> : <span className="text-[11px] text-[#9DB1B5]">—</span>}</div>
              </button>
            );
          })}
        </div>
      )}

      {editing && <AuthorityModal form={editing} busy={busy} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function AuthorityModal({ form, busy, onClose, onSave }: { form: AuthForm; busy: boolean; onClose: () => void; onSave: (f: AuthForm) => void }) {
  const [f, setF] = useState<AuthForm>(form);
  const set = (k: keyof AuthForm, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2B30]/40" onClick={onClose}>
      <div className="max-h-[90vh] w-[520px] overflow-auto rounded-2xl bg-white shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-[#E3EDEE] px-5 py-4">
          <span className="text-[18px]">🏛</span>
          <div className="font-display text-[16px] font-black">{f.id ? "Edit authority" : "New authority"}</div>
          <button onClick={onClose} className="ml-auto text-[18px] text-[#9DB1B5]">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 py-5">
          <FieldText label="Name (EN)" value={f.name_en} onChange={(v) => set("name_en", v)} />
          <FieldText label="Name (EL)" value={f.name_el} onChange={(v) => set("name_el", v)} />
          <FieldText label="Email" value={f.email_official} onChange={(v) => set("email_official", v)} />
          <FieldSelect label="Channel" value={f.delivery_channel} options={["email", "open311", "none"]} onChange={(v) => set("delivery_channel", v)} />
          <FieldText label="Level" value={f.level} onChange={(v) => set("level", v)} />
          <FieldText label="Country" value={f.country_code} onChange={(v) => set("country_code", v)} />
          <label className="col-span-2 flex items-center gap-2 text-[13px] font-bold text-[#3F5F64]">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Active
          </label>
          <label className="col-span-2">
            <span className="mb-1 block text-[11px] font-bold text-[#9DB1B5]">Coverage polygon WKT (optional, EWKT)</span>
            <textarea value={f.geom_wkt} onChange={(e) => set("geom_wkt", e.target.value)} placeholder="SRID=4326;MULTIPOLYGON(((...)))" className="h-[60px] w-full rounded-[9px] border border-[#E3EDEE] p-2 text-[12px] outline-none focus:border-primary" />
          </label>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-[#E3EDEE] px-5 py-3.5">
          <button onClick={onClose} className="rounded-[10px] border border-[#E3EDEE] bg-white px-4 py-2.5 font-display text-[13px] font-extrabold text-[#5B7378]">Cancel</button>
          <button onClick={() => onSave(f)} disabled={busy} className="rounded-[10px] bg-primary px-5 py-2.5 font-display text-[13px] font-extrabold text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
function FieldText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[#9DB1B5]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[9px] border border-[#E3EDEE] p-2 text-[13px] outline-none focus:border-primary" />
    </label>
  );
}
function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[#9DB1B5]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[9px] border border-[#E3EDEE] bg-white p-2 text-[13px]">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* ---------- A5 Delivery & Bounce Monitor (real data) ---------- */
function DeliveryView({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<AdminDeliveryRow[]>([]);
  const [health, setHealth] = useState<DeliveryHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/deliveries", { cache: "no-store" });
      const data = (await res.json()) as { deliveries?: AdminDeliveryRow[]; health?: DeliveryHealth };
      setRows(data.deliveries ?? []);
      setHealth(data.health ?? null);
    } catch {
      flash("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function resend(reportId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/deliveries/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
      const data = (await res.json()) as { delivery?: string; error?: string };
      flash(res.ok ? `Resent · ${data.delivery}` : data.error ?? "Resend failed");
      await load();
    } catch {
      flash("Resend failed — network error");
    } finally {
      setBusy(false);
    }
  }

  const cols = "90px 1.4fr 1.8fr 100px 1fr 90px";
  return (
    <div>
      {health && (
        health.domainVerified ? (
          <div className="mb-3.5 rounded-[11px] border border-[#9FE0C0] bg-[#EAFBF1] px-4 py-3 text-[13px] font-bold text-[#1B8B4A]">
            ✓ EMAIL_FROM domain {health.fromDomain ?? "—"} {health.verifiedDomain ? "matches the verified domain (SPF/DKIM/DMARC required)" : "(no EMAIL_VERIFIED_DOMAIN set — cannot verify)"}.
          </div>
        ) : (
          <div className="mb-3.5 rounded-[11px] border border-[#F3B7AF] bg-[#FDECEA] px-4 py-3 text-[13px] font-bold text-[#C0392B]">
            ⚠ EMAIL_FROM domain {health.fromDomain ?? "—"} ≠ verified {health.verifiedDomain}. Emails may bounce / land in spam.
          </div>
        )
      )}
      <div className="mb-3.5 flex gap-3">
        <KPI value={`${health?.deliveredPct ?? 0}%`} label="Delivered/sent (recent)" color="#2ECC71" />
        <KPI value={`${health?.bouncePct ?? 0}%`} label="Bounced/failed (recent)" color="#E74C3C" />
        <KPI value={`${health?.total ?? 0}`} label="Logged (recent)" color="#00A6BC" />
      </div>

      {loading ? (
        <div className="text-[13px] text-[#9DB1B5]">Loading…</div>
      ) : !rows.length ? (
        <div className="rounded-xl border border-[#E3EDEE] bg-white p-8 text-center text-[13px] text-[#9DB1B5]">No deliveries logged yet.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E3EDEE] bg-white">
          <div className="grid border-b border-[#E3EDEE] bg-[#F7FBFC]" style={{ gridTemplateColumns: cols }}>
            <Th>Report</Th><Th>Authority</Th><Th>Recipient</Th><Th>Status</Th><Th>Timestamp</Th><Th />
          </div>
          {rows.map((d) => {
            const hot = ["bounced", "failed", "complained"].includes(d.status);
            return (
              <div key={d.id} className="grid items-center border-b border-[#EEF4F4]" style={{ gridTemplateColumns: cols, background: hot ? "#FFFAF9" : "#fff" }}>
                <div className="px-3.5 py-2.5 text-[12px] font-bold text-[#00A6BC]">{d.report_token}</div>
                <div className="px-3.5 py-2.5 text-[12px]">{authorityName(d.authority_name)}</div>
                <div className="px-3.5 py-2.5 text-[12px] text-[#5B7378]">{d.recipient ?? "—"}</div>
                <div className="px-3.5 py-2.5"><Pill status={d.status} /></div>
                <div className="tnum px-3.5 py-2.5 text-[11px] text-[#9DB1B5]">{ago(d.created_at)}</div>
                <div className="px-3.5 py-2.5">
                  {hot && <button disabled={busy} onClick={() => resend(d.report_id)} className="text-[11px] font-bold text-[#00A6BC] disabled:opacity-50">Resend</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- A6 Flags & Disputes (real data) ---------- */
function FlagsView({ tab, setTab, flash }: { tab: "flags" | "disputes"; setTab: (t: "flags" | "disputes") => void; flash: (m: string) => void }) {
  const [flags, setFlags] = useState<AdminFlagRow[]>([]);
  const [disputes, setDisputes] = useState<AdminDisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, dRes] = await Promise.all([
        fetch("/api/admin/flags?status=open", { cache: "no-store" }),
        fetch("/api/admin/disputes", { cache: "no-store" }),
      ]);
      const fData = (await fRes.json()) as { flags?: AdminFlagRow[] };
      const dData = (await dRes.json()) as { disputes?: AdminDisputeRow[] };
      setFlags(fData.flags ?? []);
      setDisputes(dData.disputes ?? []);
    } catch {
      flash("Failed to load flags/disputes");
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function flagAction(id: string, action: "remove" | "dismiss") {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/flags/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      flash(res.ok ? (action === "remove" ? "Content removed (report rejected)" : "Flag dismissed") : "Action failed");
      await load();
    } catch {
      flash("Action failed — network error");
    } finally {
      setBusy(false);
    }
  }

  async function exclude(reportId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, excluded: true }),
      });
      flash(res.ok ? "Excluded from ranking" : "Action failed");
      await load();
    } catch {
      flash("Action failed — network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3.5 flex gap-2">
        <TabBtn active={tab === "flags"} onClick={() => setTab("flags")}>⚐ Flags · DSA {flags.length > 0 && <span className="tnum">({flags.length})</span>}</TabBtn>
        <TabBtn active={tab === "disputes"} onClick={() => setTab("disputes")}>⚖ Disputes {disputes.length > 0 && <span className="tnum">({disputes.length})</span>}</TabBtn>
      </div>
      {loading ? (
        <div className="text-[13px] text-[#9DB1B5]">Loading…</div>
      ) : tab === "flags" ? (
        !flags.length ? (
          <div className="rounded-xl border border-[#E3EDEE] bg-white p-8 text-center text-[13px] text-[#9DB1B5]">No open flags.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E3EDEE] bg-white">
            <div className="grid border-b border-[#E3EDEE] bg-[#F7FBFC]" style={{ gridTemplateColumns: "100px 1.6fr 1.4fr 90px 160px" }}>
              <Th>Report</Th><Th>Reason</Th><Th>Reporter</Th><Th>Status</Th><Th>Actions</Th>
            </div>
            {flags.map((f) => (
              <div key={f.id} className="grid items-center border-b border-[#EEF4F4] bg-white" style={{ gridTemplateColumns: "100px 1.6fr 1.4fr 90px 160px" }}>
                <div className="px-3.5 py-2.5 text-[12px] font-bold text-[#00A6BC]">{f.report_token}</div>
                <div className="px-3.5 py-2.5 text-[12px]">{f.reason}</div>
                <div className="px-3.5 py-2.5 text-[12px] text-[#5B7378]">{f.reporter_contact ?? "anon"}</div>
                <div className="px-3.5 py-2.5"><span className="rounded-full bg-[#FFF4DC] px-2 py-0.5 text-[10px] font-bold text-[#B7820E]">{f.status}</span></div>
                <div className="flex gap-3 px-3.5 py-2.5">
                  <button disabled={busy} onClick={() => flagAction(f.id, "remove")} className="text-[11px] font-bold text-[#C0392B] disabled:opacity-50">Remove</button>
                  <button disabled={busy} onClick={() => flagAction(f.id, "dismiss")} className="text-[11px] font-bold text-[#9DB1B5] disabled:opacity-50">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : !disputes.length ? (
        <div className="rounded-xl border border-[#E3EDEE] bg-white p-8 text-center text-[13px] text-[#9DB1B5]">No disputes.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E3EDEE] bg-white">
          <div className="grid border-b border-[#E3EDEE] bg-[#F7FBFC]" style={{ gridTemplateColumns: "100px 1.4fr 1fr 1.4fr 180px" }}>
            <Th>Report</Th><Th>Authority</Th><Th>Type</Th><Th>Note</Th><Th>Actions</Th>
          </div>
          {disputes.map((d) => (
            <div key={d.id} className="grid items-center border-b border-[#EEF4F4] bg-white" style={{ gridTemplateColumns: "100px 1.4fr 1fr 1.4fr 180px" }}>
              <div className="px-3.5 py-2.5 text-[12px] font-bold text-[#00A6BC]">{d.report_token}</div>
              <div className="px-3.5 py-2.5 text-[12px]">{authorityName(d.authority_name)}</div>
              <div className="px-3.5 py-2.5"><span className="rounded-full bg-[#FFF1E6] px-2 py-0.5 text-[10px] font-bold text-[#C45D10]">{d.response_type}</span></div>
              <div className="px-3.5 py-2.5 text-[12px] text-[#5B7378]">{d.note ?? "—"}</div>
              <div className="flex gap-3 px-3.5 py-2.5">
                {d.excluded ? (
                  <span className="text-[11px] font-bold text-[#9DB1B5]">excluded ✓</span>
                ) : (
                  <button disabled={busy} onClick={() => exclude(d.report_id)} className="text-[11px] font-bold text-[#C0392B] disabled:opacity-50">Exclude from ranking</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-[9px] px-4 py-2.5 text-[13px] font-bold" style={{ background: active ? "#0B2B30" : "#fff", color: active ? "#fff" : "#5B7378" }}>
      {children}
    </button>
  );
}
