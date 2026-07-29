# 地球材质视觉升级 Goal（P4）— 云层 + 海洋高光再压

> **执行状态（2026-07-29）**：已落地。  
> - 云层：`cloudsEnabled()===true`，`cloudsSource()==="procedural"`  
> - 资产：`public/assets/earth/clouds-2048x1024.png`（程序化，无第三方版权）  
> - 海洋：clearcoat/env/roughness 再压一档 + exposure/sun 下调  
> - KTX2：**本轮不做**（已记入暂缓）  
> - desktop visual：**10 passed**；截图 `docs/screenshot-material-p4.png`

## 默认选择

本轮默认：**P4 云层 + 海洋 specular 再压一档**。  
**KTX2 压缩暂缓**（需 Basis 转码依赖与构建管线，观感 ROI 低于云层与高光调参）。

## 推荐执行版（中文，可直接复制）

```text
/goal 在现有 Three.js 风场地球上完成 P4：新增半透明慢转云层（公共领域或程序化 equirect，运行时零网络），并再压一档海洋 clearcoat/envMap/roughness 高光，避免大西洋过曝白斑；保持 P0–P3 材质、大气散射、夜光钩子、ERA5 与 High/Low 贴图档；诚实降级（云图缺失则 cloudsEnabled=false）。
验证：npm run build；PREVIEW_PORT=4199 desktop visual（至少 renders-the-globe）；__viz.cloudsEnabled/cloudsSource 诚实；海洋过曝不明显；截图 docs/screenshot-material-p4.png。
约束：不换引擎；不引入付费/版权云图；不做 KTX2 本轮；不破坏 ERA5/边界/标签；不 git push。
边界：createClouds 新层、createEarth 海洋参数、EarthScene 挂载/动画、可选 public/assets/earth/clouds*、测试与 docs。
迭代策略：先压海洋高光，再上云层；失败则诚实关云；最多 3 轮调参。
完成条件：build 与 desktop 关键 visual 通过；云层可开关且可验证；高光明显收敛或截图证明改善。
暂停条件：仅当 visual 环境无法出图时暂停。
```

## Goal Draft (English-compatible)

```text
/goal Deliver P4 cloud layer + dialed-down ocean specular on the existing Three.js globe; defer KTX2. Public-domain or procedural clouds only; zero runtime network; keep P0–P3, ERA5, quality tiers.
Verification: build, desktop visual tests, honest cloudsEnabled/cloudsSource hooks, screenshot docs/screenshot-material-p4.png.
Constraints: no engine switch, no copyrighted clouds, no KTX2 this round, no git push.
Boundaries: cloud layer, earth specular params, EarthScene wiring, optional cloud assets, tests/docs.
Stop when: build + key visuals pass, clouds verifiable, ocean hotspots reduced.
```
