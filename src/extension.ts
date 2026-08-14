import * as vscode from 'vscode';
import { loadConfig, getConfigPath } from './config';
import { ApiClient } from './api';
import { BillTreeProvider } from './billTreeProvider';
import { ScriptEditorManager } from './scriptEditor';
import { GitService } from './gitService';

let treeProvider: BillTreeProvider | undefined;
let scriptEditorManager: ScriptEditorManager | undefined;
let apiClient: ApiClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage('YSK 插件需要先打开一个工作区');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  treeProvider = new BillTreeProvider();
  const treeView = vscode.window.createTreeView('ysk-bill-js-plugin-bills', {
    treeDataProvider: treeProvider,
    manageCheckboxStateManually: true
  });

  const safeSearch = async (keyword: string) => {
    if (!apiClient) {
      vscode.window.showErrorMessage('请先配置 ysk-bill-js-plugin.config.json');
      return;
    }
    const bills = await apiClient.searchBills(keyword);
    treeProvider!.setBills(bills);
  };

  // 1. 注册所有快捷命令与事件监听（只注册一次）
  context.subscriptions.push(
    treeView.onDidChangeCheckboxState(e => {
      treeProvider?.handleCheckboxChange(e.items);
    }),

    vscode.commands.registerCommand('ysk-bill-js-plugin.searchBills', async () => {
      const query = await vscode.window.showInputBox({
        prompt: '输入 BILLSN 或 BILLNAME 搜索',
        placeHolder: '搜索关键词（留空显示全部）',
      });
      if (query === undefined) return;
      try {
        await safeSearch(query);
      } catch (err: any) {
        vscode.window.showErrorMessage(`搜索失败: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('ysk-bill-js-plugin.refreshBills', async () => {
      try {
        await safeSearch('');
      } catch (err: any) {
        vscode.window.showErrorMessage(`刷新失败: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('ysk-bill-js-plugin.openScript', async (item: any) => {
      if (!item || !item.billId) {
        vscode.window.showErrorMessage('请先在表单列表中选中一条数据');
        return;
      }
      if (!scriptEditorManager) {
        vscode.window.showErrorMessage('请先配置 ysk-bill-js-plugin.config.json');
        return;
      }
      await scriptEditorManager.openScript(item);
    }),

    vscode.commands.registerCommand('ysk-bill-js-plugin.saveScript', async () => {
      if (!scriptEditorManager) {
        vscode.window.showErrorMessage('请先配置 ysk-bill-js-plugin.config.json');
        return;
      }
      await scriptEditorManager.saveCurrentScript();
    }),

    vscode.commands.registerCommand('ysk-bill-js-plugin.copyScriptContent', async () => {
      if (!scriptEditorManager) {
        vscode.window.showErrorMessage('请先配置 ysk-bill-js-plugin.config.json');
        return;
      }
      await scriptEditorManager.copyCurrentContent();
    }),

    vscode.commands.registerCommand('ysk-bill-js-plugin.syncScript', async (item: any) => {
      if (!item || !item.billId) {
        vscode.window.showErrorMessage('请先在表单列表中选中一条数据');
        return;
      }
      if (!scriptEditorManager) {
        vscode.window.showErrorMessage('请先配置 ysk-bill-js-plugin.config.json');
        return;
      }
      await scriptEditorManager.syncFromApi(item.billId);
    }),

    vscode.commands.registerCommand('ysk-bill-js-plugin.syncScriptToGit', async () => {
      if (!scriptEditorManager) {
        vscode.window.showErrorMessage('请先配置 ysk-bill-js-plugin.config.json');
        return;
      }
      await scriptEditorManager.syncCurrentFileToGit();
    }),

    vscode.window.onDidChangeActiveTextEditor(() => {
      scriptEditorManager?.updateActiveEditorContext();
    }),

    treeView
  );

  // 2. 核心：封装初始化逻辑
  const initApp = async (): Promise<boolean> => {
    const config = loadConfig(workspaceRoot);
    if (!config) {
      await vscode.commands.executeCommand('setContext', 'yskPlugin:configLoaded', false);
      return false;
    }

    await vscode.commands.executeCommand('setContext', 'yskPlugin:configLoaded', true);

    apiClient = new ApiClient(config);
    const gitService = config.gitSyncEnabled ? new GitService(workspaceRoot) : undefined;
    scriptEditorManager = new ScriptEditorManager(apiClient, workspaceRoot, context.subscriptions, gitService);

    try {
      const bills = await apiClient.searchBills('');
      treeProvider?.setBills(bills);
    } catch (err: any) {
      vscode.window.showErrorMessage(`加载表单列表失败: ${err.message}`);
    }
    return true;
  };

  // 3. 核心：添加配置文件监听器，文件创建或修改时自动热重载配置
  const configWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, 'ysk-bill-js-plugin.config.json')
  );

  configWatcher.onDidChange(() => initApp());
  configWatcher.onDidCreate(() => initApp());
  context.subscriptions.push(configWatcher);

  // 4. 首次尝试初始化
  const isInitialized = await initApp();

  // 5. 若配置未成功加载，引导生成默认配置并自动生效
  if (!isInitialized) {
    const createAction = '生成默认配置';
    const result = await vscode.window.showWarningMessage(
      '未找到 ysk-bill-js-plugin.config.json 配置文件',
      createAction
    );
    if (result === createAction) {
      const configPath = vscode.Uri.file(getConfigPath(workspaceRoot));
      const template = JSON.stringify(
        {
          "searchBillUrl": "http://10.25.1.37:5678/webhook/f8546e48-938f-4473-9ae3-f60f8a93c90c?keyword={keyword}&env=erp",
          "searchBillPageSize": 50,
          "getBillScriptUrl": "http://10.25.1.37:5678/webhook/d8fb6fe5-90e5-400a-8fae-3e5799994fae/erp/{env}/{billId}",
          "putBillScriptUrl": "http://10.25.1.37:5678/webhook/0dd0e0fc-e1a1-4b61-98aa-4ca03118dd05/erp/{env}/{billId}",
          "authToken": "",
          "gitSyncEnabled": true
        },
        null,
        2
      );
      await vscode.workspace.fs.writeFile(configPath, Buffer.from(template, 'utf-8'));
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);

      // 创建完配置文件后立即加载生效，不再需要重启 VS Code
      await initApp();
    }
  }
}

export function deactivate() { }