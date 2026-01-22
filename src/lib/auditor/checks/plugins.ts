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
    const found = active.find((p) => p.name === required);
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
    const found = active.find((p) => p.name === problematic.slug);
    if (found) {
      issues.push({
        category: 'plugins',
        severity: 'warning',
        title: `Problematic plugin active: ${problematic.slug}`,
        description: problematic.reason,
        recommendation: `Consider replacing or removing ${problematic.slug}.`,
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
