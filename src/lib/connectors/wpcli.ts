import { Client, ConnectConfig } from 'ssh2';

export interface WPCLIConfig {
  installName: string;
  environment?: string;
}

function getSSHConfig(installName: string): ConnectConfig {
  let privateKey = process.env.WPENGINE_SSH_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('WPENGINE_SSH_PRIVATE_KEY not configured');
  }

  // Handle escaped newlines from environment variables
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return {
    host: `${installName}.ssh.wpengine.net`,
    port: 22,
    username: installName,
    privateKey: privateKey,
    readyTimeout: 30000,
  };
}

export async function runWPCLI(
  config: WPCLIConfig,
  command: string,
  options: { format?: 'json' | 'csv' | 'table'; timeout?: number } = {}
): Promise<string> {
  const { format = 'json', timeout = 120000 } = options; // Increased to 2 minutes

  // Wrap entire operation with a hard timeout to prevent hangs
  const connectionPromise = new Promise<string>((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let errorOutput = '';
    let commandTimeoutId: NodeJS.Timeout;
    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(commandTimeoutId);
      try {
        conn.end();
      } catch {
        // Ignore cleanup errors
      }
    };

    commandTimeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`WP-CLI command '${command}' timed out after ${timeout}ms on ${config.installName}`));
    }, timeout);

    conn.on('ready', () => {
      const formatFlag = format !== 'table' ? ` --format=${format}` : '';
      const fullCommand = `wp ${command}${formatFlag}`;

      conn.exec(fullCommand, (err, stream) => {
        if (err) {
          cleanup();
          reject(err);
          return;
        }

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code: number) => {
          cleanup();

          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`WP-CLI error (code ${code}): ${errorOutput || output}`));
          }
        });
      });
    });

    conn.on('error', (err) => {
      cleanup();
      reject(new Error(`SSH connection error: ${err.message}`));
    });

    conn.on('close', () => {
      if (!resolved) {
        cleanup();
        reject(new Error('SSH connection closed unexpectedly'));
      }
    });

    conn.on('timeout', () => {
      cleanup();
      reject(new Error('SSH connection timed out'));
    });

    conn.connect(getSSHConfig(config.installName));
  });

  // Hard timeout wrapper - ensures we never hang indefinitely
  const hardTimeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`SSH operation timed out after ${timeout + 5000}ms (hard timeout)`));
    }, timeout + 5000);
  });

  return Promise.race([connectionPromise, hardTimeout]);
}

// Typed helper functions

export async function getPluginList(config: WPCLIConfig) {
  const output = await runWPCLI(config, 'plugin list');
  return JSON.parse(output) as Array<{
    name: string;
    status: string;
    update: string;
    version: string;
    update_version?: string;
    title?: string;
  }>;
}

export async function getThemeList(config: WPCLIConfig) {
  const output = await runWPCLI(config, 'theme list');
  return JSON.parse(output);
}

export async function getCoreVersion(config: WPCLIConfig) {
  const output = await runWPCLI(config, 'core version', { format: 'table' });
  return output.trim();
}

export async function checkCoreUpdates(config: WPCLIConfig) {
  try {
    const output = await runWPCLI(config, 'core check-update');
    return JSON.parse(output);
  } catch {
    // No updates available returns non-zero
    return [];
  }
}

export async function verifyChecksums(config: WPCLIConfig) {
  try {
    await runWPCLI(config, 'core verify-checksums', { format: 'table', timeout: 180000 }); // 3 minutes
    return { valid: true, errors: [] };
  } catch (err) {
    return { valid: false, errors: [String(err)] };
  }
}

export async function getDbSize(config: WPCLIConfig) {
  const output = await runWPCLI(config, 'db size --tables --format=json');
  return JSON.parse(output);
}

export async function getAutoloadOptions(config: WPCLIConfig) {
  const output = await runWPCLI(config, 'option list --autoload=on');
  return JSON.parse(output);
}

export async function getOption(config: WPCLIConfig, optionName: string) {
  const output = await runWPCLI(config, `option get ${optionName}`, { format: 'table' });
  return output.trim();
}

export async function getUserList(config: WPCLIConfig, role?: string) {
  const roleFlag = role ? ` --role=${role}` : '';
  const output = await runWPCLI(config, `user list${roleFlag}`);
  return JSON.parse(output);
}

export async function getPostCount(config: WPCLIConfig, postType: string) {
  const output = await runWPCLI(config, `post list --post_type=${postType} --format=count`, { format: 'table' });
  return parseInt(output.trim(), 10);
}

export async function getRevisionCount(config: WPCLIConfig) {
  return getPostCount(config, 'revision');
}

export async function getTransientCount(config: WPCLIConfig) {
  try {
    const output = await runWPCLI(config, 'transient list --format=count', { format: 'table' });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    // Fallback if transient list fails
    return 0;
  }
}

// Action commands (use with caution)

export async function updatePlugin(config: WPCLIConfig, pluginSlug: string) {
  return runWPCLI(config, `plugin update ${pluginSlug}`, { format: 'table' });
}

export async function updateAllPlugins(config: WPCLIConfig) {
  return runWPCLI(config, 'plugin update --all', { format: 'table', timeout: 300000 });
}

export async function deactivatePlugin(config: WPCLIConfig, pluginSlug: string) {
  return runWPCLI(config, `plugin deactivate ${pluginSlug}`, { format: 'table' });
}

export async function deletePlugin(config: WPCLIConfig, pluginSlug: string) {
  return runWPCLI(config, `plugin delete ${pluginSlug}`, { format: 'table' });
}

export async function cleanupDatabase(config: WPCLIConfig) {
  const results = [];

  // Delete revisions
  results.push(await runWPCLI(config, 'post delete $(wp post list --post_type=revision --format=ids) --force', { format: 'table' }).catch(() => 'No revisions'));

  // Delete transients
  results.push(await runWPCLI(config, 'transient delete --expired', { format: 'table' }).catch(() => 'No expired transients'));

  // Optimize tables
  results.push(await runWPCLI(config, 'db optimize', { format: 'table' }));

  return results;
}

export async function flushCache(config: WPCLIConfig) {
  return runWPCLI(config, 'cache flush', { format: 'table' });
}
