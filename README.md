# 3D 风场地球可视化

复现 X 视频 [@codetaur, 2026-06-27](https://x.com/codetaur/status/2070734494915797392) 的核心观感：**玻璃质感地球 + 动态风场流线 + 卫星点群 + 室内反射 + bloom 后期 + 可录屏镜头 + 真实像素验收**。

> 设计与决策记录见 **[PLAN.md](./PLAN.md)**；V1 逐任务执行计划见 **[PLAN-GLM5.2.md](./PLAN-GLM5.2.md)**；V2 ERA5 升级计划见 **[PLAN-ERA5-WAZA-GLM5.2.md](./PLAN-ERA5-WAZA-GLM5.2.md)**；当前验证状态与残余风险见 **[TRANSFER_STATUS.md](./TRANSFER_STATUS.md)**。

**当前状态：V2 第一版已完成并验收通过 —— 风场由真实 ERA5 10m u/v 数据驱动。**

## 风场数据来源（重要）

- **风场数据**：真实 ERA5 10m u/v 分量，来自 **Google Cloud Public Datasets 的 ARCO-ERA5**（`gcp-public-data-arco-era5`，匿名可读）。
- **数据生产者**：ECMWF / Copernicus Climate Change Service (C3S)。
- **当前样例帧**：`2024-01-15T00:00:00Z`，全球 ~2° 下采样，0.235 MB（<2MB 限制），speedStats min/max/mean/p95 = 0.05/22.24/6.55/13.35 m/s。
- **不使用 Windy API**（原作者明确不用；本项目自研 wind visualization shader）。
- 完整数据溯源、变量、单位、许可证与引用格式见 **[docs/ERA5-DATA-PROVENANCE.md](./docs/ERA5-DATA-PROVENANCE.md)**。

> Contains modified Copernicus Climate Change Service information [2024]. Neither the European Commission nor ECMWF is responsible for any use of the downstream products.

---

## 快速开始

```bash
cd "/Volumes/vol1/3D 风场地球可视化"

npm install                 # 安装依赖（three + vite + playwright + pngjs）
npm run dev                 # 启动开发服务器 → http://127.0.0.1:5173/
```

浏览器打开 `http://127.0.0.1:5173/` 即可看到 3D 风场地球（首屏直达，无 landing 页）。

### 全部命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器（`127.0.0.1:5173`，热更新） |
| `npm run build` | 生产构建到 `dist/` |
| `npm run preview` | 预览构建产物（`127.0.0.1:4173`，验收用） |
| `npm run test:visual` | 运行 Playwright 像素验收（需先装 Chromium，见下） |

### 首次运行像素验收

```bash
npx playwright install chromium   # 首次需下载 Chromium（约 90MB）
npm run build && npm run test:visual
```

验收会启动 Chromium 真实渲染两个视口（desktop `1280×1280`、mobile `390×844`），截图存到 `tests/__screens__/desktop.png` 与 `mobile.png`，并对颜色桶、动画、UI 控件、**ERA5 数据源**（`window.__viz.windSource()==="era5"`）做断言。

## ERA5 风场数据

当前已内置一帧真实 ERA5 数据，风场方向由 ERA5 10m u/v 决定：

- **数据文件**：`public/data/era5/frames/era5-10m-wind-20240115T0000Z.json`（0.235 MB）+ `public/data/era5/manifest.json`
- **来源**：ARCO-ERA5 on Google Cloud Public Datasets（`gs://gcp-public-data-arco-era5`，匿名读取，无需账号）
- **变量**：`10m_u_component_of_wind`、`10m_v_component_of_wind`，单位 `m s**-1`
- **数据源状态**：前端启动时异步加载，`window.__viz.windSource()` 返回 `era5`（成功）/ `devSynthetic`（fallback）/ `missing`。HUD 右下角显示真实状态。

### 重新获取 ERA5 数据帧（可选）

需要 Python 数据依赖（dev-only，安装到隔离 `.venv`，不污染系统 Python，不提交）：

```bash
uv venv .venv                                  # 创建隔离环境
uv pip install --python .venv xarray zarr gcsfs
.venv/bin/python scripts/era5/fetch_arco_era5_sample.py \
    --time 2024-01-15T00:00:00Z --out public/data/era5 --max-json-mb 2
node scripts/era5/validate_frame.mjs public/data/era5/manifest.json   # 验证
```

- 匿名读取 GCS public bucket，无需 Google/Copernicus 账号或认证材料。
- 备选：Google Earth Engine `ECMWF/ERA5/HOURLY`（需账号，本项目未用）。
- 权威源：Copernicus CDS ERA5 single levels。
- 完整溯源与引用见 **[docs/ERA5-DATA-PROVENANCE.md](./docs/ERA5-DATA-PROVENANCE.md)**。

## 地球纹理

地球表面使用 **NASA Blue Marble: Next Generation** 无云真彩 equirectangular 静态纹理：

- **资产**：`public/assets/earth/blue-marble-5400x2700.jpg`（5400×2700，2.20 MB，<12MB）
- **来源**：NASA Visible Earth image record 73751 — `world.topo.bathy.200407.3x5400x2700.jpg`（base topography/bathymetry，2004 年 7 月合成，无云）
- **Credit / License**：NASA Earth Observatory；NASA 影像，属公共领域。
- **校验**：`node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json`（内联 JPEG SOF parser 读尺寸 + sha256 + 体积门，只用 Node 内置 fs/crypto）。
- **运行时无网络请求**：纹理为本地静态资产，由 Vite 从 `public/` 提供。
- **诚实降级**：加载失败时降级为程序化 fallback，`window.__viz.earthMapSource()` 返回 `proceduralFallback`（**绝不**谎称高精度图）；HUD 显示真实状态。
- 数据来源、sha256、尺寸见 `public/assets/earth/manifest.json` 与 `TRANSFER_STATUS.md`。

---

## 界面与交互

页面右上角有三个控件（移动端自动移到右下角，不遮挡地球）：

| 控件 | 行为 |
|---|---|
| **暂停 / 播放**（`#btn-pause`） | 暂停时冻结自转、风场流动、卫星轨道（帧差 ≈ 0）；相机阻尼仍可手动拖动 |
| **重置视角**（`#btn-reset`） | 相机回到初始位姿、地球转回开场角度（美洲/非洲入镜） |
| **质量 High/Low**（`#select-quality`） | High：1000 风线 + 1600 卫星 + 像素比上限 2；Low：500 风线 + 800 卫星 + 像素比上限 1.5。切换走 dispose + rebuild（无叠加泄漏） |

**鼠标/触摸交互**：拖拽旋转地球、滚轮缩放（OrbitControls，距离 3.2–9）。地球同时缓慢自转。

**录制模式**：按 `h` 键隐藏 HUD 和控件（用于干净录屏/截图），再按一次恢复。也可调用 `window.__viz.setDemoMode(true)`。

> 这些控件都被 Playwright 真实驱动验证过（见 `tests/visual.spec.js`）。

---

## 截图产物

运行 `npm run test:visual` 后，`tests/__screens__/` 下会生成（该目录已在 `.gitignore` 中，仅作本地产物）：

- `desktop.png` — 1280×1280 桌面视口截图
- `mobile.png` — 390×844 移动视口截图

> 注：`tests/__screens__/` 被 git 忽略，不会提交。验收截图是真实浏览器渲染的 `#globe-canvas`，每次运行会刷新。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 构建 | Vite 8.1.0 |
| 渲染 | 原生 Three.js 0.184.0（WebGL2，非 R3F） |
| 光照 | RoomEnvironment（PMREM，内置，无外部 HDRI） |
| 后期 | EffectComposer + UnrealBloom + ACESFilmic（含 try/catch 降级） |
| 验收 | @playwright/test 1.61.1 + pngjs（HSV 颜色桶分析） |
| 数据（V1） | 程序化合成风场（mulberry32 seeded）+ 合成卫星（fibonacci 球） |
| 数据（V2，**当前**） | **真实 ERA5 10m u/v**（ARCO-ERA5 on Google Cloud，匿名读取）+ 合成卫星 |
| 数据预处理 | Python（xarray/zarr/gcsfs，dev-only 隔离 `.venv`，未提交） |

---

## 渲染层架构

每个层都是 `createXxxLayer(radius, opts) → { group, count?, update(elapsed, delta), dispose() }` 工厂（统一契约，PLAN §4.1）：

| 文件 | 内容 |
|---|---|
| `src/scene/EarthScene.js` | 场景编排：renderer/ACES/PMREM/OrbitControls/UnrealBloom 管线 + 状态机（paused/quality）+ `window.__viz` 测试钩子 + setQuality 的 dispose/rebuild + postprocessing 降级 |
| `src/scene/layers/createEarth.js` | **NASA Blue Marble NG 真彩纹理**（5400×2700 无云，NASA Earth Observatory）+ 程序化 fallback + emissive 仪表风；异步加载，`earthMapSource()` 诚实标识来源 |
| `src/scene/layers/createAtmosphere.js` | 玻璃质感壳（MeshPhysicalMaterial）+ fresnel rim glow（BackSide ShaderMaterial） |
| `src/scene/layers/createWindLayer.js` | 单 draw call `LineSegments`（合并几何）+ per-vertex color（ERA5 speed→cyan/white/amber/red）+ 流动 shader（uTime 推动 bright band，depth 近亮远淡） |
| `src/scene/layers/createSatelliteLayer.js` | 单 draw call `THREE.Points`（fibonacci 球）+ 加色 + depthWrite:false |
| `src/data/era5/loadEra5WindFrame.js` | 异步加载 manifest + ERA5 frame，验证后返回；missing 时不伪装成 ERA5 |
| `src/data/era5/validateEra5WindFrame.js` | era5-wind-frame-v1 schema 验证器（含 speedStats 重算） |
| `src/data/era5/traceWindStreamlines.js` | 在 ERA5 u/v 网格上 bilinear 采样 + 积分流线；方向来自 ERA5，seeded 只控制种子点 |
| `src/data/windSource.js` | 统一 wind source 状态出口（era5/devSynthetic/missing/loading，绝不伪装） |
| `src/data/windSynthetic.js` | 合成风场 fallback（devSynthetic），返回 `{ segments:[{ points, speed, color }] }` |
| `src/data/satellitesSynthetic.js` | seeded fibonacci 球 + 高度散布，返回 `{ positions, sizes }` |
| `src/util/seededRandom.js` | mulberry32 确定性随机（保证截图/测试稳定） |
| `src/config.js` | `QUALITY` 预设 + `CONFIG`（半径/相机/seed/默认质量） |

### 数据接口契约（V1→V2 可替换）

- **风场**：`{ segments: Array<{ points: Vec3[], speed: number, color: [r,g,b] }> }`
- **卫星**：`{ positions: Float32Array, sizes: Float32Array }`

V2 接真实数据时，**只动 `src/data/`，不改 `src/scene/`**。

### 质量预设（`src/config.js`）

```js
QUALITY = {
  high: { windSegments: 1000, windPoints: 14, satelliteCount: 1600, pixelRatioCap: 2 },
  low:  { windSegments: 500,  windPoints: 10, satelliteCount: 800,  pixelRatioCap: 1.5 }
};
```

---

## 验收说明

`npm run test:visual` 是**真实的 Playwright 像素验收**（不是文件存在检查），覆盖：

- **截图**：两视口真实 Chromium 渲染 `#globe-canvas`，产物存 `tests/__screens__/`。
- **颜色桶**（HSV，忽略背景/低值像素，阈值放宽）：`oceanBlue`、`warmLand`、`brightWhite`，外加 rim 环带采样。
- **动画**：未暂停帧差 > 阈值；暂停后帧差 ≈ 0。
- **UI 三控件真实驱动**：pause 冻结、reset 复位相机距离、quality 改变 satelliteCount 且 drawCalls=1。
- **headless WebGL**：用 `--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --enable-unsafe-swiftshader`，postprocessing 可降级，验收不依赖 bloom 精确亮度。

`tests/helpers/colorBuckets.js` 提供 PNG→HSV 颜色桶分析与 rim 环带采样。

---

## 路线图

- **V1 — 视觉近似版**（✅ 已完成）
  - 程序化真实大陆轮廓地球纹理 + bump + 海岸线
  - seeded 合成风场（合并几何单 draw call + 3 色 + 流动 shader + 3 涡旋中心）
  - seeded fibonacci 球卫星（单 draw call）
  - 玻璃大气壳 + fresnel rim glow + bloom + 室内反射
  - OrbitControls + 缓慢自转 + pause/reset/quality 三控件 + 像素验收
- **V2 — ERA5 数据驱动第一版**（✅ 已完成）
  - **真实 ERA5 10m u/v 风场**（ARCO-ERA5 on Google Cloud，匿名读取）
  - `era5-wind-frame-v1` schema + loader + validator + streamline tracer
  - `windSource()` 真实数据源标识（绝不伪装）
  - recording mode + mobile 无控件重叠
- **V2.1 — 高精度地球地图**（✅ **当前已完成**）
  - **NASA Blue Marble NG 无云真彩纹理**（5400×2700，NASA Earth Observatory）
  - 异步加载 + 程序化 fallback + emissive 仪表风
  - `earthMapSource()` 诚实标识（nasaBlueMarble / proceduralFallback）
  - colorBuckets 阈值重标定 + fallback 诚实性测试
  - 卫星仍为合成 fibonacci 球（V3 接 TLE）
- **V3 — 高保真打磨**
  - 接 TLE + satellite.js 真实轨道
  - GPU 粒子 advection、调色、60fps 优化、镜头脚本

---

## 目录结构

```
3D 风场地球可视化/
  README.md                      ← 本文件（使用说明）
  PLAN.md                        ← 原设计与决策记录
  PLAN-GLM5.2.md                 ← V1 逐任务可验证执行计划
  PLAN-ERA5-WAZA-GLM5.2.md       ← V2 ERA5 升级执行计划
  TRANSFER_STATUS.md             ← 验证状态、截图路径、残余风险
  package.json / vite.config.js  ← Vite + Three.js 项目
  playwright.config.js           ← Playwright 验收配置（两视口 + SwiftShader flag）
  index.html                     ← Web 入口（canvas + HUD + 控件 + 风源标识）
  src/
    main.js                      ← 入口 + UI 事件绑定 + 录制模式
    styles.css                   ← 样式（控件/HUD + 风源徽标 + demo mode + mobile 无重叠）
    config.js                    ← QUALITY 预设 + CONFIG
    util/seededRandom.js         ← mulberry32 确定性随机
    scene/
      EarthScene.js              ← 场景编排 + 状态机 + window.__viz + ERA5 加载
      layers/
        createEarth.js           ← 地球（程序化纹理 + bump）
        createAtmosphere.js      ← 玻璃壳 + fresnel rim
        createWindLayer.js       ← 风场（合并几何 + 流动 shader + depth 淡化）
        createSatelliteLayer.js  ← 卫星（fibonacci 球单 Points）
    data/
      windSource.js              ← 统一 wind source 状态（绝不伪装）
      windSynthetic.js           ← 合成风场 fallback（devSynthetic）
      satellitesSynthetic.js     ← 合成卫星
      era5/
        loadEra5WindFrame.js     ← ERA5 frame 异步加载（manifest + 验证）
        validateEra5WindFrame.js ← era5-wind-frame-v1 schema 验证器
        traceWindStreamlines.js  ← ERA5 u/v 积分流线（方向来自真实数据）
  public/data/era5/              ← ERA5 数据产物（manifest + frame，<2MB）
  scripts/era5/                  ← ERA5 数据获取/验证脚本（Python + Node）
  docs/                          ← ERA5 根因报告 + 数据溯源文档
  tests/
    visual.spec.js               ← Playwright 像素 + 动画 + UI 验收
    era5-source.spec.js          ← ERA5 数据源真实性验收
    helpers/colorBuckets.js      ← PNG→HSV 颜色桶 + rim 环带分析
    __screens__/                 ← 截图产物（git 忽略）
```

---

## 状态

- [x] 计划打包与交接
- [x] Vite / Three.js 外壳
- [x] **V1 实施（synthetic prototype，任务 0–7 全绿）**
- [x] **V2 ERA5 数据驱动第一版（真实 ERA5 10m u/v，windSource()==="era5"）**
- [x] **V2.1 高精度地球地图（NASA Blue Marble NG，earthMapSource()==="nasaBlueMarble"）**
- [x] 验收（Playwright 14/14 + ERA5 frame validator + earth asset validator 通过）
- [ ] V3 真实卫星（TLE）+ 高保真打磨
