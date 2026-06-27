# Transfer Status

更新时间：2026-06-27 17:05 Asia/Shanghai

## 已包含

- `README.md`：项目入口、技术栈、路线图、启动命令。
- `PLAN.md`：自包含实施计划与决策记录。
- `NEXT_AGENT_PROMPT.md`：接手 agent 执行提示。
- `package.json` / `vite.config.js` / `index.html`：Vite + Three.js 项目外壳。
- `src/`：占位 Three.js 场景、地球、风场、卫星和数据模块。
- `tests/visual.spec.js`：移交外壳校验脚本。
- `package-lock.json`：依赖锁定文件。

## 已排除

- 原 X 视频：`/tmp/codetaur_video/codetaur_globe.mp4`。
- 抽帧：`/tmp/codetaur_video/frame_*.jpg`。
- 任何 Copernicus/CDS API key、TLE 外部账号、浏览器状态、MCP 配置、provider 配置、邮箱或联系人信息。
- 无关历史项目、旧交接包、`container-3d-tutor` 源码复制件。

## 当前验证状态

- 现有 `README.md` 与 `PLAN.md` 已备份到 `.handoff-backups/20260627-170134/`。
- `npm install`：通过。
- `npm run build`：通过。
- `npm run test:visual`：通过；当前是移交外壳校验，不是完整 Playwright 像素验收。
- `npm audit`：0 vulnerabilities。原计划中的 `vite@8.0.14` 已校正为 `vite@8.1.0`，避免 Windows 路径相关 advisory。
- `MANIFEST.sha256`：已使用 null-delimited `find ... -print0 | sort -z | xargs -0 shasum -a 256` 流程生成，排除 `MANIFEST.sha256` 自身。

## 下一步

1. V1 实施完成后，把 `tests/visual.spec.js` 升级为 Playwright canvas 像素验收，并更新本文件。
2. 如果要跨机器传输，再生成 zip 并执行 `unzip -t` 验证。
