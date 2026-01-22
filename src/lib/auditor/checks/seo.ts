import { WPCLIConfig, getPluginList } from '@/lib/connectors/wpcli';
import { CheckResult, SEOAuditData } from '@/lib/types';

interface SEOConfig extends WPCLIConfig {
  domain: string;
}

export async function runSEOChecks(config: SEOConfig): Promise<CheckResult> {
  const issues: CheckResult['issues'] = [];

  // Check robots.txt
  let hasRobotsTxt = false;
  try {
    const robotsResponse = await fetch(`https://${config.domain}/robots.txt`);
    hasRobotsTxt = robotsResponse.ok;
  } catch {
    hasRobotsTxt = false;
  }

  if (!hasRobotsTxt) {
    issues.push({
      category: 'seo',
      severity: 'warning',
      title: 'robots.txt not found',
      description: 'Missing robots.txt file.',
      recommendation: 'Create a robots.txt file for search engine guidance.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check sitemap
  let hasSitemap = false;
  let sitemapUrlCount = 0;
  const sitemapLocations = [
    '/sitemap_index.xml',
    '/sitemap.xml',
    '/wp-sitemap.xml',
  ];

  for (const location of sitemapLocations) {
    try {
      const sitemapResponse = await fetch(`https://${config.domain}${location}`);
      if (sitemapResponse.ok) {
        hasSitemap = true;
        const content = await sitemapResponse.text();
        // Rough count of URLs
        sitemapUrlCount = (content.match(/<loc>/g) || []).length;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!hasSitemap) {
    issues.push({
      category: 'seo',
      severity: 'warning',
      title: 'Sitemap not found',
      description: 'No XML sitemap detected.',
      recommendation: 'Configure your SEO plugin to generate an XML sitemap.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check for SEO plugin (SEOPress is the standard)
  const plugins = await getPluginList(config);
  // SEOPress can have various slugs depending on version/install
  const seoPlugins = ['wp-seopress', 'wp-seopress-pro', 'seopress', 'seopress-pro'];
  const otherSeoPlugins = ['wordpress-seo', 'seo-by-rank-math', 'all-in-one-seo-pack'];

  const activeSEOPress = plugins.find(
    (p) => seoPlugins.includes(p.name) && p.status === 'active'
  );
  const activeOtherSEO = plugins.find(
    (p) => otherSeoPlugins.includes(p.name) && p.status === 'active'
  );

  if (!activeSEOPress && !activeOtherSEO) {
    issues.push({
      category: 'seo',
      severity: 'warning',
      title: 'No SEO plugin detected',
      description: 'No SEO plugin is active.',
      recommendation: 'Install and configure SEOPress (standard plugin).',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  } else if (!activeSEOPress && activeOtherSEO) {
    issues.push({
      category: 'seo',
      severity: 'info',
      title: `Non-standard SEO plugin: ${activeOtherSEO.name}`,
      description: 'Site is using a different SEO plugin than the standard (SEOPress).',
      recommendation: 'Consider migrating to SEOPress for consistency across sites.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  const activeSEOPlugin = activeSEOPress || activeOtherSEO;

  const data: SEOAuditData = {
    has_robots_txt: hasRobotsTxt,
    has_sitemap: hasSitemap,
    sitemap_url_count: sitemapUrlCount,
    seo_plugin: activeSEOPlugin?.name || null,
  };

  return { data, issues };
}
