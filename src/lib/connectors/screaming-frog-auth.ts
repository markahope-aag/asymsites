// Screaming Frog authentication configuration for CLI crawls
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AuthConfig {
  // Basic HTTP Authentication
  basicAuth?: {
    username: string;
    password: string;
    realm?: string;
  };
  
  // Form-based login
  formAuth?: {
    loginUrl: string;
    usernameField: string;
    passwordField: string;
    username: string;
    password: string;
    submitButtonSelector?: string;
    successIndicator?: string;
  };
  
  // Custom headers (API keys, tokens)
  customHeaders?: {
    [key: string]: string;
  };
  
  // Cookies for session-based auth
  cookies?: {
    [key: string]: string;
  };
  
  // User agent override
  userAgent?: string;
  
  // Proxy settings if needed
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export async function createScreamingFrogAuthConfig(
  authConfig: AuthConfig,
  outputPath: string
): Promise<string> {
  console.log('[SF Auth] Creating authentication configuration...');

  // Screaming Frog uses XML configuration files
  const xmlConfig = generateAuthXmlConfig(authConfig);
  
  const configPath = path.join(outputPath, 'auth-config.xml');
  await fs.writeFile(configPath, xmlConfig, 'utf-8');
  
  console.log(`[SF Auth] Auth config saved to: ${configPath}`);
  return configPath;
}

function generateAuthXmlConfig(authConfig: AuthConfig): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<seospider>\n';
  xml += '  <configuration>\n';

  // Basic Authentication
  if (authConfig.basicAuth) {
    xml += '    <authentication>\n';
    xml += '      <basic>\n';
    xml += `        <username>${escapeXml(authConfig.basicAuth.username)}</username>\n`;
    xml += `        <password>${escapeXml(authConfig.basicAuth.password)}</password>\n`;
    if (authConfig.basicAuth.realm) {
      xml += `        <realm>${escapeXml(authConfig.basicAuth.realm)}</realm>\n`;
    }
    xml += '      </basic>\n';
    xml += '    </authentication>\n';
  }

  // Form-based Authentication
  if (authConfig.formAuth) {
    xml += '    <form-authentication>\n';
    xml += `      <login-url>${escapeXml(authConfig.formAuth.loginUrl)}</login-url>\n`;
    xml += `      <username-field>${escapeXml(authConfig.formAuth.usernameField)}</username-field>\n`;
    xml += `      <password-field>${escapeXml(authConfig.formAuth.passwordField)}</password-field>\n`;
    xml += `      <username>${escapeXml(authConfig.formAuth.username)}</username>\n`;
    xml += `      <password>${escapeXml(authConfig.formAuth.password)}</password>\n`;
    
    if (authConfig.formAuth.submitButtonSelector) {
      xml += `      <submit-button>${escapeXml(authConfig.formAuth.submitButtonSelector)}</submit-button>\n`;
    }
    
    if (authConfig.formAuth.successIndicator) {
      xml += `      <success-indicator>${escapeXml(authConfig.formAuth.successIndicator)}</success-indicator>\n`;
    }
    
    xml += '    </form-authentication>\n';
  }

  // Custom Headers
  if (authConfig.customHeaders && Object.keys(authConfig.customHeaders).length > 0) {
    xml += '    <custom-headers>\n';
    for (const [name, value] of Object.entries(authConfig.customHeaders)) {
      xml += `      <header name="${escapeXml(name)}" value="${escapeXml(value)}" />\n`;
    }
    xml += '    </custom-headers>\n';
  }

  // Cookies
  if (authConfig.cookies && Object.keys(authConfig.cookies).length > 0) {
    xml += '    <cookies>\n';
    for (const [name, value] of Object.entries(authConfig.cookies)) {
      xml += `      <cookie name="${escapeXml(name)}" value="${escapeXml(value)}" />\n`;
    }
    xml += '    </cookies>\n';
  }

  // User Agent
  if (authConfig.userAgent) {
    xml += `    <user-agent>${escapeXml(authConfig.userAgent)}</user-agent>\n`;
  }

  // Proxy Settings
  if (authConfig.proxy) {
    xml += '    <proxy>\n';
    xml += `      <host>${escapeXml(authConfig.proxy.host)}</host>\n`;
    xml += `      <port>${authConfig.proxy.port}</port>\n`;
    if (authConfig.proxy.username) {
      xml += `      <username>${escapeXml(authConfig.proxy.username)}</username>\n`;
    }
    if (authConfig.proxy.password) {
      xml += `      <password>${escapeXml(authConfig.proxy.password)}</password>\n`;
    }
    xml += '    </proxy>\n';
  }

  xml += '  </configuration>\n';
  xml += '</seospider>\n';

  return xml;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Predefined auth configurations for common WordPress setups
export const WP_AUTH_CONFIGS = {
  // Standard WordPress login
  wordpressLogin: (siteUrl: string, username: string, password: string): AuthConfig => ({
    formAuth: {
      loginUrl: `${siteUrl}/wp-login.php`,
      usernameField: 'log',
      passwordField: 'pwd',
      username,
      password,
      submitButtonSelector: '#wp-submit',
      successIndicator: 'dashboard' // Look for dashboard in URL after login
    }
  }),

  // WPEngine staging with basic auth
  wpengineStaging: (username: string, password: string): AuthConfig => ({
    basicAuth: {
      username,
      password,
      realm: 'WP Engine'
    }
  }),

  // Custom API key header
  apiKeyAuth: (apiKey: string, headerName: string = 'X-API-Key'): AuthConfig => ({
    customHeaders: {
      [headerName]: apiKey
    }
  }),

  // Session-based with cookies
  sessionAuth: (cookies: { [key: string]: string }): AuthConfig => ({
    cookies
  })
};

// Helper function to get auth config for WPEngine sites
export function getWPEngineAuthConfig(site: {
  domain: string;
  wpengine_install_id?: string;
  wpengine_environment?: string;
}): AuthConfig | null {
  
  // Check if it's a staging site that might need basic auth
  if (site.domain.includes('wpenginepowered.com') || 
      site.domain.includes('wpengine.com') ||
      site.wpengine_environment === 'staging') {
    
    // WPEngine staging sites often use basic auth
    const username = process.env.WPENGINE_STAGING_USERNAME;
    const password = process.env.WPENGINE_STAGING_PASSWORD;
    
    if (username && password) {
      return WP_AUTH_CONFIGS.wpengineStaging(username, password);
    }
  }

  // For production sites, check if WordPress login is needed
  const wpUsername = process.env.WP_ADMIN_USERNAME;
  const wpPassword = process.env.WP_ADMIN_PASSWORD;
  
  if (wpUsername && wpPassword) {
    return WP_AUTH_CONFIGS.wordpressLogin(`https://${site.domain}`, wpUsername, wpPassword);
  }

  return null; // No auth needed or credentials not available
}

// Test authentication configuration
export async function testAuthConfig(
  siteUrl: string,
  authConfig: AuthConfig,
  tempDir: string
): Promise<boolean> {
  console.log(`[SF Auth] Testing authentication for ${siteUrl}...`);

  try {
    // Create auth config file
    const configPath = await createScreamingFrogAuthConfig(authConfig, tempDir);
    
    // Test with a minimal crawl
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const SCREAMING_FROG_CLI = 'C:\\Program Files (x86)\\Screaming Frog SEO Spider\\ScreamingFrogSEOSpider.exe';
    
    const command = [
      `"${SCREAMING_FROG_CLI}"`,
      '--headless',
      `--crawl "${siteUrl}"`,
      `--auth-config "${configPath}"`,
      `--output-folder "${tempDir}"`,
      '--export-tabs "Response Codes:All"'
    ].join(' ');

    console.log(`[SF Auth] Testing command: ${command}`);

    const { stdout, stderr } = await execAsync(command, { 
      timeout: 60000, // 1 minute test
      maxBuffer: 1024 * 1024 * 2 // 2MB buffer
    });

    // Check if crawl was successful (look for 200 responses)
    const csvFiles = await fs.readdir(tempDir);
    const responseFile = csvFiles.find(f => f.includes('response_codes'));
    
    if (responseFile) {
      const content = await fs.readFile(path.join(tempDir, responseFile), 'utf-8');
      const has200Response = content.includes(',"200",');
      
      if (has200Response) {
        console.log(`[SF Auth] ✅ Authentication successful for ${siteUrl}`);
        return true;
      } else {
        console.log(`[SF Auth] ❌ Authentication may have failed - no 200 responses found`);
        return false;
      }
    } else {
      console.log(`[SF Auth] ❌ No response codes file generated`);
      return false;
    }

  } catch (error) {
    console.error(`[SF Auth] ❌ Authentication test failed:`, error);
    return false;
  }
}