# Next Agent Prompt

你接手的是本地项目 `/Volumes/vol1/3D 风场地球可视化/`。

目标：把当前 Vite + Three.js 占位外壳继续实施成 V1 视觉近似版，复现 X 视频里的核心观感：玻璃质感地球、动态风场流线、卫星点群、室内反射、bloom 后期和可录屏镜头。

先读：

1. `README.md`
2. `PLAN.md`
3. `TRANSFER_STATUS.md`

执行边界：

- 不修改 `/Volumes/vol1/codex/container-3d-tutor/`，它只作为参考。
- 不复制 `/tmp/codetaur_video/codetaur_globe.mp4` 或抽帧进项目。
- 不接 Copernicus ERA5、TLE、API key、外部账号或实时服务。
- 不做 Git commit/push。

推荐下一步：

1. 运行 `npm install && npm run build && npm run test:visual`，确认移交外壳可用。
2. 从 `src/scene/layers/createEarth.js` 开始打磨程序化地球纹理。
3. 将 `src/scene/layers/createWindLayer.js` 从占位 Line 扩展为 700-1200 条短流线。
4. 将 `tests/visual.spec.js` 替换为真正的 Playwright canvas 像素验收。
5. V1 通过后更新 `TRANSFER_STATUS.md`，并把截图/录屏路径写回。
