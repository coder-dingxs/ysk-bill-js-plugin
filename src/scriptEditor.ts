import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from './api';
import { GitService } from './gitService';

const CACHE_DIR = 'scripts';

export class ScriptEditorManager {
  private billFileMap = new Map<string, string>();
  private fileBillMap = new Map<string, string>();
  private cacheDir: string;
  private saveBarItem: vscode.StatusBarItem;
  private copyBarItem: vscode.StatusBarItem;
  private gitService: GitService | null;

  constructor(
    private api: ApiClient,
    private workspaceRoot: string,
    private subscriptions: vscode.Disposable[],
    gitService?: GitService
  ) {
    this.gitService = gitService || null;
    this.cacheDir = path.join(workspaceRoot, CACHE_DIR);
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.saveBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 100
    );
    this.saveBarItem.text = '$(database) 保存到数据库';
    this.saveBarItem.tooltip = '将脚本保存回数据库';
    this.saveBarItem.command = 'ysk-bill-js-plugin.saveScript';
    this.saveBarItem.hide();
    this.subscriptions.push(this.saveBarItem);

    this.copyBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 99
    );
    this.copyBarItem.text = '$(copy) 复制全部';
    this.copyBarItem.tooltip = '全选并复制脚本到剪贴板';
    this.copyBarItem.command = 'ysk-bill-js-plugin.copyScriptContent';
    this.copyBarItem.hide();
    this.subscriptions.push(this.copyBarItem);
  }
  /**
   * 纯函数：根据单据信息计算出对应的本地文件路径（不产生网络请求）
   * @param item 
   * @returns 
   */
  private getFilePath(item: any): string {
    const { billId, billName, billSn } = item;
    let fileName = `${billId}-${billName}-${billSn}`;
    let safeName = fileName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').replace(/[\s]/g, '_');
    return path.join(this.cacheDir, `${safeName}.js`);
  }

  /**
   * 核心逻辑：固定每次都请求接口拿数据，并保存到本地缓存目录
   * @param item 
   * @returns 
   */
  async saveScriptToLocal(item: any): Promise<string> {
    const filePath = this.getFilePath(item);

    // 固定从 API 获取最新脚本内容
    let { billScript } = await this.api.getBillScript(item.billId);
    if (billScript === undefined || billScript === null) {
      billScript = '';
    }

    fs.writeFileSync(filePath, billScript, 'utf-8');

    // 更新内存映射
    this.billFileMap.set(item.billId, filePath);
    this.fileBillMap.set(filePath, item.billId);

    return filePath;
  }

  /**
   * 业务入口：打开单据对应的脚本（跨重启依然能精准识别本地缓存）
   * @param item 
   */
  async openScript(item: any): Promise<void> {
    try {
      const { billId } = item;
      const expectedFilePath = this.getFilePath(item);

      let targetFilePath = expectedFilePath;

      // 只要磁盘上有该文件（即使重启过插件），就优先打开磁盘文件，无需重复请求 API
      if (fs.existsSync(expectedFilePath)) {
        // 顺便补全重启后丢失的内存 Map 映射
        this.billFileMap.set(billId, expectedFilePath);
        this.fileBillMap.set(expectedFilePath, billId);
      } else {
        // 本地没有，才调用 saveScriptToLocal 触发 API 请求并保存
        targetFilePath = await this.saveScriptToLocal(item);
      }

      // 打开文件并呈现状态栏控件
      const doc = await vscode.workspace.openTextDocument(targetFilePath);
      // 设置 preview: false，强制以全新的常驻标签页打开
      await vscode.window.showTextDocument(doc, { preview: false });
      this.saveBarItem.show();
      this.copyBarItem.show();
    } catch (err: any) {
      vscode.window.showErrorMessage(`打开脚本失败: ${err.message}`);
    }
  }

  async saveCurrentScript(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('没有打开的编辑器');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const billId = this.fileBillMap.get(filePath);
    if (!billId) {
      vscode.window.showErrorMessage('当前文件不是 YSK 脚本文件');
      return;
    }

    const content = editor.document.getText();
    try {
      await this.api.updateBillScript(billId, content);
      await editor.document.save();
      vscode.window.showInformationMessage(`✅ 脚本 [${billId}] 已保存到数据库`);
      await this.promptAndPushToGit(filePath, billId);
    } catch (err: any) {
      vscode.window.showErrorMessage(`保存失败: ${err.message}`);
    }
  }

  async syncCurrentFileToGit(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('没有打开的编辑器');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const billId = this.fileBillMap.get(filePath);
    if (!billId) {
      vscode.window.showErrorMessage('当前文件不是 YSK 脚本文件');
      return;
    }

    await editor.document.save();
    await this.promptAndPushToGit(filePath, billId);
  }

  private async promptAndPushToGit(filePath: string, billId: string): Promise<void> {
    if (!this.gitService) return;

    const message = await vscode.window.showInputBox({
      prompt: `输入 Git commit message（脚本: ${billId}）`,
      placeHolder: '如：更新 xxx 脚本',
      ignoreFocusOut: true,
    });

    if (message === undefined) return;

    const relativePath = path.relative(this.workspaceRoot, filePath);
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: '正在同步到 Git...' },
        async () => {
          await this.gitService!.commitAndPush(relativePath, message);
        }
      );
      vscode.window.showInformationMessage(`✅ 已同步到 Git`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Git 同步失败: ${err.message}`);
    }
  }

  async copyCurrentContent(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('没有打开的编辑器');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    if (!this.fileBillMap.has(filePath)) {
      vscode.window.showErrorMessage('当前文件不是 YSK 脚本文件');
      return;
    }

    const content = editor.document.getText();
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage(`✅ 已复制 ${content.length} 字符到剪贴板`);
  }

  async syncFromApi(billId: string): Promise<void> {
    try {
      const filePath = this.billFileMap.get(billId);
      if (!filePath) {
        vscode.window.showErrorMessage('未找到对应的缓存文件');
        return;
      }

      const { billScript } = await this.api.getBillScript(billId);
      fs.writeFileSync(filePath, billScript, 'utf-8');

      const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === filePath);
      if (doc) {
        const editor = await vscode.window.showTextDocument(doc);
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length)
        );
        await editor.edit(editBuilder => {
          editBuilder.replace(fullRange, billScript);
        });
      }

      vscode.window.showInformationMessage(`✅ 脚本 [${billId}] 已从数据库同步`);
      await this.promptAndPushToGit(filePath, billId);
    } catch (err: any) {
      vscode.window.showErrorMessage(`同步失败: ${err.message}`);
    }
  }

  updateActiveEditorContext(): void {
    const editor = vscode.window.activeTextEditor;
    const isTracked = editor ? this.fileBillMap.has(editor.document.uri.fsPath) : false;
    if (isTracked) {
      this.saveBarItem.show();
      this.copyBarItem.show();
    } else {
      this.saveBarItem.hide();
      this.copyBarItem.hide();
    }
  }
}
