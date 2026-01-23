// Site Performance & Crawl Metrics Dashboard Component
import { CrawlAuditData } from '@/lib/types';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function MetricCard({ title, value, subtitle, color, trend, trendValue }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    neutral: '→',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-sm">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs opacity-75 mt-1">{subtitle}</p>
          )}
        </div>
        {trend && trendValue && (
          <div className="text-right">
            <span className="text-xs">{trendIcons[trend]}</span>
            <p className="text-xs font-medium">{trendValue}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SitePerformanceMetricsProps {
  data?: CrawlAuditData;
}

export function SitePerformanceMetrics({ data }: SitePerformanceMetricsProps) {
  if (!data) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">🚀 Site Performance & Speed</h2>
        <p className="text-gray-500">No crawl data available. Run an audit to see site performance metrics.</p>
      </div>
    );
  }

  // Check if crawl failed or has no data
  if (data.crawl_summary.total_pages === 0) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">🚀 Site Performance & Speed</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Crawl Unavailable</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Site crawl could not be completed. This may be due to authentication requirements, site accessibility issues, or temporary problems.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🚀 Site Performance & Speed</h2>
      
      {/* Crawl Summary */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">📊 Crawl Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Pages Crawled"
            value={data.crawl_summary.total_pages}
            subtitle="Total pages analyzed"
            color="blue"
          />
          <MetricCard
            title="Average Response Time"
            value={`${Math.round(data.crawl_summary.avg_response_time_ms)}ms`}
            subtitle="Server response speed"
            color={
              data.crawl_summary.avg_response_time_ms > 4000 ? 'red' :
              data.crawl_summary.avg_response_time_ms > 2000 ? 'yellow' : 'green'
            }
          />
          <MetricCard
            title="Error Rate"
            value={`${data.crawl_summary.error_rate_percent}%`}
            subtitle="4xx/5xx errors"
            color={
              data.crawl_summary.error_rate_percent > 10 ? 'red' :
              data.crawl_summary.error_rate_percent > 5 ? 'yellow' : 'green'
            }
          />
          <MetricCard
            title="Crawl Duration"
            value={`${Math.round(data.crawl_summary.crawl_duration_seconds)}s`}
            subtitle="Time to complete"
            color="gray"
          />
        </div>
      </div>

      {/* Backend Health */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">🛡️ Backend Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="Server Errors (5xx)"
            value={data.backend_health.server_errors_5xx}
            subtitle="Critical backend failures"
            color={data.backend_health.server_errors_5xx > 0 ? 'red' : 'green'}
          />
          <MetricCard
            title="Client Errors (4xx)"
            value={data.backend_health.client_errors_4xx}
            subtitle="Missing pages/resources"
            color={
              data.backend_health.client_errors_4xx > 10 ? 'red' :
              data.backend_health.client_errors_4xx > 5 ? 'yellow' : 'green'
            }
          />
          <MetricCard
            title="Slow Pages"
            value={data.backend_health.slow_pages_count}
            subtitle="Pages >3s response time"
            color={
              data.backend_health.slow_pages_count > 8 ? 'red' :
              data.backend_health.slow_pages_count > 3 ? 'yellow' : 'green'
            }
          />
        </div>
      </div>

      {/* Infrastructure Issues */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-3">🔗 Infrastructure Issues</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="Broken Links"
            value={data.backend_health.broken_links_count}
            subtitle="Internal/external links"
            color={
              data.backend_health.broken_links_count > 15 ? 'red' :
              data.backend_health.broken_links_count > 5 ? 'yellow' : 'green'
            }
          />
          <MetricCard
            title="Redirect Chains"
            value={data.backend_health.redirect_chains_count}
            subtitle="Performance impact"
            color={
              data.backend_health.redirect_chains_count > 5 ? 'yellow' : 'green'
            }
          />
          <MetricCard
            title="Large Pages"
            value={data.backend_health.large_pages_count}
            subtitle="Pages >1MB size"
            color={
              data.backend_health.large_pages_count > 3 ? 'yellow' : 'green'
            }
          />
        </div>
      </div>

      {/* Core Web Vitals (if available) */}
      {data.core_web_vitals && (
        <div className="mb-6">
          <h3 className="text-md font-medium mb-3">📈 Core Web Vitals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="LCP (Largest Contentful Paint)"
              value={`${(data.core_web_vitals.lcp_avg_ms / 1000).toFixed(1)}s`}
              subtitle="Loading performance"
              color={
                data.core_web_vitals.lcp_avg_ms > 4000 ? 'red' :
                data.core_web_vitals.lcp_avg_ms > 2500 ? 'yellow' : 'green'
              }
            />
            <MetricCard
              title="CLS (Cumulative Layout Shift)"
              value={data.core_web_vitals.cls_avg_score.toFixed(3)}
              subtitle="Visual stability"
              color={
                data.core_web_vitals.cls_avg_score > 0.25 ? 'red' :
                data.core_web_vitals.cls_avg_score > 0.1 ? 'yellow' : 'green'
              }
            />
            <MetricCard
              title="FID (First Input Delay)"
              value={`${data.core_web_vitals.fid_avg_ms}ms`}
              subtitle="Interactivity"
              color={
                data.core_web_vitals.fid_avg_ms > 300 ? 'red' :
                data.core_web_vitals.fid_avg_ms > 100 ? 'yellow' : 'green'
              }
            />
            <MetricCard
              title="CWV Pass Rate"
              value={`${Math.round(data.core_web_vitals.cwv_pass_rate_percent)}%`}
              subtitle="Pages passing all CWV"
              color={
                data.core_web_vitals.cwv_pass_rate_percent < 50 ? 'red' :
                data.core_web_vitals.cwv_pass_rate_percent < 75 ? 'yellow' : 'green'
              }
            />
          </div>
        </div>
      )}

      {/* Performance Issues Summary */}
      {data.performance_issues.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">🚨 Critical Issues Found</h4>
          <div className="space-y-1">
            {data.performance_issues.slice(0, 5).map((issue, index) => (
              <div key={index} className="text-sm">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  issue.severity === 'critical' ? 'bg-red-500' :
                  issue.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                }`}></span>
                <span className="font-medium">{issue.type.replace('_', ' ')}</span>: {issue.details}
              </div>
            ))}
            {data.performance_issues.length > 5 && (
              <p className="text-xs text-gray-600 mt-2">
                +{data.performance_issues.length - 5} more issues found
              </p>
            )}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-4 text-xs text-gray-500">
        Last crawled: {new Date(data.crawl_summary.crawl_completed_at).toLocaleString()}
      </div>
    </div>
  );
}