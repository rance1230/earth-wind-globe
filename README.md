# 3D 风场地球可视化

复现 X 视频 [@codetaur, 2026-06-27](https://x.com/codetaur/status/2070734494915797392) 的核心观感：**玻璃质感地球 + 动态风场流线 + 卫星点群 + 室内 HDRI 反射 + bloom 后期**。

> 完整设计与决策记录见 **[PLAN.md](./PLAN.md)**。接手实施请先读 **[NEXT_AGENT_PROMPT.md](./NEXT_AGENT_PROMPT.md)** 与 **[TRANSFER_STATUS.md](./TRANSFER_STATUS.md)**。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 构建 | Vite |
| 渲染 | 原生 Three.js（WebGL2，非 R3F） |
| 光照 | RoomEnvironment（内置，无外部 HDRI） |
| 后期 | EffectComposer + Bloom + ACESFilmic |
| 数据（V1） | 程序化合成风场 + 合成卫星 |
| 数据（V2） | ERA5 真实风场 + TLE 卫星 |

## 路线图

- **V1 — 视觉近似版**（当前）
  - 程序化 canvas 地球纹理 + bump
  - 合成风场短流线（cyan→yellow→red）
  - 合成卫星点群
  - 玻璃大气壳 + rim glow + bloom + 室内反射
  - OrbitControls + 缓慢自转 + 质量切换
- **V2 — 真实数据版**
  - 接 Copernicus ERA5（需 CDS 账号），Python 管线转 Float32Array
  - 接 TLE + satellite.js 真实轨道
- **V3 — 高保真打磨**
  - GPU 粒子 advection、调色、60fps 优化、镜头脚本

## 快速启动（实施完成后）

```bash
cd "/Volumes/vol1/3D 风场地球可视化"
npm install
npm run dev          # 本地开发
npm run build        # 生产构建
npm run preview      # 预览构建产物
npm run test:visual  # Playwright 视觉验收
```

## 目录结构

```
3D 风场地球可视化/
  PLAN.md                    ← 完整设计与决策
  README.md                  ← 本文件
  NEXT_AGENT_PROMPT.md       ← 接手 agent 执行提示
  TRANSFER_STATUS.md         ← 移交状态、排除项和验证记录
  MANIFEST.sha256            ← 文件校验清单
  package.json               ← Vite/Three.js 项目外壳
  vite.config.js             ← 本地 dev/preview 配置
  index.html                 ← Web 入口
  src/
    main.js                  ← 入口
    config.js                ← 半径/粒子数等常量
    scene/
      EarthScene.js          ← 场景编排
      layers/
        createEarth.js       ← 地球表面
        createAtmosphere.js  ← 玻璃大气壳
        createWindLayer.js   ← 风场流线
        createSatelliteLayer.js ← 卫星点群
    data/
      windSynthetic.js       ← 合成风场（V2 替换为 ERA5）
      satellitesSynthetic.js ← 合成卫星（V2 替换为 TLE）
  tests/
    visual.spec.js           ← Playwright 视觉验收
```

## 数据接口契约（V1→V2 可替换）

- **风场**：`{ segments: Array<{ points: Vec3[], speed: number }> }`
- **卫星**：`{ positions: Float32Array, sizes: Float32Array }`

V2 接真实数据时，**只动 `src/data/`，不改 `src/scene/`**。

## 验收标准

- 首屏直接看到地球（无 landing 页）
- 大陆/海洋可读、半透明 rim、强室内反射、动画风场、密集卫星
- `1280x1280` 视觉稳定，可流畅录屏
- `npm run build` + `npm run test:visual` 通过（像素硬阈值见 PLAN.md §8）

## 状态

- [x] 计划打包与交接
- [x] Vite / Three.js 占位外壳
- [x] 本地移交文件与 manifest
- [ ] V1 实施
- [ ] V1 验收与录屏
- [ ] V2 真实数据
