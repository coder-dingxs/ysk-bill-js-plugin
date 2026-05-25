import * as vscode from 'vscode';
import { loadConfig, getConfigPath } from './config';
import { ApiClient } from './api';
import { BillTreeProvider } from './billTreeProvider';
import { ScriptEditorManager } from './scriptEditor';

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
  });

  const safeSearch = async (keyword: string) => {
    if (!apiClient) {
      vscode.window.showErrorMessage('请先配置 ysk-bill-js-plugin.config.json');
      return;
    }
    const bills = await apiClient.searchBills(keyword);
    treeProvider!.setBills(bills);
  };

  context.subscriptions.push(
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
      await scriptEditorManager.openScript(item.billId, item.billName || item.billId);
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

    vscode.window.onDidChangeActiveTextEditor(() => {
      scriptEditorManager?.updateActiveEditorContext();
    }),

    treeView
  );

  const config = loadConfig(workspaceRoot);
  if (!config) {
    const createAction = '创建模板';
    const result = await vscode.window.showWarningMessage(
      '未找到 ysk-bill-js-plugin.config.json 配置文件',
      createAction
    );
    if (result === createAction) {
      const configPath = vscode.Uri.file(getConfigPath(workspaceRoot));
      const template = JSON.stringify(
        {
          searchUrl: 'http://localhost:3000/api/bills?q={keyword}',
          getScriptUrl: 'http://localhost:3000/api/bills/{billId}/script',
          updateScriptUrl: 'http://localhost:3000/api/bills/{billId}/script',
          authToken: '',
        },
        null,
        2
      );
      await vscode.workspace.fs.writeFile(configPath, Buffer.from(template, 'utf-8'));
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);
    }
    return;
  }

  await vscode.commands.executeCommand('setContext', 'yskPlugin:configLoaded', true);

  apiClient = new ApiClient(config);
  scriptEditorManager = new ScriptEditorManager(apiClient, workspaceRoot, context.subscriptions);

  try {
    const bills = await apiClient.searchBills('');
    treeProvider.setBills(bills);
  } catch (err: any) {
    vscode.window.showErrorMessage(`加载表单列表失败: ${err.message}`);
  }
}

export function deactivate() {}
