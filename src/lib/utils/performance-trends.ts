import { createServerClient } from '@/lib/supabase/server';
import { CloudflareMetrics, DatabaseMetrics, PluginMetrics } from '@/lib/types';

export interface PerformanceTrend {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface SitePerformanceTrends {
  cloudflare?: {
    requests_24h: PerformanceTrend;
    cache_hit_ratio: PerformanceTrend;
    threats_24h: PerformanceTrend;
  };
  database?: {
    total_size_mb: PerformanceTrend;
    autoload_size_kb: PerformanceTrend;
  };
  crawl?: {
    avg_response_time_ms: PerformanceTrend;
    error_rate_percent: PerformanceTrend;
    slow_pages_count: PerformanceTrend;
  };
}

function calculateTrend(current: number, previous: number): PerformanceTrend {
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
  
  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (Math.abs(changePercent) > 5) { // 5% threshold for significant change
    trend = change > 0 ? 'up' : 'down';
  }

  return {
    current,
    previous,
    change,
    changePercent,
    trend,
  };
}

/**
 * Get performance trends for a site by comparing latest metrics with previous period
 */
export async function getSitePerformanceTrends(siteId: string): Promise<SitePerformanceTrends> {
  const supabase = createServerClient();
  const trends: SitePerformanceTrends = {};


  // Get Cloudflare trends
  const { data: cfMetrics } = await supabase
    .from('cloudflare_metrics')
    .select('*')
    .eq('site_id', siteId)
    .order('recorded_at', { ascending: false })
    .limit(2);

  if (cfMetrics && cfMetrics.length >= 2) {
    const [current, previous] = cfMetrics as CloudflareMetrics[];
    trends.cloudflare = {
      requests_24h: calculateTrend(current.requests_24h, previous.requests_24h),
      cache_hit_ratio: calculateTrend(current.cache_hit_ratio, previous.cache_hit_ratio),
      threats_24h: calculateTrend(current.threats_24h, previous.threats_24h),
    };
  }

  // Get Database trends
  const { data: dbMetrics } = await supabase
    .from('database_metrics')
    .select('*')
    .eq('site_id', siteId)
    .order('recorded_at', { ascending: false })
    .limit(2);

  if (dbMetrics && dbMetrics.length >= 2) {
    const [current, previous] = dbMetrics as DatabaseMetrics[];
    trends.database = {
      total_size_mb: calculateTrend(current.total_size_mb, previous.total_size_mb),
      autoload_size_kb: calculateTrend(current.autoload_size_kb, previous.autoload_size_kb),
    };
  }

  return trends;
}

/**
 * Get historical performance data for charting
 */
export async function getSitePerformanceHistory(
  siteId: string, 
  days: number = 30
): Promise<{
  cloudflare: CloudflareMetrics[];
  database: DatabaseMetrics[];
  plugin: PluginMetrics[];
}> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [cfResult, dbResult, pluginResult] = await Promise.all([
    
    supabase
      .from('cloudflare_metrics')
      .select('*')
      .eq('site_id', siteId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true }),
    
    supabase
      .from('database_metrics')
      .select('*')
      .eq('site_id', siteId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true }),
    
    supabase
      .from('plugin_metrics')
      .select('*')
      .eq('site_id', siteId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true }),
  ]);

  return {
    cloudflare: (cfResult.data as CloudflareMetrics[]) || [],
    database: (dbResult.data as DatabaseMetrics[]) || [],
    plugin: (pluginResult.data as PluginMetrics[]) || [],
  };
}

/**
 * Get aggregated performance stats across all sites
 */
export async function getGlobalPerformanceStats(): Promise<{
  avgCloudflareCache: number;
  avgLatency: number;
  totalThreats: number;
  sitesWithIssues: number;
}> {
  const supabase = createServerClient();

  // Get latest metrics for all sites
  const [cfResult] = await Promise.all([
    supabase.from('latest_cloudflare_metrics').select('cache_hit_ratio, threats_24h'),
  ]);

  const cfMetrics = cfResult.data as Pick<CloudflareMetrics, 'cache_hit_ratio' | 'threats_24h'>[] || [];

  const avgCloudflareCache = cfMetrics.length > 0 
    ? cfMetrics.reduce((sum, m) => sum + m.cache_hit_ratio, 0) / cfMetrics.length 
    : 0;

  const totalThreats = cfMetrics.reduce((sum, m) => sum + m.threats_24h, 0);

  return {
    avgCloudflareCache,
    avgLatency: 0, // TODO: Implement when we have latency data
    totalThreats,
    sitesWithIssues: 0, // TODO: Implement when we have issue detection
  };
}