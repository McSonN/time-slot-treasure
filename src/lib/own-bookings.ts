import { supabase } from "@/integrations/supabase/client";

export const BOOKING_STATUS: Record<string, string> = {
  pending: "Oczekuje", approved: "Zaakceptowany", rejected: "Odrzucony", cancelled: "Anulowany",
};

export async function listOwnBookings(userId: string) {
  if (!userId) throw new Error("Zaloguj się, aby zobaczyć swoje wnioski.");
  const { data, error } = await supabase.from("bookings")
    .select("id,event_name,start_at,end_at,created_at,status,venues(name)")
    .eq("user_id", userId).eq("kind", "request")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Nie udało się wczytać Twoich wniosków.");
  return data;
}