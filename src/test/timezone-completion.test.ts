import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDate, SCORE_PER_COMPLETION, storageFor } from "@/server/storage.server";

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: db.rpc, from: db.from } }));

beforeEach(() => {
  vi.clearAllMocks();
  const row = { id: 42, name: "Read", completed: true, streak: 0, due_at: null, kind: "habit", linked_character: null, points_awarded: false, completed_at: "2026-11-22T23:00:00Z", created_at: "2026-01-01T00:00:00Z" };
  db.rpc.mockResolvedValue({ data: { found: true, awarded_points: 5 }, error: null });
  db.from.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve({ data: table === "habits" ? [row] : [], error: null }).then(resolve, reject),
    };
    return chain;
  });
});

describe("atomic completion ownership and local-day rules", () => {
  it("uses exactly five points and sends the authenticated owner and local date to the atomic action", async () => {
    expect(SCORE_PER_COMPLETION).toBe(5);
    const result = await storageFor("owner-a").setCompletion(42, true, 300);
    expect(result?.id).toBe(42);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("set_habit_completion_atomic", {
      p_user_id: "owner-a", p_habit_id: 42, p_completed: true, p_local_date: localDate(300),
    });
  });

  it("assigns an event just after UTC midnight to the previous local date for UTC-5", () => {
    expect(localDate(300, new Date("2026-11-23T02:00:00.000Z"))).toBe("2026-11-22");
  });
});