// Plugins that should be on every site (Asymmetric Marketing standard stack)
export const REQUIRED_PLUGINS = [
  'really-simple-ssl',      // Security
  'wp-rocket',              // Caching
  'seopress',               // SEO (folder name is 'seopress')
  'gravityforms',           // Forms
  'wp-mail-smtp',           // Email
];

// Plugins commonly used (not required, but expected)
export const STANDARD_PLUGINS = [
  // Required plugins (Asymmetric standard)
  'really-simple-ssl',
  'wp-rocket',
  'seopress',
  'seopress-pro',
  'wp-seopress',
  'wp-seopress-pro',
  'gravityforms',
  'wp-mail-smtp',

  // Page builders
  'elementor',
  'elementor-pro',
  'beaver-builder-lite-version',
  'bb-plugin',
  'bb-theme-builder',

  // Theme
  'astra-addon-plugin',

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
  { slug: 'wordfence', reason: 'Use Really Simple Security instead (standardization)' },
  { slug: 'wordpress-seo', reason: 'Use SEOPress instead (standardization)' },
  { slug: 'all-in-one-seo-pack', reason: 'Use SEOPress instead (standardization)' },
  { slug: 'seo-by-rank-math', reason: 'Use SEOPress instead (standardization)' },
];

// Plugins that should never be auto-updated
export const NO_AUTO_UPDATE_PLUGINS = [
  'woocommerce',
  'elementor-pro',
  'bb-plugin',
  'gravityforms',
  'acf-pro',
];
