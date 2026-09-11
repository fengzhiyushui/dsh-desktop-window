# 开发说明

> ## ⚠️ 强制维护条款
>
> **本项目每一次改动，都必须在同一次改动中更新本文件与 [`ADAPTATION.zh.md`](ADAPTATION.zh.md)。**
>
> 没有例外。凡是新增、删除或改变行为、文件、依赖、构建步骤或 DSH 接口的提交，
> 若未同步更新这两份文档，即视为未完成。本文件中的发布流程把"文档过期"当作发布阻塞项，
> 而 `npm test` 会在维护条款块或双语配对记录缺失时直接失败。
>
> 改动本文件时，必须同时更新 [`DEVELOPMENT.md`](DEVELOPMENT.md)，
> 并在 [`README.i18n.yaml`](README.i18n.yaml) 中重新记录两个哈希 —— 与两份 README 遵循同一规则。

<!-- upkeep:required -->
<!-- pair: DEVELOPMENT.md -->

## 改动该写进哪份文档

| 改动类型 | 应更新的文档 |
|---|---|
| 新功能、行为变化、新增/删除文件、依赖升级、构建或发布步骤 | **本文件** |
| 新的 DSH 版本、接口变化、兼容区间、适配清单 | **[ADAPTATION.zh.md](ADAPTATION.zh.md)** |
| 用户能感知的任何内容（行为、选项、限制） | **[README.zh.md](README.zh.md)** + [`README.md`](README.md) |
| 每次发版 | [`CHANGELOG.md`](CHANGELOG.md) |

## 架构

一个包、两个半侧 —— DSH 的双面插件形态：

```text
                         package.json
              dsh.bundle ─┘        └─ dsh.client
                    │                    │
        cordis.patch.yml                 │  （扫描器提供 ./client）
                    │                    │
        lib/index.js  ─── HTTP ───▶  lib/client.js ──▶ React slots
        （Host 半边）                 （浏览器半边）
```

**Host 半边 —— `lib/index.js`。** 注入 `webServer` 与 `timer` 服务，掌管窗口进程、
HTTP 接口、`<head>` 注入与持久化偏好。所有注册项都会在卸载时释放：路由走 `disposers`
数组，注入监听器走 `ctx.on`（effect 作用域），自动开窗延迟走 `ctx.timeout`（同为 effect），
再加上子进程树。

**浏览器半边 —— `src/client.js` → `lib/client.js`。** 占据两个 slot：

| Slot | 条目 | 用途 |
|---|---|---|
| `conversation.session.header.actions` | `desktop-window`，order 30 | 开/关按钮，状态轮询 `/desktop-window/status` |
| `settings.general.item` | `desktop-auto`，order 30 | 自动开窗开关 |

**纯决策 —— `lib/window-spec.js`。** 图标表、manifest 内容、favicon 链接、
路由 → 图标映射、浏览器候选、启动参数。无 I/O、无 Cordis，因此可直接单元测试。
测试需要推理的任何逻辑都应放在这里，而不是内联在 `lib/index.js` 里。

## 目录结构

```text
package.json             双面声明（dsh.bundle + dsh.client）
cordis.patch.yml         组合层：一行插件
lib/index.js             Host 半边：窗口进程、HTTP 路由、注入、状态
lib/window-spec.js       纯决策 —— 无需 DSH 即可单元测试
lib/client.js            浏览器 bundle（构建产物，已提交）
src/client.js            客户端源码（React）
scripts/build-client.js  构建脚本（esbuild + 注册壳）
scripts/install.ps1      一键安装
scripts/create-shortcut.ps1  一键创建桌面快捷方式
DSH-Desktop.cmd          双击启动器
assets/                  官方 DeepSeek 鲸鱼图标（SVG / 多尺寸 PNG / ICO）
test/                    逻辑测试（node:test）—— 无需安装 DSH
```

## 环境

```sh
npm install     # 仅 esbuild；react 是 peer，由 DSH 外壳提供
npm run build   # 由 src/client.js 重新生成 lib/client.js
npm test        # 四个套件，无需安装 DSH，也不需要浏览器
```

`package.json#engines` 要求 Node.js `>= 22`。开发时**不需要** `dsh`：
测试通过进程内的 Cordis/WebServer 替身来驱动 Host 半边。

## 客户端 bundle 的两条硬约束

`lib/client.js` 是提交进仓库的产物，因此安装者永远不需要构建。以下两条规则都由真实故障确立，
并由 `test/client-bundle.test.js` 强制守护 —— 不要"顺手简化"：

1. **`__ModuleLoader__.load` 注册壳是必需的。** DSH 客户端模块系统会校验 bundle 是否注册了
   factory；裸 CJS 输出不被识别。注册的 `id` 必须等于包名，因为模块图以包名为键。
2. **`react` 必须保持 external。** 官方 bundle 通过 `require("react")` 命中模块表种子词 ——
   即外壳内核注册的共享 React。内联第二份会让 Hooks 崩溃。

## 平台抽象

平台相关行为一律是**纯决策 + 薄执行器**，且决策永远放在 `lib/window-spec.js`：

| 决策 | 函数 | 执行方 |
|---|---|---|
| 尝试哪些浏览器可执行文件 | `browserCandidates(platform, env, joinPath)` | `resolveBrowser()` —— 按顺序检查是否存在 |
| 如何结束窗口进程树 | `windowTermination(pid, platform, graceMs)` | `terminateWindow()` —— 执行返回的计划 |

平台、环境变量、路径拼接器**全部是入参**。这正是让 macOS/Linux 分支能在 Windows 机器上被验证的原因；
`test/platform.test.js` 就是在这里驱动每个平台的分支。该文件还会断言 `lib/index.js` 里**不含**任何这类决策 ——
不调 `taskkill`、不含安装位置字面量、不含信号名、不做 `process.platform ===` 分支 ——
因为一旦把决策内联在那里，它就逃出了覆盖其他平台的测试。

这些分支为什么必须存在：

- 浏览器发现各不相同：Windows 区分机器级（`Program Files`）与用户级（`LOCALAPPDATA`）安装；
  macOS 的可执行文件在 `<App>.app/Contents/MacOS/` 里；Linux 各发行版的可执行文件名并不统一。
- 进程拆除各不相同：Windows 上 `process.kill` 不支持信号语义，必须用 `taskkill /T /F` 拆整棵树；
  POSIX 平台先发 SIGTERM，宽限期后才 SIGKILL，这也正是被启动的 Chromium 能带走自己渲染器与 GPU 子进程的方式。
- 启动参数必须保持平台中立。不要加入只有某个平台接受的参数（例如 macOS 会拒绝 `--class`）；
  `windowFlags()` 有白名单断言守护。

## 测试策略

`npm test` 依次运行六个套件：

| 套件 | 覆盖内容 |
|---|---|
| `test/window-spec.test.js` | 图标/manifest 契约、路由 → 图标映射、启动参数 |
| `test/platform.test.js` | win32/macOS/Linux 的浏览器候选与拆除计划，以及"把这些决策挡在 `lib/index.js` 之外"的守卫 |
| `test/host-half.test.js` | 路由注册、head 注入行、已装载的自动开窗定时器、图标字节、manifest、status、跨站 `403`、`405`、状态文件持久化（含 BOM）、卸载回收 |
| `test/client-bundle.test.js` | 已提交 bundle 的不变量（上述两条规则，以及两个 slot） |
| `test/scripts-parse.test.js` | PowerShell 隐患扫描，随后真实解析每个 `scripts/*.ps1` |
| `test/docs-upkeep.test.js` | 强制维护条款、配对链接、已记录的文档哈希 |

这套测试有两个刻意的性质：

- **Host 半边无需 DSH 即可测试。** `createHarness()` 提供最小化的 Cordis 上下文与 WebServer。
  请保持 `lib/index.js` 不引入无法这样伪造的东西；把纯逻辑推进 `lib/window-spec.js`。
- **无法运行的检查会如实报告为 skipped。** 在不允许创建可读子进程的环境里，
  PowerShell 解析步骤会带原因跳过。绝不要把无法运行的检查变成静默通过。

需要时单独运行某个套件：

```sh
node test/host-half.test.js
```

## 常见开发任务

| 任务 | 做法 |
|---|---|
| 新增或修改 HTTP 路由 | 在 `lib/index.js` 的 `disposers` 块中注册，并在 `test/host-half.test.js` 中覆盖 |
| 修改提供的图标或 manifest | 改 `lib/window-spec.js`；`assets/` 与路由表必须保持同步，两个套件都会校验 |
| 新增浏览器安装位置 | 扩展 `lib/window-spec.js` 的 `browserCandidates()` 及其测试 |
| 新增或修改平台分支 | 在 `lib/window-spec.js` 中以平台为入参做决策，在 `lib/index.js` 中执行，并在 `test/platform.test.js` 中覆盖每个平台 |
| 修改窗口启动参数 | `lib/window-spec.js` 中的 `windowFlags()` —— 必须落在可移植白名单内 |
| 修改客户端界面 | 改 `src/client.js`，执行 `npm run build`，再跑 `npm test` |
| 新增偏好键 | 扩展 `lib/index.js` 的状态读写，在两份 README 中记录，并保持写入对 BOM 容错 |

## 约定

- 仅 ESM（`"type": "module"`），2 空格缩进，工作区使用 LF。
- 新增运行时依赖必须有理由，并记录在本文件与 changelog 中。
- 不要把测试能直接持有的纯逻辑留在 `lib/index.js` 里。
- 注释解释*为什么*，尤其是在平台怪癖迫使代码呈现某种形状的地方。
- 两份 README 与两份开发文档都是双语对；绝不只改其中一侧。

## 发布流程

1. 完成改动，附带测试。
2. 若 `src/client.js` 有改动，执行 `npm run build`，然后 `npm test`。
3. **更新本文件、`ADAPTATION.zh.md`、它们的中文/英文对应件、两份 README，以及
   `CHANGELOG.md`。** 在 `README.i18n.yaml` 中重新记录 README 与开发文档的哈希。
4. 按语义化版本提升 `package.json` 的 `version`，并在 changelog 中加入带日期的章节。
5. 提交并推送到默认分支。
6. 用户执行 `dsh plugin --profile web update dsh-desktop-window`，然后重启 `dsh web`。

## 相关文档

- [`ADAPTATION.zh.md`](ADAPTATION.zh.md) —— DSH 兼容矩阵与适配清单
- [`README.zh.md`](README.zh.md) —— 面向用户的文档
- [`CHANGELOG.md`](CHANGELOG.md) —— 发布历史
- [`README.i18n.yaml`](README.i18n.yaml) —— 双语配对记录
