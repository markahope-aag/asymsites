import { getHealthStatus } from '@/lib/auditor/scoring';

interface HealthBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export function HealthBadge({ score, size = 'md' }: HealthBadgeProps) {
  if (score === null) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        No audit
      </span>
    );
  }

  const status = getHealthStatus(score);
  const colorClasses = {
    healthy: 'bg-green-100 text-green-800',
    attention: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colorClasses[status]} ${sizeClasses[size]}`}
    >
      {score}
    </span>
  );
}
