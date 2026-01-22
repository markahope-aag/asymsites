import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const wpeUser = process.env.WPENGINE_API_USER;
const wpePassword = process.env.WPENGINE_API_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (!wpeUser || !wpePassword) {
  console.error('Missing WPEngine API credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const WPE_API_BASE = 'https://api.wpengineapi.com/v1';

async function fetchWPEngineInstalls() {
  const auth = Buffer.from(`${wpeUser}:${wpePassword}`).toString('base64');

  const response = await fetch(`${WPE_API_BASE}/installs`, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WPEngine API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.results || [];
}

async function importSites() {
  console.log('Fetching installs from WPEngine...');

  const installs = await fetchWPEngineInstalls();

  console.log(`Found ${installs.length} installs\n`);

  for (const install of installs) {
    const site = {
      name: install.name,
      domain: install.primary_domain || `${install.name}.wpengine.com`,
      wpengine_install_id: install.name,
      wpengine_environment: install.environment || 'production',
      is_ecommerce: false,
      monthly_fee: 150.00,
    };

    const { error } = await supabase
      .from('sites')
      .upsert(site, { onConflict: 'domain' });

    if (error) {
      console.error(`✗ ${install.name}: ${error.message}`);
    } else {
      console.log(`✓ ${install.name} (${site.domain})`);
    }
  }

  console.log('\nDone.');
}

importSites().catch(console.error);
