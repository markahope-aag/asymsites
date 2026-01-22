const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

function getAuthHeader(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!token) {
    throw new Error('Cloudflare API token not configured');
  }

  return `Bearer ${token}`;
}

async function cfRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CF_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || 'Unknown Cloudflare error';
    throw new Error(`Cloudflare API error: ${errorMessage}`);
  }

  return data.result;
}

// Types

export interface CFZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
}

export interface CFAnalytics {
  requests: {
    all: number;
    cached: number;
    uncached: number;
    http_status: Record<string, number>;
  };
  bandwidth: {
    all: number;
    cached: number;
  };
  threats: {
    all: number;
  };
  pageViews: {
    all: number;
  };
}

// API functions

export async function listZones(): Promise<CFZone[]> {
  return cfRequest('/zones');
}

export async function getZone(zoneId: string): Promise<CFZone> {
  return cfRequest(`/zones/${zoneId}`);
}

export async function getAnalytics(
  zoneId: string,
  hours: number = 24
): Promise<{
  requests_total: number;
  requests_cached: number;
  cache_hit_ratio: number;
  bandwidth_total_mb: number;
  threats_total: number;
  status_5xx: number;
}> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();

  const data = await cfRequest<{
    totals: CFAnalytics;
  }>(`/zones/${zoneId}/analytics/dashboard?since=${since}&until=${until}`);

  const totals = data.totals;
  const requests_total = totals.requests.all || 0;
  const requests_cached = totals.requests.cached || 0;

  return {
    requests_total,
    requests_cached,
    cache_hit_ratio: requests_total > 0 ? requests_cached / requests_total : 0,
    bandwidth_total_mb: (totals.bandwidth.all || 0) / (1024 * 1024),
    threats_total: totals.threats.all || 0,
    status_5xx: (totals.requests.http_status?.['500'] || 0) +
                (totals.requests.http_status?.['502'] || 0) +
                (totals.requests.http_status?.['503'] || 0) +
                (totals.requests.http_status?.['504'] || 0),
  };
}

export async function purgeCache(zoneId: string): Promise<void> {
  await cfRequest(`/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify({ purge_everything: true }),
  });
}

export async function purgeCacheUrls(zoneId: string, urls: string[]): Promise<void> {
  await cfRequest(`/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify({ files: urls }),
  });
}
