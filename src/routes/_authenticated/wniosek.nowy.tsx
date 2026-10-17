import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, CalendarDays, ClipboardList, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/session";
import { overlaps } from "@/lib/week";
import { bookingRequestSchema, localDateTime, NGO_PLACEHOLDER, purposeTemplateSchema, toIso, venueEquipment } from "@/lib/booking-request";
import { listPurposeTemplates, savePurposeTemplate, submitBookingRequest } from "@/lib/booking-request.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type S = { start: string; end: string; venue?: string; n?: number };
export const Route = createFileRoute("/_authenticated/wniosek/nowy")({
  validateSearch: (s: Record<string, unknown>): S => ({
    start: typeof s["start"] === "string" ? s["start"] : "",
    end: typeof s["end"] === "string" ? s["end"] : "",
    venue: typeof s["venue"] === "string" ? s["venue"] : undefined,
    n: Number.isInteger(Number(s["n"])) && Number(s["n"]) > 0 ? Number(s["n"]) : undefined,
  }),
  head: () => ({ meta: [
    { title: "Złóż wniosek — Rezerwacje sal" },
    { name: "description", content: "Wniosek NGO o rezerwację sali: termin, cel spotkania, uczestnicy i wyposażenie." },
    { property: "og:title", content: "Złóż wniosek — Rezerwacje sal" },
    { property: "og:description", content: "Wniosek NGO o rezerwację sali: termin, cel spotkania, uczestnicy i wyposażenie." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: NewRequest,
});

function NewRequest() {
  const s = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const isAdmin = useIsAdmin(user?.id);
  const submitRequest = useServerFn(submitBookingRequest);
  const saveTemplate = useServerFn(savePurposeTemplate);
  const loadTemplates = useServerFn(listPurposeTemplates);
  const [startInput, setStartInput] = useState(() => localDateTime(s.start));
  const [endInput, setEndInput] = useState(() => localDateTime(s.end));
  const start = toIso(startInput);
  const end = toIso(endInput);
  const validDates = !!start && !!end && new Date(end) > new Date(start);
  const [venueId, setVenueId] = useState(s.venue ?? "");
  const [form, setForm] = useState({
    ...NGO_PLACEHOLDER, event_name: "", contact_name: "", contact_email: "",
    participants: s.n ?? 1, description: "", kind: "request" as "request" | "event",
    equipment: [] as string[], regulations_accepted: false, privacy_accepted: false,
  });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const venues = useQuery({
    queryKey: ["request-venues", start, end],
    queryFn: async () => {
      const { data: v, error: venueError } = await supabase.from("venues").select("id,name,capacity").order("capacity");
      if (venueError) throw venueError;
      if (!validDates) return (v ?? []).map((x) => ({ ...x, free: false }));
      const { data: slots, error: slotsError } = await supabase.rpc("get_busy_slots", { _from: start, _to: end });
      if (slotsError) throw slotsError;
      const taken = new Set((slots ?? []).filter((b) => overlaps(new Date(start), new Date(end), new Date(b.start_at), new Date(b.end_at))).map((b) => b.venue_id));
      return (v ?? []).map((x) => ({ ...x, free: !taken.has(x.id) }));
    },
  });
  const templates = useQuery({ queryKey: ["purpose-templates", user?.id], enabled: !!user, queryFn: () => loadTemplates() });
  const options = (venues.data ?? []).filter((v) => v.free && v.capacity >= form.participants);
  const chosen = venueId || options[0]?.id;
  const selected = venues.data?.find((v) => v.id === chosen);
  const available = !!selected?.free && selected.capacity >= form.participants && validDates;
  const equipment = selected ? venueEquipment(selected.name) : [];
  const selectedEquipment = form.equipment.filter((item) => equipment.includes(item));
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: key === "participants" ? Number(e.target.value) : e.target.value }));
  };

  async function savePurpose() {
    const parsed = purposeTemplateSchema.safeParse({ name: templateName, purpose: form.description });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Sprawdź szablon."); return; }
    setSaving(true);
    try {
      const saved = await saveTemplate({ data: parsed.data });
      await qc.invalidateQueries({ queryKey: ["purpose-templates", user?.id] });
      setTemplateId(saved.id);
      setTemplateName("");
      toast.success("Zapisano cel spotkania jako szablon.");
    } catch { toast.error("Nie udało się zapisać szablonu. Spróbuj ponownie."); }
    finally { setSaving(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = bookingRequestSchema.safeParse({ ...form, contact_email: form.contact_email || user?.email || "", equipment: selectedEquipment, venue_id: chosen, start_at: start, end_at: end });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Sprawdź dane wniosku."); return; }
    if (!available || venues.isFetching) { setError("Wybierz dostępny obiekt dla tego terminu i liczby uczestników."); return; }
    setBusy(true);
    try {
      const result = await submitRequest({ data: parsed.data });
      await qc.invalidateQueries({ queryKey: ["busy"] });
      await qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast.success("Wniosek został złożony.");
      await navigate({ to: "/wniosek/$id", params: { id: result.id } });
    } catch (err) { setError(err instanceof Error ? err.message : "Nie udało się złożyć wniosku."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Button asChild variant="link" className="h-auto p-0 text-muted-foreground"><Link to="/">← Wróć do kalendarza</Link></Button>
      <div className="mt-6 border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Rezerwacja przestrzeni</p>
        <h1 className="mt-2 text-4xl font-semibold">Złóż wniosek</h1>
      </div>
      <form onSubmit={submit} className="divide-y">
        <Section icon={Building2} title="Dane organizacji" note="Dane przykładowe — profil NGO">
          <Field label="Nazwa organizacji" id="org"><Input id="org" required maxLength={200} value={form.organization} onChange={set("organization")} /></Field>
          <Field label="Adres organizacji" id="address"><Input id="address" required maxLength={500} value={form.organization_address} onChange={set("organization_address")} /></Field>
          <Field label="Imię i nazwisko osoby kierującej NGO" id="leader"><Input id="leader" required maxLength={150} value={form.organization_leader} onChange={set("organization_leader")} /></Field>
        </Section>
        <Section icon={CalendarDays} title="Termin i obiekt">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Początek spotkania" id="start"><Input id="start" type="datetime-local" required value={startInput} onChange={(e) => setStartInput(e.target.value)} /></Field>
            <Field label="Koniec spotkania" id="end"><Input id="end" type="datetime-local" required value={endInput} onChange={(e) => setEndInput(e.target.value)} /></Field>
          </div>
          {!validDates && <p role="alert" className="text-sm text-destructive">Wybierz poprawny początek i koniec spotkania.</p>}
          <Field label="Szacowana liczba uczestników" id="participants"><div className="relative"><Users className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="participants" type="number" min={1} max={100000} required className="pl-10" value={form.participants} onChange={set("participants")} /></div></Field>
          <div className="grid gap-2">
            <Label htmlFor="venue">Obiekt</Label>
            <Select value={chosen ?? ""} onValueChange={(id) => { setVenueId(id); setForm((v) => ({ ...v, equipment: [] })); }}>
              <SelectTrigger id="venue"><SelectValue placeholder="Wybierz obiekt" /></SelectTrigger>
              <SelectContent>{(venues.data ?? []).map((v) => <SelectItem key={v.id} value={v.id} disabled={!v.free || v.capacity < form.participants}>{v.name} · {v.capacity} miejsc{!v.free ? " · zajęty" : v.capacity < form.participants ? " · za mały" : ""}</SelectItem>)}</SelectContent>
            </Select>
            {venues.isFetching ? <p className="text-sm text-muted-foreground">Sprawdzanie dostępności…</p> : venues.isError ? <p role="alert" className="text-sm text-destructive">Nie udało się sprawdzić dostępności. Spróbuj ponownie.</p> : !available && <p role="alert" className="text-sm text-destructive">Obiekt jest niedostępny w wybranym terminie lub ma za mało miejsc.</p>}
          </div>
        </Section>
        <Section icon={ClipboardList} title="Spotkanie">
          {isAdmin && <div className="grid gap-2"><Label htmlFor="kind">Typ wpisu</Label><Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v === "event" ? "event" : "request" }))}><SelectTrigger id="kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="request">Wniosek</SelectItem><SelectItem value="event">Wydarzenie (zatwierdzone)</SelectItem></SelectContent></Select></div>}
          <Field label="Nazwa spotkania" id="event"><Input id="event" required maxLength={200} value={form.event_name} onChange={set("event_name")} /></Field>
          <div className="grid gap-2">
            <Label htmlFor="template">Zapisane cele spotkań</Label>
            <Select value={templateId} onValueChange={(id) => { const template = templates.data?.find((t) => t.id === id); if (template) { setForm((f) => ({ ...f, description: template.purpose })); setTemplateId(id); } }} disabled={!templates.data?.length}>
              <SelectTrigger id="template"><SelectValue placeholder={templates.isLoading ? "Wczytywanie…" : "Wybierz szablon"} /></SelectTrigger>
              <SelectContent>{templates.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            {templates.isError && <p role="alert" className="text-sm text-destructive">Nie udało się wczytać zapisanych celów.</p>}
          </div>
          <Field label="Cel spotkania" id="purpose"><Textarea id="purpose" rows={5} required maxLength={5000} value={form.description} onChange={set("description")} placeholder="Cel i planowany przebieg spotkania" /></Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Nazwa nowego szablonu" id="template-name"><Input id="template-name" maxLength={100} value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="np. Spotkanie zespołu" /></Field>
            <Button type="button" variant="outline" onClick={savePurpose} disabled={saving || !user || !form.description.trim() || !templateName.trim()}><Save className="size-4" />{saving ? "Zapisywanie…" : "Zapisz cel"}</Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Osoba kontaktowa" id="contact"><Input id="contact" maxLength={150} value={form.contact_name} onChange={set("contact_name")} /></Field>
            <Field label="E-mail kontaktowy" id="email"><Input id="email" type="email" required maxLength={255} value={form.contact_email || user?.email || ""} onChange={set("contact_email")} /></Field>
          </div>
        </Section>
        <section className="py-7">
          <h2 className="text-2xl font-semibold">Wyposażenie</h2>
          <p className="mt-1 text-sm text-muted-foreground">Przykładowe wyposażenie{selected ? ` · ${selected.name}` : ""}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">{equipment.map((item) => <label key={item} className="flex cursor-pointer items-center gap-3"><Checkbox checked={selectedEquipment.includes(item)} onCheckedChange={(checked) => setForm((f) => ({ ...f, equipment: checked === true ? [...new Set([...selectedEquipment, item])] : selectedEquipment.filter((x) => x !== item) }))} /><span className="text-sm">{item}</span></label>)}</div>
        </section>
        <section className="grid gap-4 py-7">
          <div><h2 className="text-2xl font-semibold">Regulamin i RODO</h2><p className="mt-1 text-sm text-muted-foreground">Treść zgód do uzupełnienia — pola przykładowe.</p></div>
          <label className="flex cursor-pointer items-start gap-3"><Checkbox className="mt-0.5" checked={form.regulations_accepted} onCheckedChange={(v) => setForm((f) => ({ ...f, regulations_accepted: v === true }))} /><span className="text-sm">Akceptuję regulamin korzystania z obiektu (treść do uzupełnienia).</span></label>
          <label className="flex cursor-pointer items-start gap-3"><Checkbox className="mt-0.5" checked={form.privacy_accepted} onCheckedChange={(v) => setForm((f) => ({ ...f, privacy_accepted: v === true }))} /><span className="text-sm">Potwierdzam zapoznanie się z informacją RODO (treść do uzupełnienia).</span></label>
        </section>
        <div className="py-6">
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !available || venues.isFetching || !user}>{busy ? "Wysyłanie…" : "Wyślij wniosek"}</Button><Button asChild variant="outline"><Link to="/">Anuluj</Link></Button></div>
        </div>
      </form>
    </div>
  );
}

function Section({ icon: Icon, title, note, children }: { icon: typeof Building2; title: string; note?: string; children: React.ReactNode }) {
  return <section className="grid gap-5 py-7"><div className="flex items-center gap-3"><Icon className="size-5 text-accent" /><div><h2 className="text-2xl font-semibold">{title}</h2>{note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}</div></div>{children}</section>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
