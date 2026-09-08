import { data } from "react-router";
import { z } from "zod";
import { getCurrentUserId } from "~/lib/session";
import { parseJsonBody } from "~/lib/validation";
import { markAsRead } from "~/services/notificationService";
import { db } from "~/db";
import { notifications } from "~/db/schema";
import { eq } from "drizzle-orm";

const markAsReadSchema = z.object({
  notificationId: z.number(),
});

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, markAsReadSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { notificationId } = parsed.data;

  // Verify notification belongs to current user
  const notification = db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .get();

  if (!notification) {
    throw data("Notification not found", { status: 404 });
  }

  if (notification.recipientUserId !== currentUserId) {
    throw data("You do not have permission to modify this notification", {
      status: 403,
    });
  }

  const updated = markAsRead(notificationId);

  return { success: true, notification: updated };
}
