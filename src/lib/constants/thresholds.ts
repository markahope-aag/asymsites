export const THRESHOLDS = {
  // Database
  autoload_size_kb: {
    warning: 800,
    critical: 1500,
  },
  revision_count: {
    warning: 500,
    critical: 2000,
  },
  transient_count: {
    warning: 300,
    critical: 1000,
  },
  database_size_mb: {
    warning: 500,
    critical: 1000,
  },

  // Performance
  cache_hit_ratio: {
    warning: 0.7,
    critical: 0.5,
  },
  status_5xx_24h: {
    warning: 10,
    critical: 50,
  },
  average_latency_ms: {
    warning: 1000,
    critical: 2000,
  },
  error_rate: {
    warning: 0.02, // 2%
    critical: 0.05, // 5%
  },
  slow_pages_count: {
    warning: 5,
    critical: 10,
  },

  // Crawl performance
  CRAWL_ERROR_RATE_WARNING: 5, // 5% error rate
  CRAWL_ERROR_RATE_CRITICAL: 10, // 10% error rate
  AVG_RESPONSE_TIME_WARNING: 2000, // 2 seconds
  AVG_RESPONSE_TIME_CRITICAL: 4000, // 4 seconds
  SLOW_PAGES_WARNING: 3, // 3 slow pages
  SLOW_PAGES_CRITICAL: 8, // 8 slow pages
  BROKEN_LINKS_WARNING: 5, // 5 broken links
  BROKEN_LINKS_CRITICAL: 15, // 15 broken links

  // Plugins
  inactive_plugins: {
    warning: 3,
    critical: 8,
  },
  outdated_plugins: {
    warning: 5,
    critical: 10,
  },

  // Health score weights
  severity_deduction: {
    critical: 15,
    warning: 5,
    info: 1,
  },
};
