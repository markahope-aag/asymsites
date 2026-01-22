import Link from 'next/link';
import { HealthBadge } from './health-badge';
import { SiteDashboard } from '@/lib/types';

interface SiteCardProps {
  site: SiteDashboard;
}

export function SiteCard({ site }: SiteCardProps) {
  const lastAuditDate = site.latest_audit_at
    ? new Date(site.latest_audit_at).toLocaleDateString()
    : 'Never';

  return (
    <Link href={`/sites/${site.id}`}>
      <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-lg">{site.name}</h3>
            <p className="text-sm text-gray-500">{site.domain}</p>
          </div>
          <HealthBadge score={site.latest_health_score} />
        </div>

        <div className="mt-4 flex justify-between text-sm text-gray-600">
          <span>
            {site.open_issues_count} open issues
            {site.critical_issues_count > 0 && (
              <span className="text-red-600 ml-1">
                ({site.critical_issues_count} critical)
              </span>
            )}
          </span>
          <span>Last audit: {lastAuditDate}</span>
        </div>

        {site.client_name && (
          <div className="mt-2 text-xs text-gray-400">{site.client_name}</div>
        )}
      </div>
    </Link>
  );
}
