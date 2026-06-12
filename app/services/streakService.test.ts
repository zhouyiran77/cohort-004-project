import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { recordStreakActivity, getStreakData } from "./streakService";

function utcDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

describe("streakService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("recordStreakActivity", () => {
    it("starts a new streak at 1 on first completion", () => {
      const result = recordStreakActivity(base.user.id, utcDate("2026-06-10"));
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });

    it("increments streak on consecutive UTC days", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-10"));
      recordStreakActivity(base.user.id, utcDate("2026-06-11"));
      const result = recordStreakActivity(base.user.id, utcDate("2026-06-12"));
      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(3);
    });

    it("collapses multiple completions on the same UTC day", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-10"));
      const result = recordStreakActivity(base.user.id, utcDate("2026-06-10"));
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);

      const activities = testDb.select().from(schema.streakActivities).all();
      expect(activities).toHaveLength(1);
    });

    it("resets current streak after missing a day", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-10"));
      recordStreakActivity(base.user.id, utcDate("2026-06-11"));
      const result = recordStreakActivity(base.user.id, utcDate("2026-06-13"));
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(2);
    });

    it("longest streak never decreases after a reset", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      recordStreakActivity(base.user.id, utcDate("2026-06-03"));
      expect(
        recordStreakActivity(base.user.id, utcDate("2026-06-03")).longestStreak
      ).toBe(3);

      recordStreakActivity(base.user.id, utcDate("2026-06-10"));
      const result = recordStreakActivity(base.user.id, utcDate("2026-06-11"));
      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(3);
    });

    it("tracks streaks independently per user", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-10"));
      recordStreakActivity(base.user.id, utcDate("2026-06-11"));

      const result = recordStreakActivity(
        base.instructor.id,
        utcDate("2026-06-11")
      );
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });

    it("handles UTC midnight boundary correctly", () => {
      recordStreakActivity(base.user.id, new Date("2026-06-10T23:59:59Z"));
      const result = recordStreakActivity(
        base.user.id,
        new Date("2026-06-11T00:00:01Z")
      );
      expect(result.currentStreak).toBe(2);
    });
  });

  describe("getStreakData", () => {
    it("returns 0 for a user with no activity", () => {
      const result = getStreakData(base.user.id);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    it("returns current streak when active today", () => {
      const now = new Date();
      recordStreakActivity(base.user.id, now);
      const result = getStreakData(base.user.id);
      expect(result.currentStreak).toBe(1);
    });

    it("returns 0 current streak if user missed more than a day", () => {
      recordStreakActivity(base.user.id, utcDate("2020-01-01"));
      recordStreakActivity(base.user.id, utcDate("2020-01-02"));
      const result = getStreakData(base.user.id);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(2);
    });

    it("returns 0 for a non-existent user", () => {
      const result = getStreakData(9999);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });
  });
});
