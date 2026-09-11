# dsh-desktop-window

[English](README.md) | 中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件：把 DSH Web UI 用一个**独立应用窗口**打开 —— 双击即用，没有标签页、没有地址栏，浏览器配置目录与日常浏览完全隔离。

```text
dsh web  ──▶  服务就绪  ──▶  ┌──────────────────────────┐
                              │  DSH · 独立应用窗口       │
                              │  (Edge/Chrome --app)     │
                              └──────────────────────────┘
```

## 特性

- **自动开窗** —— 服务就绪后窗口自动出现（默认开启）；
- **手动开关** —— 会话头部的窗口按钮可直接开/关，状态自动同步；
- **设置开关** —— 设置 → 常规 →「启动时自动打开独立窗口」，重启后依然生效；
- **鲸鱼图标** —— 注入官方鲸鱼 favicon 与 web manifest，窗口标题栏与「安装为应用」后的图标均为 DeepSeek 样式；
- **完全隔离** —— 专用配置目录位于 `%TEMP%` 下，你日常的 Edge/Chrome 窗口、标签与登录态不受任何影响。

| | |
|---|---|
| 独立窗口 | Chromium `--app` 模式：无标签栏、无地址栏，启动尺寸 1440×900 |
| 自动开窗 | 首屏即为真实界面，而不是空白帧 |
| 会话头部按钮 | 展示实时窗口状态并切换开/关 |
| 设置页行 | 设置「常规」分区内的一枚紧凑开关 |
| 鲸鱼图标 | 7 种尺寸 favicon + web manifest，以 `<head>` 行注入 |
| 安全 | 有副作用的操作路由带同源校验（跨站 `POST` → `403`）；插件卸载时回收全部路由、定时器与子进程 |
| 生命周期 | 关窗状态自动同步；关闭时清理整棵进程树 |

## 环境要求

| | |
|---|---|
| 操作系统 | Windows 10/11（主要），macOS 11+ | Linux 复用同一代码路径，尚未验证 |
| DSH | `>= 0.1.0-rc.6` —— 开发与验证基于 **0.1.5-rc.1** |
| Node.js | `>= 22`（继承自 DSH） |
| 浏览器 | Edge、Chrome、Chromium、Brave 或 Vivaldi，位于标准安装位置 |
| pnpm | 仅 `dsh plugin add` / `update` 需要（`npm install -g pnpm`） |

窗口逻辑本身跨平台，但目前只有 Windows 是受支持的目标平台。

## 安装方法

> 安装组合包会改变 profile 的组合包列表，而 DSH 在**启动时**读取该列表 —— 因此之后必须重启 `dsh web`。

**从 GitHub 安装：**

```sh
dsh plugin --profile web add github:fengzhiyushui/dsh-desktop-window
# 等价写法：
dsh plugin --profile web add "git+https://github.com/fengzhiyushui/dsh-desktop-window.git"
```

**从本地目录安装：**

```sh
dsh plugin --profile web add "file:D:/path/to/dsh-desktop-window"
```

`dsh plugin add` 会把包装进 profile 的 `node_modules`，并自动把声明了 `dsh.bundle` 的组合包合并进 `dsh.profile.bundles` —— 无需手工改配置。然后**重启 `dsh web`**。

也可以让脚本一次做完（检查 pnpm、规避空格路径、校验组合层）：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件目录>\scripts\install.ps1"
```

<details>
<summary><b>Windows：从含空格的路径安装</b></summary>

`dsh plugin` 会把参数经 shell 转发给 pnpm，含空格的路径会被重新分词。改用无空格的目录联接（junction）安装 ——
`scripts/install.ps1` 已自动处理，手工方式如下：

```powershell
New-Item -ItemType Junction -Path D:\dsh-desktop-window -Target 'D:\path with spaces\dsh-desktop-window'
dsh plugin --profile web add "file:D:/dsh-desktop-window"
```
</details>

### 更新

```sh
# git 依赖会重新拉取默认分支的 HEAD
dsh plugin --profile web update dsh-desktop-window
# 然后重启 dsh web
```

用户无需重新 `add`，`update` 就够了。

## 使用

```sh
dsh web
# 服务就绪后独立应用窗口自动弹出
```

| 做什么 | 在哪里 |
|---|---|
| 开 / 关独立窗口 | 会话头部的窗口按钮 |
| 开关自动开窗 | 设置 → 常规 →「启动时自动打开独立窗口」 |
| 调整浏览器优先级 | 编辑 `lib/window-spec.js` 中的 `browserCandidates()` |

关闭应用窗口**不会**结束 `dsh` 进程 —— 这是刻意设计：只关闭独立窗口。

### 桌面快捷方式（Windows）

```powershell
# 鲸鱼图标，以本插件目录为默认工作区
powershell -ExecutionPolicy Bypass -File "<插件目录>\scripts\create-shortcut.ps1"

# 指定默认工作区
powershell -ExecutionPolicy Bypass -File "<插件目录>\scripts\create-shortcut.ps1" -WorkspaceDir "D:\my project"
```

快捷方式指向的启动器是 `DSH-Desktop.cmd`，也可以直接双击运行。它在 `PATH` 上有 `dsh` 时直接用 `dsh`，
否则回退到 `npx @deepseek-ai/dsh@latest`（可用环境变量 `DSH_DESKTOP_DSH_VERSION` 固定版本）。

## 配置

自动开窗偏好保存在 `$DSH_HOME/desktop-window.json`（默认 `%USERPROFILE%\.dsh\desktop-window.json`）。
它由设置页开关写入，也可以手工编辑 —— 包括用记事本保存（兼容 UTF-8 BOM）。

```json
{
  "autoOpen": true,
  "cleanProfileOnUnload": false
}
```

| 键 | 默认值 | 含义 |
|---|---|---|
| `autoOpen` | `true` | 服务启动后是否自动打开独立窗口 |
| `cleanProfileOnUnload` | `false` | 插件卸载时是否删除专用浏览器配置目录。保持 `false` 时保留该目录，窗口因此能"热启动" |

### HTTP 接口

插件的浏览器半侧通过这些路由通信，也可以从脚本调用。有副作用的路由会拒绝跨站 `Origin`（`403`）以及超过 4 KB 的请求体。

| 路由 | 方法 | 用途 |
|---|---|---|
| `/desktop-window/status` | `GET`/`POST` | `{ open, auto }` |
| `/desktop-window/toggle` | `POST` | 打开窗口；已打开时则关闭 |
| `/desktop-window/set-auto` | `POST` | `{ auto: boolean }` → 持久化偏好 |
| `/desktop-window/manifest.webmanifest` | `GET` | 注入的 web manifest |
| `/desktop-window/<icon>.png` | `GET` | 图标字节流 |

## 平台支持

| 平台 | 自动开窗与按钮 | 关闭窗口 | 说明 |
|---|---|---|---|
| Windows 10/11 | 支持 | 完整进程树清理（`taskkill /T /F`） | 主要目标平台 |
| macOS | 支持 | 先 SIGTERM，2 秒后升级为 SIGKILL | Chrome、Edge、Chromium、Brave、Vivaldi，查 `/Applications` 与 `~/Applications` |
| Linux | 支持 | 先 SIGTERM，2 秒后升级为 SIGKILL | Chrome、Edge、Chromium、Brave，查常见的 `/usr/bin` 位置 |

所有平台启动的都是同一个 Chromium `--app` 窗口，差异只在浏览器发现与进程拆除。
Windows 与 macOS 有各自专属的代码路径并有测试覆盖；Linux 与 macOS 共用 POSIX 路径，
但尚未在真机上验证。

## 已知限制

- **任务栏／Dock 图标显示的是浏览器，而不是鲸鱼。** 本窗口是 `--app` 模式下的 Chromium，
  因此 Windows 会把它的任务栏按钮归到 Edge/Chrome 名下，macOS 的 Dock 同样显示浏览器图标；
  标题栏、标签页图标与 Alt+Tab / ⌘-Tab 用的是注入的 favicon。若想处处都是鲸鱼，
  请把页面安装为应用：**Edge 菜单 → 应用 → 将此站点安装为应用**，或在 Chrome 中
  **⋮ → 投放、保存和共享 → 将页面作为应用安装**（macOS：**⋮ → 保存并共享 → 将页面作为应用安装**）。
  两者都会消费本插件注入的 manifest。
- **关闭窗口不会退出 `dsh`** —— 刻意设计。
- **这是浏览器窗口**，不是内嵌 webview。
- **专用配置目录会保留**在系统临时目录下（Windows 为 `%TEMP%\dsh-desktop-window`，
  macOS 为 `$TMPDIR/dsh-desktop-window`），这正是窗口能热启动的原因。
  把它设为 `cleanProfileOnUnload: true` 可在卸载时清理。
- **开窗不等于身份认证。** 有副作用的路由会拒绝跨站浏览器请求，但不会对本机非浏览器进程做校验。

## 开发

开发规范、构建细节与版本适配清单是独立文档：

- [DEVELOPMENT.zh.md](DEVELOPMENT.zh.md) —— 架构、构建、测试策略、发布流程；
- [ADAPTATION.zh.md](ADAPTATION.zh.md) —— DSH 兼容矩阵，以及新版本 DSH 发布时需要重新核验的内容。

> **本项目每次改动都必须同步更新上述两份文档。**

## 许可

[MIT](LICENSE)
