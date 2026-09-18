import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getAnalyticsSummary,
  getRevenueTimeSeries,
  getPerCourseBreakdown,
} from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getAnalyticsSummary", () => {
    it("returns zero totals for instructor with no courses", () => {
      const newInstructor = testDb
        .insert(schema.users)
        .values({
          name: "New Instructor",
          email: "new@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const summary = getAnalyticsSummary(newInstructor.id, "30d");

      expect(summary.totalRevenue).toBe(0);
      expect(summary.totalEnrollments).toBe(0);
      expect(summary.averageRating).toBeNull();
      expect(summary.ratingCount).toBe(0);
    });

    it("returns zero totals for instructor with courses but no data", () => {
      const summary = getAnalyticsSummary(base.instructor.id, "30d");

      expect(summary.totalRevenue).toBe(0);
      expect(summary.totalEnrollments).toBe(0);
      expect(summary.averageRating).toBeNull();
      expect(summary.ratingCount).toBe(0);
    });

    it("calculates total revenue from purchases", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "all");

      expect(summary.totalRevenue).toBe(7499);
    });

    it("calculates total enrollments", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "all");

      expect(summary.totalEnrollments).toBe(2);
    });

    it("calculates average rating and rating count", () => {
      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          rating: 5,
        })
        .run();

      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          rating: 4,
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "all");

      expect(summary.averageRating).toBe(4.5);
      expect(summary.ratingCount).toBe(2);
    });

    it("filters data by 7d period", () => {
      const now = new Date();
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: sixDaysAgo.toISOString(),
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
          createdAt: eightDaysAgo.toISOString(),
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "7d");

      expect(summary.totalRevenue).toBe(4999);
    });

    it("filters data by 30d period", () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: twentyDaysAgo.toISOString(),
        })
        .run();

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          enrolledAt: fortyDaysAgo.toISOString(),
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "30d");

      expect(summary.totalEnrollments).toBe(1);
    });

    it("filters data by 12m period", () => {
      const now = new Date();
      const tenMonthsAgo = new Date(now);
      tenMonthsAgo.setMonth(now.getMonth() - 10);
      const fourteenMonthsAgo = new Date(now);
      fourteenMonthsAgo.setMonth(now.getMonth() - 14);

      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          rating: 5,
          createdAt: tenMonthsAgo.toISOString(),
        })
        .run();

      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          rating: 3,
          createdAt: fourteenMonthsAgo.toISOString(),
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "12m");

      expect(summary.averageRating).toBe(5);
      expect(summary.ratingCount).toBe(1);
    });

    it("includes all data for 'all' period", () => {
      const veryOldDate = new Date("2020-01-01").toISOString();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
          createdAt: veryOldDate,
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "all");

      expect(summary.totalRevenue).toBe(1000);
    });

    it("only includes data for instructor's own courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
          pricePaid: 9999,
          country: "US",
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "all");

      expect(summary.totalRevenue).toBe(4999);
    });

    it("aggregates data across multiple courses for the same instructor", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course by the same instructor",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: course2.id,
          pricePaid: 2999,
          country: "US",
        })
        .run();

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: course2.id,
        })
        .run();

      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          rating: 5,
        })
        .run();

      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: course2.id,
          rating: 3,
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "all");

      expect(summary.totalRevenue).toBe(7998);
      expect(summary.totalEnrollments).toBe(2);
      expect(summary.averageRating).toBe(4);
      expect(summary.ratingCount).toBe(2);
    });

    it("handles period boundary dates correctly", () => {
      const now = new Date();
      const exactly7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: exactly7DaysAgo.toISOString(),
        })
        .run();

      const summary = getAnalyticsSummary(base.instructor.id, "7d");

      expect(summary.totalRevenue).toBe(4999);
    });
  });

  // ─── Revenue Time Series ───

  describe("getRevenueTimeSeries", () => {
    it("returns empty array for instructor with no courses", () => {
      const newInstructor = testDb
        .insert(schema.users)
        .values({
          name: "New Instructor",
          email: "new@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const series = getRevenueTimeSeries(newInstructor.id, "30d");
      expect(series).toEqual([]);
    });

    it("uses daily granularity for 7d period", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: threeDaysAgo.toISOString(),
        })
        .run();

      const series = getRevenueTimeSeries(base.instructor.id, "7d");

      expect(series.length).toBe(8);
      series.forEach((point) => {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it("uses daily granularity for 30d period", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
        })
        .run();

      const series = getRevenueTimeSeries(base.instructor.id, "30d");

      expect(series.length).toBe(31);
      series.forEach((point) => {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it("uses monthly granularity for 12m period", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
        })
        .run();

      const series = getRevenueTimeSeries(base.instructor.id, "12m");

      expect(series.length).toBe(13);
      series.forEach((point) => {
        expect(point.date).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it("fills zero-revenue periods with $0 data points", () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: fiveDaysAgo.toISOString(),
        })
        .run();

      const series = getRevenueTimeSeries(base.instructor.id, "7d");
      const zeroDays = series.filter((p) => p.revenue === 0);
      expect(zeroDays.length).toBeGreaterThanOrEqual(6);
    });

    it("sums revenue on the same date", () => {
      const today = new Date().toISOString();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 2000,
          country: "US",
          createdAt: today,
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 3000,
          country: "US",
          createdAt: today,
        })
        .run();

      const series = getRevenueTimeSeries(base.instructor.id, "7d");
      const todayKey = today.slice(0, 10);
      const todayPoint = series.find((p) => p.date === todayKey);

      expect(todayPoint).toBeDefined();
      expect(todayPoint!.revenue).toBe(5000);
    });

    it("uses monthly granularity for 'all' period", () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
          createdAt: sixMonthsAgo.toISOString(),
        })
        .run();

      const series = getRevenueTimeSeries(base.instructor.id, "all");

      expect(series.length).toBeGreaterThanOrEqual(7);
      series.forEach((point) => {
        expect(point.date).toMatch(/^\d{4}-\d{2}$/);
      });
    });
  });

  // ─── Per-Course Breakdown ───

  describe("getPerCourseBreakdown", () => {
    it("returns empty array for instructor with no courses", () => {
      const newInstructor = testDb
        .insert(schema.users)
        .values({
          name: "New Instructor",
          email: "new@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      const breakdown = getPerCourseBreakdown(newInstructor.id, "all");
      expect(breakdown).toEqual([]);
    });

    it("returns course with zero metrics when no data", () => {
      const breakdown = getPerCourseBreakdown(base.instructor.id, "all");

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].courseId).toBe(base.course.id);
      expect(breakdown[0].title).toBe("Test Course");
      expect(breakdown[0].revenue).toBe(0);
      expect(breakdown[0].salesCount).toBe(0);
      expect(breakdown[0].enrollmentCount).toBe(0);
      expect(breakdown[0].averageRating).toBeNull();
      expect(breakdown[0].ratingCount).toBe(0);
    });

    it("correctly attributes revenue and sales count per course", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 2999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: course2.id,
          pricePaid: 2999,
          country: "US",
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: course2.id,
          pricePaid: 2999,
          country: "IN",
        })
        .run();

      const breakdown = getPerCourseBreakdown(base.instructor.id, "all");

      expect(breakdown).toHaveLength(2);

      const course1Data = breakdown.find((c) => c.courseId === base.course.id)!;
      const course2Data = breakdown.find((c) => c.courseId === course2.id)!;

      expect(course1Data.revenue).toBe(4999);
      expect(course1Data.salesCount).toBe(1);
      expect(course2Data.revenue).toBe(5998);
      expect(course2Data.salesCount).toBe(2);
    });

    it("includes list price from the course", () => {
      testDb
        .update(schema.courses)
        .set({ price: 4999 })
        .where(eq(schema.courses.id, base.course.id))
        .run();

      const breakdown = getPerCourseBreakdown(base.instructor.id, "all");
      expect(breakdown[0].listPrice).toBe(4999);
    });

    it("correctly attributes enrollments per course", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
        })
        .run();

      const breakdown = getPerCourseBreakdown(base.instructor.id, "all");
      expect(breakdown[0].enrollmentCount).toBe(2);
    });

    it("correctly attributes ratings per course", () => {
      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          rating: 5,
        })
        .run();

      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          rating: 3,
        })
        .run();

      const breakdown = getPerCourseBreakdown(base.instructor.id, "all");
      expect(breakdown[0].averageRating).toBe(4);
      expect(breakdown[0].ratingCount).toBe(2);
    });

    it("respects time period filtering", () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: fiveDaysAgo.toISOString(),
        })
        .run();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          pricePaid: 2500,
          country: "IN",
          createdAt: fifteenDaysAgo.toISOString(),
        })
        .run();

      const breakdown7d = getPerCourseBreakdown(base.instructor.id, "7d");
      expect(breakdown7d[0].revenue).toBe(4999);
      expect(breakdown7d[0].salesCount).toBe(1);

      const breakdownAll = getPerCourseBreakdown(base.instructor.id, "all");
      expect(breakdownAll[0].revenue).toBe(7499);
      expect(breakdownAll[0].salesCount).toBe(2);
    });

    it("only includes courses owned by the instructor", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();

      testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .run();

      const breakdown = getPerCourseBreakdown(base.instructor.id, "all");
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].courseId).toBe(base.course.id);
    });
  });
});
