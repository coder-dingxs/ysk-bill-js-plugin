# 云时空二开表单 js 脚本编辑器

**ysk-bill-js-plugin** 是一个 VS Code 扩展，用于浏览云时空（Oracle BILLDOC）数据库中的表单，并在线编辑、保存关联的 JS 脚本。

## 功能

- **浏览表单列表** — 在侧栏树视图中展示数据库中的表单（BILLID / BILLNAME / BILLSN）
- **搜索表单** — 按 BILLSN 或 BILLNAME 关键词搜索过滤
- **打开脚本** — 从数据库拉取表单关联的 JS 脚本，在编辑器中打开
- **编辑脚本** — 在 VS Code 编辑器中自由编辑脚本内容
- **保存到数据库** — 将修改后的脚本写回数据库（快捷键 `alt+s`）
- **复制脚本内容** — 一键复制当前脚本全文到剪贴板（快捷键 `alt+c`）
- **从数据库同步** — 丢弃本地修改，重新从数据库拉取覆盖

## 使用前提

1. 打开一个 VS Code 工作区（文件夹）
2. 在工作区根目录创建 `ysk-bill-js-plugin.config.json` 配置文件

## 安装

~~在 VS Code 扩展商店搜索 "云时空二开表单js脚本编辑器" 安装，或从 VSIX 包安装。~~

安装ysk-bill-js-plugin.vsix文件

## 配置文件

在工作区根目录创建 `ysk-bill-js-plugin.config.json`：

```json
{
  "searchBillUrl": "http://your-server:port/api/bills?keyword={keyword}",
  "getBillScriptUrl": "http://your-server:port/api/bills/{billId}",
  "putBillScriptUrl": "http://your-server:port/api/bills/{billId}",
  "authToken": ""
}
```

### 配置项说明

| 配置项 | 用途 | 请求方法 | URL 占位符 | 说明 |
|--------|------|---------|-----------|------|
| `searchBillUrl` | 搜索表单列表 | GET | `{keyword}` | 响应 JSON: `[{ billId, billName, billSn }]`。`{keyword}` 会被搜索关键词 URL 编码后替换；未输入关键词时自动移除 `?keyword=...` 参数，以查询全部表单 |
| `getBillScriptUrl` | 获取指定表单的 JS 脚本 | GET | `{billId}` | 响应 JSON: `{ billScript: "..." }`。`{billId}` 会被表单 ID 替换 |
| `putBillScriptUrl` | 保存/更新指定表单的 JS 脚本 | PUT | `{billId}` | 请求体 JSON: `{ billScript: "..." }`。响应仅校验 HTTP 状态码 |
| `authToken` | Bearer 认证令牌 | - | - | 非必填。设置后所有请求头携带 `Authorization: Bearer <token>` |

### 占位符说明

- `{keyword}` — 搜索关键词，由用户输入。URL 编码后替换到 `searchBillUrl` 中
- `{billId}` — 表单 ID，在树视图中选中表单时自动填入。URL 编码后替换到 `getBillScriptUrl` 和 `putBillScriptUrl` 中

## 操作

| 操作 | 方式 |
|------|------|
| 搜索表单 | 点击树视图标题栏的搜索图标，或命令面板执行 "YSK: 搜索表单" |
| 刷新列表 | 点击树视图标题栏的刷新图标，或命令面板执行 "YSK: 刷新表单列表" |
| 打开脚本 | 点击树视图中的表单项 |
| 保存脚本 | 按 `alt+s`，或命令面板执行 "YSK: 保存脚本到数据库" |
| 复制脚本 | 按 `alt+c`，或编辑器右键菜单 "YSK: 复制脚本内容" |
| 同步脚本 | 在树视图表单项上点击同步按钮，或命令面板执行 "YSK: 从数据库同步" |
