export interface Site {
  id: string;
  name: string;
  domain: string;
  wpengine_install_id: string;
  wpengine_site_name: string | null;
  wpengine_environment: string;
  cloudflare_zone_id: string | null;
  client_name: string | null;
  page_builder: 'elementor' | 'beaver' | 'gutenberg' | 'other' | null;
  monthly_fee: number;
  is_ecommerce: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  site_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  health_score: number | null;
  summary: string | null;
  raw_data: AuditRawData;
  error_message: string | null;
  created_at: string;
}

export interface AuditRawData {
  plugins?: PluginAuditData;
  database?: DatabaseAuditData;
  performance?: PerformanceAuditData;
  security?: SecurityAuditData;
  seo?: SEOAuditData;
  crawl?: CrawlAuditData;
}

export interface PluginAuditData {
  total: number;
  active: number;
  inactive: number;
  needs_update: number;
  plugins: PluginInfo[];
}

export interface PluginInfo {
  name: string;
  status: 'active' | 'inactive' | 'must-use' | 'dropin';
  version: string;
  update_version?: string;
  title?: string;
}

export interface DatabaseAuditData {
  total_size_mb: number;
  autoload_size_kb: number;
  revision_count: number;
  transient_count: number;
  spam_comments: number;
  tables: TableInfo[];
  large_autoload_options: AutoloadOption[];
}

export interface TableInfo {
  name: string;
  rows: number;
  size_mb: number;
}

export interface AutoloadOption {
  name: string;
  size_bytes: number;
}

export interface PerformanceAuditData {
  cloudflare?: {
    requests_24h: number;
    cached_requests_24h: number;
    cache_hit_ratio: number;
    bandwidth_mb: number;
    bandwidth_saved_mb: number;
    threats_24h: number;
    status_5xx_24h: number;
    status_4xx_24h: number;
    ssl_encrypted_requests: number;
    bot_requests: number;
    bot_score_avg: number;
    countries_top: Array<{ country: string; requests: number }>;
    ssl_protocol_breakdown: Record<string, number>;
  };
  response_time_ms?: number;
  ttfb_ms?: number;
}

export interface SecurityAuditData {
  wp_version: string;
  wp_update_available: boolean;
  php_version: string;
  ssl_valid: boolean;
  xmlrpc_enabled: boolean;
  debug_mode: boolean;
  file_editing_disabled: boolean;
  admin_users: AdminUser[];
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  display_name: string;
}

export interface SEOAuditData {
  has_robots_txt: boolean;
  has_sitemap: boolean;
  sitemap_url_count: number;
  seo_plugin: string | null;
}

export interface Issue {
  id: string;
  site_id: string;
  audit_id: string | null;
  category: 'plugins' | 'database' | 'performance' | 'security' | 'seo';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string | null;
  recommendation: string | null;
  auto_fixable: boolean;
  fix_action: string | null;
  fix_params: Record<string, unknown>;
  status: 'open' | 'fixed' | 'ignored' | 'in_progress';
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface ActionLog {
  id: string;
  site_id: string;
  issue_id: string | null;
  action_type: string;
  action_params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SiteDashboard extends Site {
  latest_audit_id: string | null;
  latest_health_score: number | null;
  latest_audit_at: string | null;
  latest_audit_status: string | null;
  open_issues_count: number;
  critical_issues_count: number;
}

// Performance metrics tables for historical tracking
export interface WPEngineMetrics {
  id: string;
  site_id: string;
  audit_id: string;
  cache_hit_ratio: number;
  average_latency_ms: number;
  error_rate: number;
  page_requests_peak_hour: number;
  slow_pages_count: number;
  recorded_at: string;
  created_at: string;
}

export interface CloudflareMetrics {
  id: string;
  site_id: string;
  audit_id: string;
  requests_24h: number;
  cached_requests_24h: number;
  cache_hit_ratio: number;
  bandwidth_mb: number;
  bandwidth_saved_mb: number;
  threats_24h: number;
  status_5xx_24h: number;
  status_4xx_24h: number;
  ssl_encrypted_requests: number;
  bot_requests: number;
  bot_score_avg: number | null;
  recorded_at: string;
  created_at: string;
}

export interface DatabaseMetrics {
  id: string;
  site_id: string;
  audit_id: string;
  total_size_mb: number;
  autoload_size_kb: number;
  revision_count: number;
  transient_count: number;
  recorded_at: string;
  created_at: string;
}

export interface PluginMetrics {
  id: string;
  site_id: string;
  audit_id: string;
  total_plugins: number;
  active_plugins: number;
  inactive_plugins: number;
  plugins_needing_updates: number;
  recorded_at: string;
  created_at: string;
}

// Screaming Frog crawl audit data
export interface CrawlAuditData {
  crawl_summary: {
    total_pages: number;
    crawl_duration_seconds: number;
    avg_response_time_ms: number;
    error_rate_percent: number;
    crawl_completed_at: string;
  };
  
  backend_health: {
    server_errors_5xx: number;
    client_errors_4xx: number;
    slow_pages_count: number;
    broken_links_count: number;
    redirect_chains_count: number;
    large_pages_count: number;
  };
  
  core_web_vitals?: {
    lcp_avg_ms: number;
    cls_avg_score: number;
    fid_avg_ms: number;
    pages_failing_cwv: number;
    cwv_pass_rate_percent: number;
  };
  
  performance_issues: Array<{
    type: 'server_error' | 'slow_page' | 'broken_link' | 'large_page' | 'redirect_chain';
    url: string;
    details: string;
    severity: 'critical' | 'warning' | 'info';
    response_time_ms?: number;
    status_code?: number;
    page_size_kb?: number;
  }>;
}

// Check result type used by auditor
export interface CheckResult {
  data: PluginAuditData | DatabaseAuditData | PerformanceAuditData | SecurityAuditData | SEOAuditData | CrawlAuditData;
  issues: Omit<Issue, 'id' | 'site_id' | 'audit_id' | 'status' | 'resolved_at' | 'resolved_by' | 'created_at'>[];
}
