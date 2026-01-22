import { createClient } from '@supabase/supabase-js';
import { getInstall } from '@/lib/connectors/wpengine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Sync WPEngine site names for all sites that don't have them
 */
export async function syncWPEngineSiteNames() {
  console.log('Syncing WPEngine site names...');

  // Get all sites without WPEngine site names
  const { data: sites, error } = await supabase
    .from('sites')
    .select('id, wpengine_install_id, wpengine_site_name')
    .is('wpengine_site_name', null);

  if (error) {
    console.error('Error fetching sites:', error);
    return;
  }

  if (!sites || sites.length === 0) {
    console.log('All sites already have WPEngine site names.');
    return;
  }

  console.log(`Found ${sites.length} sites without WPEngine site names.`);

  for (const site of sites) {
    try {
      console.log(`Fetching WPEngine details for install: ${site.wpengine_install_id}`);
      
      const wpeInstall = await getInstall(site.wpengine_install_id);
      
      // Update the site with the proper WPEngine site name
      const { error: updateError } = await supabase
        .from('sites')
        .update({ wpengine_site_name: wpeInstall.name })
        .eq('id', site.id);

      if (updateError) {
        console.error(`Failed to update site ${site.id}:`, updateError);
      } else {
        console.log(`✓ Updated ${site.wpengine_install_id} with site name: ${wpeInstall.name}`);
      }
    } catch (error) {
      console.error(`Failed to fetch WPEngine details for ${site.wpengine_install_id}:`, error);
    }
  }

  console.log('WPEngine site name sync completed.');
}

/**
 * Sync a single site's WPEngine name
 */
export async function syncSingleWPEngineSiteName(siteId: string) {
  const { data: site, error } = await supabase
    .from('sites')
    .select('id, wpengine_install_id')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  try {
    const wpeInstall = await getInstall(site.wpengine_install_id);
    
    const { error: updateError } = await supabase
      .from('sites')
      .update({ wpengine_site_name: wpeInstall.name })
      .eq('id', siteId);

    if (updateError) {
      throw new Error(`Failed to update site: ${updateError.message}`);
    }

    return wpeInstall.name;
  } catch (error) {
    throw new Error(`Failed to fetch WPEngine details: ${error}`);
  }
}