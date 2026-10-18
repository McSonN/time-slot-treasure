import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/session";
import { weekKey } from "@/lib/week";
import {
  bookingEditSchema, bookingPermissions, changeRequestSchema, localDateTime, rejectSchema, toIso, venueEquipment,
} from "@/lib/booking-request";
import {
  approveBooking, cancelBooking, deleteBooking, rejectBooking, requestBookingChange, updateBooking,
} from "@/lib/booking-request.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/wniosek/$id")({
  head: () => ({
    meta: [
      { title: "Szczegóły wniosku" },
      { name: "description", content: "Szczegóły, status i historia wniosku o rezerwację obiektu." },
      { property: "og:title", content: "Szczegóły wniosku" },
      { property: "og:description", content: "Szczegóły, status i historia wniosku o rezerwację obiektu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detail,
});

export const STATUS: Record<string, string> = {
  pending: "Oczekuje", approved: "Zaakceptowany", rejected: "Odrzucony", cancelled: "Anulowany",
};
const ACTION: Record<string, string> = {
  created: "Złożono wniosek", edited: "Edytowano wniosek", approved: "Zaakceptowano", rejected: "Odrzucono",
  cancelled: "Anulowano", change_requested: "Prośba o zmiany", status_changed: "Zmiana statusu", deleted: "Usunięto",
};
const FIELD: Record<string, string> = {
  start_at: "Początek", end_at: "Koniec", event_name: "Nazwa", participants: "Uczestnicy", description: "Cel",
  contact_name: "Osoba kontaktowa", contact_email: "E-mail", equipment: "Wyposażenie", rejection_reason: "Uzasadnienie",
  change_request: "Prośba o zmiany", organization: "Organizacja", venue_id: "Obiekt",
};
const fmt = (d: string) => format(new Date(d), "d MMM yyyy, HH:mm", { locale: pl });
const show = (v: unknown) => (v == null || v === "" ? "—" : Array.isArray(v) ? v.join(", ") || "—" : typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? fmt(v) : String(v));

function Detail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const isAdmin = useIsAdmin(user?.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fns = {
    update: useServerFn(updateBooking), cancel: useServerFn(cancelBooking), change: useServerFn(requestBookingChange),
    approve: useServerFn(approveBooking), reject: useServerFn(rejectBooking), remove: useServerFn(deleteBooking),
  };
  const [mode, setMode] = useState<"" | "edit" | "reject" | "change">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*, venues(name, capacity)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["booking-history", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("booking_history").select("*").eq("booking_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (q.isLoading) return <p className="p-10 text-muted-foreground">Wczytywanie…</p>;
  const b = q.data;
  if (!b) return <p className="p-10">Nie znaleziono wniosku lub brak dostępu.</p>;
  const start = new Date(b.start_at);
  const end = new Date(b.end_at);
  const isOwner = b.user_id === user?.id;
  const can = bookingPermissions(b.status, isOwner, isAdmin);

  async function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setMode(""); setText("");
      await qc.invalidateQueries();
      after?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Wystąpił błąd."); }
    finally { setBusy(false); }
  }
  function reject() {
    const p = rejectSchema.safeParse({ id, reason: text });
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    run(() => fns.reject({ data: p.data }), "Wniosek odrzucony.");
  }
  function change() {
    const p = changeRequestSchema.safeParse({ id, message: text });
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    run(() => fns.change({ data: p.data }), "Prośba o zmiany wysłana do administratora.");
  }

  const visibleHistory = history.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" search={{ venue: b.venue_id, week: weekKey(start) }} className="text-sm text-muted-foreground hover:underline">
        ← Wróć do kalendarza
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">{b.kind === "event" ? "Wydarzenie" : "Wniosek"}</p>
          <h1 className="text-4xl font-semibold">{b.event_name}</h1>
          <p className="mt-1 text-muted-foreground">
            {b.organization}
            {isAdmin && (
              <> · <Link to="/ngo" search={{ org: b.organization }} className="text-accent underline-offset-4 hover:underline">Profil NGO</Link></>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Złożono: {fmt(b.created_at)}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">{STATUS[b.status] ?? b.status}</span>
      </div>

      {b.status === "rejected" && b.rejection_reason && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Uzasadnienie odrzucenia</p>
          <p className="mt-1 whitespace-pre-wrap">{b.rejection_reason}</p>
        </div>
      )}
      {b.change_request && b.status === "approved" && (
        <div className="mt-6 rounded-lg border bg-secondary/50 p-4 text-sm">
          <p className="font-medium">Prośba o zmiany ({b.change_requested_at ? fmt(b.change_requested_at) : ""})</p>
          <p className="mt-1 whitespace-pre-wrap">{b.change_request}</p>
        </div>
      )}

      {mode === "edit" ? (
        <EditForm b={b} busy={busy} onCancel={() => setMode("")} onSave={(data) =>
          run(() => fns.update({ data }), "Zapisano zmiany.")} />
      ) : (
        <dl className="mt-8 grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-2">
          <Item k="Obiekt" v={b.venues?.name} />
          <Item k="Termin" v={`${format(start, "EEEE d MMM yyyy", { locale: pl })}, ${format(start, "HH:mm")}–${format(end, "HH:mm")}`} />
          <Item k="Uczestnicy" v={String(b.participants)} />
          <Item k="Adres organizacji" v={b.organization_address || "—"} />
          <Item k="Osoba kierująca NGO" v={b.organization_leader || "—"} />
          <Item k="Kontakt" v={[b.contact_name, b.contact_email].filter(Boolean).join(" · ") || "—"} />
          <div className="whitespace-pre-wrap sm:col-span-2"><Item k="Cel spotkania" v={b.description || "—"} /></div>
          <div className="sm:col-span-2"><Item k="Wyposażenie" v={b.equipment.join(", ") || "Nie wybrano"} /></div>
          <Item k="Regulamin (zgoda przykładowa)" v={b.regulations_accepted ? "Zaznaczono" : "Nie zaznaczono"} />
          <Item k="RODO (potwierdzenie przykładowe)" v={b.privacy_accepted ? "Zaznaczono" : "Nie zaznaczono"} />
        </dl>
      )}

      {(mode === "reject" || mode === "change") && (
        <div className="mt-6 space-y-3 rounded-lg border bg-card p-4">
          <label className="text-sm font-medium" htmlFor="reason">
            {mode === "reject" ? "Uzasadnienie odrzucenia" : "Jakie zmiany chcesz wprowadzić?"}
          </label>
          <Textarea id="reason" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <Button disabled={busy} variant={mode === "reject" ? "destructive" : "default"} onClick={mode === "reject" ? reject : change}>
              {mode === "reject" ? "Odrzuć wniosek" : "Wyślij prośbę"}
            </Button>
            <Button variant="ghost" onClick={() => { setMode(""); setText(""); }}>Anuluj</Button>
          </div>
        </div>
      )}

      {mode === "" && (
        <div className="mt-6 flex flex-wrap gap-3">
          {can.approve && <Button disabled={busy} onClick={() => run(() => fns.approve({ data: { id } }), "Zaakceptowano wniosek.")}>Zaakceptuj</Button>}
          {can.reject && <Button variant="outline" onClick={() => setMode("reject")}>Odrzuć</Button>}
          {can.edit && <Button variant="outline" onClick={() => setMode("edit")}>Edytuj</Button>}
          {can.requestChange && <Button variant="outline" onClick={() => setMode("change")}>Poproś o zmiany</Button>}
          {can.cancel && (
            <Button variant="outline" disabled={busy} onClick={() => confirm("Anulować ten wniosek?") && run(() => fns.cancel({ data: { id } }), "Wniosek anulowany.")}>
              Anuluj wniosek
            </Button>
          )}
          {can.remove && (
            <Button variant="destructive" disabled={busy} onClick={() => confirm("Na pewno usunąć ten wniosek?") &&
              run(() => fns.remove({ data: { id } }), "Wniosek usunięty.", () => navigate({ to: "/" }))}>
              Usuń
            </Button>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Historia zmian</h2>
        <ol className="mt-4 space-y-3 border-l pl-5">
          {visibleHistory.map((h) => {
            const changes = Object.entries((h.changes ?? {}) as Record<string, { from: unknown; to: unknown }>);
            return (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full bg-accent" />
                <p className="text-sm font-medium">
                  {ACTION[h.action] ?? h.action}
                  {h.to_status && h.action !== "edited" && h.action !== "change_requested" && <span className="text-muted-foreground"> → {STATUS[h.to_status] ?? h.to_status}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmt(h.created_at)}
                  {isAdmin && <> · {h.actor_email ?? "system"} ({h.actor_is_admin ? "administrator" : h.actor_id === b.user_id ? "wnioskodawca" : "użytkownik"})</>}
                </p>
                {h.note && <p className="mt-1 whitespace-pre-wrap text-sm">{h.note}</p>}
                {changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {changes.map(([k, c]) => (
                      <li key={k}><span className="font-medium">{FIELD[k] ?? k}:</span> {show(c.from)} → {show(c.to)}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {visibleHistory.length === 0 && <li className="text-sm text-muted-foreground">Brak wpisów.</li>}
        </ol>
      </section>
    </div>
  );
}

type B = { id: string; start_at: string; end_at: string; event_name: string; participants: number; description: string | null;
  contact_name: string | null; contact_email: string | null; equipment: string[]; venues: { name: string; capacity: number } | null };

function EditForm({ b, busy, onSave, onCancel }: { b: B; busy: boolean; onSave: (d: any) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    start: localDateTime(b.start_at), end: localDateTime(b.end_at), event_name: b.event_name, participants: b.participants,
    description: b.description ?? "", contact_name: b.contact_name ?? "", contact_email: b.contact_email ?? "", equipment: b.equipment,
  });
  const [err, setErr] = useState("");
  const options = venueEquipment(b.venues?.name ?? "");
  function save() {
    const p = bookingEditSchema.safeParse({
      id: b.id, start_at: toIso(f.start), end_at: toIso(f.end), event_name: f.event_name, participants: f.participants,
      description: f.description, contact_name: f.contact_name, contact_email: f.contact_email, equipment: f.equipment,
    });
    if (!p.success) { setErr(p.error.issues[0]?.message ?? "Sprawdź dane."); return; }
    setErr(""); onSave(p.data);
  }
  return (
    <div className="mt-8 grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-2">
      <L t="Początek"><Input type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></L>
      <L t="Koniec"><Input type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></L>
      <L t="Nazwa spotkania"><Input value={f.event_name} maxLength={200} onChange={(e) => setF({ ...f, event_name: e.target.value })} /></L>
      <L t={`Uczestnicy (max ${b.venues?.capacity ?? "?"})`}><Input type="number" min={1} value={f.participants} onChange={(e) => setF({ ...f, participants: Number(e.target.value) })} /></L>
      <L t="Osoba kontaktowa"><Input value={f.contact_name} maxLength={150} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></L>
      <L t="E-mail kontaktowy"><Input type="email" value={f.contact_email} maxLength={255} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></L>
      <div className="sm:col-span-2"><L t="Cel spotkania"><Textarea rows={4} maxLength={5000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></L></div>
      <div className="sm:col-span-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Wyposażenie</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.equipment.includes(o)}
                onChange={(e) => setF({ ...f, equipment: e.target.checked ? [...f.equipment, o] : f.equipment.filter((x) => x !== o) })} />
              {o}
            </label>
          ))}
        </div>
      </div>
      {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button disabled={busy} onClick={save}>Zapisz zmiany</Button>
        <Button variant="ghost" onClick={onCancel}>Anuluj</Button>
      </div>
    </div>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs uppercase tracking-wide text-muted-foreground">{t}</span>{children}</label>;
}

function Item({ k, v }: { k: string; v?: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-1">{v}</dd>
    </div>
  );
}
