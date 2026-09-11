# DSH 版本适配说明

> ## ⚠️ 强制维护条款
>
> **本项目每一次改动，都必须在同一次改动中更新本文件与 [`DEVELOPMENT.zh.md`](DEVELOPMENT.zh.md)。**
>
> 新的 DSH 版本、接口变化、兼容区间调整，或一次完成的适配验证，都属于本文件 ——
> 且必须与代码改动在同一次改动中提交。发布流程把"文档过期"当作发布阻塞项，
> 而 `npm test` 会在维护条款块或双语配对记录缺失时直接失败。
>
> 改动本文件时，必须同时更新 [`ADAPTATION.md`](ADAPTATION.md)，
> 并在 [`README.i18n.yaml`](README.i18n.yaml) 中重新记录两个哈希。

<!-- upkeep:required -->
<!-- pair: ADAPTATION.md -->

## 兼容矩阵

| 插件版本 | 验证所依据的 DSH | 支持的 DSH 区间 | 备注 |
|---|---|---|---|
| 0.4.0 | 0.1.5-rc.1（HEAD `aa8262ec09`） | `>= 0.1.0-rc.6` | macOS/Linux 浏览器发现与 POSIX 拆除路径；15 个接口全部重新核验 |
| 0.3.0 | 0.1.5-rc.1 | `>= 0.1.0-rc.6` | 移除窗口装饰助手（见 changelog） |
| 0.2.0 | 0.1.5-rc.1 | `>= 0.1.0-rc.6` | 结构化 head 注入；图标助手加固 |
| 0.1.0 | 0.1.0-rc.6 | `>= 0.1.0-rc.6` | 初版 |

"验证所依据"指：在该 DSH 代码树中读过下一节列出的接口，且测试套件通过。
它**不**表示已针对该版本的实时浏览器会话做过手工验证。

## 本插件依赖的接口

下表中每一行都是 DSH 可能变更的契约。验证列：**read** 表示读过源码；
**test** 表示本仓库有测试覆盖我方这一侧；**runtime** 表示只能对着运行中的 DSH 确认。

| # | 接口 | 使用位置 | 失效后果 | 验证 |
|---|---|---|---|---|
| 1 | `ctx.webServer` 服务，以 `webServer` 注入 | `lib/index.js` | 插件根本不激活 | test（替身）+ read |
| 2 | `webServer.register({ kind, path, handler })` → disposer；重复 `(kind, path)` 抛错 | 全部五条路由 | 路由挂载失败，或热重载时冲突 | test |
| 3 | `webServer.tapIndex()`（旧逃生舱） | **未使用** —— 已被 #4 取代 | — | read |
| 4 | `webserver/index-inject` 事件，`{ kind: 'html', placement: 'head', html }` 行 | favicon/manifest 注入 | 标题栏没有鲸鱼图标 | test |
| 5 | `webServer.host` / `webServer.port` getter | `baseUrl()` | 窗口打开错误 URL | test |
| 6 | `ctx.timeout(callback, delay)`，effect 作用域定时器 | 自动开窗延迟 | 卸载时定时器未清理 | test（已装载）+ read |
| 7 | `ctx.on(event, listener)` 随插件释放 | `index-inject` 订阅 | 卸载后监听器泄漏 | read |
| 8 | `ctx.effect(factory)` 卸载顺序 | 进程/路由拆除 | 遗留窗口进程 | test |
| 9 | `dsh.client` 声明 + `./client` 导出（扫描要求该导出必须存在；`platform`、`inject`、`external`、`immediately` 均为受校验字段） | package.json、模块扫描 | 浏览器半边永不加载 | runtime + read |
| 10 | `__ModuleLoader__.load({ id, factory })`，`id` == 包名 | `lib/client.js` | bundle 加载但未注册 | test |
| 11 | `PLATFORM_MODULES` 播种 React；bundle 经 `require("react")` 解析 | `lib/client.js` | 内联 React 会导致 Hooks 崩溃 | test |
| 12 | Slot `conversation.session.header.actions`（list，scope session） | 会话头部按钮 | 按钮消失 | runtime |
| 13 | Slot `settings.general.item`（list，scope root） | 自动开窗开关 | 开关消失 | runtime |
| 14 | package.json 的 `dsh.bundle.patch` + `cordis.patch.yml` 顶层 `insert:` 数组 | 组合层 | 插件行永不挂载 | runtime |
| 15 | `$DSH_HOME`（默认 `~/.dsh`） | 状态文件位置 | 偏好无法持久化或读取不到 | test |

第 9、12、13、14 行需要一份运行中的 DSH 并已安装本插件；它们是适配验证中必须手工走一遍的部分。

## 新 DSH 版本的适配清单

逐项完成并在下方运行日志中记录结论。没有证据就不要标记完成。

1. **阅读 DSH 的 changelog**，关注 web server、客户端模块系统、slot、插件/组合格式的改动。
2. **在新代码树中重新核验第 1–15 行。** 其中第 2、4、11 行最易变动。
3. **跑测试**：`npm test`。全绿是必要条件，不是充分条件。
4. **做一次实机验证**：装进 profile、启动 `dsh web`，确认窗口自动打开、头部按钮能开关、
   设置开关能持久化、标题栏显示鲸鱼图标。
5. **更新上方兼容矩阵**；若支持的最低版本变化，同步更新 `package.json` 的
   `peerDependencies` 区间与两份 README 的环境要求表。
6. **更新 `DEVELOPMENT.zh.md`**：若构建、测试或发布步骤有变化。
7. **在下方运行日志中记录本次适配**，并添加 changelog 条目。

## 降级策略

当 DSH 的改动打破了某个契约，按以下优先级处理：

1. **改用官方替代 API**（`tapIndex` → `webserver/index-inject` 就是这种情况）。
2. **加守卫并降级**：保留功能，但检测能力缺失后回退，只记录一次日志而不是刷屏。
3. **放弃该功能**，并在两份 README 的「已知限制」中说明。
4. **仅在清单全部通过后扩大支持区间**；若接口已删除，则应缩小区间。

不要为了逃避适配工作而把插件钉死在某个 DSH 补丁版本上 —— 本包通过 git 引用安装，跟随默认分支。

## 关于本地 DSH 源码

本地可能存在一份完整的 DSH 检出，仅用于适配工作。它是**只读参考**：

- **不提交** —— `.gitignore` 已忽略 `dsh/` 目录；
- **不构建、不运行**；
- 绝不从中复制代码进本包；只读接口并与之对齐。

需要查阅的位置：`packages/host/webserver/src/index.ts`（路由、注入事件）、
`src/injections.ts`（head 行渲染）、`packages/client/modules/src/client/{system,manifest}.ts`
（bundle 注册与 `id` 规则），以及本插件占据的两个 slot 的 slot 契约源码。

## 适配运行日志

最新在上。每条记录：DSH 版本、日期、核验了什么、结论。

### 0.1.5-rc.1 — 2026-09-10（完整重新核验）

- 先确定参照点：当前最新的 DSH 就是 **0.1.5-rc.1**。npm registry 显示 `latest` 与 `next` 均为
  `0.1.5-rc.1`（`alpha` 为 `0.1.5-alpha.2`），本地最高 tag 为 `dsh-v0.1.5-rc.1`，且本地检出的
  HEAD 等于 `origin/master`（`aa8262ec09`）。既然没有更新的版本可适配，本次改为对 15 个接口
  做完整重新核验。
- 在该代码树中逐行重新核验：
  - **2** —— `register(route: WebRoute)` 返回 disposer，且冲突时抛
    `webserver: duplicate <kind> route "<path>"`（`webserver/src/index.ts`）。
  - **4** —— `webserver/index-inject` 事件与 `{ kind: 'html', placement: 'head' }` 行未变，
    head 行仍插在真正的 `<head>` 之后（`webserver/src/injections.ts`）。
  - **5** —— `get host()`、`get port()` 未变。
  - **10** —— `manifest.ts` 仍写明 "Entry name == package name"，`stripClientSuffix` 未变，
    `system.ts` 仍然强制"重复 factory"与 `loaded without registering "<id>"` 两项校验。
  - **9** —— `clientExportOf()` 把 `exports["./client"]` 解析为字符串，或带字符串 `default`
    的对象；客户端源码规则明确说明缺少该导出时扫描会抛错。我们使用的字符串形式被接受。
  - **12/13** —— 两个 slot 未变：`conversation.session.header.actions` 是
    `{ kind: 'list', scope: 'session' }`，`settings.general.item` 是
    `{ kind: 'list', scope: 'root' }`；注册选项仍是我们传入的 `{ name, id, order }`。
  - **6/7/8** —— `timeout(callback, delay)` 仍基于 `ctx.effect` 实现，自动开窗定时器为
    fiber 作用域；`ctx.on`、`ctx.effect` 语义未变。
- 没有任何接口破裂，也没有发现更好的替代 API，因此本次发布**未改动任何 DSH 接口用法**。
  改动都在平台覆盖上：按平台发现浏览器，以及 POSIX 拆除路径（见 `DEVELOPMENT.zh.md` → 平台抽象）。
- `npm test` 全绿（六个套件）。针对运行中 DSH 会话的实机验证：**尚未执行**。

### 0.1.5-rc.1 — 2026-09-10

- 在 DSH 代码树中通读第 1–15 行接口（`host/webserver/src/index.ts`、
  `host/webserver/src/injections.ts`、`client/modules/src/client/{system,manifest}.ts`、
  两个 slot 契约、`vendor/timer/src/index.ts`）。
- 发现并应用了一处"官方替代 API"升级：favicon/manifest 注入从 `tapIndex` 字符串替换
  改为结构化的 `webserver/index-inject` 事件（接口 4），因为字符串形式在页面没有字面
  `</head>` 时会静默失效。
- 确认 bundle `id` 必须等于包名（`manifest.ts`："Entry name == package name"；
  `stripClientSuffix` 只负责剥掉 `/client` 后缀）。
- 确认注册壳由 `client/modules/src/client/system.ts` 强制校验（未注册的 bundle 会抛出
  `loaded without registering "<id>" via __ModuleLoader__.load`）。
- `npm test` 全绿。针对运行中 DSH 会话的实机验证：**尚未执行**。

## 相关文档

- [`DEVELOPMENT.zh.md`](DEVELOPMENT.zh.md) —— 架构、构建、测试策略、发布流程
- [`README.zh.md`](README.zh.md) —— 面向用户的文档
- [`CHANGELOG.md`](CHANGELOG.md) —— 发布历史
