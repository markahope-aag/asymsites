import { getAnalytics } from '@/lib/connectors/cloudflare';
import { getPerformanceInsights } from '@/lib/connectors/wpengine';
import { WPCLIConfig } from '@/lib/connectors/wpcli';
import { THRESHOLDS } from '@/lib/constants/thresholds';
import { CheckResult, PerformanceAuditData } from '@/lib/types';

interface PerformanceConfig extends WPCLIConfig {
  cloudflareZoneId?: string;
  wpengineInstallId?: string;
  domain: string;
}

export async function runPerformanceChecks(config: PerformanceConfig): Promise<CheckResult> {
  const issues: CheckResult['issues'] = [];
  const data: PerformanceAuditData = {};

  // Cloudflare analytics
  if (config.cloudflareZoneId) {
    try {
      const cfAnalytics = await getAnalytics(config.cloudflareZoneId, 24);

      data.cloudflare = {
        requests_24h: cfAnalytics.requests_total,
        cached_requests_24h: cfAnalytics.requests_cached,
        cache_hit_ratio: cfAnalytics.cache_hit_ratio,
        bandwidth_mb: cfAnalytics.bandwidth_total_mb,
        threats_24h: cfAnalytics.threats_total,
        status_5xx_24h: cfAnalytics.status_5xx,
      };

      // Check Cloudflare edge cache hit ratio (CDN level - different from WPEngine server cache)
      // Note: This measures CDN edge caching, not server-side WordPress cache (WP Rocket, etc.)
      if (cfAnalytics.cache_hit_ratio < THRESHOLDS.cache_hit_ratio.critical) {
        issues.push({
          category: 'performance',
          severity: 'warning', // Reduced severity since server cache is more important
          title: `Cloudflare CDN cache hit ratio is ${Math.round(cfAnalytics.cache_hit_ratio * 100)}%`,
          description: 'Low CDN edge cache hit ratio. Most requests are going to origin server instead of being served from Cloudflare edge cache.',
          recommendation: 'Review Cloudflare page rules, cache headers from origin, and caching configuration. Note: Server-side cache (WP Rocket) is more critical for performance.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (cfAnalytics.cache_hit_ratio < THRESHOLDS.cache_hit_ratio.warning) {
        issues.push({
          category: 'performance',
          severity: 'info', // Reduced severity since server cache is more important
          title: `Cloudflare CDN cache hit ratio is ${Math.round(cfAnalytics.cache_hit_ratio * 100)}%`,
          description: 'CDN edge cache hit ratio could be improved to reduce load on origin server.',
          recommendation: 'Review Cloudflare caching strategy and page rules. Server-side cache (WP Rocket) performance is more critical.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check 5xx errors
      if (cfAnalytics.status_5xx >= THRESHOLDS.status_5xx_24h.critical) {
        issues.push({
          category: 'performance',
          severity: 'critical',
          title: `${cfAnalytics.status_5xx} server errors (5xx) in last 24h`,
          description: 'High number of server errors indicates serious issues.',
          recommendation: 'Investigate server logs and PHP errors immediately.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (cfAnalytics.status_5xx >= THRESHOLDS.status_5xx_24h.warning) {
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `${cfAnalytics.status_5xx} server errors (5xx) in last 24h`,
          description: 'Elevated server errors detected.',
          recommendation: 'Review recent changes and error logs.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check for threats
      if (cfAnalytics.threats_total > 100) {
        issues.push({
          category: 'performance',
          severity: 'info',
          title: `${cfAnalytics.threats_total} threats blocked in last 24h`,
          description: 'Cloudflare is blocking malicious traffic.',
          recommendation: 'Monitor threat patterns, consider additional rules if needed.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Determine severity based on error type
      const severity = errorMessage.includes('authentication') || 
                      errorMessage.includes('permission') || 
                      errorMessage.includes('Zone not found') ? 'warning' : 'info';
      
      // Provide specific recommendations based on error
      let recommendation = 'Check Cloudflare API configuration.';
      if (errorMessage.includes('authentication') || errorMessage.includes('10000')) {
        recommendation = 'Verify CLOUDFLARE_API_TOKEN is set correctly in environment variables.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('9109')) {
        recommendation = 'Update the Cloudflare API token to include "Zone:Read" and "Analytics:Read" permissions.';
      } else if (errorMessage.includes('Zone not found') || errorMessage.includes('7003')) {
        recommendation = 'Verify the Cloudflare zone ID is correct in the database.';
      } else if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
        recommendation = 'Check internet connection and Cloudflare API availability.';
      }
      
      issues.push({
        category: 'performance',
        severity,
        title: 'Could not fetch Cloudflare analytics',
        description: `Cloudflare API error: ${errorMessage}`,
        recommendation,
        auto_fixable: false,
        fix_action: null,
        fix_params: {},
      });
      
      console.log(`[Performance] Cloudflare analytics failed: ${errorMessage}`);
    }
  } else {
    // No Cloudflare zone ID configured
    issues.push({
      category: 'performance',
      severity: 'info',
      title: 'Cloudflare not configured',
      description: 'No Cloudflare zone ID is set for this site.',
      recommendation: 'Run the Cloudflare zone import script or manually add the zone ID.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // WPEngine Server Cache Check (Performance Insights)
  if (config.wpengineInstallId) {
    try {
      const wpeInsights = await getPerformanceInsights(config.wpengineInstallId);
      
      data.wpengine = {
        cache_hit_ratio: wpeInsights.cache_hit_ratio,
        average_latency_ms: wpeInsights.average_latency_ms,
        error_rate: wpeInsights.error_rate,
        page_requests_peak_hour: wpeInsights.page_requests_peak_hour,
        slow_pages_count: wpeInsights.slow_pages_count,
      };

      // Check WPEngine server cache hit ratio (more important than CDN cache)
      if (wpeInsights.cache_hit_ratio < THRESHOLDS.cache_hit_ratio.critical) {
        issues.push({
          category: 'performance',
          severity: 'critical',
          title: `WPEngine server cache hit ratio is ${Math.round(wpeInsights.cache_hit_ratio * 100)}%`,
          description: 'Very low server-side cache hit ratio. Most requests are generating pages instead of serving from cache.',
          recommendation: 'Review WP Rocket configuration, check cache exclusions, and optimize caching strategy. Server cache is critical for WordPress performance.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (wpeInsights.cache_hit_ratio < THRESHOLDS.cache_hit_ratio.warning) {
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `WPEngine server cache hit ratio is ${Math.round(wpeInsights.cache_hit_ratio * 100)}%`,
          description: 'Server cache hit ratio could be improved to reduce server load and improve performance.',
          recommendation: 'Review WP Rocket settings and cache exclusions to improve server-side caching.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check error rate
      if (wpeInsights.error_rate > THRESHOLDS.error_rate.critical) {
        issues.push({
          category: 'performance',
          severity: 'critical',
          title: `High error rate: ${Math.round(wpeInsights.error_rate * 100)}%`,
          description: 'Site is experiencing a high rate of errors.',
          recommendation: 'Investigate error logs and fix underlying issues causing errors.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (wpeInsights.error_rate > THRESHOLDS.error_rate.warning) {
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `Error rate: ${Math.round(wpeInsights.error_rate * 100)}%`,
          description: 'Site is experiencing some errors.',
          recommendation: 'Monitor error logs and investigate potential issues.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check average latency
      if (wpeInsights.average_latency_ms > THRESHOLDS.average_latency_ms.critical) {
        issues.push({
          category: 'performance',
          severity: 'critical',
          title: `Very high average latency: ${wpeInsights.average_latency_ms}ms`,
          description: 'Site response times are critically slow.',
          recommendation: 'Urgent optimization needed. Check database performance, plugin efficiency, and server resources.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (wpeInsights.average_latency_ms > THRESHOLDS.average_latency_ms.warning) {
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `High average latency: ${wpeInsights.average_latency_ms}ms`,
          description: 'Site response times are higher than ideal.',
          recommendation: 'Optimize database queries, improve caching, and review plugin performance.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check slow pages count
      if (wpeInsights.slow_pages_count > THRESHOLDS.slow_pages_count.critical) {
        issues.push({
          category: 'performance',
          severity: 'critical',
          title: `${wpeInsights.slow_pages_count} slow pages detected`,
          description: 'Many pages are loading slowly, significantly impacting user experience.',
          recommendation: 'Urgent optimization needed. Identify and fix slow-loading pages. Check for heavy plugins, large images, or inefficient queries.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (wpeInsights.slow_pages_count > THRESHOLDS.slow_pages_count.warning) {
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `${wpeInsights.slow_pages_count} slow pages detected`,
          description: 'Multiple pages are loading slowly, which impacts user experience.',
          recommendation: 'Identify and optimize slow-loading pages. Check for heavy plugins, large images, or inefficient queries.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (wpeInsights.slow_pages_count > 0) {
        issues.push({
          category: 'performance',
          severity: 'info',
          title: `${wpeInsights.slow_pages_count} slow page(s) detected`,
          description: 'Some pages are loading slowly.',
          recommendation: 'Review slow pages and optimize where possible.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check peak hour traffic (informational - high traffic isn't necessarily bad)
      if (wpeInsights.page_requests_peak_hour > 10000) {
        issues.push({
          category: 'performance',
          severity: 'info',
          title: `High peak traffic: ${wpeInsights.page_requests_peak_hour.toLocaleString()} requests/hour`,
          description: 'Site experiences high traffic during peak hours.',
          recommendation: 'Monitor server performance during peak hours. Consider upgrading hosting plan if performance degrades.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Performance] WPEngine Performance Insights error:', errorMessage);
      
      // Add informational note about WPEngine cache monitoring
      issues.push({
        category: 'performance',
        severity: 'info',
        title: 'WPEngine Performance Insights unavailable',
        description: errorMessage,
        recommendation: 'Monitor WPEngine dashboard for server cache performance (cache hit ratio, latency, error rate). Server cache is more critical than CDN cache for WordPress performance.',
        auto_fixable: false,
        fix_action: null,
        fix_params: {},
      });
    }
  } else {
    // No WPEngine install ID configured
    issues.push({
      category: 'performance',
      severity: 'info',
      title: 'WPEngine Performance Insights not configured',
      description: 'No WPEngine install ID is set for this site.',
      recommendation: 'Add WPEngine install ID to enable server cache monitoring. Server cache hit ratio is more critical than CDN cache for WordPress performance.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Basic response time check
  try {
    const startTime = Date.now();
    const response = await fetch(`https://${config.domain}`, {
      method: 'HEAD',
      cache: 'no-store',
    });
    const responseTime = Date.now() - startTime;

    data.response_time_ms = responseTime;

    if (responseTime > 3000) {
      issues.push({
        category: 'performance',
        severity: 'critical',
        title: `Slow response time: ${responseTime}ms`,
        description: 'Site is responding very slowly.',
        recommendation: 'Investigate server performance and caching.',
        auto_fixable: false,
        fix_action: null,
        fix_params: {},
      });
    } else if (responseTime > 1500) {
      issues.push({
        category: 'performance',
        severity: 'warning',
        title: `Response time: ${responseTime}ms`,
        description: 'Site response time is higher than ideal.',
        recommendation: 'Review caching and optimization.',
        auto_fixable: false,
        fix_action: null,
        fix_params: {},
      });
    }
  } catch (error) {
    issues.push({
      category: 'performance',
      severity: 'critical',
      title: 'Site unreachable',
      description: `Could not connect to ${config.domain}: ${error}`,
      recommendation: 'Verify site is online.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  return { data, issues };
}
