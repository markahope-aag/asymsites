import { getAnalytics } from '@/lib/connectors/cloudflare';
import { WPCLIConfig } from '@/lib/connectors/wpcli';
import { THRESHOLDS } from '@/lib/constants/thresholds';
import { CheckResult, PerformanceAuditData } from '@/lib/types';

interface PerformanceConfig extends WPCLIConfig {
  cloudflareZoneId?: string;
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

  // WPEngine Server Cache Check
  // Note: WPEngine doesn't provide cache hit ratio through their API
  // The 78% cache hit ratio mentioned is likely from WPEngine's dashboard
  // or server-side cache plugins like WP Rocket
  try {
    // TODO: Implement WPEngine server cache statistics retrieval
    // This would require either:
    // 1. WPEngine API enhancement to provide cache metrics
    // 2. WP Rocket WP-CLI commands for cache statistics
    // 3. Server log analysis for cache hit ratio calculation
    
    // For now, add a note that server cache should be monitored separately
    issues.push({
      category: 'performance',
      severity: 'info',
      title: 'Server cache monitoring needed',
      description: 'WPEngine server-side cache hit ratio (WP Rocket, object cache) should be monitored separately from CDN cache.',
      recommendation: 'Monitor WPEngine dashboard for server cache performance. Server cache hit ratio is more critical than CDN cache for WordPress performance.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  } catch (error) {
    console.error('Error checking server cache:', error);
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
