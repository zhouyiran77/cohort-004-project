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

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface CourseBreakdown {
  courseId: number;
  title: string;
  listPrice: number;
  revenue: number;
  salesCount: number;
  enrollmentCount: number;
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

function getGranularity(period: TimePeriod): "daily" | "monthly" {
  return period === "7d" || period === "30d" ? "daily" : "monthly";
}

function formatDateKey(date: Date, granularity: "daily" | "monthly"): string {
  if (granularity === "daily") {
    return date.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 7);
}

function generateDateRange(
  periodStart: Date,
  periodEnd: Date,
  granularity: "daily" | "monthly"
): string[] {
  const dates: string[] = [];
  const current = new Date(periodStart);

  if (granularity === "daily") {
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(periodEnd);
    end.setUTCHours(0, 0, 0, 0);
    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else {
    current.setUTCDate(1);
    current.setUTCHours(0, 0, 0, 0);
    const endKey = periodEnd.toISOString().slice(0, 7);
    while (current.toISOString().slice(0, 7) <= endKey) {
      dates.push(current.toISOString().slice(0, 7));
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  return dates;
}

export function getRevenueTimeSeries(
  instructorId: number,
  period: TimePeriod
): RevenueDataPoint[] {
  const periodStart = getTimePeriodStart(period);
  const granularity = getGranularity(period);

  const instructorCourses = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const courseIds = instructorCourses.map((c) => c.id);

  if (courseIds.length === 0) {
    return [];
  }

  const dateFormat =
    granularity === "daily"
      ? sql<string>`SUBSTR(${purchases.createdAt}, 1, 10)`
      : sql<string>`SUBSTR(${purchases.createdAt}, 1, 7)`;

  const rows = periodStart
    ? db
        .select({
          dateKey: dateFormat,
          revenue: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
        })
        .from(purchases)
        .where(
          and(
            sql`${purchases.courseId} IN (${sql.join(courseIds, sql`, `)})`,
            gte(purchases.createdAt, periodStart)
          )
        )
        .groupBy(dateFormat)
        .all()
    : db
        .select({
          dateKey: dateFormat,
          revenue: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
        })
        .from(purchases)
        .where(sql`${purchases.courseId} IN (${sql.join(courseIds, sql`, `)})`)
        .groupBy(dateFormat)
        .all();

  const revenueMap = new Map(rows.map((r) => [r.dateKey, r.revenue]));

  const now = new Date();
  let rangeStart: Date;

  if (periodStart) {
    rangeStart = new Date(periodStart);
  } else if (rows.length > 0) {
    const sortedKeys = [...revenueMap.keys()].sort();
    rangeStart = new Date(sortedKeys[0]);
  } else {
    return [];
  }

  const dateRange = generateDateRange(rangeStart, now, granularity);

  return dateRange.map((date) => ({
    date,
    revenue: revenueMap.get(date) ?? 0,
  }));
}

export function getPerCourseBreakdown(
  instructorId: number,
  period: TimePeriod
): CourseBreakdown[] {
  const periodStart = getTimePeriodStart(period);

  const instructorCourses = db
    .select({
      id: courses.id,
      title: courses.title,
      price: courses.price,
    })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  if (instructorCourses.length === 0) {
    return [];
  }

  return instructorCourses.map((course) => {
    const revenueRow = periodStart
      ? db
          .select({
            total: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(purchases)
          .where(
            and(
              eq(purchases.courseId, course.id),
              gte(purchases.createdAt, periodStart)
            )
          )
          .get()
      : db
          .select({
            total: sql<number>`COALESCE(SUM(${purchases.pricePaid}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(purchases)
          .where(eq(purchases.courseId, course.id))
          .get();

    const enrollmentRow = periodStart
      ? db
          .select({ count: sql<number>`COUNT(*)` })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.courseId, course.id),
              gte(enrollments.enrolledAt, periodStart)
            )
          )
          .get()
      : db
          .select({ count: sql<number>`COUNT(*)` })
          .from(enrollments)
          .where(eq(enrollments.courseId, course.id))
          .get();

    const ratingRow = periodStart
      ? db
          .select({
            avg: sql<number | null>`AVG(${courseRatings.rating})`,
            count: sql<number>`COUNT(*)`,
          })
          .from(courseRatings)
          .where(
            and(
              eq(courseRatings.courseId, course.id),
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
          .where(eq(courseRatings.courseId, course.id))
          .get();

    return {
      courseId: course.id,
      title: course.title,
      listPrice: course.price,
      revenue: revenueRow?.total ?? 0,
      salesCount: revenueRow?.count ?? 0,
      enrollmentCount: enrollmentRow?.count ?? 0,
      averageRating: ratingRow?.avg ?? null,
      ratingCount: ratingRow?.count ?? 0,
    };
  });
}
