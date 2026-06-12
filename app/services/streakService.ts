import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { streakActivities, users } from "~/db/schema";

function getUtcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00Z").getTime();
  const b = new Date(dateB + "T00:00:00Z").getTime();
  return Math.round(Math.abs(a - b) / (1000 * 60 * 60 * 24));
}

export function recordStreakActivity(
  userId: number,
  now: Date = new Date()
): { currentStreak: number; longestStreak: number } {
  const today = getUtcDateString(now);

  const existing = db
    .select()
    .from(streakActivities)
    .where(
      and(
        eq(streakActivities.userId, userId),
        eq(streakActivities.activityDate, today)
      )
    )
    .get();

  if (existing) {
    const user = db
      .select({
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    return {
      currentStreak: user?.currentStreak ?? 0,
      longestStreak: user?.longestStreak ?? 0,
    };
  }

  db.insert(streakActivities).values({ userId, activityDate: today }).run();

  const user = db
    .select({
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      lastActivityDate: users.lastActivityDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let newStreak: number;
  if (
    user.lastActivityDate &&
    daysBetween(user.lastActivityDate, today) === 1
  ) {
    newStreak = user.currentStreak + 1;
  } else if (user.lastActivityDate === today) {
    newStreak = user.currentStreak;
  } else {
    newStreak = 1;
  }

  const newLongest = Math.max(user.longestStreak, newStreak);

  db.update(users)
    .set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActivityDate: today,
    })
    .where(eq(users.id, userId))
    .run();

  return { currentStreak: newStreak, longestStreak: newLongest };
}

export function getStreakData(userId: number): {
  currentStreak: number;
  longestStreak: number;
} {
  const user = db
    .select({
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      lastActivityDate: users.lastActivityDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  if (!user.lastActivityDate) {
    return { currentStreak: 0, longestStreak: user.longestStreak };
  }

  const today = getUtcDateString();
  const gap = daysBetween(user.lastActivityDate, today);

  if (gap <= 1) {
    return {
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
    };
  }

  return { currentStreak: 0, longestStreak: user.longestStreak };
}
