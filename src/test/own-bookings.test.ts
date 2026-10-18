import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), order: vi.fn() }));
const from = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { listOwnBookings } from "@/lib/own-bookings";

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [], error: null });
});

describe("own request list", () => {
  it("scopes requests to the signed-in owner even when they are an admin", async () => {
    await listOwnBookings("11111111-1111-4111-8111-111111111111");
    expect(query.eq).toHaveBeenCalledWith("user_id", "11111111-1111-4111-8111-111111111111");
    expect(query.eq).toHaveBeenCalledWith("kind", "request");
  });
  it("does not read requests without an owner", async () => {
    await expect(listOwnBookings("")).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
  it("returns cancelled and rejected requests as well as active ones", async () => {
    const rows = [{ id: "one", status: "cancelled" }, { id: "two", status: "rejected" }];
    query.order.mockResolvedValue({ data: rows, error: null });
    expect(await listOwnBookings("owner")).toEqual(rows);
    expect(query.eq.mock.calls).toEqual([["user_id", "owner"], ["kind", "request"]]);
  });
});