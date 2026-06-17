import { sportEmoji } from "@/lib/sport-emoji";

type SportBadgeProps = {
  sport: string;
  showLabel?: boolean;
  className?: string;
};

export function SportBadge({ sport, showLabel = false, className = "" }: SportBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={sport}>
      <span aria-hidden className="text-base leading-none">
        {sportEmoji(sport)}
      </span>
      {showLabel && <span>{sport}</span>}
    </span>
  );
}
