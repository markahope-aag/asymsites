// Screaming Frog crawl audit checks
import { crawlSiteForBackendMetrics, ScreamingFrogResults } from '@/lib/connectors/screaming-frog';
import { getWPEngineAuthConfig } from '@/lib/connectors/screaming-frog-auth';
import { CheckResult, CrawlAuditData } from '@/lib/types';
import { THRESHOLDS } from '@/lib/constants/thresholds';
import { getOptimalCrawlSettings, CRAWL_ERROR_HANDLING } from '@/lib/constants/crawl-config';

export interface CrawlConfig {
  domain: string;
  wpengine_install_id?: string;
  wpengine_environment?: string;
  is_ecommerce?: boolean;
  page_builder?: string;
  maxPages?: number;
  includePageSpeed?: boolean;
  timeout?: number;
}

export async function runCrawlChecks(config: CrawlConfig): Promise<CheckResult> {
  const issues: CheckResult['issues'] = [];

  console.log(`[Crawl] Starting comprehensive site analysis for ${config.domain}...`);

  try {
    // Get optimal crawl settings for this site
    const optimalSettings = getOptimalCrawlSettings({
      domain: config.domain,
      is_ecommerce: config.is_ecommerce,
      page_builder: config.page_builder,
      wpengine_environment: config.wpengine_environment,
    });

    // Override with any provided config
    const crawlSettings = {
      maxPages: config.maxPages || optimalSettings.maxPages,
      timeout: config.timeout || optimalSettings.timeout,
      includePageSpeed: config.includePageSpeed ?? optimalSettings.includePageSpeed,
    };

    console.log(`[Crawl] Using settings: ${crawlSettings.maxPages} pages, ${Math.round(crawlSettings.timeout/1000)}s timeout, PageSpeed: ${crawlSettings.includePageSpeed}`);

    // Get authentication config if needed
    const authConfig = getWPEngineAuthConfig({
      domain: config.domain,
      wpengine_install_id: config.wpengine_install_id,
      wpengine_environment: config.wpengine_environment,
    });

    // Run Screaming Frog crawl with retry logic
    let crawlResults: ScreamingFrogResults | undefined;
    let attempts = 0;
    
    while (attempts < CRAWL_ERROR_HANDLING.RETRY_ATTEMPTS) {
      try {
        crawlResults = await crawlSiteForBackendMetrics(`https://${config.domain}`, {
          ...crawlSettings,
          authConfig: authConfig || undefined,
        });
        break; // Success, exit retry loop
      } catch (error) {
        attempts++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        console.log(`[Crawl] Attempt ${attempts} failed: ${errorMessage}`);
        
        // Check if we should skip retrying
        const shouldSkip = CRAWL_ERROR_HANDLING.SKIP_CONDITIONS.some(condition => 
          errorMessage.toLowerCase().includes(condition.toLowerCase())
        );
        
        if (shouldSkip || attempts >= CRAWL_ERROR_HANDLING.RETRY_ATTEMPTS) {
          throw error; // Re-throw the error to be handled by outer catch
        }
        
        // Wait before retry
        console.log(`[Crawl] Retrying in ${CRAWL_ERROR_HANDLING.RETRY_DELAY/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, CRAWL_ERROR_HANDLING.RETRY_DELAY));
        
        // Use fallback settings for retry
        Object.assign(crawlSettings, CRAWL_ERROR_HANDLING.FALLBACK_SETTINGS);
        console.log(`[Crawl] Using fallback settings for retry: ${crawlSettings.maxPages} pages`);
      }
    }

    // Process results into audit data (crawlResults should be defined if we reach here)
    const auditData = processCrawlResults(crawlResults!);
    
    // Generate issues based on findings
    generateCrawlIssues(auditData, issues);

    console.log(`[Crawl] Completed crawl for ${config.domain} - ${auditData.crawl_summary.total_pages} pages, ${auditData.backend_health.server_errors_5xx} server errors`);

    return { data: auditData, issues };

  } catch (error) {
    console.error(`[Crawl] Failed to crawl ${config.domain}:`, error);
    
    // Create minimal data structure for failed crawl
    const failedData: CrawlAuditData = {
      crawl_summary: {
        total_pages: 0,
        crawl_duration_seconds: 0,
        avg_response_time_ms: 0,
        error_rate_percent: 100,
        crawl_completed_at: new Date().toISOString(),
      },
      backend_health: {
        server_errors_5xx: 0,
        client_errors_4xx: 0,
        slow_pages_count: 0,
        broken_links_count: 0,
        redirect_chains_count: 0,
        large_pages_count: 0,
      },
      performance_issues: [],
    };

    // Add crawl failure as an issue
    issues.push({
      category: 'performance',
      severity: 'warning',
      title: 'Site crawl failed',
      description: `Could not complete Screaming Frog crawl: ${error instanceof Error ? error.message : String(error)}`,
      recommendation: 'Check site accessibility, authentication settings, or try again later.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });

    return { data: failedData, issues };
  }
}

function processCrawlResults(results: ScreamingFrogResults): CrawlAuditData {
  const totalPages = results.crawl_summary.total_urls;
  const totalErrors = results.crawl_summary.errors_4xx + results.crawl_summary.errors_5xx;
  const errorRate = totalPages > 0 ? (totalErrors / totalPages) * 100 : 0;

  return {
    crawl_summary: {
      total_pages: totalPages,
      crawl_duration_seconds: results.crawl_summary.crawl_time_seconds,
      avg_response_time_ms: results.performance_metrics.avg_response_time_ms,
      error_rate_percent: Math.round(errorRate * 100) / 100,
      crawl_completed_at: new Date().toISOString(),
    },
    
    backend_health: {
      server_errors_5xx: results.crawl_summary.errors_5xx,
      client_errors_4xx: results.crawl_summary.errors_4xx,
      slow_pages_count: results.performance_metrics.slow_pages_count,
      broken_links_count: results.performance_metrics.broken_links_count,
      redirect_chains_count: results.backend_issues.broken_links.length, // Approximate
      large_pages_count: results.performance_metrics.large_pages_count,
    },
    
    // Core Web Vitals would be populated if PageSpeed is enabled
    core_web_vitals: undefined,
    
    performance_issues: [
      // Convert server errors to issues
      ...results.backend_issues.server_errors.map(error => ({
        type: 'server_error' as const,
        url: error.url,
        details: `HTTP ${error.status_code} error`,
        severity: 'critical' as const,
        response_time_ms: error.response_time_ms,
        status_code: error.status_code,
      })),
      
      // Convert slow pages to issues
      ...results.backend_issues.slow_pages.map(page => ({
        type: 'slow_page' as const,
        url: page.url,
        details: `Slow response time: ${page.response_time_ms}ms`,
        severity: page.response_time_ms > 5000 ? 'critical' as const : 'warning' as const,
        response_time_ms: page.response_time_ms,
        page_size_kb: page.size_kb,
      })),
      
      // Convert broken links to issues
      ...results.backend_issues.broken_links.map(link => ({
        type: 'broken_link' as const,
        url: link.source_url,
        details: `Broken link to: ${link.target_url}`,
        severity: 'warning' as const,
        status_code: link.status_code,
      })),
    ],
  };
}

function generateCrawlIssues(data: CrawlAuditData, issues: CheckResult['issues']): void {
  // Check server error rate
  if (data.backend_health.server_errors_5xx > 0) {
    issues.push({
      category: 'performance',
      severity: data.backend_health.server_errors_5xx > 5 ? 'critical' : 'warning',
      title: `${data.backend_health.server_errors_5xx} server errors detected`,
      description: `Found ${data.backend_health.server_errors_5xx} pages returning 5xx server errors during crawl.`,
      recommendation: 'Investigate server errors immediately. Check server logs and fix backend issues.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check error rate
  if (data.crawl_summary.error_rate_percent > THRESHOLDS.CRAWL_ERROR_RATE_WARNING) {
    issues.push({
      category: 'performance',
      severity: data.crawl_summary.error_rate_percent > THRESHOLDS.CRAWL_ERROR_RATE_CRITICAL ? 'critical' : 'warning',
      title: `High error rate: ${data.crawl_summary.error_rate_percent}%`,
      description: `${data.crawl_summary.error_rate_percent}% of crawled pages returned errors (4xx/5xx).`,
      recommendation: 'Review and fix broken links, missing pages, and server errors.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check average response time
  if (data.crawl_summary.avg_response_time_ms > THRESHOLDS.AVG_RESPONSE_TIME_WARNING) {
    issues.push({
      category: 'performance',
      severity: data.crawl_summary.avg_response_time_ms > THRESHOLDS.AVG_RESPONSE_TIME_CRITICAL ? 'critical' : 'warning',
      title: `Slow average response time: ${Math.round(data.crawl_summary.avg_response_time_ms)}ms`,
      description: `Average page response time is ${Math.round(data.crawl_summary.avg_response_time_ms)}ms, which is slow.`,
      recommendation: 'Optimize server performance, database queries, and caching. Consider CDN optimization.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check slow pages
  if (data.backend_health.slow_pages_count > THRESHOLDS.SLOW_PAGES_WARNING) {
    issues.push({
      category: 'performance',
      severity: data.backend_health.slow_pages_count > THRESHOLDS.SLOW_PAGES_CRITICAL ? 'critical' : 'warning',
      title: `${data.backend_health.slow_pages_count} slow pages detected`,
      description: `Found ${data.backend_health.slow_pages_count} pages with response times over 3 seconds.`,
      recommendation: 'Optimize slow pages by reducing database queries, optimizing images, and improving caching.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check broken links
  if (data.backend_health.broken_links_count > THRESHOLDS.BROKEN_LINKS_WARNING) {
    issues.push({
      category: 'performance',
      severity: data.backend_health.broken_links_count > THRESHOLDS.BROKEN_LINKS_CRITICAL ? 'warning' : 'info',
      title: `${data.backend_health.broken_links_count} broken links found`,
      description: `Found ${data.backend_health.broken_links_count} broken internal or external links.`,
      recommendation: 'Review and fix broken links to improve user experience and SEO.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }
}