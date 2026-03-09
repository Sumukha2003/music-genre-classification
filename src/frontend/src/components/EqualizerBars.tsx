interface EqualizerBarsProps {
  count?: number;
  className?: string;
  animated?: boolean;
}

export default function EqualizerBars({
  count = 12,
  className = "",
  animated = true,
}: EqualizerBarsProps) {
  const heights = [40, 65, 80, 55, 90, 70, 45, 85, 60, 75, 50, 95];
  const barKeys = Array.from({ length: count }, (_, i) => `bar-${i}`);

  return (
    <div className={`flex items-end gap-0.5 ${className}`} aria-hidden="true">
      {barKeys.map((key, i) => (
        <div
          key={key}
          className={[
            "w-1 rounded-t-sm",
            animated ? `eq-bar-${(i % 5) + 1}` : "",
            i % 3 === 0
              ? "bg-amber-500"
              : i % 3 === 1
                ? "bg-amber-500/60"
                : "bg-amber-500/30",
          ].join(" ")}
          style={{ height: `${heights[i % heights.length]}%` }}
        />
      ))}
    </div>
  );
}
