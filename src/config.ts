import * as path from 'path';
import * as fs from 'fs';

export interface AppConfig {
  env: string;
  searchBillUrl: string;
  getBillScriptUrl: string;
  putBillScriptUrl: string;
  authToken?: string;
  gitSyncEnabled?: boolean;
}

const CONFIG_FILE = 'ysk-bill-js-plugin.config.json';

// 1. 定义默认配置对象
const DEFAULT_CONFIG: Partial<AppConfig> = {
  gitSyncEnabled: true,      // 默认开启 Git 同步
  authToken: '',              // 默认为空 Token
  env: 'erp-test'                  // 默认环境
};

export function loadConfig(workspaceRoot: string): AppConfig | null {
  const configPath = path.join(workspaceRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(raw) as Partial<AppConfig>;

    // 2. 将默认配置与用户定义的配置进行合并（用户配置优先级更高，会覆盖默认值）
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
    } as AppConfig;

    // 3. 校验必填字段（如必要的接口 URL）
    if (!config.searchBillUrl || !config.getBillScriptUrl || !config.putBillScriptUrl) {
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