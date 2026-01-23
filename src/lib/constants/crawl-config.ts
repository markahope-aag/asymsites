// Screaming Frog crawl configuration constants
export const CRAWL_CONFIG = {
  // Default crawl limits for different site types
  LIMITS: {
    SMALL_SITE: {
      maxPages: 50,
      timeout: 180000, // 3 minutes
      includePageSpeed: true,
    },
    MEDIUM_SITE: {
      maxPages: 100,
      timeout: 300000, // 5 minutes
      includePageSpeed: true,
    },
    LARGE_SITE: {
      maxPages: 200,
      timeout: 600000, // 10 minutes
      includePageSpeed: false, // Skip PageSpeed for large sites to save time
    },
    ECOMMERCE_SITE: {
      maxPages: 150,
      timeout: 450000, // 7.5 minutes
      includePageSpeed: true,
    },
  },

  // Crawl priorities by page builder
  PAGE_BUILDER_SETTINGS: {
    elementor: {
      // Elementor sites can be slower due to dynamic content
      timeoutMultiplier: 1.5,
      includePageSpeed: true,
    },
    beaver: {
      timeoutMultiplier: 1.2,
      includePageSpeed: true,
    },
    gutenberg: {
      timeoutMultiplier: 1.0,
      includePageSpeed: true,
    },
    other: {
      timeoutMultiplier: 1.0,
      includePageSpeed: true,
    },
  },

  // Environment-specific settings
  ENVIRONMENT_SETTINGS: {
    production: {
      respectRobots: true,
      crawlDelay: 1000, // 1 second between requests
      userAgent: 'AsymSites-Monitor/1.0 (Screaming Frog SEO Spider)',
    },
    staging: {
      respectRobots: false,
      crawlDelay: 500,
      userAgent: 'AsymSites-Monitor/1.0 (Screaming Frog SEO Spider)',
    },
  },

  // Export settings for different analysis types
  EXPORT_SETTINGS: {
    BASIC: [
      'Response Codes:All',
      'Page Titles:All',
    ],
    PERFORMANCE: [
      'Response Codes:All',
      'Page Titles:All',
      'Meta Description:All',
      'Images:All',
    ],
    COMPREHENSIVE: [
      'Response Codes:All',
      'Page Titles:All',
      'Meta Description:All',
      'Images:All',
      'External Links:All',
      'Internal Links:All',
    ],
  },

  // Bulk export options
  BULK_EXPORTS: {
    BASIC: [
      'response_codes',
      'page_titles',
    ],
    PERFORMANCE: [
      'response_codes',
      'page_titles',
      'images',
      'redirect_chains',
    ],
    COMPREHENSIVE: [
      'response_codes',
      'page_titles',
      'images',
      'redirect_chains',
      'internal_links',
      'external_links',
    ],
  },
};

// Helper function to get optimal crawl settings for a site
export function getOptimalCrawlSettings(site: {
  domain: string;
  is_ecommerce?: boolean;
  page_builder?: string;
  wpengine_environment?: string;
}) {
  // Determine site size category (could be enhanced with historical data)
  let sizeCategory: keyof typeof CRAWL_CONFIG.LIMITS = 'MEDIUM_SITE';
  
  if (site.is_ecommerce) {
    sizeCategory = 'ECOMMERCE_SITE';
  }
  
  // Get base settings
  const baseSettings = CRAWL_CONFIG.LIMITS[sizeCategory];
  
  // Apply page builder adjustments
  const pageBuilder = site.page_builder || 'other';
  const builderSettings = CRAWL_CONFIG.PAGE_BUILDER_SETTINGS[pageBuilder as keyof typeof CRAWL_CONFIG.PAGE_BUILDER_SETTINGS] || 
                         CRAWL_CONFIG.PAGE_BUILDER_SETTINGS.other;
  
  // Apply environment settings
  const environment = site.wpengine_environment === 'staging' ? 'staging' : 'production';
  const envSettings = CRAWL_CONFIG.ENVIRONMENT_SETTINGS[environment];
  
  return {
    maxPages: baseSettings.maxPages,
    timeout: Math.round(baseSettings.timeout * builderSettings.timeoutMultiplier),
    includePageSpeed: baseSettings.includePageSpeed && builderSettings.includePageSpeed,
    crawlDelay: envSettings.crawlDelay,
    userAgent: envSettings.userAgent,
    respectRobots: envSettings.respectRobots,
    exportTabs: CRAWL_CONFIG.EXPORT_SETTINGS.PERFORMANCE,
    bulkExports: CRAWL_CONFIG.BULK_EXPORTS.PERFORMANCE,
  };
}

// Error handling configurations
export const CRAWL_ERROR_HANDLING = {
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 30000, // 30 seconds
  
  FALLBACK_SETTINGS: {
    maxPages: 25, // Reduced page limit for problematic sites
    timeout: 120000, // 2 minutes
    includePageSpeed: false,
  },
  
  SKIP_CONDITIONS: [
    'Authentication required',
    'Site unreachable',
    'Timeout exceeded',
    'License invalid',
  ],
};