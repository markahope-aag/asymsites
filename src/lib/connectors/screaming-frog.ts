// Screaming Frog CLI integration for backend performance monitoring
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Screaming Frog CLI executable path
const SCREAMING_FROG_CLI = 'C:\\Program Files (x86)\\Screaming Frog SEO Spider\\ScreamingFrogSEOSpider.exe';

export interface ScreamingFrogResults {
  crawl_summary: {
    total_urls: number;
    crawl_time_seconds: number;
    errors_4xx: number;
    errors_5xx: number;
    redirects_3xx: number;
    success_2xx: number;
  };
  performance_metrics: {
    avg_response_time_ms: number;
    slow_pages_count: number;
    large_pages_count: number;
    broken_links_count: number;
  };
  backend_issues: {
    server_errors: Array<{
      url: string;
      status_code: number;
      response_time_ms: number;
    }>;
    slow_pages: Array<{
      url: string;
      response_time_ms: number;
      size_kb: number;
    }>;
    broken_links: Array<{
      source_url: string;
      target_url: string;
      status_code: number;
    }>;
  };
}

export async function crawlSiteForBackendMetrics(
  siteUrl: string,
  options: {
    maxPages?: number;
    timeout?: number;
    outputFolder?: string;
    authConfig?: any;
  } = {}
): Promise<ScreamingFrogResults> {
  const {
    maxPages = 100,
    timeout = 300000, // 5 minutes
    outputFolder = path.join(process.cwd(), 'temp', 'screaming-frog')
  } = options;

  console.log(`[Screaming Frog] Starting crawl for ${siteUrl}...`);

  // Ensure output folder exists (this was the bug!)
  await fs.mkdir(outputFolder, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const crawlName = `crawl-${timestamp}`;
  const outputPath = path.join(outputFolder, crawlName);
  
  // Also ensure the specific output path exists
  await fs.mkdir(outputPath, { recursive: true });

  try {
    // Build CLI command for backend performance focus
    const command = [
      `"${SCREAMING_FROG_CLI}"`,
      '--headless',
      `--crawl "${siteUrl}"`,
      `--output-folder "${outputPath}"`,
      `--task-name "${crawlName}"`,
      '--timestamped-output',
      '--export-tabs "Response Codes:All,Page Titles:All,Meta Description:All"',
      '--bulk-export "response_codes,page_titles,redirect_chains"',
      '--save-crawl'
    ].join(' ');

    console.log(`[Screaming Frog] Running command: ${command}`);

    // Execute crawl
    const { stdout, stderr } = await execAsync(command, { 
      timeout,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    console.log(`[Screaming Frog] Crawl completed for ${siteUrl}`);
    
    // Parse results from exported files
    const results = await parseScreamingFrogResults(outputPath, siteUrl);
    
    // Cleanup temporary files
    await cleanupTempFiles(outputPath);
    
    return results;

  } catch (error) {
    console.error(`[Screaming Frog] Crawl failed for ${siteUrl}:`, error);
    
    // Cleanup on error
    try {
      await cleanupTempFiles(outputPath);
    } catch (cleanupError) {
      console.error(`[Screaming Frog] Cleanup failed:`, cleanupError);
    }
    
    throw new Error(`Screaming Frog crawl failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function parseScreamingFrogResults(outputPath: string, siteUrl: string): Promise<ScreamingFrogResults> {
  console.log(`[Screaming Frog] Parsing results from ${outputPath}...`);

  try {
    // Look for exported CSV files
    const files = await fs.readdir(outputPath, { recursive: true });
    const csvFiles = files.filter(f => typeof f === 'string' && f.endsWith('.csv'));
    
    console.log(`[Screaming Frog] Found ${csvFiles.length} CSV files:`, csvFiles);

    // Initialize results structure
    const results: ScreamingFrogResults = {
      crawl_summary: {
        total_urls: 0,
        crawl_time_seconds: 0,
        errors_4xx: 0,
        errors_5xx: 0,
        redirects_3xx: 0,
        success_2xx: 0,
      },
      performance_metrics: {
        avg_response_time_ms: 0,
        slow_pages_count: 0,
        large_pages_count: 0,
        broken_links_count: 0,
      },
      backend_issues: {
        server_errors: [],
        slow_pages: [],
        broken_links: [],
      },
    };

    // Parse response codes file for backend metrics
    const responseCodesFile = csvFiles.find(f => f.includes('response_codes') || f.includes('Response Codes'));
    if (responseCodesFile) {
      await parseResponseCodes(path.join(outputPath, responseCodesFile), results);
    }

    // Parse redirect chains for performance issues
    const redirectsFile = csvFiles.find(f => f.includes('redirect_chains') || f.includes('Redirect'));
    if (redirectsFile) {
      await parseRedirectChains(path.join(outputPath, redirectsFile), results);
    }

    console.log(`[Screaming Frog] Parsed results: ${results.crawl_summary.total_urls} URLs, ${results.crawl_summary.errors_5xx} server errors`);
    
    return results;

  } catch (error) {
    console.error(`[Screaming Frog] Failed to parse results:`, error);
    throw new Error(`Failed to parse Screaming Frog results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function parseResponseCodes(filePath: string, results: ScreamingFrogResults): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').slice(1); // Skip header
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const columns = line.split(',');
      if (columns.length < 3) continue;
      
      const url = columns[0]?.replace(/"/g, '');
      const statusCode = parseInt(columns[1]) || 0;
      const responseTime = parseFloat(columns[2]) || 0;
      
      if (!url || !statusCode) continue;
      
      results.crawl_summary.total_urls++;
      
      // Categorize by status code
      if (statusCode >= 200 && statusCode < 300) {
        results.crawl_summary.success_2xx++;
      } else if (statusCode >= 300 && statusCode < 400) {
        results.crawl_summary.redirects_3xx++;
      } else if (statusCode >= 400 && statusCode < 500) {
        results.crawl_summary.errors_4xx++;
      } else if (statusCode >= 500) {
        results.crawl_summary.errors_5xx++;
        
        // Track server errors for backend monitoring
        results.backend_issues.server_errors.push({
          url,
          status_code: statusCode,
          response_time_ms: responseTime,
        });
      }
      
      // Track slow pages (>3 seconds)
      if (responseTime > 3000) {
        results.performance_metrics.slow_pages_count++;
        results.backend_issues.slow_pages.push({
          url,
          response_time_ms: responseTime,
          size_kb: 0, // Would need additional data
        });
      }
    }
    
    // Calculate average response time
    if (results.crawl_summary.total_urls > 0) {
      // This would need to be calculated from all response times
      results.performance_metrics.avg_response_time_ms = 0; // Placeholder
    }
    
  } catch (error) {
    console.error(`[Screaming Frog] Failed to parse response codes:`, error);
  }
}

async function parseRedirectChains(filePath: string, results: ScreamingFrogResults): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').slice(1); // Skip header
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const columns = line.split(',');
      if (columns.length < 2) continue;
      
      const sourceUrl = columns[0]?.replace(/"/g, '');
      const targetUrl = columns[1]?.replace(/"/g, '');
      
      if (!sourceUrl || !targetUrl) continue;
      
      // Track broken redirects as backend issues
      results.backend_issues.broken_links.push({
        source_url: sourceUrl,
        target_url: targetUrl,
        status_code: 0, // Would need additional data
      });
    }
    
    results.performance_metrics.broken_links_count = results.backend_issues.broken_links.length;
    
  } catch (error) {
    console.error(`[Screaming Frog] Failed to parse redirect chains:`, error);
  }
}

async function cleanupTempFiles(outputPath: string): Promise<void> {
  try {
    await fs.rm(outputPath, { recursive: true, force: true });
    console.log(`[Screaming Frog] Cleaned up temp files: ${outputPath}`);
  } catch (error) {
    console.error(`[Screaming Frog] Failed to cleanup temp files:`, error);
  }
}

// Test function for development
export async function testScreamingFrogCrawl(testUrl: string = 'https://example.com'): Promise<void> {
  try {
    console.log(`🧪 Testing Screaming Frog crawl for ${testUrl}...`);
    
    const results = await crawlSiteForBackendMetrics(testUrl, {
      maxPages: 10,
      timeout: 60000, // 1 minute for testing
    });
    
    console.log('✅ Test results:', JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}