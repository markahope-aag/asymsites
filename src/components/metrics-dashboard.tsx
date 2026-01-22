'use client';

import { AuditRawData } from '@/lib/types';
import { SitePerformanceTrends } from '@/lib/utils/performance-trends';

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

function WPEngineMetrics({ 
  data, 
  trends 
}: { 
  data: AuditRawData['wpengine']; 
  trends?: SitePerformanceTrends['wpengine'];
}) {
  if (!data) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">🏗️ WPEngine Performance</h2>
        <p className="text-gray-500">No WPEngine performance data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🏗️ WPEngine Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Server Cache Hit Ratio"
          value={`${Math.round(data.cache_hit_ratio * 100)}%`}
          subtitle="Server-side caching efficiency"
          color={data.cache_hit_ratio > 0.7 ? 'green' : data.cache_hit_ratio > 0.5 ? 'yellow' : 'red'}
          trend={trends?.cache_hit_ratio?.trend}
          trendValue={trends?.cache_hit_ratio ? `${trends.cache_hit_ratio.changePercent > 0 ? '+' : ''}${trends.cache_hit_ratio.changePercent.toFixed(1)}%` : undefined}
        />
        <MetricCard
          title="Average Latency"
          value={`${data.average_latency_ms}ms`}
          subtitle="Server response time"
          color={data.average_latency_ms < 1000 ? 'green' : data.average_latency_ms < 2000 ? 'yellow' : 'red'}
          trend={trends?.average_latency_ms?.trend}
          trendValue={trends?.average_latency_ms ? `${trends.average_latency_ms.changePercent > 0 ? '+' : ''}${trends.average_latency_ms.changePercent.toFixed(1)}%` : undefined}
        />
        <MetricCard
          title="Error Rate"
          value={`${Math.round(data.error_rate * 100)}%`}
          subtitle="Server error percentage"
          color={data.error_rate < 0.02 ? 'green' : data.error_rate < 0.05 ? 'yellow' : 'red'}
          trend={trends?.error_rate?.trend}
          trendValue={trends?.error_rate ? `${trends.error_rate.changePercent > 0 ? '+' : ''}${trends.error_rate.changePercent.toFixed(1)}%` : undefined}
        />
        <MetricCard
          title="Peak Hour Requests"
          value={data.page_requests_peak_hour.toLocaleString()}
          subtitle="Busiest hour traffic"
          color="blue"
        />
        <MetricCard
          title="Slow Pages"
          value={data.slow_pages_count}
          subtitle="Pages loading slowly"
          color={data.slow_pages_count === 0 ? 'green' : data.slow_pages_count < 5 ? 'yellow' : 'red'}
        />
      </div>
    </div>
  );
}

function CloudflareMetrics({ 
  data, 
  trends 
}: { 
  data: AuditRawData['cloudflare']; 
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

  const threatRate = data.requests_24h > 0 ? (data.threats_24h / data.requests_24h) * 100 : 0;
  const sslRate = data.requests_24h > 0 ? (data.ssl_encrypted_requests / data.requests_24h) * 100 : 0;
  const botRate = data.requests_24h > 0 ? (data.bot_requests / data.requests_24h) * 100 : 0;

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">☁️ Cloudflare Analytics</h2>
      
      {/* Traffic & Performance */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">📊 Traffic & Performance (24h)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Requests"
            value={data.requests_24h.toLocaleString()}
            subtitle="24-hour traffic"
            color="blue"
            trend={trends?.requests_24h?.trend}
            trendValue={trends?.requests_24h ? `${trends.requests_24h.changePercent > 0 ? '+' : ''}${trends.requests_24h.changePercent.toFixed(1)}%` : undefined}
          />
          <MetricCard
            title="CDN Cache Hit Ratio"
            value={`${Math.round(data.cache_hit_ratio * 100)}%`}
            subtitle="Edge cache efficiency"
            color={data.cache_hit_ratio > 0.8 ? 'green' : data.cache_hit_ratio > 0.6 ? 'yellow' : 'red'}
            trend={trends?.cache_hit_ratio?.trend}
            trendValue={trends?.cache_hit_ratio ? `${trends.cache_hit_ratio.changePercent > 0 ? '+' : ''}${trends.cache_hit_ratio.changePercent.toFixed(1)}%` : undefined}
          />
          <MetricCard
            title="Bandwidth"
            value={`${Math.round(data.bandwidth_mb)}MB`}
            subtitle={`Saved: ${Math.round(data.bandwidth_saved_mb)}MB`}
            color="blue"
          />
          <MetricCard
            title="SSL Encryption"
            value={`${Math.round(sslRate)}%`}
            subtitle="HTTPS traffic"
            color={sslRate > 95 ? 'green' : sslRate > 90 ? 'yellow' : 'red'}
          />
        </div>
      </div>

      {/* Security */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">🛡️ Security & Threats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="Threats Blocked"
            value={data.threats_24h.toLocaleString()}
            subtitle={`${threatRate.toFixed(2)}% of traffic`}
            color={threatRate > 1 ? 'red' : threatRate > 0.1 ? 'yellow' : 'green'}
            trend={trends?.threats_24h?.trend}
            trendValue={trends?.threats_24h ? `${trends.threats_24h.changePercent > 0 ? '+' : ''}${trends.threats_24h.changePercent.toFixed(1)}%` : undefined}
          />
          <MetricCard
            title="Server Errors (5xx)"
            value={data.status_5xx_24h}
            subtitle="Critical errors"
            color={data.status_5xx_24h > 50 ? 'red' : data.status_5xx_24h > 10 ? 'yellow' : 'green'}
          />
          <MetricCard
            title="Client Errors (4xx)"
            value={data.status_4xx_24h}
            subtitle="Missing resources"
            color={data.status_4xx_24h > data.requests_24h * 0.05 ? 'yellow' : 'green'}
          />
        </div>
      </div>

      {/* Bot Analytics */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">🤖 Bot Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Bot Requests"
            value={data.bot_requests.toLocaleString()}
            subtitle={`${botRate.toFixed(1)}% of traffic`}
            color={botRate > 30 ? 'red' : botRate > 10 ? 'yellow' : 'green'}
          />
          <MetricCard
            title="Average Bot Score"
            value={Math.round(data.bot_score_avg)}
            subtitle="Higher = more human-like"
            color={data.bot_score_avg > 70 ? 'green' : data.bot_score_avg > 30 ? 'yellow' : 'red'}
          />
        </div>
      </div>

      {/* Geographic */}
      {data.countries_top && data.countries_top.length > 0 && (
        <div>
          <h3 className="text-md font-medium mb-3">🌍 Geographic Distribution</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="space-y-2">
              {data.countries_top.slice(0, 5).map((country, index) => {
                const percentage = data.requests_24h > 0 ? (country.requests / data.requests_24h) * 100 : 0;
                return (
                  <div key={country.country} className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      #{index + 1} {country.country}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {country.requests.toLocaleString()} ({percentage.toFixed(1)}%)
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DatabaseMetrics({ data }: { data: AuditRawData['database'] }) {
  if (!data) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">🗄️ Database Health</h2>
        <p className="text-gray-500">No database metrics available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🗄️ Database Health</h2>
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

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🔌 Plugin Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Plugins"
          value={data.total}
          subtitle="Installed plugins"
          color="blue"
        />
        <MetricCard
          title="Active Plugins"
          value={data.active}
          subtitle="Currently enabled"
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

      {/* WPEngine Performance */}
      <WPEngineMetrics data={auditData.wpengine} trends={trends?.wpengine} />

      {/* Cloudflare Analytics */}
      <CloudflareMetrics data={auditData.cloudflare} trends={trends?.cloudflare} />

      {/* Database Health */}
      <DatabaseMetrics data={auditData.database} />

      {/* Plugin Overview */}
      <PluginMetrics data={auditData.plugins} />
    </div>
  );
}