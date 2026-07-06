interface CustomerNameWithBadgeProps {
  name: string;
  badge?: string;
  className?: string;
}

export function CustomerNameWithBadge({
  name,
  badge,
  className = "",
}: CustomerNameWithBadgeProps) {
  return (
    <span className={className}>
      {name}
      {badge ? (
        <span className="ml-1" aria-hidden>
          {badge}
        </span>
      ) : null}
    </span>
  );
}
