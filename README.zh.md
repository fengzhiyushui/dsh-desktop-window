# dsh-desktop-window

中文 | [English](README.md)

DSH 桌面窗口插件：让 DeepSeek Harness 的 Web UI 以**独立应用窗口**（Edge/Chrome `--app` 模式）打开——双击启动、自动弹窗、无地址栏、与日常浏览器互不干扰。

## 特性

- **自动开窗**：`dsh web` 启动、服务器就绪后，自动弹出独立应用窗口（默认开启）；
- **手动开关**：会话头部操作行新增「独立窗口」按钮，一键开/关窗口；
- **设置开关**：设置 → 常规 →「启动时自动打开独立窗口」，持久化到 `$DSH_HOME/desktop-window.json`（兼容记事本编辑产生的 BOM）；
- **鲸鱼图标**：向页面注入 DeepSeek 官方鲸鱼 favicon（16/32/64/128/256 多尺寸）+ web manifest（192/512），窗口标题栏显示鲸鱼；任务栏图标通过图标助手尽力设置（见已知限制）；
- **安全**：操作路由带同源校验（跨站 POST 返回 403）；窗口使用 TEMP 下的**独立配置目录**，与你的日常 Edge/Chrome 完全隔离；
- **生命周期**：关窗后状态自动同步；插件卸载时清理窗口进程树、图标助手与全部路由。

## 安装

前置条件：已安装 DSH（`dsh` 命令可用）与 pnpm（`dsh plugin` 内部依赖 pnpm；没有则 `npm install -g pnpm`）。

**从 GitHub 安装（推荐）：**

```sh
dsh plugin --profile web add github:<你的用户名>/dsh-desktop-window
# 或
dsh plugin --profile web add "git+https://github.com/<你的用户名>/dsh-desktop-window.git"
```

**从本地目录安装：**

```sh
dsh plugin --profile web add "file:D:/path/to/dsh-desktop-window"
```

> **Windows 空格路径坑**：`dsh plugin` 转发参数给 pnpm 时，含空格的路径会被命令行二次切分导致
> `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`。解法：为插件目录建一个无空格的 junction 再安装：
>
> ```powershell
> New-Item -ItemType Junction -Path D:\dsh-desktop-window -Target 'D:\path with spaces\dsh-desktop-window'
> dsh plugin --profile web add "file:D:/dsh-desktop-window"
> ```

`dsh plugin add` 会把插件装进 profile 的 node_modules，并自动把声明了 `dsh.bundle` 的包并入
`dsh.profile.bundles` 组合层，无需手改配置。安装后**重启 `dsh web`** 生效。

## 更新

```sh
# 更新到最新版本（git 依赖会重新拉取默认分支最新提交）
dsh plugin --profile web update dsh-desktop-window

# 然后重启 dsh web
```

新版发布流程见 [CHANGELOG.md](CHANGELOG.md)；插件新增版本无需用户重新 `add`，直接 `update` 即可。

## 使用

```sh
dsh web
# 服务器就绪后自动弹出独立应用窗口
```

- 会话标题右侧的「独立窗口」按钮：开/关窗口；
- 设置 → 常规：关闭/开启自动开窗；
- 浏览器选择：默认优先 Edge，其次 Chrome（均使用 `--app` 应用窗口模式，参数通用）。想指定优先级可编辑
  `lib/index.js` 中的 `BROWSER_CANDIDATES` 顺序。

## 桌面快捷方式（Windows）

一键创建（目标 `DSH-Desktop.cmd`、鲸鱼图标）：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\scripts\create-shortcut.ps1"
# 指定默认工作区：
powershell -ExecutionPolicy Bypass -File "<插件目录>\scripts\create-shortcut.ps1" -WorkspaceDir "D:\my project"
```

也可以直接双击 `DSH-Desktop.cmd`（自动识别全局 `dsh`，没有则走 npx）。

## 平台

Windows 优先（窗口关闭依赖 `taskkill`、任务栏图标助手依赖 PowerShell）。macOS/Linux 上
自动开窗与按钮可用，但关闭窗口会退化为仅结束主进程。

## 开发与构建

`lib/client.js` 是浏览器端 bundle（构建产物已提交，安装者无需构建）。要点：

- **react 必须 external**：官方客户端 bundle 通过 `require("react")` 命中模块表种子词（shell 内核
  注册的共享 React）；内联打包会产生第二份 React，导致 Hooks 崩溃；
- **必须带 `__ModuleLoader__.load` 注册壳**：裸 CJS 输出不会被模块表识别。

重新构建：

```sh
npm install          # esbuild + react（开发依赖）
npm run build        # node scripts/build-client.js
```

## 目录结构

```
package.json            dsh.bundle + dsh.client 双面声明
cordis.patch.yml        组合层（一行：desktop-window）
lib/index.js            Host 半边：窗口进程 + HTTP 路由 + 图标/manifest 注入 + 状态持久化
lib/client.js           浏览器 bundle（构建产物，已提交）
src/client.js           客户端源码（React）
scripts/build-client.js 构建脚本（esbuild + 注册壳）
scripts/set-window-icon.ps1  任务栏图标助手（WM_SETICON + 自定义 AUMID）
scripts/install.ps1     一键安装
scripts/create-shortcut.ps1  一键桌面快捷方式
DSH-Desktop.cmd         双击启动器
assets/                 DeepSeek 官方鲸鱼图标（SVG/PNG 多尺寸/ICO）
```

## 已知限制

- **Windows 任务栏按钮图标**：标题栏已显示鲸鱼（favicon/manifest 生效），但任务栏按钮在部分
  Edge 版本仍显示默认图标——图标助手会尝试 WM_SETICON + 自定义 AppUserModelID，效果因 Edge
  版本而异。需要 100% 鲸鱼任务栏图标时，可在窗口内「Edge 菜单 → 应用 → 将此站点安装为应用」
  （会使用本插件注入的 manifest 图标）。
- 关闭应用窗口不会退出 `dsh` 进程（终端里的 dsh 继续运行）。
- 自动开窗开关存于 `$DSH_HOME/desktop-window.json`；后续版本可迁移到 settings 服务。

## License

MIT
