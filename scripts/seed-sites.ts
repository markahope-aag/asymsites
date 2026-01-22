import { createClient } from '@supabase/supabase-js';

// Run with: npx tsx scripts/seed-sites.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Example sites - replace with your actual sites
const sites = [
  {
    name: 'Example Site 1',
    domain: 'example1.com',
    wpengine_install_id: 'example1',
    wpengine_environment: 'production',
    cloudflare_zone_id: null,
    client_name: 'Client A',
    page_builder: 'elementor',
    is_ecommerce: false,
    monthly_fee: 150.00,
  },
  {
    name: 'Example Site 2',
    domain: 'example2.com',
    wpengine_install_id: 'example2',
    wpengine_environment: 'production',
    cloudflare_zone_id: null,
    client_name: 'Client B',
    page_builder: 'gutenberg',
    is_ecommerce: true,
    monthly_fee: 200.00,
  },
  // Add more sites here...
];

async function seed() {
  console.log('Seeding sites...');

  for (const site of sites) {
    const { error } = await supabase.from('sites').upsert(site, {
      onConflict: 'domain',
    });

    if (error) {
      console.error(`Failed to insert ${site.name}:`, error.message);
    } else {
      console.log(`✓ ${site.name}`);
    }
  }

  console.log('Done.');
}

seed();
