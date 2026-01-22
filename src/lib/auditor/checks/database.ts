import {
  WPCLIConfig,
  getDbSize,
  getAutoloadOptions,
  getRevisionCount,
  getTransientCount,
} from '@/lib/connectors/wpcli';
import { THRESHOLDS } from '@/lib/constants/thresholds';
import { CheckResult, DatabaseAuditData } from '@/lib/types';

export async function runDatabaseChecks(config: WPCLIConfig): Promise<CheckResult> {
  const issues: CheckResult['issues'] = [];

  // Get database size
  const dbSizeData = await getDbSize(config);
  const tables = Array.isArray(dbSizeData) ? dbSizeData : [];

  let totalSizeMb = 0;
  const tableInfo = tables.map((t: { Name: string; Rows: number; 'Data_length': number }) => {
    const sizeMb = (t.Data_length || 0) / (1024 * 1024);
    totalSizeMb += sizeMb;
    return {
      name: t.Name,
      rows: t.Rows || 0,
      size_mb: Math.round(sizeMb * 100) / 100,
    };
  });

  // Get autoload options
  const autoloadOptions = await getAutoloadOptions(config);
  let autoloadSizeBytes = 0;
  const largeAutoloadOptions: { name: string; size_bytes: number }[] = [];

  for (const opt of autoloadOptions) {
    const size = opt.value?.length || 0;
    autoloadSizeBytes += size;
    if (size > 50000) {
      largeAutoloadOptions.push({
        name: opt.option_name,
        size_bytes: size,
      });
    }
  }

  const autoloadSizeKb = autoloadSizeBytes / 1024;

  // Get counts
  const revisionCount = await getRevisionCount(config);
  const transientCount = await getTransientCount(config);

  // Check autoload size
  if (autoloadSizeKb >= THRESHOLDS.autoload_size_kb.critical) {
    issues.push({
      category: 'database',
      severity: 'critical',
      title: `Autoload data is ${Math.round(autoloadSizeKb)}KB (critical)`,
      description: `Large autoload options: ${largeAutoloadOptions.map((o) => o.name).join(', ')}`,
      recommendation: 'Identify plugins storing excessive data in autoload options and clean up.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  } else if (autoloadSizeKb >= THRESHOLDS.autoload_size_kb.warning) {
    issues.push({
      category: 'database',
      severity: 'warning',
      title: `Autoload data is ${Math.round(autoloadSizeKb)}KB`,
      description: `Consider reviewing autoloaded options.`,
      recommendation: 'Review plugins with large autoload footprints.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check revisions
  if (revisionCount >= THRESHOLDS.revision_count.critical) {
    issues.push({
      category: 'database',
      severity: 'critical',
      title: `${revisionCount.toLocaleString()} post revisions`,
      description: 'Excessive revisions are bloating the database.',
      recommendation: 'Clean up old revisions and configure revision limits.',
      auto_fixable: true,
      fix_action: 'cleanup_revisions',
      fix_params: {},
    });
  } else if (revisionCount >= THRESHOLDS.revision_count.warning) {
    issues.push({
      category: 'database',
      severity: 'warning',
      title: `${revisionCount.toLocaleString()} post revisions`,
      description: 'Consider cleaning up old revisions.',
      recommendation: 'Schedule periodic revision cleanup.',
      auto_fixable: true,
      fix_action: 'cleanup_revisions',
      fix_params: {},
    });
  }

  // Check transients
  if (transientCount >= THRESHOLDS.transient_count.critical) {
    issues.push({
      category: 'database',
      severity: 'critical',
      title: `${transientCount.toLocaleString()} transients in database`,
      description: 'Excessive transients indicate caching issues.',
      recommendation: 'Clean expired transients and investigate source.',
      auto_fixable: true,
      fix_action: 'cleanup_transients',
      fix_params: {},
    });
  } else if (transientCount >= THRESHOLDS.transient_count.warning) {
    issues.push({
      category: 'database',
      severity: 'warning',
      title: `${transientCount.toLocaleString()} transients in database`,
      description: 'Consider cleaning up expired transients.',
      recommendation: 'Run transient cleanup.',
      auto_fixable: true,
      fix_action: 'cleanup_transients',
      fix_params: {},
    });
  }

  // Check total database size
  if (totalSizeMb >= THRESHOLDS.database_size_mb.critical) {
    issues.push({
      category: 'database',
      severity: 'critical',
      title: `Database size is ${Math.round(totalSizeMb)}MB`,
      description: 'Very large database may cause performance issues.',
      recommendation: 'Investigate large tables and consider cleanup.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  } else if (totalSizeMb >= THRESHOLDS.database_size_mb.warning) {
    issues.push({
      category: 'database',
      severity: 'warning',
      title: `Database size is ${Math.round(totalSizeMb)}MB`,
      description: 'Database is larger than typical.',
      recommendation: 'Review database for cleanup opportunities.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  const data: DatabaseAuditData = {
    total_size_mb: Math.round(totalSizeMb * 100) / 100,
    autoload_size_kb: Math.round(autoloadSizeKb * 100) / 100,
    revision_count: revisionCount,
    transient_count: transientCount,
    spam_comments: 0, // TODO: implement
    tables: tableInfo,
    large_autoload_options: largeAutoloadOptions,
  };

  return { data, issues };
}
