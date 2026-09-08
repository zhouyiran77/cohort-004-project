import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "~/db";
import { notifications, NotificationType } from "~/db/schema";

// ─── Notification Service ───
// Handles in-app notifications for instructors with read/unread state management.

export function createNotification(
  recipientUserId: number,
  type: NotificationType,
  title: string,
  message: string,
  linkUrl: string
) {
  return db
    .insert(notifications)
    .values({
      recipientUserId,
      type,
      title,
      message,
      linkUrl,
      isRead: false,
    })
    .returning()
    .get();
}

export function getNotifications(
  userId: number,
  limit: number,
  offset: number
) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
}

export function getUnreadCount(userId: number) {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.isRead, false)
      )
    )
    .get();

  return result?.count ?? 0;
}

export function markAsRead(notificationId: number) {
  return db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId))
    .returning()
    .get();
}

export function markAllAsRead(userId: number) {
  return db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.recipientUserId, userId))
    .run();
}
