import * as vscode from 'vscode';
import { Bill } from './api';

export class BillTreeItem extends vscode.TreeItem {
  constructor(
    public readonly billId: string,
    public readonly billName: string,
    public readonly billSn: string,
    public isChecked: boolean = false
  ) {
    super(billName, vscode.TreeItemCollapsibleState.None);
    this.description = billSn;
    this.tooltip = `${billName}\nbillId: ${billId}\nbillSn: ${billSn}`;
    this.contextValue = 'billItem';

    // 设置复选框初始状态
    this.checkboxState = this.isChecked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;

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
  // 维护选中的 billId 集合
  private selectedBillIds: Set<string> = new Set();

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
    return this.bills.map(
      b => new BillTreeItem(b.billId, b.billName, b.billSn, this.selectedBillIds.has(b.billId))
    );
  }

  // 处理复选框切换逻辑
  handleCheckboxChange(items: readonly [BillTreeItem, vscode.TreeItemCheckboxState][]): void {
    for (const [item, state] of items) {
      if (state === vscode.TreeItemCheckboxState.Checked) {
        this.selectedBillIds.add(item.billId);
      } else {
        this.selectedBillIds.delete(item.billId);
      }
    }
  }

  // 获取所有当前已被勾选的单据 ID 数组
  getSelectedBillIds(): string[] {
    return Array.from(this.selectedBillIds);
  }
}