type SkeletonProps = {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
};

export function Skeleton({ width, height = '1rem', radius = '4px', className = '' }: SkeletonProps) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height="0.85rem" />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <Skeleton width="2rem" height="2rem" radius="8px" />
        <Skeleton width="3rem" height="0.75rem" />
      </div>
      <Skeleton width="60%" height="0.75rem" className="mt-2" />
      <Skeleton width="3rem" height="2rem" radius="4px" className="mt-1" />
      <Skeleton width="80%" height="0.7rem" className="mt-1" />
    </div>
  );
}
