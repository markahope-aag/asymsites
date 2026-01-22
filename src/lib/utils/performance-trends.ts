import { createServerClient } from '@/lib/supabase/server';
import { WPEngineMetrics, CloudflareMetrics, DatabaseMetrics, PluginMetrics } from '@/lib/types';

export interface PerformanceTrend {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SitePerformanceTrends {
  wpengine?: {
    cache_hit_ratio: PerformanceTrend;
    average_latency_ms: PerformanceTrend;
    error_rate: PerformanceTrend;
  };
  cloudflare?: {
    requests_24h: PerformanceTrend;
    cache_hit_ratio: PerformanceTrend;
    threats_24h: PerformanceTrend;
  };
  database?: {
    total_size_mb: PerformanceTrend;
    autoload_size_kb: PerformanceTrend;
  };
}

function calculateTrend(current: number, previous: number): PerformanceTrend {
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
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

  // Get WPEngine trends
  const { data: wpeMetrics } = await supabase
    .from('wpengine_metrics')
    .select('*')
    .eq('site_id', siteId)
    .order('recorded_at', { ascending: false })
    .limit(2);

  if (wpeMetrics && wpeMetrics.length >= 2) {
    const [current, previous] = wpeMetrics as WPEngineMetrics[];
    trends.wpengine = {
      cache_hit_ratio: calculateTrend(current.cache_hit_ratio, previous.cache_hit_ratio),
      average_latency_ms: calculateTrend(current.average_latency_ms, previous.average_latency_ms),
      error_rate: calculateTrend(current.error_rate, previous.error_rate),
    };
  }

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
  wpengine: WPEngineMetrics[];
  cloudflare: CloudflareMetrics[];
  database: DatabaseMetrics[];
  plugin: PluginMetrics[];
}> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [wpeResult, cfResult, dbResult, pluginResult] = await Promise.all([
    supabase
      .from('wpengine_metrics')
      .select('*')
      .eq('site_id', siteId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true }),
    
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
    wpengine: (wpeResult.data as WPEngineMetrics[]) || [],
    cloudflare: (cfResult.data as CloudflareMetrics[]) || [],
    database: (dbResult.data as DatabaseMetrics[]) || [],
    plugin: (pluginResult.data as PluginMetrics[]) || [],
  };
}

/**
 * Get aggregated performance stats across all sites
 */
export async function getGlobalPerformanceStats(): Promise<{
  avgWPEngineCache: number;
  avgCloudflareCache: number;
  avgLatency: number;
  totalThreats: number;
  sitesWithIssues: number;
}> {
  const supabase = createServerClient();

  // Get latest metrics for all sites
  const [wpeResult, cfResult] = await Promise.all([
    supabase.from('latest_wpengine_metrics').select('cache_hit_ratio, average_latency_ms'),
    supabase.from('latest_cloudflare_metrics').select('cache_hit_ratio, threats_24h'),
  ]);

  const wpeMetrics = wpeResult.data as Pick<WPEngineMetrics, 'cache_hit_ratio' | 'average_latency_ms'>[] || [];
  const cfMetrics = cfResult.data as Pick<CloudflareMetrics, 'cache_hit_ratio' | 'threats_24h'>[] || [];

  const avgWPEngineCache = wpeMetrics.length > 0 
    ? wpeMetrics.reduce((sum, m) => sum + m.cache_hit_ratio, 0) / wpeMetrics.length 
    : 0;

  const avgCloudflareCache = cfMetrics.length > 0 
    ? cfMetrics.reduce((sum, m) => sum + m.cache_hit_ratio, 0) / cfMetrics.length 
    : 0;

  const avgLatency = wpeMetrics.length > 0 
    ? wpeMetrics.reduce((sum, m) => sum + m.average_latency_ms, 0) / wpeMetrics.length 
    : 0;

  const totalThreats = cfMetrics.reduce((sum, m) => sum + m.threats_24h, 0);

  const sitesWithIssues = wpeMetrics.filter(m => 
    m.cache_hit_ratio < 0.7 || m.average_latency_ms > 1000
  ).length;

  return {
    avgWPEngineCache,
    avgCloudflareCache,
    avgLatency,
    totalThreats,
    sitesWithIssues,
  };
}