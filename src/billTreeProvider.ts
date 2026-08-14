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
      // 补充传递完整对象（包含了 billSn）
      arguments: [{ billId: this.billId, billName: this.billName, billSn: this.billSn }],
    };
  }
}

export class BillTreeProvider implements vscode.TreeDataProvider<BillTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BillTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private bills: Bill[] = [];
  // 核心修改 1：使用 Map<string, Bill> 存储选中的单据对象（Key 为 billId）
  private selectedBills: Map<string, Bill> = new Map();

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
      b => new BillTreeItem(b.billId, b.billName, b.billSn, this.selectedBills.has(b.billId))
    );
  }

  // 核心修改 2：勾选时将完整的 Bill 对象存入 Map
  handleCheckboxChange(items: readonly [BillTreeItem, vscode.TreeItemCheckboxState][]): void {
    for (const [item, state] of items) {
      if (state === vscode.TreeItemCheckboxState.Checked) {
        this.selectedBills.set(item.billId, {
          billId: item.billId,
          billName: item.billName,
          billSn: item.billSn
        });
      } else {
        this.selectedBills.delete(item.billId);
      }
    }
  }

  // 核心修改 3：直接返回已选中的 Bill 对象数组
  getSelectedBills(): Bill[] {
    return Array.from(this.selectedBills.values());
  }

  // 核心修改 4：全选时，将所有 Bill 对象一次性构建为 Map
  selectAll(): void {
    this.selectedBills = new Map(this.bills.map(b => [b.billId, b]));
    this._onDidChangeTreeData.fire(undefined);
  }

  // 核心修改 5：清空 Map
  unselectAll(): void {
    this.selectedBills.clear();
    this._onDidChangeTreeData.fire(undefined);
  }
}