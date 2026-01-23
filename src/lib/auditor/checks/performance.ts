import { getAnalytics, CloudflareAnalytics } from '@/lib/connectors/cloudflare';
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
        bandwidth_saved_mb: cfAnalytics.bandwidth_saved_mb,
        threats_24h: cfAnalytics.threats_total,
        status_5xx_24h: cfAnalytics.status_5xx,
        status_4xx_24h: cfAnalytics.status_4xx,
        ssl_encrypted_requests: cfAnalytics.ssl_encrypted_requests,
        bot_requests: cfAnalytics.bot_requests,
        bot_score_avg: cfAnalytics.bot_score_avg,
        countries_top: cfAnalytics.countries_top,
        ssl_protocol_breakdown: cfAnalytics.ssl_protocol_breakdown,
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
      const threat_rate = cfAnalytics.requests_total > 0 ? cfAnalytics.threats_total / cfAnalytics.requests_total : 0;
      if (threat_rate > 0.01) { // More than 1% threats
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `${cfAnalytics.threats_total} threats blocked in 24h (${Math.round(threat_rate * 100)}% of traffic)`,
          description: 'High level of threats detected and blocked by Cloudflare.',
          recommendation: 'Review security settings and consider enabling additional protection features.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (cfAnalytics.threats_total > 100) {
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

      // Check 4xx errors (client errors)
      const error_4xx_threshold = cfAnalytics.requests_total * 0.05; // 5% of total requests
      if (cfAnalytics.status_4xx > error_4xx_threshold) {
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `${cfAnalytics.status_4xx} client errors in 24h (${Math.round(cfAnalytics.status_4xx / cfAnalytics.requests_total * 100)}%)`,
          description: 'High number of 4xx client errors detected. This may indicate broken links or missing resources.',
          recommendation: 'Review 404 errors, fix broken links, and check for missing assets.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check SSL encryption rate
      const ssl_rate = cfAnalytics.requests_total > 0 ? cfAnalytics.ssl_encrypted_requests / cfAnalytics.requests_total : 0;
      if (ssl_rate < 0.95) { // Less than 95% SSL
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `SSL encryption rate is ${Math.round(ssl_rate * 100)}%`,
          description: 'Some requests are not using SSL encryption.',
          recommendation: 'Ensure all traffic is redirected to HTTPS. Check for mixed content issues.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check bandwidth savings from caching
      const bandwidth_savings_rate = cfAnalytics.bandwidth_total_mb > 0 ? cfAnalytics.bandwidth_saved_mb / cfAnalytics.bandwidth_total_mb : 0;
      if (bandwidth_savings_rate > 0.5) {
        issues.push({
          category: 'performance',
          severity: 'info',
          title: `Cloudflare saved ${Math.round(cfAnalytics.bandwidth_saved_mb)}MB bandwidth (${Math.round(bandwidth_savings_rate * 100)}%)`,
          description: 'Good CDN performance - significant bandwidth savings from edge caching.',
          recommendation: 'CDN is working well. Continue optimizing cache headers for better performance.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Check bot traffic
      const bot_rate = cfAnalytics.requests_total > 0 ? cfAnalytics.bot_requests / cfAnalytics.requests_total : 0;
      if (bot_rate > 0.3) { // More than 30% bot traffic
        issues.push({
          category: 'performance',
          severity: 'warning',
          title: `${cfAnalytics.bot_requests} bot requests in 24h (${Math.round(bot_rate * 100)}% of traffic)`,
          description: 'High level of bot traffic detected. This may impact server performance.',
          recommendation: 'Review bot management settings. Consider enabling Bot Fight Mode or custom bot rules.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      } else if (bot_rate > 0.1) { // More than 10% bot traffic
        issues.push({
          category: 'performance',
          severity: 'info',
          title: `${cfAnalytics.bot_requests} bot requests in 24h (${Math.round(bot_rate * 100)}% of traffic)`,
          description: 'Moderate bot traffic detected.',
          recommendation: 'Monitor bot patterns and consider bot management if performance is affected.',
          auto_fixable: false,
          fix_action: null,
          fix_params: {},
        });
      }

      // Geographic traffic insights
      if (cfAnalytics.countries_top.length > 0) {
        const topCountry = cfAnalytics.countries_top[0];
        const topCountryRate = cfAnalytics.requests_total > 0 ? topCountry.requests / cfAnalytics.requests_total : 0;
        
        if (topCountryRate > 0.8) { // More than 80% from one country
          issues.push({
            category: 'performance',
            severity: 'info',
            title: `${Math.round(topCountryRate * 100)}% of traffic from ${topCountry.country}`,
            description: 'Traffic is highly concentrated in one geographic region.',
            recommendation: 'Consider regional optimization and ensure CDN coverage is appropriate for your audience.',
            auto_fixable: false,
            fix_action: null,
            fix_params: {},
          });
        } else {
          const countries = cfAnalytics.countries_top.slice(0, 3).map(c => c.country).join(', ');
          issues.push({
            category: 'performance',
            severity: 'info',
            title: `Global traffic from ${cfAnalytics.countries_top.length} countries`,
            description: `Top traffic sources: ${countries}. Good geographic distribution.`,
            recommendation: 'Monitor regional performance and consider geo-specific optimizations if needed.',
            auto_fixable: false,
            fix_action: null,
            fix_params: {},
          });
        }
      }

      // SSL/TLS protocol security analysis
      const sslProtocols = Object.entries(cfAnalytics.ssl_protocol_breakdown || {});
      if (sslProtocols.length > 0) {
        const totalSSLRequests = sslProtocols.reduce((sum, [, count]) => sum + count, 0);
        
        // Check for outdated TLS versions
        const tls10_11_requests = (cfAnalytics.ssl_protocol_breakdown['TLSv1'] || 0) + 
                                  (cfAnalytics.ssl_protocol_breakdown['TLSv1.1'] || 0);
        
        if (tls10_11_requests > 0) {
          const oldTLSRate = tls10_11_requests / totalSSLRequests;
          issues.push({
            category: 'performance',
            severity: 'warning',
            title: `${tls10_11_requests} requests using outdated TLS 1.0/1.1 (${Math.round(oldTLSRate * 100)}%)`,
            description: 'Some clients are using outdated TLS versions with security vulnerabilities.',
            recommendation: 'Consider deprecating TLS 1.0/1.1 support. Encourage clients to upgrade to TLS 1.2+.',
            auto_fixable: false,
            fix_action: null,
            fix_params: {},
          });
        }

        // Check TLS 1.3 adoption
        const tls13_requests = cfAnalytics.ssl_protocol_breakdown['TLSv1.3'] || 0;
        if (tls13_requests > 0) {
          const tls13Rate = tls13_requests / totalSSLRequests;
          if (tls13Rate > 0.5) {
            issues.push({
              category: 'performance',
              severity: 'info',
              title: `${Math.round(tls13Rate * 100)}% of SSL traffic using TLS 1.3`,
              description: 'Excellent SSL security - high adoption of modern TLS 1.3 protocol.',
              recommendation: 'TLS configuration is optimal. Continue monitoring for security best practices.',
              auto_fixable: false,
              fix_action: null,
              fix_params: {},
            });
          }
        }
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

  // WPEngine Server Cache Check (Performance Insights) - DISABLED
  // WPEngine API does not provide programmatic access to Performance Insights
  /*
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
  */

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
