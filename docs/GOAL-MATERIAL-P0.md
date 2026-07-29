# 地球材质视觉升级 Goal（P0）

> **执行状态（2026-07-28）**：已落地并验收。  
> - `materialMode()==="cinematicPBR"`、`oceanSpecularEnabled()===true`、`environmentKind()==="deepSpacePMREM"`  
> - desktop visual：全量 10 passed；调参后再跑关键 3 项 passed  
> - `npm run build` 通过；资产 validator PASS  
> - 截图：`docs/screenshot-material-p0.png`、`docs/screenshot.png`  
> - 说明：本地若 4173 被占用，使用 `PREVIEW_PORT=4199 npm run test:visual`

## 推荐执行版（中文，可直接复制）

```text
/goal 在现有 Three.js 风场地球项目中完成 P0 材质光学升级：把哑光贴图球升级为海陆分离的 PBR 地球（海洋更镜面、陆地更哑光），用深空风格环境反射替代室内 RoomEnvironment 矩形高光，微调大气轮廓光与夜面柔光使 terminator 更清晰，并保证 ERA5 风场/边界/标签/验收钩子仍可用；最终截图与原帖观感差距在「液体海洋 + HDRI 感」方向明显缩小。
验证：运行 `npm run build`；运行 `node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json`；运行 `npm run test:visual`（或在 SwiftShader 过慢时至少跑 desktop `renders-the-globe` 相关用例并保存截图）；检查 `window.__viz.earthMapSource()==="nasaBlueMarble"`、`windSource()` 仍为 era5 成功路径、`lightingMode` 仍为 realisticSun；产出 `tests/__screens__/desktop.png` 与（如有）mobile 截图，人工确认海洋有可见太阳/环境高光、陆地无明显廉价镜面、rim 大气仍在、风线仍可读。
约束：不换渲染引擎；不引入账号/API key/运行时网络贴图；不使用有版权素材；不整球 emissive 自发光回归；不删除 ERA5/边界/标签功能；不 git push；不改无关业务逻辑；保持 `window.__viz` 钩子可扩展不破坏既有字段语义。
边界：主要写入 `src/scene/layers/createEarth.js`、`src/scene/layers/createAtmosphere.js`、`src/scene/EarthScene.js`、必要的 `tests/visual.spec.js` 与 `tests/helpers/colorBuckets.js` 阈值重标定、可选 `public/assets/earth/` 烘焙资产与 manifest、`docs/` 或 README 中材质说明；禁止修改 `.git/`、密钥、node_modules 源、无关 scripts 大重构。
迭代策略：按 P0 顺序实现（1 海陆 roughness/clearcoat 掩膜 2 深空 env 3 灯光/大气微调 4 验收重标定）；每步后能本地预览则预览；同一失败连续 2 次后换证据（读测试输出/截图/控制台）再改；最多 3 轮聚焦调参后报告剩余风险。
完成条件：build 通过；地球仍加载 NASA 贴图；材质模式可被代码或 `__viz` 标识为 cinematicPBR 或等价；visual 测试通过或阈值按新观感诚实重标定且截图证明海洋高光与 terminator 改善；风场数据源仍诚实报告。
暂停条件：需要付费/登录下载贴图、引入版权 HDRI、推倒渲染管线、16K 贴图下载不可达且无公共领域替代、或 visual 测试环境完全无法出图时暂停并写明阻塞。
```

## 默认选择理由

优先做 P0「海陆 PBR + 深空环境 + 灯光/大气微调」，因为可行性报告判定这是相对原帖观感的最大跃升，且可在现有 Three.js 管线内 3–5 天级完成，无需换引擎或引入运行时网络。

## 可选调整

1. 范围：A 仅 P0 材质光学（默认） / B P0+P1 大气散射体 / C P0+P1+P2 夜光
2. 环境反射：A 程序化深空 PMREM（默认，零版权） / B 公共领域 HDR 文件烘焙进 public
3. 验证深度：A build + visual 全套（默认） / B 仅 desktop 关键用例 + 截图 / C 全套 + 人工并排原帖

你可以直接回复：按默认，或如 `1B 2A 3B`。

## Goal Draft (English-compatible)

```text
/goal Deliver a P0 cinematic material upgrade for the existing Three.js wind-field globe: convert the matte textured sphere into land/ocean-separated PBR (shinier ocean, matte land), replace indoor RoomEnvironment rectangular reflections with a deep-space style environment, retune atmosphere rim and night fill for a clearer terminator, and keep ERA5 wind, borders, labels, and __viz hooks working so screenshots move closer to the original X post look.
Verification: run `npm run build`; run `node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json`; run `npm run test:visual` (or at least desktop globe render cases if SwiftShader is too slow) and keep screenshots under `tests/__screens__/`; confirm `earthMapSource()==="nasaBlueMarble"`, honest wind source, and `lightingMode==="realisticSun"`; visually confirm ocean specular/env response, matte land, rim atmosphere, and readable wind lines.
Constraints: do not switch engines; no accounts/API keys/runtime network textures; no copyrighted assets; no full-sphere emissive dashboard lighting regression; do not remove ERA5/boundaries/labels; no git push; do not break existing __viz field semantics.
Boundaries: primarily edit `src/scene/layers/createEarth.js`, `createAtmosphere.js`, `EarthScene.js`, necessary visual test thresholds, optional baked assets under `public/assets/earth/`, and short docs; do not touch secrets, `.git/`, or unrelated refactors.
Iteration policy: implement in order (ocean/land maps → deep-space env → light/atmosphere tune → test recalibration); rerun checks after meaningful changes; after 2 identical failures change evidence source; at most 3 focused tuning rounds then report residual risks.
Stop when: build passes, NASA map still loads, material upgrade is identifiable in code or __viz, visual checks pass or are honestly recalibrated with screenshot evidence of improved ocean response and terminator, and wind source reporting remains honest.
Pause if: paid/login downloads, copyrighted HDRI, full pipeline rewrite, unreachable 16K assets without public-domain fallback, or the visual test environment cannot produce images.
```
