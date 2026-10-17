import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/session";
import { weekKey } from "@/lib/week";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/wniosek/$id")({
  head: () => ({
    meta: [
      { title: "Szczegóły wniosku" },
      { name: "description", content: "Szczegóły wniosku o rezerwację obiektu." },
      { property: "og:title", content: "Szczegóły wniosku" },
      { property: "og:description", content: "Szczegóły wniosku o rezerwację obiektu." },
    ],
  }),
  component: Detail,
});

const STATUS: Record<string, string> = { pending: "Oczekuje", approved: "Zatwierdzony", rejected: "Odrzucony" };

function Detail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const isAdmin = useIsAdmin(user?.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*, venues(name, capacity)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (q.isLoading) return <p className="p-10 text-muted-foreground">Wczytywanie…</p>;
  const b = q.data;
  if (!b) return <p className="p-10">Nie znaleziono wniosku lub brak dostępu.</p>;
  const start = new Date(b.start_at);
  const end = new Date(b.end_at);

  async function setStatus(status: string) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Zaktualizowano");
    qc.invalidateQueries();
  }
  async function remove() {
    if (!confirm("Na pewno usunąć ten wniosek?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" search={{ venue: b.venue_id, week: weekKey(start) }} className="text-sm text-muted-foreground hover:underline">
        ← Wróć do kalendarza
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">{b.kind === "event" ? "Wydarzenie" : "Wniosek"}</p>
          <h1 className="text-4xl font-semibold">{b.event_name}</h1>
          <p className="mt-1 text-muted-foreground">{b.organization}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">{STATUS[b.status] ?? b.status}</span>
      </div>
      <dl className="mt-8 grid gap-4 rounded-lg border bg-card p-6 sm:grid-cols-2">
        <Item k="Obiekt" v={b.venues?.name} />
        <Item k="Termin" v={`${format(start, "EEEE d MMM yyyy", { locale: pl })}, ${format(start, "HH:mm")}–${format(end, "HH:mm")}`} />
        <Item k="Uczestnicy" v={String(b.participants)} />
        <Item k="Kontakt" v={[b.contact_name, b.contact_email].filter(Boolean).join(" · ") || "—"} />
        <div className="sm:col-span-2"><Item k="Opis" v={b.description || "—"} /></div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        {isAdmin && b.status !== "approved" && <Button onClick={() => setStatus("approved")}>Zatwierdź</Button>}
        {isAdmin && b.status !== "rejected" && <Button variant="outline" onClick={() => setStatus("rejected")}>Odrzuć</Button>}
        {(isAdmin || b.user_id === user?.id) && <Button variant="destructive" onClick={remove}>Usuń</Button>}
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-1 capitalize-first">{v}</dd>
    </div>
  );
}
