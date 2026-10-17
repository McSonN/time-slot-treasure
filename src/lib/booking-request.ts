import { z } from "zod";

export const NGO_PLACEHOLDER = {
  organization: "Fundacja Przykładowa",
  organization_address: "ul. Przykładowa 10, 00-001 Warszawa",
  organization_leader: "Anna Kowalska",
};

export const EQUIPMENT = ["Projektor", "Ekran projekcyjny", "Flipchart", "Nagłośnienie"] as const;
export function venueEquipment(name: string) {
  return name.toLowerCase().includes("pracownia") ? ["Projektor", "Flipchart"] : [...EQUIPMENT];
}

export const purposeTemplateSchema = z.object({
  name: z.string().trim().min(1, "Podaj nazwę szablonu.").max(100),
  purpose: z.string().trim().min(1, "Wpisz cel spotkania.").max(5000),
});

export const bookingRequestSchema = z.object({
  venue_id: z.string().uuid("Wybierz obiekt."),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
  organization: z.string().trim().min(1, "Podaj nazwę organizacji.").max(200),
  organization_address: z.string().trim().min(1, "Podaj adres organizacji.").max(500),
  organization_leader: z.string().trim().min(1, "Podaj imię i nazwisko osoby kierującej NGO.").max(150),
  event_name: z.string().trim().min(1, "Podaj nazwę spotkania.").max(200),
  contact_name: z.string().trim().max(150),
  contact_email: z.string().trim().email("Podaj poprawny e-mail.").max(255),
  participants: z.number().int().min(1, "Podaj co najmniej jednego uczestnika.").max(100000),
  description: z.string().trim().min(1, "Wpisz cel spotkania.").max(5000),
  equipment: z.array(z.enum(EQUIPMENT)).max(10),
  regulations_accepted: z.boolean(),
  privacy_accepted: z.boolean(),
  kind: z.enum(["request", "event"]),
}).refine((v) => new Date(v.end_at) > new Date(v.start_at), {
  message: "Koniec spotkania musi być późniejszy niż początek.", path: ["end_at"],
});

export function localDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toIso(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
export const bookingEditSchema = z.object({
  id: z.string().uuid(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }),
  event_name: z.string().trim().min(1, "Podaj nazwę spotkania.").max(200),
  participants: z.number().int().min(1, "Podaj co najmniej jednego uczestnika.").max(100000),
  description: z.string().trim().min(1, "Wpisz cel spotkania.").max(5000),
  contact_name: z.string().trim().max(150),
  contact_email: z.string().trim().email("Podaj poprawny e-mail.").max(255),
  equipment: z.array(z.enum(EQUIPMENT)).max(10),
}).refine((v) => new Date(v.end_at) > new Date(v.start_at), {
  message: "Koniec spotkania musi być późniejszy niż początek.", path: ["end_at"],
});

export const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(5, "Podaj uzasadnienie (min. 5 znaków).").max(2000),
});

export const changeRequestSchema = z.object({
  id: z.string().uuid(),
  message: z.string().trim().min(5, "Opisz proponowane zmiany (min. 5 znaków).").max(2000),
});

/** Who may do what with a booking, by status. */
export function bookingPermissions(status: string, isOwner: boolean, isAdmin: boolean) {
  return {
    edit: isAdmin || (isOwner && status === "pending"),
    cancel: isOwner && status === "pending",
    requestChange: isOwner && !isAdmin && status === "approved",
    approve: isAdmin && status !== "approved",
    reject: isAdmin && status !== "rejected",
    remove: isAdmin,
  };
}
