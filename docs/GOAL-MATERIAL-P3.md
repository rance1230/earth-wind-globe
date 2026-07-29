# 地球材质视觉升级 Goal（P3）— 贴图清晰度（8K albedo + 高清 normal）

> **执行状态（2026-07-29）**：已落地。  
> - High：`albedo 8192×4096`、`normal/height 2880×1440`（原生 ETOPO1）  
> - Low：保留 `5400×2700` + `720×360`  
> - NASA eoimages 8K 不可达 → 使用 Wikimedia NASA Blue Marble 2002 全分辨率下采样为 8K  
> - validator PASS（含 hires）；desktop visual **10 passed**  
> - 截图：`docs/screenshot-material-p3.png` / `docs/screenshot-material-p3-zoom.png`

## 推荐执行版（中文，可直接复制）

```text
/goal 在现有 Three.js 风场地球项目上完成 P3 贴图清晰度升级：为 High 质量提供更高分辨率 NASA Blue Marble equirect albedo（目标约 8K 宽，公共领域），并将 ETOPO1 派生 normal（及可选 height）升到至少 2K 宽；Low 质量保留现有 5400×2700 + 720 normal 以控体积；运行时零网络、诚实 fallback；保持 P0 cinematicPBR、P1 scatteringV1/夜光钩子、ERA5 风场与 realisticSun。
验证：运行 `npm run build`；校验 albedo/normal manifest（尺寸、sha256、体积门可按档调整）；`PREVIEW_PORT=4199 npx playwright test tests/visual.spec.js --project=desktop`（至少 renders-the-globe + terrain + material）；`__viz` 暴露 `albedoResolution`/`normalResolution` 或等价，High 档高于 baseline；产出 `docs/screenshot-material-p3.png` 与 zoom 截图，人工确认近景陆地纹理与浮雕比 P1 更清晰。
约束：不换引擎；不引入账号/付费/运行时网络贴图；不使用有版权素材；不破坏 P0/P1 材质与风场；不 git push；总资产体积尽量可控（High 可更大，Low 维持轻量）。
边界：主要写入 `public/assets/earth/` 新资产与 manifest、`scripts/earth/` bake/validate、`src/scene/layers/createEarth.js`、`EarthScene.js` 质量联动、必要 visual 测试与 README/docs；禁止改密钥与无关大重构。
迭代策略：先尝试获取/烘焙 8K albedo + 高清 normal；下载失败则用可达的最高公共领域分辨率并诚实报告，至少把 normal/height 升到 ≥2048 宽；build + 关键 visual；最多 3 轮调参（体积/anisotropy/加载策略）。
完成条件：build 通过；High 档贴图分辨率明显高于 5400×2700 或明确文档化「8K 不可达 + 实际采用分辨率」；normal ≥2048 宽已启用；desktop 关键 visual 通过；截图与钩子可证明清晰度提升或诚实降级。
暂停条件：全部公共领域高清源不可达且无法从本地 ETOPO 重烘焙、需要付费素材、或 visual 环境无法出图时暂停。
```

## 默认选择理由

P3 锁定贴图清晰度：P0/P1 已补光学与大气，近景糊主要来自 5.4K albedo 与 720 normal；High/Low 双档可在画质与体积间平衡。

## Goal Draft (English-compatible)

```text
/goal Deliver P3 texture clarity on the existing Three.js wind-field globe: High quality uses a higher-resolution public-domain NASA Blue Marble equirect albedo (~8K width target) and ETOPO1-derived normal/height at ≥2K width; Low keeps the current 5400×2700 + 720 maps; zero runtime network; honest fallback; keep P0 cinematicPBR, P1 atmosphere/night hooks, ERA5 wind, and realisticSun.
Verification: build; validate manifests; desktop Playwright visual tests; expose resolution hooks; capture docs/screenshot-material-p3.png showing sharper zoomed terrain/texture.
Constraints: no engine switch, no paid/copyrighted assets, no runtime network textures, no breakage of P0/P1/ERA5, no git push; control package size via quality tiers.
Boundaries: public/assets/earth, scripts/earth, createEarth/EarthScene, visual tests, short docs only.
Iteration policy: fetch/bake 8K + hi-res normal first; if 8K unreachable use best available public-domain res and still ship ≥2K normal; max 3 tuning rounds.
Stop when: build passes, High is clearly sharper or honestly documented, normal ≥2K is live, key visuals pass, screenshots/hooks prove the upgrade.
Pause if: all public-domain hi-res sources unreachable and ETOPO cannot be rebaked, paid assets required, or visual env cannot capture.
```
