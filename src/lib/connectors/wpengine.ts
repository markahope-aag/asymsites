const WPE_API_BASE = 'https://api.wpengineapi.com/v1';

function getAuthHeader(): string {
  const user = process.env.WPENGINE_API_USER;
  const password = process.env.WPENGINE_API_PASSWORD;

  if (!user || !password) {
    throw new Error('WPEngine API credentials not configured');
  }

  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

async function wpeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${WPE_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WPEngine API error (${response.status}): ${error}`);
  }

  return response.json();
}

// Types

export interface WPEInstall {
  id: string;
  name: string;
  environment: string;
  primary_domain: string;
  php_version: string;
  cname: string;
  is_multisite: boolean;
}

export interface WPEBackup {
  id: string;
  description: string;
  created_at: string;
  status: string;
}

export interface WPEPerformanceInsights {
  cache_hit_ratio: number;
  average_latency_ms: number;
  error_rate: number;
  page_requests_peak_hour: number;
  slow_pages_count: number;
}

// API functions

export async function listInstalls(): Promise<{ results: WPEInstall[] }> {
  return wpeRequest('/installs');
}

export async function getInstall(installId: string): Promise<WPEInstall> {
  return wpeRequest(`/installs/${installId}`);
}

export async function listBackups(installId: string): Promise<{ results: WPEBackup[] }> {
  return wpeRequest(`/installs/${installId}/backups`);
}

export async function createBackup(
  installId: string,
  description: string
): Promise<WPEBackup> {
  return wpeRequest(`/installs/${installId}/backups`, {
    method: 'POST',
    body: JSON.stringify({
      description,
      notification_emails: [],
    }),
  });
}

export async function purgeCache(installId: string): Promise<void> {
  await wpeRequest(`/installs/${installId}/purge_cache`, {
    method: 'POST',
  });
}

export async function getStatus(installId: string): Promise<{
  status: string;
  php_version: string;
}> {
  return wpeRequest(`/installs/${installId}/status`);
}

export async function getPerformanceInsights(installId: string): Promise<WPEPerformanceInsights> {
  // Note: This endpoint may not exist yet in WPEngine's API
  // Based on research, Performance Insights data is available in the dashboard
  // but may require API enhancement from WPEngine to access programmatically
  try {
    const response = await wpeRequest(`/installs/${installId}/performance-insights`);
    return response;
  } catch (error) {
    // Fallback: Return placeholder data with a note
    console.warn(`[WPEngine] Performance Insights API not available for install ${installId}:`, error);
    throw new Error('WPEngine Performance Insights API not available. Check WPEngine dashboard for cache hit ratio.');
  }
}
