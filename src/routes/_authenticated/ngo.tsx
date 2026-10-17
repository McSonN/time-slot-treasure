import { createFileRoute, Link } from "@tanstack/react-router";
import { NGO_PLACEHOLDER } from "@/lib/booking-request";

export const Route = createFileRoute("/_authenticated/ngo")({
  validateSearch: (s: Record<string, unknown>): { org?: string | undefined } => ({
    org: typeof s["org"] === "string" ? s["org"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Profil NGO" },
      { name: "description", content: "Profil organizacji składającej wnioski o rezerwację." },
      { property: "og:title", content: "Profil NGO" },
      { property: "og:description", content: "Profil organizacji składającej wnioski o rezerwację." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NgoProfile,
});

function NgoProfile() {
  const { org } = Route.useSearch();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <button onClick={() => history.back()} className="text-sm text-muted-foreground hover:underline">← Wróć</button>
      <p className="mt-4 text-sm uppercase tracking-widest text-accent">Profil NGO · dane przykładowe</p>
      <h1 className="text-4xl font-semibold">{org ?? NGO_PLACEHOLDER.organization}</h1>
      <dl className="mt-8 grid gap-4 rounded-lg border bg-card p-6">
        <div><dt className="text-xs uppercase text-muted-foreground">Adres</dt><dd>{NGO_PLACEHOLDER.organization_address}</dd></div>
        <div><dt className="text-xs uppercase text-muted-foreground">Osoba kierująca</dt><dd>{NGO_PLACEHOLDER.organization_leader}</dd></div>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">Pełny profil organizacji pojawi się tutaj po podłączeniu profili NGO.</p>
      <Link to="/" className="mt-6 inline-block text-sm text-accent hover:underline">Kalendarz</Link>
    </div>
  );
}
