# 云时空二开表单 JS 脚本工具箱

**ysk-bill-js-plugin** 是一个 VS Code 扩展，用于浏览云时空（Oracle BILLDOC）数据库中的表单，并在线编辑、保存关联的 JS 脚本。支持多环境切换、批量下载/打开、Git 版本同步等功能。

## 功能

- **浏览表单列表** — 侧栏树视图展示数据库中的表单（BILLID / BILLNAME / BILLSN），支持勾选
- **搜索表单** — 按 BILLID / BILLSN / BILLNAME 关键词搜索过滤
- **打开脚本** — 打开表单关联的 JS 脚本到编辑器；本地已有缓存时直接打开，否则从数据库拉取
- **批量操作** — 全选 / 取消全选、批量下载选中脚本到本地、批量打开选中脚本
- **编辑脚本** — 在 VS Code 编辑器中自由编辑脚本内容
- **保存到数据库** — 将修改后的脚本写回数据库（快捷键 `alt+s`）
- **复制脚本内容** — 一键复制当前脚本全文到剪贴板（快捷键 `alt+c`）
- **从数据库同步** — 丢弃本地修改，重新从数据库拉取覆盖
- **同步到 Git** — 将当前脚本 commit 并 push 到工作区 Git 仓库（自动弹窗输入 commit message）
- **配置热重载** — 修改配置文件后无需重启 VS Code，自动重新加载生效

## 使用前提

1. 打开一个 VS Code 工作区（文件夹）
2. 在工作区根目录创建 `ysk-bill-js-plugin.config.json` 配置文件
3. 如启用 Git 同步，工作区需为 Git 仓库（含远程 origin）

## 安装

安装 `ysk-bill-js-plugin.vsix` 文件：

1. 打开 VS Code，进入「扩展」视图
2. 点击右上角「…」→「从 VSIX 安装…」
3. 选择 `ysk-bill-js-plugin.vsix` 即可

## 配置文件

在工作区根目录创建 `ysk-bill-js-plugin.config.json`：

```json
{
  "env": "erp",
  "searchBillUrl": "http://your-server:port/api/bills?env={env}&keyword={keyword}",
  "searchBillPageSize": 50,
  "getBillScriptUrl": "http://your-server:port/api/bills/{env}/{billId}",
  "putBillScriptUrl": "http://your-server:port/api/bills/{env}/{billId}",
  "authToken": "",
  "gitSyncEnabled": true
}
```

### 配置项说明

| 配置项 | 用途 | 请求方法 | URL 占位符 | 默认值 | 说明 |
|--------|------|---------|-----------|--------|------|
| `env` | 运行环境标识 | - | `{env}` | `erp-test` | 用于区分不同环境的 API URL |
| `searchBillUrl` | 搜索表单列表 | GET | `{env}` `{keyword}` | - | 响应 JSON: `[{ billId, billName, billSn }]`。`{keyword}` 会被关键词 URL 编码后替换；未输入关键词时自动移除 `keyword` 参数以查询全部 |
| `searchBillPageSize` | 搜索分页大小 | - | - | - | 预留的分页大小配置 |
| `getBillScriptUrl` | 获取指定表单的 JS 脚本 | GET | `{env}` `{billId}` | - | 响应 JSON: `{ billScript: "..." }` |
| `putBillScriptUrl` | 保存/更新指定表单的 JS 脚本 | PUT | `{env}` `{billId}` | - | 请求体 JSON: `{ billScript: "..." }`，仅校验 HTTP 状态码 |
| `authToken` | Bearer 认证令牌 | - | - | 空 | 非必填。设置后所有请求头携带 `Authorization: Bearer <token>` |
| `gitSyncEnabled` | 是否启用 Git 同步 | - | - | `true` | 开启后保存/同步脚本时自动弹窗输入 commit message 并 `git commit + push` |

### 占位符说明

- `{env}` — 运行环境标识，取自配置项 `env`。URL 编码后替换到所有 API URL 中
- `{keyword}` — 搜索关键词，由用户输入。URL 编码后替换到 `searchBillUrl` 中
- `{billId}` — 表单 ID，在树视图中选中表单时自动填入。URL 编码后替换到 `getBillScriptUrl` 和 `putBillScriptUrl` 中

## API 接口文档

插件通过三个 REST 接口与云时空后端交互，接口地址由配置文件中的 URL 模板拼接而成。

### 通用说明

- **认证**：若配置了 `authToken`，所有请求头携带 `Authorization: Bearer <token>`；否则仅带 `Content-Type: application/json`
- **错误处理**：接口返回非 2xx 状态码时，插件提示 `API <status> <statusText>` 错误
- **占位符**：`{env}`、`{keyword}`、`{billId}` 均会被 URL 编码后替换

### 1. 搜索表单列表

获取符合关键词条件的表单列表，用于填充侧栏树视图。

- **请求方法**：`GET`
- **请求 URL**：`searchBillUrl`（如 `http://host/api/bills?env={env}&keyword={keyword}`）
- **路径/查询参数**：

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| `env` | 查询参数 | 是 | 环境标识，替换 `{env}` |
| `keyword` | 查询参数 | 否 | 搜索关键词，替换 `{keyword}`；留空时自动移除 `keyword` 参数查询全部表单 |

- **成功响应**：`200 OK`，返回表单数组

```json
[
  { "billId": 1001, "billName": "采购订单", "billSn": "CGDD" },
  { "billId": 1002, "billName": "销售订单", "billSn": "XSDD" }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `billId` | number | 表单 ID（插件内部会转为字符串） |
| `billName` | string | 表单名称 |
| `billSn` | string | 表单编码 |

- **异常情况**：返回空数组或 `[{ billId: undefined }]` 时，插件提示「未找到相关表单数据」

### 2. 获取表单脚本

获取指定表单关联的 JS 脚本内容。

- **请求方法**：`GET`
- **请求 URL**：`getBillScriptUrl`（如 `http://host/api/bills/{env}/{billId}`）
- **路径参数**：

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| `env` | 路径 | 是 | 环境标识，替换 `{env}` |
| `billId` | 路径 | 是 | 表单 ID，替换 `{billId}` |

- **成功响应**：`200 OK`，返回脚本内容

```json
{
  "billScript": "function onLoad() { ... }"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `billScript` | string | 表单关联的 JS 脚本源码 |

### 3. 保存表单脚本

将修改后的 JS 脚本写回数据库。

- **请求方法**：`PUT`
- **请求 URL**：`putBillScriptUrl`（如 `http://host/api/bills/{env}/{billId}`）
- **路径参数**：

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| `env` | 路径 | 是 | 环境标识，替换 `{env}` |
| `billId` | 路径 | 是 | 表单 ID，替换 `{billId}` |

- **请求体**：`application/json`

```json
{
  "billScript": "function onLoad() { ... }"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `billScript` | string | 是 | 要保存的 JS 脚本源码 |

- **成功响应**：`200 OK`，不校验响应体内容，仅校验状态码

## 操作指南

### 打开脚本

点击树视图中的表单项即可打开对应 JS 脚本。脚本以 `scripts/` 目录下的本地文件形式保存，文件名格式为 `{billId}-{billName}-{billSn}.js`。本地已有缓存时优先打开缓存文件，无需重复请求接口。

### 批量操作

1. 勾选树视图中需要操作的表单（或使用「全选表单」）
2. 在树视图标题栏的「批量操作」菜单中选择：
   - **下载选中的表单** — 将选中表单的脚本全部保存到本地 `scripts/` 目录
   - **打开选中的脚本** — 依次打开选中表单的脚本文件

### 保存到数据库

按 `alt+s`，或命令面板执行「YSK: 保存脚本到数据库」。脚本会写回数据库；若启用了 Git 同步，还会弹出输入框要求填写 commit message，确认后自动执行 `git add → git commit → git push`。

### 同步到 Git

在编辑器右键菜单选择「YSK: 同步脚本到 Git」，或命令面板执行「YSK: 同步脚本到 Git」。会先保存文件，再弹窗输入 commit message 并提交推送。

> 注：Git 操作使用系统 git 命令与工作区 `.git` 配置（remote、user.name、user.email 等），请确保本机已安装 git 且配置好远程仓库。

## 命令一览

| 命令 | 标题 | 快捷键 | 说明 |
|------|------|--------|------|
| `ysk-bill-js-plugin.searchBills` | YSK: 搜索表单 | - | 按关键词搜索表单 |
| `ysk-bill-js-plugin.refreshBills` | YSK: 刷新表单列表 | - | 刷新全部表单列表 |
| `ysk-bill-js-plugin.checkAllBills` | YSK: 全选表单 | - | 全选当前列表中的表单 |
| `ysk-bill-js-plugin.uncheckAllBills` | YSK: 取消全选表单 | - | 取消全选 |
| `ysk-bill-js-plugin.downloadCheckedScript` | YSK: 下载选中的表单 | - | 批量下载选中脚本到本地 |
| `ysk-bill-js-plugin.openScript` | YSK: 打开脚本 | - | 打开选中表单的脚本 |
| `ysk-bill-js-plugin.openCheckedScript` | YSK: 打开选中的脚本 | - | 批量打开选中表单的脚本 |
| `ysk-bill-js-plugin.saveScript` | YSK: 保存脚本到数据库 | `alt+s` | 保存当前脚本到数据库 |
| `ysk-bill-js-plugin.copyScriptContent` | YSK: 复制脚本内容 | `alt+c` | 复制当前脚本全文到剪贴板 |
| `ysk-bill-js-plugin.syncScript` | YSK: 从数据库同步 | - | 从数据库拉取覆盖本地脚本 |
| `ysk-bill-js-plugin.syncScriptToGit` | YSK: 同步脚本到 Git | - | 提交并推送当前脚本到 Git 仓库 |

## 目录结构

```
ysk-bill-js-plugin/
├── src/
│   ├── extension.ts          # 扩展入口，注册命令与事件
│   ├── config.ts             # 配置加载与默认值合并
│   ├── api.ts                # API 客户端（搜索/获取/保存脚本）
│   ├── billTreeProvider.ts   # 树视图数据提供器（含勾选/批量逻辑）
│   ├── scriptEditor.ts       # 脚本编辑管理器（打开/保存/同步/复制）
│   └── gitService.ts         # Git 封装（add/commit/push）
├── scripts/                  # 运行时脚本缓存目录（本地生成）
└── ysk-bill-js-plugin.config.json  # 配置文件（本地生成）
```

## 开发

```bash
npm install      # 安装依赖
npm run compile  # TypeScript 编译
npm run watch    # 监听编译
npm run lint     # 类型检查
npx vsce package # 打包为 .vsix
```