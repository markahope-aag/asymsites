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

export interface CloudflareAnalytics {
  requests_total: number;
  requests_cached: number;
  cache_hit_ratio: number;
  bandwidth_total_mb: number;
  bandwidth_saved_mb: number;
  threats_total: number;
  status_5xx: number;
  status_4xx: number;
  bot_requests: number;
  bot_score_avg: number;
  countries_top: Array<{ country: string; requests: number }>;
  ssl_encrypted_requests: number;
  ssl_protocol_breakdown: Record<string, number>;
}

export async function getAnalytics(
  zoneId: string,
  hours: number = 24
): Promise<CloudflareAnalytics> {
  // Calculate time range
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const until = new Date();

  // Format for GraphQL API (YYYY-MM-DDTHH:MM:SSZ)
  const sinceStr = since.toISOString();
  const untilStr = until.toISOString();

  console.log(`[Cloudflare] Fetching analytics for zone ${zoneId}...`);

  // Use GraphQL API with daily grouping for more accurate cache statistics
  // Note: Hourly grouping often shows 0 cached requests, daily is more reliable
  try {
    const days = Math.min(Math.ceil(hours / 24), 7); // Max 7 days for daily grouping
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${zoneId}" }) {
            httpRequests1dGroups(
              limit: ${days}
              filter: { date_geq: "${startDateStr}" }
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
                encryptedRequests
                encryptedBytes
              }
              dimensions {
                date
              }
            }
            httpRequestsAdaptiveGroups(
              limit: 20
              filter: { datetime_geq: "${sinceStr}", datetime_lt: "${untilStr}" }
            ) {
              count
              dimensions {
                clientCountryName
                botScore
                botScoreClass
                clientSSLProtocol
                clientTLSVersion
              }
            }
            firewallEventsAdaptiveGroups(
              limit: 10
              filter: { datetime_geq: "${sinceStr}", datetime_lt: "${untilStr}" }
            ) {
              count
              dimensions {
                action
                source
                ruleId
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

    const groups = zones[0].httpRequests1dGroups || [];

    // Aggregate all time buckets
    let requests_total = 0;
    let requests_cached = 0;
    let bandwidth_total = 0;
    let bandwidth_cached = 0;
    let threats_total = 0;
    let status_5xx = 0;
    let status_4xx = 0;
    let ssl_encrypted_requests = 0;

    for (const group of groups) {
      const sum = group.sum;
      requests_total += sum.requests || 0;
      requests_cached += sum.cachedRequests || 0;
      bandwidth_total += sum.bytes || 0;
      bandwidth_cached += sum.cachedBytes || 0;
      threats_total += sum.threats || 0;
      ssl_encrypted_requests += sum.encryptedRequests || 0;

      for (const status of sum.responseStatusMap || []) {
        if (status.edgeResponseStatus >= 500 && status.edgeResponseStatus < 600) {
          status_5xx += status.requests || 0;
        } else if (status.edgeResponseStatus >= 400 && status.edgeResponseStatus < 500) {
          status_4xx += status.requests || 0;
        }
      }
    }

    // Process firewall events
    const firewallEvents = zones[0].firewallEventsAdaptiveGroups || [];
    let firewall_blocks = 0;
    let firewall_challenges = 0;
    
    for (const event of firewallEvents) {
      if (event.dimensions?.action === 'block') {
        firewall_blocks += event.count || 0;
      } else if (event.dimensions?.action === 'challenge') {
        firewall_challenges += event.count || 0;
      }
    }

    // Process bot analytics, geographic data, and SSL protocols
    const httpRequestsAdaptive = zones[0].httpRequestsAdaptiveGroups || [];
    let bot_requests = 0;
    let bot_score_sum = 0;
    let bot_score_count = 0;
    const country_requests: Record<string, number> = {};
    const ssl_protocols: Record<string, number> = {};

    for (const group of httpRequestsAdaptive) {
      const count = group.count || 0;
      const dimensions = group.dimensions;

      // Bot analytics
      if (dimensions?.botScore !== undefined) {
        const botScore = parseInt(dimensions.botScore);
        if (botScore <= 30) { // Cloudflare considers scores <= 30 as likely bots
          bot_requests += count;
        }
        bot_score_sum += botScore * count;
        bot_score_count += count;
      }

      // Geographic data
      if (dimensions?.clientCountryName) {
        const country = dimensions.clientCountryName;
        country_requests[country] = (country_requests[country] || 0) + count;
      }

      // SSL protocol breakdown
      if (dimensions?.clientTLSVersion) {
        const protocol = dimensions.clientTLSVersion;
        ssl_protocols[protocol] = (ssl_protocols[protocol] || 0) + count;
      }
    }

    // Calculate average bot score and top countries
    const bot_score_avg = bot_score_count > 0 ? bot_score_sum / bot_score_count : 0;
    const countries_top = Object.entries(country_requests)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([country, requests]) => ({ country, requests }));

    console.log(`[Cloudflare] Got ${requests_total} total requests (${requests_cached} cached) - ${(requests_total > 0 ? (requests_cached / requests_total * 100).toFixed(1) : 0)}% cache hit ratio, ${threats_total + firewall_blocks} threats blocked, ${bot_requests} bot requests`);

    return {
      requests_total,
      requests_cached,
      cache_hit_ratio: requests_total > 0 ? requests_cached / requests_total : 0,
      bandwidth_total_mb: bandwidth_total / (1024 * 1024),
      bandwidth_saved_mb: bandwidth_cached / (1024 * 1024),
      threats_total: threats_total + firewall_blocks,
      status_5xx,
      status_4xx,
      bot_requests,
      bot_score_avg,
      countries_top,
      ssl_encrypted_requests,
      ssl_protocol_breakdown: ssl_protocols
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
