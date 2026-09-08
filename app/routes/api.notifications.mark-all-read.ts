import { data } from "react-router";
import { getCurrentUserId } from "~/lib/session";
import { markAllAsRead } from "~/services/notificationService";

export async function action({ request }: { request: Request }) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  markAllAsRead(currentUserId);

  return { success: true };
}
