import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bookingEditSchema, bookingRequestSchema, changeRequestSchema, purposeTemplateSchema, rejectSchema, venueEquipment } from "./booking-request";

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
async function isAdminCheck(context: { supabase: any; userId: string }) {
  const r = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return !!r.data;
}

export const updateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof bookingEditSchema>) => bookingEditSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const current = await context.supabase.from("bookings").select("venue_id, venues(name,capacity)").eq("id", id).single();
    if (current.error || !current.data?.venues) throw new Error("Nie znaleziono wniosku.");
    const v = current.data.venues;
    if (fields.participants > v.capacity) throw new Error("Liczba uczestników przekracza pojemność obiektu.");
    if (fields.equipment.some((i) => !venueEquipment(v.name).includes(i))) throw new Error("Wybrane wyposażenie nie jest dostępne w tym obiekcie.");
    const r = await context.supabase.from("bookings").update(fields).eq("id", id).select("id").single();
    if (r.error) throw new Error(r.error.message.includes("zajęty") ? "Wybrany termin jest już zajęty." : "Nie udało się zapisać zmian (wniosek może być już zaakceptowany).");
    return { ok: true };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("bookings").update({ status: "cancelled" })
      .eq("id", data.id).eq("user_id", context.userId).eq("status", "pending").select("id").single();
    if (r.error) throw new Error("Nie można anulować tego wniosku.");
    return { ok: true };
  });

export const requestBookingChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof changeRequestSchema>) => changeRequestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("bookings")
      .update({ change_request: data.message, change_requested_at: new Date().toISOString() })
      .eq("id", data.id).eq("user_id", context.userId).eq("status", "approved").select("id").single();
    if (r.error) throw new Error("Nie udało się wysłać prośby o zmianę.");
    return { ok: true };
  });

export const approveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdminCheck(context))) throw new Error("Brak uprawnień.");
    const r = await context.supabase.from("bookings").update({ status: "approved", rejection_reason: null, change_request: null })
      .eq("id", data.id).select("id").single();
    if (r.error) throw new Error(r.error.message.includes("zajęty") ? "Termin koliduje z innym wnioskiem." : "Nie udało się zaakceptować.");
    return { ok: true };
  });

export const rejectBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof rejectSchema>) => rejectSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdminCheck(context))) throw new Error("Brak uprawnień.");
    const r = await context.supabase.from("bookings").update({ status: "rejected", rejection_reason: data.reason })
      .eq("id", data.id).select("id").single();
    if (r.error) throw new Error("Nie udało się odrzucić wniosku.");
    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await isAdminCheck(context))) throw new Error("Brak uprawnień.");
    const r = await context.supabase.from("bookings").delete().eq("id", data.id).select("id");
    if (r.error || !r.data?.length) throw new Error("Nie udało się usunąć wniosku.");
    return { ok: true };
  });
