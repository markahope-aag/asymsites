import { WPCLIConfig, getPluginList } from '@/lib/connectors/wpcli';
import { STANDARD_PLUGINS, PROBLEMATIC_PLUGINS, REQUIRED_PLUGINS } from '@/lib/constants/plugins';
import { THRESHOLDS } from '@/lib/constants/thresholds';
import { CheckResult, PluginAuditData } from '@/lib/types';

export async function runPluginChecks(config: WPCLIConfig): Promise<CheckResult> {
  const plugins = await getPluginList(config);
  const issues: CheckResult['issues'] = [];

  const active = plugins.filter((p) => p.status === 'active');
  const inactive = plugins.filter((p) => p.status === 'inactive');
  const needsUpdate = plugins.filter((p) => p.update === 'available');

  // Check for inactive plugins
  if (inactive.length >= THRESHOLDS.inactive_plugins.critical) {
    issues.push({
      category: 'plugins',
      severity: 'critical',
      title: `${inactive.length} inactive plugins installed`,
      description: `Inactive plugins: ${inactive.map((p) => p.name).join(', ')}`,
      recommendation: 'Remove inactive plugins to reduce security surface and improve performance.',
      auto_fixable: true,
      fix_action: 'remove_inactive_plugins',
      fix_params: { plugins: inactive.map((p) => p.name) },
    });
  } else if (inactive.length >= THRESHOLDS.inactive_plugins.warning) {
    issues.push({
      category: 'plugins',
      severity: 'warning',
      title: `${inactive.length} inactive plugins installed`,
      description: `Inactive plugins: ${inactive.map((p) => p.name).join(', ')}`,
      recommendation: 'Consider removing inactive plugins.',
      auto_fixable: true,
      fix_action: 'remove_inactive_plugins',
      fix_params: { plugins: inactive.map((p) => p.name) },
    });
  }

  // Check for outdated plugins
  if (needsUpdate.length >= THRESHOLDS.outdated_plugins.critical) {
    issues.push({
      category: 'plugins',
      severity: 'critical',
      title: `${needsUpdate.length} plugins need updates`,
      description: `Outdated: ${needsUpdate.map((p) => `${p.name} (${p.version} → ${p.update_version})`).join(', ')}`,
      recommendation: 'Update plugins on staging first, verify, then promote to production.',
      auto_fixable: true,
      fix_action: 'update_plugins_staging',
      fix_params: { plugins: needsUpdate.map((p) => p.name) },
    });
  } else if (needsUpdate.length >= THRESHOLDS.outdated_plugins.warning) {
    issues.push({
      category: 'plugins',
      severity: 'warning',
      title: `${needsUpdate.length} plugins need updates`,
      description: `Outdated: ${needsUpdate.map((p) => p.name).join(', ')}`,
      recommendation: 'Schedule plugin updates.',
      auto_fixable: true,
      fix_action: 'update_plugins_staging',
      fix_params: { plugins: needsUpdate.map((p) => p.name) },
    });
  }

  // Check for missing required plugins
  for (const required of REQUIRED_PLUGINS) {
    // More flexible matching for plugin names
    const found = active.find((p) => {
      // Exact match first
      if (p.name === required) return true;
      
      // Handle SEOPress variations
      if (required === 'seopress') {
        return p.name === 'wp-seopress' || 
               p.name === 'seopress-pro' || 
               p.name === 'wp-seopress-pro' ||
               p.name.includes('seopress');
      }
      
      // Handle WP Mail SMTP variations
      if (required === 'wp-mail-smtp') {
        return p.name === 'wp-mail-smtp' || 
               p.name === 'wp-mail-smtp-pro' ||
               p.name === 'wp-smtp' ||
               p.name.includes('mail-smtp');
      }
      
      // Handle Gravity Forms variations
      if (required === 'gravityforms') {
        return p.name === 'gravityforms' || 
               p.name === 'gravity-forms' ||
               p.name.includes('gravityforms');
      }
      
      // Handle WP Rocket variations
      if (required === 'wp-rocket') {
        return p.name === 'wp-rocket' || p.name.includes('rocket');
      }
      
      // Handle Really Simple Security variations
      if (required === 'really-simple-security') {
        return p.name === 'really-simple-security' || 
               p.name === 'really-simple-ssl' ||  // Legacy name
               p.name === 'ssl-insecure-content-fixer' ||
               p.name.includes('simple-security') ||
               p.name.includes('simple-ssl');
      }
      
      return false;
    });
    
    if (!found) {
      issues.push({
        category: 'plugins',
        severity: 'warning',
        title: `Required plugin missing: ${required}`,
        description: `The plugin ${required} is part of the standard stack but is not active.`,
        recommendation: `Install and activate ${required}.`,
        auto_fixable: false,
        fix_action: null,
        fix_params: {},
      });
    }
  }

  // Check for problematic plugins
  for (const problematic of PROBLEMATIC_PLUGINS) {
    const found = active.find((p) => {
      // Exact match first
      if (p.name === problematic.slug) return true;
      
      // Check for common variations
      if (problematic.slug === 'wordpress-seo') {
        return p.name === 'wordpress-seo' || p.name === 'yoast-seo';
      }
      
      return false;
    });
    
    if (found) {
      issues.push({
        category: 'plugins',
        severity: 'warning',
        title: `Problematic plugin active: ${found.name}`,
        description: problematic.reason,
        recommendation: `Consider replacing or removing ${found.name}.`,
        auto_fixable: false,
        fix_action: null,
        fix_params: {},
      });
    }
  }

  // Check for non-standard plugins (info only)
  const nonStandard = active.filter((p) => !STANDARD_PLUGINS.includes(p.name));
  if (nonStandard.length > 5) {
    issues.push({
      category: 'plugins',
      severity: 'info',
      title: `${nonStandard.length} non-standard plugins`,
      description: `Custom plugins: ${nonStandard.map((p) => p.name).join(', ')}`,
      recommendation: 'Review if all custom plugins are necessary.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  const data: PluginAuditData = {
    total: plugins.length,
    active: active.length,
    inactive: inactive.length,
    needs_update: needsUpdate.length,
    plugins: plugins.map((p) => ({
      name: p.name,
      status: p.status as 'active' | 'inactive',
      version: p.version,
      update_version: p.update_version,
      title: p.title,
    })),
  };

  return { data, issues };
}
