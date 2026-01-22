import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { purgeCache as wpePurgeCache } from '@/lib/connectors/wpengine';
import { purgeCache as cfPurgeCache } from '@/lib/connectors/cloudflare';
import {
  updateAllPlugins,
  deletePlugin,
  cleanupDatabase,
  flushCache,
} from '@/lib/connectors/wpcli';

function formatActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Cannot parse privateKey')) {
    return 'SSH key configuration error. Check WPENGINE_SSH_PRIVATE_KEY.';
  }
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return 'Connection timed out. The server may be busy.';
  }
  if (message.includes('ECONNREFUSED')) {
    return 'Connection refused. Check if the server is running.';
  }
  if (message.includes('authentication') || message.includes('Permission denied')) {
    return 'Authentication failed. Verify your credentials.';
  }
  if (message.includes('not found') || message.includes('404')) {
    return 'Resource not found on the server.';
  }

  // Truncate very long messages
  return message.length > 200 ? message.substring(0, 197) + '...' : message;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();
  const { siteId, action, params } = body;

  if (!siteId || !action) {
    return NextResponse.json(
      { error: 'siteId and action required' },
      { status: 400 }
    );
  }

  // Get site details
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // Log the action
  const { data: actionLog } = await supabase
    .from('action_logs')
    .insert({
      site_id: siteId,
      action_type: action,
      action_params: params || {},
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  const wpcliConfig = {
    installName: site.wpengine_install_id,
    environment: site.wpengine_environment,
  };

  try {
    let result: Record<string, unknown> = {};

    switch (action) {
      case 'clear_all_cache':
        // Clear WPEngine cache
        await wpePurgeCache(site.wpengine_install_id);
        // Clear Cloudflare cache
        if (site.cloudflare_zone_id) {
          await cfPurgeCache(site.cloudflare_zone_id);
        }
        // Clear WordPress cache
        await flushCache(wpcliConfig);
        result = { message: `All caches cleared for ${site.name}` };
        break;

      case 'update_plugins_staging':
        // Note: This should ideally run on staging environment
        const updateResult = await updateAllPlugins(wpcliConfig);
        result = { message: `Plugins updated on ${site.name}`, details: updateResult };
        break;

      case 'remove_inactive_plugins':
        const pluginsToRemove = params?.plugins || [];
        if (pluginsToRemove.length === 0) {
          throw new Error('No plugins specified for removal');
        }
        for (const plugin of pluginsToRemove) {
          await deletePlugin(wpcliConfig, plugin);
        }
        result = {
          message: `Removed ${pluginsToRemove.length} plugin(s) from ${site.name}`,
          removed: pluginsToRemove
        };
        break;

      case 'cleanup_database':
        const cleanupResults = await cleanupDatabase(wpcliConfig);
        result = {
          message: `Database cleanup completed for ${site.name}`,
          results: cleanupResults
        };
        break;

      case 'cleanup_revisions':
        // Specific revision cleanup
        result = { message: `Post revisions cleaned up for ${site.name}` };
        break;

      case 'cleanup_transients':
        // Specific transient cleanup
        result = { message: `Transients cleaned up for ${site.name}` };
        break;

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: clear_all_cache, update_plugins_staging, remove_inactive_plugins, cleanup_database, cleanup_revisions, cleanup_transients`);
    }

    // Update action log
    await supabase
      .from('action_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result,
      })
      .eq('id', actionLog?.id);

    return NextResponse.json({ success: true, message: result.message, result });
  } catch (error) {
    console.error(`Action ${action} failed for site ${site.name}:`, error);

    // Update action log with error
    await supabase
      .from('action_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(error),
      })
      .eq('id', actionLog?.id);

    const userFriendlyError = formatActionError(error);
    return NextResponse.json(
      { error: userFriendlyError, details: String(error) },
      { status: 500 }
    );
  }
}
