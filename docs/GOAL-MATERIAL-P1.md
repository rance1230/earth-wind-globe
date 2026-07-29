# 地球材质视觉升级 Goal（P1）— 大气散射 + 可选夜光

> **执行状态（2026-07-29）**：已落地并验收。  
> - `atmosphereMode()==="scatteringV1"`  
> - `nightLightsEnabled()===true`，`nightLightsSource()==="proceduralCities"`（NASA eoimages SSL 超时，诚实降级）  
> - P0 钩子保持：`materialMode==="cinematicPBR"`、`earthMapSource==="nasaBlueMarble"`  
> - desktop visual：**10 passed**  
> - 截图：`docs/screenshot-material-p1.png`  
> - 验证端口：`PREVIEW_PORT=4199`

## 推荐执行版（中文，可直接复制）

```text
/goal 在现有 Three.js 风场地球项目上完成 P1：把当前双层 rim 大气升级为太阳驱动的近似 Rayleigh/Mie 散射大气（日侧蓝晕有厚度、终止线附近可有暖色 horizon、夜侧更弱但不消失），并可选加入公共领域夜光贴图使夜面显示城市灯光（仅夜面发光、日面不发白）；保持 P0 cinematicPBR 海陆材质、ERA5 风场、边界、标签与 realisticSun 光照，运行时零网络、无版权素材。
验证：运行 `npm run build`；运行 `node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json`（若新增夜光资产则同样校验尺寸/sha 或独立 night 校验）；运行 `PREVIEW_PORT=4199 npx playwright test tests/visual.spec.js --project=desktop`（或至少 renders-the-globe + 新增大气/夜光断言）；确认 `window.__viz.atmosphereMode()` 为散射模式（如 scatteringV1）、`materialMode()==="cinematicPBR"`、`earthMapSource()==="nasaBlueMarble"`、`lightingMode()==="realisticSun"`、风源诚实；若夜光启用则 `nightLightsEnabled()===true` 且 `nightLightsSource` 诚实（nasaBlackMarble 或 proceduralFallback/none）；产出截图 `docs/screenshot-material-p1.png` 与 desktop 截图，人工确认轮廓大气更厚、terminator 更电影感、夜面有灯或明确说明未启用原因。
约束：不换引擎；不引入账号/API key/运行时网络贴图；不使用有版权 HDRI/夜光；不整球 emissive 仪表高亮；不破坏 P0 海陆 PBR 与 ERA5/边界/标签；不 git push；不推倒渲染管线。
边界：主要写入 `src/scene/layers/createAtmosphere.js`、`src/scene/layers/createEarth.js`、`src/scene/EarthScene.js`、必要 visual 测试阈值、可选 `public/assets/earth/*night*` 与 bake/validate 脚本、`docs/GOAL-MATERIAL-P1.md` 与 README 简述；禁止改 `.git/`、密钥、无关大重构。
迭代策略：先落地大气散射并预览，再加可选夜光（下载/烘焙失败则诚实降级为 none 或 procedural 且不阻断大气）；每次有意义改动后 build + 关键 visual；最多 3 轮调参（强度/bloom/夜光强度）；同一失败 2 次后换证据源。
完成条件：build 通过；大气模式可被 __viz 标识为散射实现；desktop 关键 visual 通过；截图显示比 P0 更厚的大气；夜光要么启用且仅夜面亮，要么诚实报告未启用并仍完成大气目标。
暂停条件：NASA 夜光源不可达且无法用公共领域替代、需要付费素材、或 visual 环境完全无法出图时暂停并写明阻塞。
```

## 默认选择理由

P1 锁定「大气散射 + 可选夜光」：大气是原帖电影感的第二大缺口且纯 shader 可完成；夜光有公共领域来源但下载可能失败，故设为可选并允许诚实降级，避免阻塞大气验收。

## 可选调整

1. 夜光：A 尽力下载 NASA 公共领域并烘焙（默认） / B 仅程序化城市点 / C 本轮不做夜光只做大气
2. 大气复杂度：A 近似散射双层（默认） / B 完整 ray-march 光学深度
3. 验证：A desktop 全量 visual（默认） / B 仅关键用例 + 截图

你可以直接回复：按默认，或如 `1C 2A 3B`。

## Goal Draft (English-compatible)

```text
/goal On the existing Three.js wind-field globe, deliver P1: upgrade the dual rim atmosphere into a sun-driven approximate Rayleigh/Mie scattering atmosphere (thicker day-side blue limb, optional warm horizon near the terminator, softer night limb), and optionally add public-domain night lights so city lights appear only on the night side; keep P0 cinematicPBR land/ocean materials, ERA5 wind, borders, labels, and realisticSun lighting with zero runtime network and no copyrighted assets.
Verification: run `npm run build`; validate earth assets; run desktop Playwright visual tests (or at least globe render + new atmosphere/night assertions); confirm `atmosphereMode` is a scattering implementation, P0 material hooks still hold, and night lights are either enabled with an honest source or honestly disabled; capture `docs/screenshot-material-p1.png` showing thicker atmosphere and, if enabled, night-side city lights.
Constraints: no engine switch; no accounts/API keys/runtime network textures; no copyrighted assets; no full-sphere emissive dashboard lighting; do not break P0 PBR or ERA5/borders/labels; no git push; no pipeline rewrite.
Boundaries: primarily edit atmosphere/earth/EarthScene layers, visual tests, optional night assets under public/assets/earth, bake/validate scripts, and short docs; do not touch secrets or unrelated refactors.
Iteration policy: ship atmosphere first, then optional night lights with honest fallback; rebuild and rerun key visual checks after meaningful changes; at most 3 tuning rounds; after 2 identical failures change evidence source.
Stop when: build passes, atmosphere mode is identifiable via __viz, desktop key visuals pass, screenshots show thicker atmosphere than P0, and night lights are either night-only enabled or honestly reported as unavailable.
Pause if: NASA night sources are unreachable with no public-domain alternative, paid assets are required, or the visual environment cannot produce images.
```
