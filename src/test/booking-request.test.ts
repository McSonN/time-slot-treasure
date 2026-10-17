import { describe, expect, it } from "vitest";
import { bookingRequestSchema, NGO_PLACEHOLDER, purposeTemplateSchema, toIso, localDateTime } from "@/lib/booking-request";

const request = {
  ...NGO_PLACEHOLDER,
  venue_id: "11111111-1111-4111-8111-111111111111",
  start_at: "2026-10-19T08:00:00.000Z", end_at: "2026-10-19T10:00:00.000Z",
  event_name: "Spotkanie NGO", contact_name: "Jan Nowak", contact_email: "jan@example.org",
  participants: 12, description: "Omówienie planu wolontariatu.", equipment: ["Projektor"],
  regulations_accepted: false, privacy_accepted: false, kind: "request",
};

describe("booking request", () => {
  it("retains NGO profile name, address and leader on submission", () => {
    const parsed = bookingRequestSchema.parse(request);
    expect(parsed.organization).toBe("Fundacja Przykładowa");
    expect(parsed.organization_address).toBe("ul. Przykładowa 10, 00-001 Warszawa");
    expect(parsed.organization_leader).toBe("Anna Kowalska");
  });
  it("accepts changed calendar dates and rejects end before start", () => {
    expect(bookingRequestSchema.parse({ ...request, start_at: "2026-10-20T08:00:00Z", end_at: "2026-10-20T11:00:00Z" }).end_at).toBe("2026-10-20T11:00:00Z");
    expect(bookingRequestSchema.safeParse({ ...request, end_at: request.start_at }).success).toBe(false);
  });
  it("stores estimated participants and rejects fractional counts", () => {
    expect(bookingRequestSchema.parse(request).participants).toBe(12);
    expect(bookingRequestSchema.safeParse({ ...request, participants: 1.5 }).success).toBe(false);
  });
  it("saves reusable descriptive meeting purposes", () => {
    const saved = purposeTemplateSchema.parse({ name: " Wolontariat ", purpose: request.description });
    expect(saved).toEqual({ name: "Wolontariat", purpose: "Omówienie planu wolontariatu." });
    expect(purposeTemplateSchema.safeParse({ name: "Wolontariat", purpose: " " }).success).toBe(false);
  });
  it("preserves projector request and rejects unknown equipment", () => {
    expect(bookingRequestSchema.parse(request).equipment).toEqual(["Projektor"]);
    expect(bookingRequestSchema.safeParse({ ...request, equipment: ["unknown"] }).success).toBe(false);
  });
  it("stores placeholder consents without requiring unfinished legal text", () => {
    expect(bookingRequestSchema.parse(request).privacy_accepted).toBe(false);
    expect(bookingRequestSchema.parse({ ...request, privacy_accepted: true, regulations_accepted: true }).regulations_accepted).toBe(true);
  });
  it("round-trips the calendar timestamp through editable local date fields", () => {
    expect(toIso(localDateTime(request.start_at))).toBe(request.start_at);
  });
});
import { bookingPermissions, rejectSchema } from "@/lib/booking-request";
describe("booking detail permissions", () => {
  it("lets the owner edit or cancel only before acceptance", () => {
    expect(bookingPermissions("pending", true, false)).toMatchObject({ edit: true, cancel: true, requestChange: false });
    expect(bookingPermissions("approved", true, false)).toMatchObject({ edit: false, cancel: false, requestChange: true });
  });
  it("lets admins edit, approve, reject and delete", () => {
    expect(bookingPermissions("approved", false, true)).toMatchObject({ edit: true, reject: true, remove: true, approve: false });
  });
  it("requires a descriptive rejection reason", () => {
    expect(rejectSchema.safeParse({ id: "00000000-0000-4000-8000-000000000000", reason: "" }).success).toBe(false);
  });
});
