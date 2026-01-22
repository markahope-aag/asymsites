import { createServerClient } from '@/lib/supabase/server';
import { SiteCard } from '@/components/site-card';
import { AuditButton } from '@/components/audit-button';
import { SiteDashboard } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = createServerClient();

  const { data: sites } = await supabase
    .from('site_dashboard')
    .select('*')
    .not('domain', 'ilike', '%stg%')
    .not('domain', 'ilike', '%dev%')
    .not('domain', 'ilike', '%.wpenginepowered.com')
    .not('domain', 'ilike', '%.wpengine.com')
    .order('name');

  const healthyCt = sites?.filter((s) => (s.latest_health_score ?? 0) >= 90).length || 0;
  const attentionCt = sites?.filter(
    (s) => (s.latest_health_score ?? 0) >= 70 && (s.latest_health_score ?? 0) < 90
  ).length || 0;
  const criticalCt = sites?.filter((s) => (s.latest_health_score ?? 0) < 70 && s.latest_health_score !== null).length || 0;
  const noAuditCt = sites?.filter((s) => s.latest_health_score === null).length || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">AsymSites Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Monitoring {sites?.length || 0} WordPress sites
          </p>
        </div>
        <AuditButton />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{healthyCt}</div>
          <div className="text-sm text-green-600">Healthy</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">{attentionCt}</div>
          <div className="text-sm text-yellow-600">Need Attention</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-700">{criticalCt}</div>
          <div className="text-sm text-red-600">Critical</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700">{noAuditCt}</div>
          <div className="text-sm text-gray-600">Not Audited</div>
        </div>
      </div>

      {/* Site grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(sites as SiteDashboard[])?.map((site) => (
          <SiteCard key={site.id} site={site} />
        ))}
      </div>

      {(!sites || sites.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          <p>No sites configured yet.</p>
          <p className="text-sm mt-2">Add sites to get started.</p>
        </div>
      )}
    </div>
  );
}
