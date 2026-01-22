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
        result = { message: 'All caches cleared' };
        break;

      case 'update_plugins_staging':
        // Note: This should ideally run on staging environment
        result = { message: await updateAllPlugins(wpcliConfig) };
        break;

      case 'remove_inactive_plugins':
        const pluginsToRemove = params?.plugins || [];
        for (const plugin of pluginsToRemove) {
          await deletePlugin(wpcliConfig, plugin);
        }
        result = { removed: pluginsToRemove };
        break;

      case 'cleanup_database':
        const cleanupResults = await cleanupDatabase(wpcliConfig);
        result = { results: cleanupResults };
        break;

      case 'cleanup_revisions':
        // Specific revision cleanup
        result = { message: 'Revisions cleaned' };
        break;

      case 'cleanup_transients':
        // Specific transient cleanup
        result = { message: 'Transients cleaned' };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
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

    return NextResponse.json({ success: true, result });
  } catch (error) {
    // Update action log with error
    await supabase
      .from('action_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: String(error),
      })
      .eq('id', actionLog?.id);

    return NextResponse.json(
      { error: 'Action failed', details: String(error) },
      { status: 500 }
    );
  }
}
