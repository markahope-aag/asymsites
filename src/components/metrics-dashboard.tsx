'use client';

import { AuditRawData, PerformanceAuditData } from '@/lib/types';
import { SitePerformanceTrends } from '@/lib/utils/performance-trends';
import { SitePerformanceMetrics } from './site-performance-metrics';

interface MetricsDashboardProps {
  auditData: AuditRawData | null;
  trends?: SitePerformanceTrends | null;
  lastUpdated?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
}

function MetricCard({ title, value, subtitle, trend, trendValue, color = 'blue' }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    neutral: '→',
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-sm font-medium opacity-75">{title}</h3>
          <div className="text-2xl font-bold mt-1">{value}</div>
          {subtitle && (
            <p className="text-xs opacity-60 mt-1">{subtitle}</p>
          )}
        </div>
        {trend && (
          <div className="flex flex-col items-end">
            <span className="text-lg">{trendIcons[trend]}</span>
            {trendValue && (
              <span className={`text-xs font-medium ${trendColors[trend]}`}>
                {trendValue}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CloudflareMetrics({ 
  data, 
  trends 
}: { 
  data?: PerformanceAuditData['cloudflare']; 
  trends?: SitePerformanceTrends['cloudflare'];
}) {
  if (!data) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">☁️ Cloudflare Analytics</h2>
        <p className="text-gray-500">No Cloudflare analytics data available</p>
      </div>
    );
  }

  // Check if there's any meaningful traffic data
  const hasTrafficData = data.requests_24h > 0 || data.bandwidth_mb > 0;
  
  if (!hasTrafficData) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">☁️ Cloudflare Analytics</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">No Recent Traffic</h3>
              <p className="text-sm text-blue-700 mt-1">
                No traffic data available for the last 24 hours. This could mean the site has very low traffic or Cloudflare analytics may need time to populate.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const threatRate = data.requests_24h > 0 ? (data.threats_24h / data.requests_24h) * 100 : 0;
  const sslRate = data.requests_24h > 0 ? (data.ssl_encrypted_requests / data.requests_24h) * 100 : 0;
  const botRate = data.requests_24h > 0 ? (data.bot_requests / data.requests_24h) * 100 : 0;

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">☁️ Backend Performance & Security</h2>
      
      {/* Performance & Caching */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">⚡ Performance & Caching (24h)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="CDN Cache Hit Ratio"
            value={`${Math.round(data.cache_hit_ratio * 100)}%`}
            subtitle="Origin server load reduction"
            color={data.cache_hit_ratio > 0.8 ? 'green' : data.cache_hit_ratio > 0.6 ? 'yellow' : 'red'}
            trend={trends?.cache_hit_ratio?.trend}
            trendValue={trends?.cache_hit_ratio ? `${trends.cache_hit_ratio.changePercent > 0 ? '+' : ''}${trends.cache_hit_ratio.changePercent.toFixed(1)}%` : undefined}
          />
          <MetricCard
            title="Bandwidth Saved"
            value={`${Math.round(data.bandwidth_saved_mb)}MB`}
            subtitle={`Total: ${Math.round(data.bandwidth_mb)}MB`}
            color="blue"
          />
          <MetricCard
            title="SSL Encryption"
            value={`${Math.round(sslRate)}%`}
            subtitle="Secure connections"
            color={sslRate > 95 ? 'green' : sslRate > 90 ? 'yellow' : 'red'}
          />
        </div>
      </div>

      {/* Security & Error Monitoring */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">🛡️ Security & Error Monitoring (24h)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Threats Blocked"
            value={data.threats_24h.toLocaleString()}
            subtitle={`${Math.round(threatRate)}% of requests`}
            color={threatRate > 10 ? 'red' : threatRate > 5 ? 'yellow' : 'green'}
            trend={trends?.threats_24h?.trend}
            trendValue={trends?.threats_24h ? `${trends.threats_24h.changePercent > 0 ? '+' : ''}${trends.threats_24h.changePercent.toFixed(1)}%` : undefined}
          />
          <MetricCard
            title="Bot Requests"
            value={data.bot_requests.toLocaleString()}
            subtitle={`${Math.round(botRate)}% bot traffic`}
            color={botRate > 50 ? 'red' : botRate > 30 ? 'yellow' : 'green'}
          />
          <MetricCard
            title="5xx Server Errors"
            value={data.status_5xx_24h.toLocaleString()}
            subtitle="Backend failures"
            color={data.status_5xx_24h > 100 ? 'red' : data.status_5xx_24h > 10 ? 'yellow' : 'green'}
          />
          <MetricCard
            title="4xx Client Errors"
            value={data.status_4xx_24h.toLocaleString()}
            subtitle="Missing pages/resources"
            color={data.status_4xx_24h > data.requests_24h * 0.1 ? 'red' : data.status_4xx_24h > data.requests_24h * 0.05 ? 'yellow' : 'green'}
          />
        </div>
      </div>

      {/* Request Volume Context */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Total Requests (24h): <strong>{data.requests_24h.toLocaleString()}</strong></span>
          <span>Error Rate: <strong>{Math.round(((data.status_4xx_24h + data.status_5xx_24h) / Math.max(data.requests_24h, 1)) * 100)}%</strong></span>
        </div>
      </div>
    </div>
  );
}

function DatabaseMetrics({ data }: { data: AuditRawData['database'] }) {
  if (!data) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">🗄️ Database Performance & Bloat</h2>
        <p className="text-gray-500">No database metrics available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🗄️ Database Performance & Bloat</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Database Size"
          value={`${data.total_size_mb}MB`}
          subtitle="Total database size"
          color={data.total_size_mb > 1000 ? 'red' : data.total_size_mb > 500 ? 'yellow' : 'green'}
        />
        <MetricCard
          title="Autoload Size"
          value={`${Math.round(data.autoload_size_kb)}KB`}
          subtitle="Auto-loaded options"
          color={data.autoload_size_kb > 1500 ? 'red' : data.autoload_size_kb > 800 ? 'yellow' : 'green'}
        />
        <MetricCard
          title="Post Revisions"
          value={data.revision_count.toLocaleString()}
          subtitle="Old post versions"
          color={data.revision_count > 2000 ? 'red' : data.revision_count > 500 ? 'yellow' : 'green'}
        />
        <MetricCard
          title="Transients"
          value={data.transient_count.toLocaleString()}
          subtitle="Cached data entries"
          color={data.transient_count > 1000 ? 'red' : data.transient_count > 300 ? 'yellow' : 'green'}
        />
      </div>
    </div>
  );
}

function PluginMetrics({ data }: { data: AuditRawData['plugins'] }) {
  if (!data) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">🔌 Plugin Overview</h2>
        <p className="text-gray-500">No plugin data available</p>
      </div>
    );
  }

  // Calculate must-use and drop-in counts from the plugins array
  const mustUseCount = data.plugins?.filter(p => p.status === 'must-use').length || 0;
  const dropinCount = data.plugins?.filter(p => p.status === 'dropin').length || 0;

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🔌 Plugin Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Plugins"
          value={data.total}
          subtitle={`${data.active} active + ${data.inactive} inactive + ${mustUseCount} must-use + ${dropinCount} drop-ins`}
          color="blue"
        />
        <MetricCard
          title="Active Plugins"
          value={data.active}
          subtitle="User-enabled plugins"
          color="green"
        />
        <MetricCard
          title="Inactive Plugins"
          value={data.inactive}
          subtitle="Disabled plugins"
          color={data.inactive > 8 ? 'red' : data.inactive > 3 ? 'yellow' : 'green'}
        />
        <MetricCard
          title="Updates Available"
          value={data.needs_update}
          subtitle="Outdated plugins"
          color={data.needs_update > 10 ? 'red' : data.needs_update > 5 ? 'yellow' : 'green'}
        />
      </div>
    </div>
  );
}

export function MetricsDashboard({ auditData, trends, lastUpdated }: MetricsDashboardProps) {
  if (!auditData) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">📊 Performance Metrics</h2>
        <p className="text-gray-500">No audit data available. Run an audit to see performance metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">📊 Performance Metrics</h2>
        {lastUpdated && (
          <p className="text-sm text-gray-500">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      {/* Site Performance & Speed */}
      <SitePerformanceMetrics data={auditData.crawl} />

      {/* Cloudflare Analytics */}
      <CloudflareMetrics data={auditData.performance?.cloudflare} trends={trends?.cloudflare} />

      {/* Database Health */}
      <DatabaseMetrics data={auditData.database} />

      {/* Plugin Overview */}
      <PluginMetrics data={auditData.plugins} />
    </div>
  );
}