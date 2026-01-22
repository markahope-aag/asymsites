-- Performance metrics tables for historical tracking and trend analysis
-- This enables alerting, reporting, and performance monitoring over time

-- WPEngine performance metrics (server-side)
CREATE TABLE public.wpengine_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  
  -- Key server performance metrics
  cache_hit_ratio decimal(5,4) NOT NULL, -- 0.0000 to 1.0000
  average_latency_ms integer NOT NULL,
  error_rate decimal(6,5) NOT NULL, -- 0.00000 to 1.00000
  page_requests_peak_hour integer NOT NULL,
  slow_pages_count integer NOT NULL DEFAULT 0,
  
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Cloudflare analytics metrics (CDN/edge)
CREATE TABLE public.cloudflare_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  
  -- Traffic and performance
  requests_24h bigint NOT NULL,
  cached_requests_24h bigint NOT NULL,
  cache_hit_ratio decimal(5,4) NOT NULL,
  bandwidth_mb decimal(10,2) NOT NULL,
  bandwidth_saved_mb decimal(10,2) NOT NULL,
  
  -- Security and errors
  threats_24h integer NOT NULL DEFAULT 0,
  status_5xx_24h integer NOT NULL DEFAULT 0,
  status_4xx_24h integer NOT NULL DEFAULT 0,
  ssl_encrypted_requests bigint NOT NULL DEFAULT 0,
  
  -- Bot analytics
  bot_requests integer NOT NULL DEFAULT 0,
  bot_score_avg decimal(5,2), -- Average bot score 0-100
  
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Database health metrics
CREATE TABLE public.database_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  
  total_size_mb decimal(10,2) NOT NULL,
  autoload_size_kb decimal(10,2) NOT NULL,
  revision_count integer NOT NULL DEFAULT 0,
  transient_count integer NOT NULL DEFAULT 0,
  
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Plugin health metrics
CREATE TABLE public.plugin_metrics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  
  total_plugins integer NOT NULL DEFAULT 0,
  active_plugins integer NOT NULL DEFAULT 0,
  inactive_plugins integer NOT NULL DEFAULT 0,
  plugins_needing_updates integer NOT NULL DEFAULT 0,
  
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance and querying
CREATE INDEX idx_wpengine_metrics_site_recorded ON public.wpengine_metrics(site_id, recorded_at DESC);
CREATE INDEX idx_wpengine_metrics_audit ON public.wpengine_metrics(audit_id);
CREATE INDEX idx_wpengine_metrics_cache_ratio ON public.wpengine_metrics(cache_hit_ratio);
CREATE INDEX idx_wpengine_metrics_latency ON public.wpengine_metrics(average_latency_ms);

CREATE INDEX idx_cloudflare_metrics_site_recorded ON public.cloudflare_metrics(site_id, recorded_at DESC);
CREATE INDEX idx_cloudflare_metrics_audit ON public.cloudflare_metrics(audit_id);
CREATE INDEX idx_cloudflare_metrics_requests ON public.cloudflare_metrics(requests_24h);
CREATE INDEX idx_cloudflare_metrics_threats ON public.cloudflare_metrics(threats_24h);

CREATE INDEX idx_database_metrics_site_recorded ON public.database_metrics(site_id, recorded_at DESC);
CREATE INDEX idx_database_metrics_size ON public.database_metrics(total_size_mb);

CREATE INDEX idx_plugin_metrics_site_recorded ON public.plugin_metrics(site_id, recorded_at DESC);
CREATE INDEX idx_plugin_metrics_updates ON public.plugin_metrics(plugins_needing_updates);

-- Views for latest metrics (for dashboard display)
CREATE VIEW public.latest_wpengine_metrics AS
SELECT DISTINCT ON (site_id) *
FROM public.wpengine_metrics
ORDER BY site_id, recorded_at DESC;

CREATE VIEW public.latest_cloudflare_metrics AS
SELECT DISTINCT ON (site_id) *
FROM public.cloudflare_metrics
ORDER BY site_id, recorded_at DESC;

CREATE VIEW public.latest_database_metrics AS
SELECT DISTINCT ON (site_id) *
FROM public.database_metrics
ORDER BY site_id, recorded_at DESC;

CREATE VIEW public.latest_plugin_metrics AS
SELECT DISTINCT ON (site_id) *
FROM public.plugin_metrics
ORDER BY site_id, recorded_at DESC;

-- Comments for documentation
COMMENT ON TABLE public.wpengine_metrics IS 'Historical WPEngine server performance metrics for trend analysis';
COMMENT ON TABLE public.cloudflare_metrics IS 'Historical Cloudflare CDN/edge analytics for performance tracking';
COMMENT ON TABLE public.database_metrics IS 'Historical database health metrics for optimization tracking';
COMMENT ON TABLE public.plugin_metrics IS 'Historical plugin status metrics for maintenance tracking';

COMMENT ON COLUMN public.wpengine_metrics.cache_hit_ratio IS 'Server-side cache hit ratio (0.0-1.0) - more critical than CDN cache';
COMMENT ON COLUMN public.cloudflare_metrics.cache_hit_ratio IS 'CDN edge cache hit ratio (0.0-1.0) - supplements server cache';
COMMENT ON COLUMN public.cloudflare_metrics.bot_score_avg IS 'Average Cloudflare bot score (0-100, higher = more human-like)';