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
  // Calculate time range
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const until = new Date();

  // Format for GraphQL API (YYYY-MM-DDTHH:MM:SSZ)
  const sinceStr = since.toISOString();
  const untilStr = until.toISOString();

  console.log(`[Cloudflare] Fetching analytics for zone ${zoneId}...`);

  // Use GraphQL API as primary method (REST Analytics API has been sunset)
  try {
    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1hGroups(
              limit: ${hours}
              filter: { datetime_geq: "${sinceStr}", datetime_lt: "${untilStr}" }
            ) {
              sum {
                requests
                cachedRequests
                bytes
                cachedBytes
                threats
                responseStatusMap {
                  edgeResponseStatus
                  requests
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }

    const zones = result.data?.viewer?.zones;
    if (!zones || zones.length === 0) {
      throw new Error('Zone not found or no data available');
    }

    const groups = zones[0].httpRequests1hGroups || [];

    // Aggregate all time buckets
    let requests_total = 0;
    let requests_cached = 0;
    let bandwidth_total = 0;
    let threats_total = 0;
    let status_5xx = 0;

    for (const group of groups) {
      const sum = group.sum;
      requests_total += sum.requests || 0;
      requests_cached += sum.cachedRequests || 0;
      bandwidth_total += sum.bytes || 0;
      threats_total += sum.threats || 0;

      for (const status of sum.responseStatusMap || []) {
        if (status.edgeResponseStatus >= 500 && status.edgeResponseStatus < 600) {
          status_5xx += status.requests || 0;
        }
      }
    }

    console.log(`[Cloudflare] Got ${requests_total} total requests (${requests_cached} cached)`);

    return {
      requests_total,
      requests_cached,
      cache_hit_ratio: requests_total > 0 ? requests_cached / requests_total : 0,
      bandwidth_total_mb: bandwidth_total / (1024 * 1024),
      threats_total,
      status_5xx,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Cloudflare] GraphQL API failed: ${errorMessage}`);

    // Provide helpful error messages
    if (errorMessage.includes('10000') || errorMessage.includes('Authentication')) {
      throw new Error('API token authentication failed. Check CLOUDFLARE_API_TOKEN.');
    }
    if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('9109')) {
      throw new Error('API token lacks analytics permissions. Add "Zone:Read" and "Analytics:Read" permissions.');
    }
    if (errorMessage.includes('7003') || errorMessage.includes('Could not route')) {
      throw new Error('Zone not found. The zone ID may be incorrect.');
    }
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
      throw new Error('Network error connecting to Cloudflare API. Check internet connection.');
    }
    
    throw new Error(`Analytics unavailable: ${errorMessage}`);
  }
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
