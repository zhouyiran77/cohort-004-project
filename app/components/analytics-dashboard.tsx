import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TrendingUp, Users, Star, ArrowUp, ArrowDown } from "lucide-react";
import { formatPrice } from "~/lib/utils";
import type {
  AnalyticsSummary,
  RevenueDataPoint,
  CourseBreakdown,
  TimePeriod,
} from "~/services/analyticsService";

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary;
  timeSeries: RevenueDataPoint[];
  courseBreakdown: CourseBreakdown[];
  period: TimePeriod;
  breadcrumbs?: { label: string; to?: string }[];
}

const PERIOD_OPTIONS = [
  { value: "7d" as const, label: "7 days" },
  { value: "30d" as const, label: "30 days" },
  { value: "12m" as const, label: "12 months" },
  { value: "all" as const, label: "All time" },
];

type SortKey = keyof Pick<
  CourseBreakdown,
  | "title"
  | "listPrice"
  | "revenue"
  | "salesCount"
  | "enrollmentCount"
  | "averageRating"
  | "ratingCount"
>;

type SortDir = "asc" | "desc";

function formatChartRevenue(cents: number): string {
  if (cents === 0) return "$0";
  if (cents >= 100_00) return `$${(cents / 100).toFixed(0)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function sortCourses(
  courses: CourseBreakdown[],
  key: SortKey,
  dir: SortDir
): CourseBreakdown[] {
  return [...courses].sort((a, b) => {
    let aVal = a[key];
    let bVal = b[key];
    if (aVal === null) aVal = -1;
    if (bVal === null) bVal = -1;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return dir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return dir === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline size-3" />
  ) : (
    <ArrowDown className="ml-1 inline size-3" />
  );
}

function SortableHeader({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th
      className={`cursor-pointer select-none px-0 py-3 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${className}`}
      onClick={() => onSort(key)}
    >
      {label}
      <SortIcon active={currentKey === key} dir={currentDir} />
    </th>
  );
}

function isEmpty(
  summary: AnalyticsSummary,
  timeSeries: RevenueDataPoint[],
  courseBreakdown: CourseBreakdown[]
) {
  const hasAnyData =
    summary.totalRevenue > 0 ||
    summary.totalEnrollments > 0 ||
    summary.ratingCount > 0;
  const hasTimeSeries = timeSeries.some((p) => p.revenue > 0);
  const hasCourseData = courseBreakdown.some(
    (c) => c.revenue > 0 || c.enrollmentCount > 0 || c.ratingCount > 0
  );
  return !hasAnyData && !hasTimeSeries && !hasCourseData;
}

export function AnalyticsDashboard({
  summary,
  timeSeries,
  courseBreakdown,
  period,
  breadcrumbs = [],
}: AnalyticsDashboardProps) {
  const [searchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedCourses = sortCourses(courseBreakdown, sortKey, sortDir);
  const showEmpty = isEmpty(summary, timeSeries, courseBreakdown);

  const chartData = timeSeries.map((p) => ({
    date: p.date,
    revenue: p.revenue,
  }));

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {breadcrumbs.length > 0 && (
        <nav className="mb-6 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-2">/</span>}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track revenue and course performance
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        {PERIOD_OPTIONS.map((option) => {
          const params = new URLSearchParams(searchParams);
          params.set("period", option.value);
          const isActive = period === option.value;
          return (
            <Link
              key={option.value}
              to={`?${params.toString()}`}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      {showEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">No revenue data yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish a course to start tracking analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Revenue
                </CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPrice(summary.totalRevenue)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Enrollments
                </CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.totalEnrollments}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Rating
                </CardTitle>
                <Star className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.averageRating !== null
                    ? summary.averageRating.toFixed(1)
                    : "—"}
                </div>
                {summary.ratingCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {summary.ratingCount}{" "}
                    {summary.ratingCount === 1 ? "rating" : "ratings"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Revenue Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tickFormatter={formatChartRevenue}
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatPrice(Number(value ?? 0)),
                          "Revenue",
                        ]}
                        labelFormatter={(label) => String(label)}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-course table */}
          {sortedCourses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Per-Course Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <SortableHeader
                          label="Course"
                          sortKey="title"
                          currentKey={sortKey}
                          currentDir={sortDir}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="List Price"
                          sortKey="listPrice"
                          currentKey={sortKey}
                          currentDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableHeader
                          label="Revenue"
                          sortKey="revenue"
                          currentKey={sortKey}
                          currentDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableHeader
                          label="Sales"
                          sortKey="salesCount"
                          currentKey={sortKey}
                          currentDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableHeader
                          label="Enrollments"
                          sortKey="enrollmentCount"
                          currentKey={sortKey}
                          currentDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableHeader
                          label="Avg Rating"
                          sortKey="averageRating"
                          currentKey={sortKey}
                          currentDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                        <SortableHeader
                          label="Ratings"
                          sortKey="ratingCount"
                          currentKey={sortKey}
                          currentDir={sortDir}
                          onSort={handleSort}
                          className="text-right"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCourses.map((course) => (
                        <tr
                          key={course.courseId}
                          className="border-b last:border-0"
                        >
                          <td className="py-3 pr-4 font-medium">
                            {course.title}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {formatPrice(course.listPrice)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {formatPrice(course.revenue)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {course.salesCount}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {course.enrollmentCount}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {course.averageRating !== null
                              ? course.averageRating.toFixed(1)
                              : "—"}
                          </td>
                          <td className="py-3 text-right">
                            {course.ratingCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
