import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ from: vi.fn(), owners: [] as string[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: db.from } }));
import { profileContext } from "@/server/team-setup.server";
beforeEach(() => {
  db.owners.length = 0;
  db.from.mockImplementation((table: string) => {
    const data = table === "profile" ? [{ team_setup_completed_at: null }] : [
      { kind: "learning", character_id: "Sensei", answers: { subject: "fixture-pottery" }, completed_at: "2026-01-01", updated_at: "2026-01-01" },
      { kind: "wellness", character_id: "Hassan", answers: { goal: "fixture-mobility" }, completed_at: "2026-01-01", updated_at: "2026-01-01" },
      { kind: "development", character_id: "Dr Neo", answers: { challenge: "private-unfinished" }, completed_at: null, updated_at: "2026-01-01" },
    ];
    const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => void) => resolve({ data, error: null }) };
    chain.select = () => chain; chain.order = () => chain; chain.limit = () => chain;
    chain.eq = (key: string, value: string) => { if (key === "user_id") db.owners.push(value); return chain; };
    return chain;
  });
});
describe("Saved specialist context", () => {
  it("gives Larry every completed profile but not unfinished answers", async () => {
    const context = await profileContext("fixture-owner", "Larry");
    expect(context).toContain("fixture-pottery"); expect(context).toContain("fixture-mobility");
    expect(context).not.toContain("private-unfinished"); expect(db.owners).toEqual(["fixture-owner", "fixture-owner"]);
  });
  it("limits each specialist to their own completed answers", async () => {
    const sensei = await profileContext("fixture-owner", "Sensei");
    expect(sensei).toContain("fixture-pottery"); expect(sensei).not.toContain("fixture-mobility");
    const hassan = await profileContext("fixture-owner", "Hassan");
    expect(hassan).toContain("fixture-mobility"); expect(hassan).not.toContain("fixture-pottery");
    const neo = await profileContext("fixture-owner", "Dr Neo");
    expect(neo).not.toContain("private-unfinished"); expect(neo).toContain("not completed");
  });
});