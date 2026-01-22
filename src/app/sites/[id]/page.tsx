import { createServerClient } from '@/lib/supabase/server';
import { HealthBadge } from '@/components/health-badge';
import { IssueList } from '@/components/issue-list';
import { AuditButton } from '@/components/audit-button';
import { ActionButton } from '@/components/action-button';
import { Issue } from '@/lib/types';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SiteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createServerClient();

  // Get site details
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .single();

  if (!site) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Site not found</h1>
        <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  // Get latest audit
  const { data: latestAudit } = await supabase
    .from('audits')
    .select('*')
    .eq('site_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get open issues
  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('site_id', id)
    .eq('status', 'open')
    .order('severity');

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">
        Back to dashboard
      </Link>

      {/* Site header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">{site.name}</h1>
            <HealthBadge score={latestAudit?.health_score ?? null} size="lg" />
          </div>
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {site.domain}
          </a>
          {site.client_name && (
            <p className="text-gray-500 mt-1">Client: {site.client_name}</p>
          )}
        </div>
        <AuditButton siteId={site.id} />
      </div>

      {/* Site info */}
      <div className="bg-white border rounded-lg p-4 mb-8">
        <h2 className="font-semibold mb-3">Site Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">WPEngine Install:</span>
            <div className="font-medium">{site.wpengine_install_id}</div>
          </div>
          <div>
            <span className="text-gray-500">Environment:</span>
            <div className="font-medium">{site.wpengine_environment}</div>
          </div>
          <div>
            <span className="text-gray-500">Page Builder:</span>
            <div className="font-medium">{site.page_builder || 'Unknown'}</div>
          </div>
          <div>
            <span className="text-gray-500">E-commerce:</span>
            <div className="font-medium">{site.is_ecommerce ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      {/* Last audit summary */}
      {latestAudit && (
        <div className="bg-white border rounded-lg p-4 mb-8">
          <h2 className="font-semibold mb-2">Latest Audit</h2>
          <p className="text-sm text-gray-600">{latestAudit.summary}</p>
          <p className="text-xs text-gray-400 mt-2">
            {new Date(latestAudit.completed_at || latestAudit.created_at).toLocaleString()}
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 mb-8">
        <ActionButton
          siteId={site.id}
          action="clear_all_cache"
          label="Clear All Cache"
        />
        <a
          href={`https://my.wpengine.com/installs/${site.wpengine_install_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          View in WPEngine
        </a>
        {site.cloudflare_zone_id && (
          <a
            href={`https://dash.cloudflare.com/?to=/:account/${site.cloudflare_zone_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            View in Cloudflare
          </a>
        )}
      </div>

      {/* Issues */}
      <div>
        <h2 className="font-semibold text-xl mb-4">
          Open Issues ({issues?.length || 0})
        </h2>
        <IssueList issues={(issues as Issue[]) || []} />
      </div>
    </div>
  );
}
