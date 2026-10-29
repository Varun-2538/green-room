import { describe, expect, it } from "vitest";
import { creators } from "@/lib/db/schema";
import { makeTestDb } from "./helpers/db";

describe("database schema", () => {
  it("defaults a new creator's agent username to Varun's agent bot", async () => {
    const db = await makeTestDb();
    const [row] = await db
      .insert(creators)
      .values({ telegramId: 1001, name: "Varun" })
      .returning();
    expect(row.agentUsername).toBe("edge_city_agent_qbdffu_bot");
  });

  it("refuses two creators with the same World ID nullifier", async () => {
    const db = await makeTestDb();
    const nullifier = "123456789012345678901234567890";
    await db.insert(creators).values({ telegramId: 1, name: "A", nullifier });
    await expect(
      db.insert(creators).values({ telegramId: 2, name: "B", nullifier }),
    ).rejects.toThrow();
  });

  it("refuses two creators with the same Telegram id", async () => {
    const db = await makeTestDb();
    await db.insert(creators).values({ telegramId: 7, name: "A" });
    await expect(db.insert(creators).values({ telegramId: 7, name: "B" })).rejects.toThrow();
  });
});
