import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

function StarIcon({
  filled,
  half,
  className,
}: {
  filled: boolean;
  half?: boolean;
  className?: string;
}) {
  if (half) {
    return (
      <span className={cn("relative inline-block", className)}>
        <Star className="size-full text-muted-foreground/30" />
        <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
          <Star className="size-full fill-amber-400 text-amber-400" />
        </span>
      </span>
    );
  }

  return (
    <Star
      className={cn(
        "size-full",
        filled
          ? "fill-amber-400 text-amber-400"
          : "text-muted-foreground/30",
        className
      )}
    />
  );
}

export function StarRatingDisplay({
  average,
  count,
  size = "sm",
}: {
  average: number;
  count: number;
  size?: "sm" | "md";
}) {
  if (count === 0) return null;

  const starSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const starValue = i + 1;
          const filled = average >= starValue;
          const half = !filled && average >= starValue - 0.5;
          return (
            <span key={i} className={starSize}>
              <StarIcon filled={filled} half={half} />
            </span>
          );
        })}
      </span>
      <span className={cn(
        "text-muted-foreground",
        size === "sm" ? "text-xs" : "text-sm"
      )}>
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || value || 0;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            className="size-7 cursor-pointer disabled:cursor-default disabled:opacity-50"
            onMouseEnter={() => !disabled && setHoverValue(starValue)}
            onMouseLeave={() => setHoverValue(0)}
            onClick={() => !disabled && onChange(starValue)}
            aria-label={`Rate ${starValue} star${starValue > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                "size-full transition-colors",
                displayValue >= starValue
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30 hover:text-amber-300"
              )}
            />
          </button>
        );
      })}
      {value ? (
        <span className="ml-1 text-sm text-muted-foreground">
          {value}/5
        </span>
      ) : (
        <span className="ml-1 text-sm text-muted-foreground">
          Rate this course
        </span>
      )}
    </div>
  );
}
