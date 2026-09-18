import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "~/db";
import { courses, purchases, enrollments, courseRatings } from "~/db/schema";

export type TimePeriod = "7d" | "30d" | "12m" | "all";

export interface AnalyticsSummary {
  totalRevenue: number;
  totalEnrollments: number;
  averageRating: number | null;
  ratingCount: number;
}

function getTimePeriodStart(period: TimePeriod): string | null {
  if (period === "all") return null;

  const now = new Date();
  switch (period) {
    case "7d":
      now.setDate(now.getDate() - 7);
      break;
    case "30d":
      now.setDate(now.getDate() - 30);
      break;
    case "12m":
      now.setMonth(now.getMonth() - 12);
      break;
  }
  return now.toISOString();
}

export function getAnalyticsSummary(
  instructorId: number,
  period: TimePeriod
): AnalyticsSummary {
  const periodStart = getTimePeriodStart(period);

  const instructorCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const courseIds = instructorCourses.map((c) => c.id);

  if (courseIds.length === 0) {
    return {
      totalRevenue: 0,
      totalEnrollments: 0,
      averageRating: null,
      ratingCount: 0,
    };
  }

  const revenueQuery = periodStart
    ? db
        .select({
          total: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
        })
        .from(purchases)
        .where(
          and(
            sql`${purchases.courseId} IN (${sql.join(courseIds, sql`, `)})`,
            gte(purchases.createdAt, periodStart)
          )
        )
        .get()
    : db
        .select({
          total: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
        })
        .from(purchases)
        .where(sql`${purchases.courseId} IN (${sql.join(courseIds, sql`, `)})`)
        .get();

  const totalRevenue = revenueQuery?.total ?? 0;

  const enrollmentQuery = periodStart
    ? db
        .select({ count: sql<number>`COUNT(*)` })
        .from(enrollments)
        .where(
          and(
            sql`${enrollments.courseId} IN (${sql.join(courseIds, sql`, `)})`,
            gte(enrollments.enrolledAt, periodStart)
          )
        )
        .get()
    : db
        .select({ count: sql<number>`COUNT(*)` })
        .from(enrollments)
        .where(
          sql`${enrollments.courseId} IN (${sql.join(courseIds, sql`, `)})`
        )
        .get();

  const totalEnrollments = enrollmentQuery?.count ?? 0;

  const ratingQuery = periodStart
    ? db
        .select({
          avg: sql<number | null>`AVG(${courseRatings.rating})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(courseRatings)
        .where(
          and(
            sql`${courseRatings.courseId} IN (${sql.join(courseIds, sql`, `)})`,
            gte(courseRatings.createdAt, periodStart)
          )
        )
        .get()
    : db
        .select({
          avg: sql<number | null>`AVG(${courseRatings.rating})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(courseRatings)
        .where(
          sql`${courseRatings.courseId} IN (${sql.join(courseIds, sql`, `)})`
        )
        .get();

  return {
    totalRevenue,
    totalEnrollments,
    averageRating: ratingQuery?.avg ?? null,
    ratingCount: ratingQuery?.count ?? 0,
  };
}
