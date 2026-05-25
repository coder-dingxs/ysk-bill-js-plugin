import * as path from 'path';
import * as fs from 'fs';

export interface AppConfig {
  searchUrl: string;
  getScriptUrl: string;
  updateScriptUrl: string;
  authToken?: string;
}

const CONFIG_FILE = 'ysk-bill-js-plugin.config.json';

export function loadConfig(workspaceRoot: string): AppConfig | null {
  const configPath = path.join(workspaceRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as AppConfig;
    if (!config.searchUrl || !config.getScriptUrl || !config.updateScriptUrl) {
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

export function getConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, CONFIG_FILE);
}
