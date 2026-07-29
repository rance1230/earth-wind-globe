# 地球材质视觉升级 Goal — KTX2 压缩（High 档）

> **执行状态（2026-07-29）**：已落地。  
> - High：`textureEncoding.albedo/normal === "ktx2"`，`cloudsEncoding === "ktx2"`，height 保持 `png`  
> - 体积：源合计 ~6.67MB → KTX2 合计 ~3.16MB（**ratio 0.47**），见 `public/assets/earth/ktx2/manifest.json`  
> - transcoder：`public/basis/*`；烘焙：`scripts/earth/bake_ktx2.sh`  
> - desktop visual：**10 passed**；截图 `docs/screenshot-material-ktx2.png`

## 推荐执行版（中文，可直接复制）

```text
/goal 为现有 Three.js 风场地球的 High 质量档启用 KTX2/Basis 压缩贴图：将 8K albedo、2880 normal（及可选 height/clouds）烘焙为 .ktx2，运行时用 KTX2Loader + 官方 transcoder；加载失败诚实回退 JPEG/PNG；Low 档仍用原有 JPEG/PNG；保持 P0–P4 材质/云层/大气/ERA5；不引入付费服务。
验证：npm run build；desktop visual 全量或关键用例；__viz 暴露 textureEncoding high=ktx2|jpeg 诚实值；albedo 仍 ≥8192（或回退 5400）；体积对比 High 贴图总大小相对 JPEG/PNG 下降；截图 docs/screenshot-material-ktx2.png。
约束：不换引擎；运行时零外网；不破坏 Low 档与 fallback 诚实性；不 git push；transcoder 静态服务自 public。
边界：scripts/earth 烘焙脚本、public/assets/earth/*.ktx2、public/basis transcoder、createEarth/createClouds/EarthScene、测试与 docs。
迭代策略：先烘焙与体积验证，再接线加载与回退，最后 visual；最多 3 轮。
完成条件：build 与 desktop 关键 visual 通过；High 优先 KTX2 或诚实 JPEG 回退；体积有文档化对比。
暂停条件：无法安装 basisu/ktx 编码器且无替代方案时，用 JPEG 质量优化并诚实记录阻塞。
```

## 默认选择理由

KTX2 针对 P3 引入的 8K+2880 体积与解码压力；High 用 GPU 压缩纹理，Low 保持兼容。

## Goal Draft (English-compatible)

```text
/goal Enable KTX2/Basis compressed textures for High quality on the existing Three.js wind-field globe; bake 8K albedo and 2880 normal (optional height/clouds) to .ktx2; load via KTX2Loader with vendored transcoder; honest JPEG/PNG fallback; Low stays on legacy formats; keep P0–P4 and ERA5.
Verification: build, desktop visual, textureEncoding hook, size comparison, screenshot docs/screenshot-material-ktx2.png.
Constraints: no engine switch, no runtime network, no paid services, no git push.
Boundaries: bake scripts, ktx2 assets, public/basis, earth/clouds loaders, EarthScene, tests/docs.
Stop when: High prefers KTX2 or honest fallback, visuals pass, size win documented.
```
