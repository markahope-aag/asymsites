import { createServerClient } from '@/lib/supabase/server';
import { runPluginChecks } from './checks/plugins';
import { runDatabaseChecks } from './checks/database';
import { runPerformanceChecks } from './checks/performance';
import { runSecurityChecks } from './checks/security';
import { runSEOChecks } from './checks/seo';
import { calculateHealthScore } from './scoring';
import { Site, CheckResult, AuditRawData } from '@/lib/types';

export interface AuditResult {
  auditId: string;
  healthScore: number;
  issueCount: number;
  summary: string;
}

export async function runAudit(siteId: string): Promise<AuditResult> {
  const supabase = createServerClient();

  // Get site details
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  // Create audit record
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .insert({
      site_id: siteId,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (auditError || !audit) {
    throw new Error(`Failed to create audit: ${auditError?.message}`);
  }

  const allIssues: CheckResult['issues'] = [];
  const rawData: AuditRawData = {};

  try {
    const wpcliConfig = {
      installName: site.wpengine_install_id,
      environment: site.wpengine_environment,
    };

    // Run plugin checks
    console.log(`[Audit ${audit.id}] Running plugin checks...`);
    const pluginResult = await runPluginChecks(wpcliConfig);
    rawData.plugins = pluginResult.data as AuditRawData['plugins'];
    allIssues.push(...pluginResult.issues);

    // Run database checks
    console.log(`[Audit ${audit.id}] Running database checks...`);
    const dbResult = await runDatabaseChecks(wpcliConfig);
    rawData.database = dbResult.data as AuditRawData['database'];
    allIssues.push(...dbResult.issues);

    // Run performance checks
    console.log(`[Audit ${audit.id}] Running performance checks...`);
    const perfResult = await runPerformanceChecks({
      cloudflareZoneId: site.cloudflare_zone_id || undefined,
      domain: site.domain,
    });
    rawData.performance = perfResult.data as AuditRawData['performance'];
    allIssues.push(...perfResult.issues);

    // Run security checks
    console.log(`[Audit ${audit.id}] Running security checks...`);
    const securityResult = await runSecurityChecks(wpcliConfig);
    rawData.security = securityResult.data as AuditRawData['security'];
    allIssues.push(...securityResult.issues);

    // Run SEO checks
    console.log(`[Audit ${audit.id}] Running SEO checks...`);
    const seoResult = await runSEOChecks({
      ...wpcliConfig,
      domain: site.domain,
    });
    rawData.seo = seoResult.data as AuditRawData['seo'];
    allIssues.push(...seoResult.issues);

    // Calculate health score
    const healthScore = calculateHealthScore(allIssues);

    // Generate summary
    const criticalCount = allIssues.filter((i) => i.severity === 'critical').length;
    const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
    const summary = `Health: ${healthScore}/100. Found ${criticalCount} critical, ${warningCount} warning issues.`;

    // Update audit record
    await supabase
      .from('audits')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        health_score: healthScore,
        raw_data: rawData,
        summary,
      })
      .eq('id', audit.id);

    // Close existing open issues for this site (they'll be recreated if still present)
    await supabase
      .from('issues')
      .update({ status: 'fixed', resolved_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('status', 'open');

    // Insert new issues
    if (allIssues.length > 0) {
      const issuesToInsert = allIssues.map((issue) => ({
        site_id: siteId,
        audit_id: audit.id,
        ...issue,
      }));

      await supabase.from('issues').insert(issuesToInsert);
    }

    console.log(`[Audit ${audit.id}] Completed. Score: ${healthScore}, Issues: ${allIssues.length}`);

    return {
      auditId: audit.id,
      healthScore,
      issueCount: allIssues.length,
      summary,
    };
  } catch (error) {
    console.error(`[Audit ${audit.id}] Failed:`, error);

    await supabase
      .from('audits')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(error),
      })
      .eq('id', audit.id);

    throw error;
  }
}

export async function runAllAudits(): Promise<{ succeeded: number; failed: number }> {
  const supabase = createServerClient();

  const { data: sites } = await supabase.from('sites').select('id, name');

  if (!sites || sites.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const site of sites) {
    try {
      console.log(`Starting audit for ${site.name}...`);
      await runAudit(site.id);
      succeeded++;
    } catch (error) {
      console.error(`Audit failed for ${site.name}:`, error);
      failed++;
    }
  }

  return { succeeded, failed };
}
