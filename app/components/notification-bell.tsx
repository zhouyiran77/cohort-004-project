import { useFetcher, Link } from "react-router";
import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: number;
  recipientUserId: number;
  type: string;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

export function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const markAsReadFetcher = useFetcher();
  const markAllAsReadFetcher = useFetcher();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markAsReadFetcher.submit(
        { notificationId: notification.id },
        {
          method: "post",
          action: "/api/notifications/mark-read",
          encType: "application/json",
        }
      );
    }
    setIsOpen(false);
  }

  function handleMarkAllAsRead() {
    markAllAsReadFetcher.submit(
      {},
      {
        method: "post",
        action: "/api/notifications/mark-all-read",
      }
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        title="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-md border border-sidebar-border bg-sidebar shadow-lg">
          <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
            <h3 className="text-sm font-semibold text-sidebar-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-sidebar-foreground/50">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.linkUrl}
                  onClick={() => handleNotificationClick(notification)}
                  className={`block border-b border-sidebar-border px-4 py-3 transition-colors hover:bg-sidebar-accent ${
                    !notification.isRead ? "bg-sidebar-accent/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.isRead && (
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-sm text-sidebar-foreground/70">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-sidebar-foreground/50">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
