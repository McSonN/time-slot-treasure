import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowUpRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { BOOKING_STATUS, listOwnBookings } from "@/lib/own-bookings";

export function OwnBookings() {
  const { user, loading } = useSession();
  const requests = useQuery({
    queryKey: ["own-bookings", user?.id],
    enabled: !!user,
    queryFn: () => listOwnBookings(user?.id ?? ""),
  });

  return (
    <section className="mt-10 border-t pt-8" aria-labelledby="own-bookings-title">
      <div className="mb-5 flex items-center gap-3">
        <FileText className="size-5 text-accent" />
        <h2 id="own-bookings-title" className="text-2xl font-semibold">Twoje wnioski</h2>
        {user && requests.data && <span className="text-sm text-muted-foreground">({requests.data.length})</span>}
      </div>
      {loading || (user && requests.isPending) ? (
        <p role="status" className="text-sm text-muted-foreground">Wczytywanie wniosków…</p>
      ) : !user ? (
        <Button asChild variant="outline"><Link to="/auth" search={{ redirect: "/" }}>Zaloguj się, aby zobaczyć swoje wnioski</Link></Button>
      ) : requests.isError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">Nie udało się wczytać Twoich wniosków.</p>
          <Button variant="outline" size="sm" onClick={() => requests.refetch()}>Spróbuj ponownie</Button>
        </div>
      ) : requests.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nie masz jeszcze żadnych wniosków.</p>
      ) : (
        <ul className="divide-y border-y">
          {requests.data?.map((booking) => (
            <li key={booking.id}>
              <Link to="/wniosek/$id" params={{ id: booking.id }} className="flex flex-wrap items-center gap-3 py-4 transition-colors hover:bg-secondary/50">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-words font-medium">{booking.event_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{booking.venues?.name ?? "Obiekt"} · {format(new Date(booking.start_at), "d MMM yyyy, HH:mm", { locale: pl })} – {format(new Date(booking.end_at), "d MMM yyyy, HH:mm", { locale: pl })}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Złożono: {format(new Date(booking.created_at), "d MMM yyyy, HH:mm", { locale: pl })}</p>
                </div>
                <span className="rounded-md bg-secondary px-3 py-1 text-xs font-medium">{BOOKING_STATUS[booking.status] ?? booking.status}</span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}