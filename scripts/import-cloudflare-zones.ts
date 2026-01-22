import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cfToken = process.env.CLOUDFLARE_API_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (!cfToken) {
  console.error('Missing CLOUDFLARE_API_TOKEN');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchCloudflareZones() {
  const response = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=100', {
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || 'Failed to fetch zones');
  }

  return data.result;
}

async function matchZonesToSites() {
  console.log('Fetching Cloudflare zones...');
  const zones = await fetchCloudflareZones();
  console.log(`Found ${zones.length} zones\n`);

  console.log('Fetching sites from database...');
  const { data: sites } = await supabase.from('sites').select('id, domain');

  if (!sites) {
    console.error('No sites found');
    return;
  }

  let matched = 0;

  for (const zone of zones) {
    // Find site with matching domain
    const site = sites.find((s) => {
      const siteDomain = s.domain.replace(/^www\./, '').toLowerCase();
      const zoneName = zone.name.toLowerCase();
      return siteDomain === zoneName || siteDomain.endsWith('.' + zoneName);
    });

    if (site) {
      const { error } = await supabase
        .from('sites')
        .update({ cloudflare_zone_id: zone.id })
        .eq('id', site.id);

      if (error) {
        console.error(`✗ ${zone.name}: ${error.message}`);
      } else {
        console.log(`✓ ${zone.name} → ${site.domain}`);
        matched++;
      }
    } else {
      console.log(`- ${zone.name} (no matching site)`);
    }
  }

  console.log(`\nMatched ${matched} zones to sites.`);
}

matchZonesToSites().catch(console.error);
