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

import { getAnalyticsSummary } from "./analyticsService";

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
});
