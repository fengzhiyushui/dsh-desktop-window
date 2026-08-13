# Changelog

## 0.1.0 (2026-08-13)

初版。

### 功能

- `dsh web` 启动后自动以独立应用窗口（Edge/Chrome `--app` 模式）打开 Web UI；
- 会话头部「独立窗口」按钮，手动开/关窗口，状态自动同步；
- 设置 → 常规「启动时自动打开独立窗口」开关，持久化到 `$DSH_HOME/desktop-window.json`（兼容 BOM）；
- DeepSeek 官方鲸鱼图标：多尺寸 favicon + web manifest（192/512）注入，窗口标题栏生效；
- 任务栏图标助手：WM_SETICON（周期重推）+ 窗口类图标 + 自定义 AppUserModelID（实验性，见已知问题）；
- 操作路由同源防护（跨站 POST 403）；独立窗口配置目录与日常浏览器完全隔离；
- 窗口进程树清理（taskkill /T /F）、插件卸载全量回收。

### 修复历史（本版本内）

- 客户端 bundle 增加 `__ModuleLoader__.load` 注册壳（否则 `loaded without registering` 报错）；
- react 改为 external、走共享 React（否则 `Invalid hook call` / `useState` 崩溃）；
- 移除 `windowsHide`（曾导致窗口进程存活但不可见）；
- 状态文件解析兼容 UTF-8 BOM；`cordis.patch.yml` 修正为顶层数组格式。

### 已知问题

- Windows 任务栏按钮图标在部分 Edge 版本仍显示默认图标（标题栏已是鲸鱼）；需要 100% 效果时
  使用「将此站点安装为应用」。
- 关闭窗口不退出 `dsh` 进程（按设计，仅关闭独立窗口）。

## 发布/更新流程

1. 修改代码后运行 `npm run build`（重新生成 `lib/client.js`）；
2. 更新 `package.json` 的 `version` 并在本文件记录变更；
3. 提交并推送到 GitHub 默认分支；
4. 用户侧执行 `dsh plugin --profile web update dsh-desktop-window` 并重启 `dsh web`。
