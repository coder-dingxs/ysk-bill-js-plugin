import * as vscode from 'vscode';
import { Bill } from './api';

export class BillTreeItem extends vscode.TreeItem {
  constructor(
    public readonly billId: string,
    public readonly billName: string,
    public readonly billSn: string
  ) {
    super(billName, vscode.TreeItemCollapsibleState.None);
    this.description = billSn;
    this.tooltip = `${billName}\nbillId: ${billId}\nbillSn: ${billSn}`;
    this.contextValue = 'billItem';
    this.command = {
      command: 'ysk-bill-js-plugin.openScript',
      title: '打开脚本',
      arguments: [{ billId: this.billId, billName: this.billName }],
    };
  }
}

export class BillTreeProvider implements vscode.TreeDataProvider<BillTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BillTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private bills: Bill[] = [];

  setBills(bills: Bill[]): void {
    this.bills = bills;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BillTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: BillTreeItem): BillTreeItem[] {
    if (_element) {
      return [];
    }
    return this.bills.map(b => new BillTreeItem(b.billId, b.billName, b.billSn));
  }
}
