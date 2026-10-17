import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bookingRequestSchema, purposeTemplateSchema, venueEquipment } from "./booking-request";

export const listPurposeTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("meeting_purpose_templates")
      .select("id,name,purpose").eq("user_id", context.userId).order("created_at", { ascending: false });
    if (error) throw new Error("Nie udało się wczytać szablonów.");
    return data;
  });

export const savePurposeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof purposeTemplateSchema>) => purposeTemplateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.from("meeting_purpose_templates")
      .insert({ ...data, user_id: context.userId }).select("id,name,purpose").single();
    if (result.error) throw new Error("Nie udało się zapisać szablonu.");
    return result.data;
  });

export const submitBookingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof bookingRequestSchema>) => bookingRequestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const venue = await context.supabase.from("venues").select("name,capacity").eq("id", data.venue_id).single();
    if (venue.error || !venue.data) throw new Error("Nie znaleziono obiektu.");
    if (data.participants > venue.data.capacity) throw new Error("Liczba uczestników przekracza pojemność obiektu.");
    if (data.equipment.some((item) => !venueEquipment(venue.data.name).includes(item))) throw new Error("Wybrane wyposażenie nie jest dostępne w tym obiekcie.");
    if (data.kind === "event") {
      const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (role.error || !role.data) throw new Error("Brak uprawnień do dodania wydarzenia.");
    }
    const result = await context.supabase.from("bookings")
      .insert({ ...data, user_id: context.userId, status: data.kind === "event" ? "approved" : "pending" })
      .select("id").single();
    if (result.error) throw new Error("Nie udało się złożyć wniosku. Termin może być już zajęty — sprawdź dostępność.");
    return result.data;
  });