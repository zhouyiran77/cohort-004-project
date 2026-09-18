import { Link, data, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getAnalyticsSummary,
  getRevenueTimeSeries,
  getPerCourseBreakdown,
  type TimePeriod,
} from "~/services/analyticsService";
import { AnalyticsDashboard } from "~/components/analytics-dashboard";
import { AlertTriangle } from "lucide-react";
import { z } from "zod";

const periodSchema = z.enum(["7d", "30d", "12m", "all"]).catch("30d");

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "View your revenue analytics" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Instructor) {
    throw data("Only instructors can access this page.", {
      status: 403,
    });
  }

  const url = new URL(request.url);
  const period = periodSchema.parse(
    url.searchParams.get("period")
  ) as TimePeriod;

  const summary = getAnalyticsSummary(currentUserId, period);
  const timeSeries = getRevenueTimeSeries(currentUserId, period);
  const courseBreakdown = getPerCourseBreakdown(currentUserId, period);

  return { summary, timeSeries, courseBreakdown, period };
}

export default function InstructorAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const { summary, timeSeries, courseBreakdown, period } = loaderData;

  return (
    <AnalyticsDashboard
      summary={summary}
      timeSeries={timeSeries}
      courseBreakdown={courseBreakdown}
      period={period}
      breadcrumbs={[
        { label: "Home", to: "/" },
        { label: "My Courses", to: "/instructor" },
        { label: "Analytics" },
      ]}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/courses">
            <button className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              Browse Courses
            </button>
          </Link>
          <Link to="/">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Go Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
