import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from './api';

const CACHE_DIR = '.ysk-bill-js-plugin-cache';

export class ScriptEditorManager {
  private billFileMap = new Map<string, string>();
  private fileBillMap = new Map<string, string>();
  private cacheDir: string;
  private saveBarItem: vscode.StatusBarItem;
  private copyBarItem: vscode.StatusBarItem;

  constructor(
    private api: ApiClient,
    private workspaceRoot: string,
    private subscriptions: vscode.Disposable[]
  ) {
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

  async openScript(billId: string, billName: string): Promise<void> {
    try {
      const { billScript } = await this.api.getBillScript(billId);
      const safeName = billName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
      const fileName = `${billId}-${safeName}.js`;
      const filePath = path.join(this.cacheDir, fileName);

      fs.writeFileSync(filePath, billScript, 'utf-8');

      this.billFileMap.set(billId, filePath);
      this.fileBillMap.set(filePath, billId);

      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
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
      vscode.window.showInformationMessage(`✅ 脚本 [${billId}] 已保存到数据库`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`保存失败: ${err.message}`);
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
