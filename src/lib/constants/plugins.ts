// Plugins that should be on every site
export const REQUIRED_PLUGINS = [
  'wordfence',
  'wp-optimize',
];

// Plugins commonly used (not required, but expected)
export const STANDARD_PLUGINS = [
  // Page builders
  'elementor',
  'elementor-pro',
  'beaver-builder-lite-version',
  'bb-plugin',
  'bb-theme-builder',

  // Theme
  'astra-addon-plugin',

  // SEO
  'wordpress-seo', // Yoast
  'seo-by-rank-math',

  // Forms
  'wpforms-lite',
  'gravityforms',
  'contact-form-7',

  // Security & Performance
  'wordfence',
  'wp-optimize',
  'autoptimize',

  // Utilities
  'duplicate-post',
  'redirection',
  'safe-svg',
  'classic-editor',
  'advanced-custom-fields',
  'acf-pro',

  // WooCommerce (for ecommerce sites)
  'woocommerce',

  // Analytics
  'google-site-kit',
];

// Plugins known to cause problems
export const PROBLEMATIC_PLUGINS = [
  { slug: 'jetpack', reason: 'Heavy, often unnecessary features enabled' },
  { slug: 'broken-link-checker', reason: 'Database intensive, causes bloat' },
  { slug: 'wp-statistics', reason: 'Database heavy, use GA instead' },
  { slug: 'revision-control', reason: 'Often misconfigured, causes issues' },
  { slug: 'w3-total-cache', reason: 'Conflicts with WPEngine caching' },
  { slug: 'wp-super-cache', reason: 'Conflicts with WPEngine caching' },
  { slug: 'all-in-one-seo-pack', reason: 'Use Yoast or RankMath instead (standardization)' },
];

// Plugins that should never be auto-updated
export const NO_AUTO_UPDATE_PLUGINS = [
  'woocommerce',
  'elementor-pro',
  'bb-plugin',
  'gravityforms',
  'acf-pro',
];
