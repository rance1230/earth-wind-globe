# 交接：Three.js 3D 风场地球可视化复现

> 本文档是**自包含交接包**。接手者按「实施入口」执行即可，无需重新做技术决策。
>
> 目标目录：`/Volumes/vol1/3D 风场地球可视化/`
> 来源参考：X 视频 [@codetaur, 2026-06-27](https://x.com/codetaur/status/2070734494915797392)

---

## 0. 一句话目标

用 **Vite + 原生 Three.js** 复现 X 视频的核心观感：**玻璃质感地球 + 动态风场流线 + 卫星点群 + 室内 HDRI 反射 + bloom 后期 + 可录屏镜头**。V1 用合成数据跑通全视觉，真实 ERA5/TLE 留 V2。

---

## 1. 已锁定决策（不再讨论）

| 项 | 决定 | 理由 |
|---|---|---|
| 渲染栈 | **原生 Three.js**（非 R3F） | 本机有可工作原生项目可借鉴；shader/粒子需底层掌控；贴近原作者气质 |
| 数据 | **V1 合成风场 + 合成卫星** | 先跑通视觉，不接外部账号；接口预留 V2 替换 |
| 反射 | **RoomEnvironment**（非外部 HDRI） | 零依赖、零版权风险 |
| 卫星版本 | V1 合成；V2 优先 pin `satellite.js@6.0.2` | V1 不依赖；避免 `7.x` 与 Vite 的兼容风险 |
| V1 风场 | **预计算短流线段**（8-16 段折线/条） | 有动感且不掉进实时 advection 的性能坑 |

## 2. 明确不做（V1 范围外）

- ❌ 实时 ERA5 / Copernicus API（V2）
- ❌ React / R3F
- ❌ AR / 摄像头
- ❌ 公网部署 / Git push
- ❌ 有版权的外部地球纹理或 HDRI
- ❌ 原视频帧打包进 repo

## 3. 脆弱假设（实施首步必须验证）

| # | 假设 | 兜底 |
|---|---|---|
| **H1** | `container-3d-tutor` 存在且 `vite@8.0.14 + three@0.184.0`、`npm run build` 通过 | 不存在/失败 → `npm create vite@latest -- --template vanilla` 全新起 |
| **H2** | 程序化 canvas 地球纹理能产出可读大陆/海洋对比 | canvas → Three.js examples 自带 earth texture（BSD）→ 自然地球公共领域矢量 |
| H3 | `satellite.js@6.0.2` 足以支撑 V2 TLE 轨道计算 | 仅 V2 触及；若 API 不够，再单独评估新版兼容性 |

---

## 4. 文件结构（目标）

```
/Volumes/vol1/3D 风场地球可视化/
  PLAN.md                 ← 本交接文档
  README.md               ← 项目入口 + 快速启动
  NEXT_AGENT_PROMPT.md    ← 接手 agent 执行提示
  TRANSFER_STATUS.md      ← 移交状态、排除项和验证记录
  MANIFEST.sha256         ← 文件校验清单
  package.json
  vite.config.js
  index.html
  src/
    main.js
    styles.css
    config.js
    scene/
      EarthScene.js
      layers/
        createEarth.js
        createWindLayer.js
        createSatelliteLayer.js
        createAtmosphere.js
    data/
      windSynthetic.js
      satellitesSynthetic.js
  tests/
    visual.spec.js
```

## 5. 数据流

```
main.js
  → EarthScene
    → createEarth        (表面 + bump/海岸)
    → createAtmosphere   (玻璃壳 + rim glow)
    → createWindLayer    (windSynthetic → 动画短流线)
    → createSatelliteLayer (satellitesSynthetic → InstancedMesh/Points)
    → RoomEnvironment + bloom + ACESFilmic tone mapping
  → OrbitControls + 缓慢自转 + 相机 preset
  → Playwright visual checks
```

**V1→V2 数据契约**（换数据不动 scene 层）：
- 风场：`{ segments: Array<{ points: Vec3[], speed: number }> }`
- 卫星：`{ positions: Float32Array, sizes: Float32Array }`

## 6. 视觉需求

- Canvas 全 viewport，方屏友好；**首屏直接地球，无 landing 页**
- 地球半径固定在 `config.js`；相机初始美洲/非洲角度，缓慢自转
- 地球表面：程序化 equirect canvas 纹理（陆地/海洋/地形）+ bump 层；不满意按 H2 升级
- 风场：700-1200 条动画短流线，颜色 cyan→pale yellow→red 按合成风速
- 卫星：1000-2000 白点/方块，高度散布 + 缓慢轨道相位
- 玻璃壳：透明 MeshPhysicalMaterial 风格 + rim glow + 加色 bloom
- 控件：拖拽旋转、滚轮缩放、暂停/播放、重置相机、质量切换 High/Low（Low 降粒子数 + pixel ratio 上限）

## 7. 依赖

- 运行：`three@0.184.0`
- 开发：`vite@8.1.0`、`@playwright/test@1.61.1`
- scripts：`dev` / `build` / `preview` / `test:visual`
- vite.config：host/preview `127.0.0.1`，`build.chunkSizeWarningLimit: 900`

## 8. 验收

**自动化（硬阈值）**：
```bash
cd "/Volumes/vol1/3D 风场地球可视化" && npm install
npm run build
npm run test:visual
```
- Playwright preview @ `1280x1280` + `390x844`
- canvas 非空；非透明像素 > 60%；直方图 ≥3 峰（蓝海/棕陆/白 bloom）；连续两帧差异 > 阈值（证明动画）

**人工**：
- 首屏即地球；大陆/海洋可读、半透明 rim、强室内反射、动画风场、密集卫星
- 本地可流畅录屏；`1280x1280` 视觉稳定
- UI 不遮挡 canvas

## 9. 风险与兜底

- 合成风场显假 → 增流线曲率 + 2-3 涡旋中心，再考虑 ERA5
- 掉帧 → pixel ratio 上限 1.5、卫星数减半、风场 Line 合并为 BufferGeometry
- 反射弱 → 先 RoomEnvironment，再加程序化室内 equirect
- **回滚**：删整个文件夹即可，不影响任何现有项目

---

## 10. 实施入口（接手者从这里开始，按序）

1. **验证 H1**：`ls /Volumes/vol1/codex/container-3d-tutor && cd $_ && npm run build` → 通过则借鉴其 vite.config/package.json；否则全新脚手架
2. 在 `/Volumes/vol1/3D 风场地球可视化/` 建第 4 节文件结构
3. 按 layers 顺序实现：`createEarth → createAtmosphere → createWindLayer → createSatelliteLayer → EarthScene 串联 → main.js 启动`
4. 加 RoomEnvironment + bloom + tone mapping
5. 加 OrbitControls + 自转 + 控件 UI
6. 写 `tests/visual.spec.js`，跑通 build + test:visual
7. 人工验收 + 录屏，归档到 `Deck / Visual Artifacts`

## 11. 来源

- [原帖 @codetaur](https://x.com/codetaur/status/2070734494915797392)
- [Three.js 文档](https://threejs.org/docs/)
- [Copernicus ERA5](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels)
- [satellite.js](https://github.com/shashwatak/satellite-js)
- [three-globe](https://github.com/vasturiano/three-globe)
