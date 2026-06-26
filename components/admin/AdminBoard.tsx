"use client";

import { useCallback, useEffect, useState } from "react";
import { DrosiaMark } from "@/components/brand/Logo";
import { CATEGORY_META, isReportCategory } from "@/lib/categories";
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

function catDisplay(cat: string): string {
  if (isReportCategory(cat)) return `${CATEGORY_META[cat].emoji} ${CATEGORY_META[cat].label.en}`;
  return cat;
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

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports?status=submitted", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = (await res.json()) as { reports?: AdminReportRow[] };
      setReports(data.reports ?? []);
    } catch {
      flash("Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    // Load the queue from the server on sign-in (external-system sync, not derived state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (authed) void fetchQueue();
  }, [authed, fetchQueue]);

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
      await fetchQueue();
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
      await fetchQueue();
    } catch {
      flash("Reject failed — network error");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) return <SignIn onSignIn={() => setAuthed(true)} />;

  const titles: Record<Screen, string> = {
    queue: "Moderation Queue",
    detail: "Report Moderation Detail",
    authorities: "Authority Directory",
    delivery: "Delivery & Bounce Monitor",
    flags: "Flags & Disputes",
  };
  const nav: { key: Screen; icon: string; label: string; count?: number }[] = [
    { key: "queue", icon: "📥", label: "Moderation Queue", count: reports.length },
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
          <button onClick={fetchQueue} className="ml-auto rounded-[9px] border border-[#E3EDEE] bg-[#F4F8F9] px-3 py-2 text-[12px] font-bold text-[#3F5F64]">
            ↻ Refresh
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {screen === "queue" && (
            <QueueView
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

/* ---------- A2 Queue (real data) ---------- */
function QueueView({ reports, loading, onOpen }: { reports: AdminReportRow[]; loading: boolean; onOpen: (r: AdminReportRow) => void }) {
  const cols = "70px 1.4fr 1.6fr 1.4fr 80px 110px";
  if (loading) return <div className="text-[13px] text-[#9DB1B5]">Loading…</div>;
  if (!reports.length) return <div className="rounded-xl border border-[#E3EDEE] bg-white p-8 text-center text-[13px] text-[#9DB1B5]">No reports awaiting moderation.</div>;
  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <span className="rounded-[9px] bg-[#0B2B30] px-3 py-2 text-[12px] font-bold text-white">Status: submitted</span>
        <span className="tnum ml-auto text-[12px] text-[#9DB1B5]">{reports.length} awaiting moderation</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E3EDEE] bg-white">
        <div className="grid border-b border-[#E3EDEE] bg-[#F7FBFC]" style={{ gridTemplateColumns: cols }}>
          <Th>Photo</Th><Th>Category</Th><Th>Auto authority</Th><Th>Location</Th><Th>Age</Th><Th>Blur</Th>
        </div>
        {reports.map((r) => {
          const age = reportAgeDays(r);
          const ageColor = age >= 60 ? "#E74C3C" : age >= 7 ? "#E67E22" : "#1B8B4A";
          const blurDone = r.photo_count > 0 && r.blur_done_count >= r.photo_count;
          const authority = r.authority_name?.en ?? r.authority_name?.el;
          return (
            <button key={r.id} onClick={() => onOpen(r)} className="grid w-full items-center border-b border-[#EEF4F4] text-left hover:bg-[#F4F8F9]" style={{ gridTemplateColumns: cols }}>
              <div className="px-3.5 py-2"><div className="photo-placeholder h-10 w-10 rounded-lg" /></div>
              <div className="px-3.5 py-2.5 text-[13px] font-bold">{catDisplay(r.category)}</div>
              <div className="px-3.5 py-2.5 text-[13px]" style={{ color: authority ? "#0B2B30" : "#C0392B" }}>{authority ?? "⚠ unrouted"}</div>
              <div className="tnum px-3.5 py-2.5 text-[12px] text-[#5B7378]">{r.lat.toFixed(3)}, {r.lng.toFixed(3)}</div>
              <div className="tnum px-3.5 py-2.5 font-display text-[13px] font-extrabold" style={{ color: ageColor }}>{age}d</div>
              <div className="px-3.5 py-2.5">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: blurDone ? "#EAFBF1" : "#FFF4DC", color: blurDone ? "#1B8B4A" : "#B7820E" }}>
                  {blurDone ? "done" : `${r.blur_done_count}/${r.photo_count}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- A3 Detail (real data) ---------- */
function DetailView({
  report,
  busy,
  onBack,
  onApprove,
  onReject,
}: {
  report: AdminReportRow;
  busy: boolean;
  onBack: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("private_person");
  const blurDone = report.photo_count > 0 && report.blur_done_count >= report.photo_count;
  const authority = report.authority_name?.en ?? report.authority_name?.el;
  return (
    <div>
      <button onClick={onBack} className="mb-3.5 text-[13px] font-bold text-[#00A6BC]">‹ Back to queue</button>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
        <div className="rounded-xl border border-[#E3EDEE] bg-white p-4">
          <div className="photo-placeholder relative h-[300px] rounded-[10px]">
            <div className="absolute left-3 top-3 rounded-full bg-[#0B2B30]/80 px-2.5 py-1 text-[11px] font-bold text-white">🔒 Anonymized (public)</div>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="text-[11px] text-[#9DB1B5]">Original is service-role only (signed-URL view: next)</span>
            <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: blurDone ? "#EAFBF1" : "#FFF4DC", color: blurDone ? "#1B8B4A" : "#B7820E" }}>
              blur: {blurDone ? "done" : `${report.blur_done_count}/${report.photo_count}`}
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
