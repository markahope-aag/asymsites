import {
  WPCLIConfig,
  getCoreVersion,
  checkCoreUpdates,
  verifyChecksums,
  getUserList,
  getOption,
  getPluginList,
} from '@/lib/connectors/wpcli';
import { CheckResult, SecurityAuditData } from '@/lib/types';

export async function runSecurityChecks(config: WPCLIConfig): Promise<CheckResult> {
  const issues: CheckResult['issues'] = [];

  // Check for security plugin (Really Simple Security is the standard)
  const plugins = await getPluginList(config);
  const standardSecurityPlugins = ['really-simple-ssl'];
  const otherSecurityPlugins = ['wordfence', 'sucuri-scanner', 'ithemes-security-pro', 'all-in-one-wp-security-and-firewall'];

  const activeStandardSecurity = plugins.find(
    (p) => standardSecurityPlugins.includes(p.name) && p.status === 'active'
  );
  const activeOtherSecurity = plugins.find(
    (p) => otherSecurityPlugins.includes(p.name) && p.status === 'active'
  );

  if (!activeStandardSecurity && !activeOtherSecurity) {
    issues.push({
      category: 'security',
      severity: 'warning',
      title: 'No security plugin detected',
      description: 'No security plugin is active.',
      recommendation: 'Install and configure Really Simple Security (standard plugin).',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  } else if (!activeStandardSecurity && activeOtherSecurity) {
    issues.push({
      category: 'security',
      severity: 'info',
      title: `Non-standard security plugin: ${activeOtherSecurity.name}`,
      description: 'Site is using a different security plugin than the standard (Really Simple Security).',
      recommendation: 'Consider migrating to Really Simple Security for consistency across sites.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Get WordPress version
  const wpVersion = await getCoreVersion(config);

  // Check for core updates
  const coreUpdates = await checkCoreUpdates(config);
  const wpUpdateAvailable = Array.isArray(coreUpdates) && coreUpdates.length > 0;

  if (wpUpdateAvailable) {
    const latestVersion = coreUpdates[0]?.version;
    issues.push({
      category: 'security',
      severity: 'critical',
      title: `WordPress core update available (${wpVersion} → ${latestVersion})`,
      description: 'Running outdated WordPress core is a security risk.',
      recommendation: 'Update WordPress core on staging first, then production.',
      auto_fixable: false, // Core updates are risky
      fix_action: null,
      fix_params: {},
    });
  }

  // Verify checksums
  const checksumResult = await verifyChecksums(config);
  if (!checksumResult.valid) {
    issues.push({
      category: 'security',
      severity: 'critical',
      title: 'WordPress core file integrity check failed',
      description: `Modified or missing files detected: ${checksumResult.errors.join(', ')}`,
      recommendation: 'Investigate modified core files for potential compromise.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check admin users
  const adminUsers = await getUserList(config, 'administrator');

  const weakUsernames = ['admin', 'administrator', 'root', 'user', 'test'];
  const suspiciousAdmins = adminUsers.filter((u: { user_login: string }) =>
    weakUsernames.includes(u.user_login.toLowerCase())
  );

  if (suspiciousAdmins.length > 0) {
    issues.push({
      category: 'security',
      severity: 'warning',
      title: `Weak admin username detected: ${suspiciousAdmins.map((u: { user_login: string }) => u.user_login).join(', ')}`,
      description: 'Common usernames are targets for brute force attacks.',
      recommendation: 'Create new admin account with unique username and remove weak ones.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  if (adminUsers.length > 5) {
    issues.push({
      category: 'security',
      severity: 'info',
      title: `${adminUsers.length} administrator accounts`,
      description: 'Consider if all admin accounts are necessary.',
      recommendation: 'Review and remove unnecessary admin accounts.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  // Check debug mode (try to detect if enabled)
  let debugMode = false;
  try {
    const debugOption = await getOption(config, 'wp_debug_mode');
    debugMode = debugOption === '1' || debugOption === 'true';
  } catch {
    // Option may not exist
  }

  if (debugMode) {
    issues.push({
      category: 'security',
      severity: 'warning',
      title: 'Debug mode may be enabled',
      description: 'Debug mode can expose sensitive information.',
      recommendation: 'Ensure WP_DEBUG is false in production.',
      auto_fixable: false,
      fix_action: null,
      fix_params: {},
    });
  }

  const data: SecurityAuditData = {
    wp_version: wpVersion,
    wp_update_available: wpUpdateAvailable,
    php_version: '', // Would need WPEngine API
    ssl_valid: true, // Assumed on WPEngine
    xmlrpc_enabled: true, // Would need HTTP check
    debug_mode: debugMode,
    file_editing_disabled: true, // Assumed on WPEngine
    admin_users: adminUsers.map((u: { ID: number; user_login: string; user_email: string; display_name: string }) => ({
      id: u.ID,
      username: u.user_login,
      email: u.user_email,
      display_name: u.display_name,
    })),
  };

  return { data, issues };
}
