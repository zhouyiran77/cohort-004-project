import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { eq } from "drizzle-orm";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notificationService";

describe("notificationService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("createNotification", () => {
    it("creates a notification with all required fields", () => {
      const notification = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "New Enrollment",
        "Test User enrolled in Test Course",
        "/instructor/1/students"
      );

      expect(notification).toBeDefined();
      expect(notification.recipientUserId).toBe(base.instructor.id);
      expect(notification.type).toBe(schema.NotificationType.Enrollment);
      expect(notification.title).toBe("New Enrollment");
      expect(notification.message).toBe("Test User enrolled in Test Course");
      expect(notification.linkUrl).toBe("/instructor/1/students");
      expect(notification.isRead).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications ordered by creation time desc", () => {
      const n1 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "First",
        "First message",
        "/link1"
      );

      const n2 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "Second",
        "Second message",
        "/link2"
      );

      // Manually update createdAt to ensure ordering
      testDb
        .update(schema.notifications)
        .set({ createdAt: new Date(Date.now() + 1000).toISOString() })
        .where(eq(schema.notifications.id, n2.id))
        .run();

      const notifications = getNotifications(base.instructor.id, 10, 0);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toBe("Second");
      expect(notifications[1].title).toBe("First");
    });

    it("respects limit parameter", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N2",
        "M2",
        "/2"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N3",
        "M3",
        "/3"
      );

      const notifications = getNotifications(base.instructor.id, 2, 0);

      expect(notifications).toHaveLength(2);
    });

    it("respects offset parameter", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N2",
        "M2",
        "/2"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N3",
        "M3",
        "/3"
      );

      const notifications = getNotifications(base.instructor.id, 10, 1);

      expect(notifications).toHaveLength(2);
    });

    it("only returns notifications for the specified user", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "For instructor",
        "M1",
        "/1"
      );
      createNotification(
        base.user.id,
        schema.NotificationType.Enrollment,
        "For student",
        "M2",
        "/2"
      );

      const instructorNotifications = getNotifications(
        base.instructor.id,
        10,
        0
      );
      const studentNotifications = getNotifications(base.user.id, 10, 0);

      expect(instructorNotifications).toHaveLength(1);
      expect(instructorNotifications[0].title).toBe("For instructor");
      expect(studentNotifications).toHaveLength(1);
      expect(studentNotifications[0].title).toBe("For student");
    });
  });

  describe("getUnreadCount", () => {
    it("returns count of unread notifications", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N2",
        "M2",
        "/2"
      );
      const n3 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N3",
        "M3",
        "/3"
      );

      // Mark one as read
      markAsRead(n3.id);

      const count = getUnreadCount(base.instructor.id);

      expect(count).toBe(2);
    });

    it("returns 0 when all notifications are read", () => {
      const n1 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );
      const n2 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N2",
        "M2",
        "/2"
      );

      markAsRead(n1.id);
      markAsRead(n2.id);

      const count = getUnreadCount(base.instructor.id);

      expect(count).toBe(0);
    });

    it("returns 0 when user has no notifications", () => {
      const count = getUnreadCount(base.instructor.id);

      expect(count).toBe(0);
    });

    it("only counts notifications for the specified user", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );
      createNotification(
        base.user.id,
        schema.NotificationType.Enrollment,
        "N2",
        "M2",
        "/2"
      );

      const instructorCount = getUnreadCount(base.instructor.id);
      const userCount = getUnreadCount(base.user.id);

      expect(instructorCount).toBe(1);
      expect(userCount).toBe(1);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", () => {
      const notification = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );

      expect(notification.isRead).toBe(false);

      const updated = markAsRead(notification.id);

      expect(updated).toBeDefined();
      expect(updated!.isRead).toBe(true);
    });

    it("updates unread count after marking as read", () => {
      const n1 = createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );

      expect(getUnreadCount(base.instructor.id)).toBe(1);

      markAsRead(n1.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read for a user", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N2",
        "M2",
        "/2"
      );
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N3",
        "M3",
        "/3"
      );

      expect(getUnreadCount(base.instructor.id)).toBe(3);

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
    });

    it("only marks notifications for the specified user", () => {
      createNotification(
        base.instructor.id,
        schema.NotificationType.Enrollment,
        "N1",
        "M1",
        "/1"
      );
      createNotification(
        base.user.id,
        schema.NotificationType.Enrollment,
        "N2",
        "M2",
        "/2"
      );

      markAllAsRead(base.instructor.id);

      expect(getUnreadCount(base.instructor.id)).toBe(0);
      expect(getUnreadCount(base.user.id)).toBe(1);
    });
  });
});
