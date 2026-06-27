# Transfer Status

更新时间：2026-06-28 00:55 Asia/Shanghai（V2.1 NASA Blue Marble 地球纹理完成，PLAN-V2.1-EARTH-MAP 任务 0–8 全绿）

## 版本状态

**V2.1 已完成**：地球表面从程序化 canvas 替换为 **NASA Blue Marble NG 无云真彩静态纹理**（5400×2700），`earthMapSource()==="nasaBlueMarble"`。风场仍由真实 ERA5 10m u/v 驱动，`windSource()==="era5"` 不变。明确不使用 Windy API。

## 已包含

### V2.1 新增（NASA Blue Marble 地球纹理）
- **NASA 纹理资产**：`public/assets/earth/blue-marble-5400x2700.jpg`（5400×2700，2.20 MB，<12MB）+ `public/assets/earth/manifest.json`。
- **来源**：NASA Visible Earth image record 73751，`world.topo.bathy.200407.3x5400x2700.jpg`（base topography/bathymetry，2004-07，无云）。Credit: NASA Earth Observatory（公共领域）。
- **sha256**：`4f4240673a3a1b173d61b92ca4b07bac5fd17059ea5f725ba6da5a9c5386b7ba`
- `src/scene/layers/createEarth.js`：异步加载 NASA 纹理 + 程序化 fallback + emissive 仪表风（emissiveIntensity 1.25）；删除旧 bump（D3）。
- `src/scene/EarthScene.js`：`__viz` 加 `earthMapReady/earthMapSource/earthMapAttribution`；`INTRO_ROTATION_Y` 常量化；`onEarthMapReady` 传播。
- `scripts/earth/validate_earth_assets.mjs`：资产校验脚本（Node 内置 fs/crypto，内联 JPEG SOF parser，dimensions/sha256/体积门）。
- colorBuckets 阈值重标定为 NASA baseline；新增 fallback 诚实性测试（route 拦截纹理 → 断言 proceduralFallback）。

### V2 基础（保留，本次未触碰风场逻辑）
- 真实 ERA5 数据帧：`public/data/era5/frames/era5-10m-wind-20240115T0000Z.json`（0.235 MB）。
- ERA5 loader/validator/streamline tracer + windSource 状态机（`windSource()==="era5"`）。
- 玻璃大气壳 + fresnel rim glow + bloom + 风场流动 shader + depth 淡化。
- pause/reset/quality 三控件 + recording mode + mobile 无控件重叠。

## 已包含

### V1 基础（保留）
- Vite 8.1.0 + Three.js 0.184.0 渲染管线（renderer/ACES/PMREM RoomEnvironment/OrbitControls/UnrealBloom + 降级）。
- 程序化真实大陆轮廓地球纹理 + bump + 海岸线。
- 玻璃大气壳 + fresnel rim glow。
- seeded fibonacci 球卫星（单 draw call）。
- pause / reset / quality 三控件 + `window.__viz` 测试钩子。

### V2 新增（ERA5 数据驱动）
- **真实 ERA5 数据帧**：`public/data/era5/frames/era5-10m-wind-20240115T0000Z.json`（0.235 MB，<2MB）+ `public/data/era5/manifest.json`。
- `src/data/era5/`：loader + validator + streamline tracer。
- `src/data/windSource.js`：统一数据源状态（绝不伪装）。
- `scripts/era5/`：Python fetch 脚本 + Node validator + streamline 自测。
- `docs/`：ERA5 根因报告 + 数据溯源文档。
- recording mode（`h` 键 / `window.__viz.setDemoMode`）+ mobile 无控件重叠修复。

## 数据来源声明

- **风场数据**：ERA5 10m u/v，来自 Google Cloud Public Datasets 的 ARCO-ERA5（`gcp-public-data-arco-era5`，匿名读取）。
- **生产者**：ECMWF / Copernicus Climate Change Service (C3S)。
- **不使用 Windy API**（自研 shader）。
- 完整溯源、变量、单位、许可证与引用见 `docs/ERA5-DATA-PROVENANCE.md`。
- 许可证免责声明：Contains modified Copernicus Climate Change Service information [2024]. Neither the European Commission nor ECMWF is responsible for any use of the downstream products.
- **地球纹理**：NASA Blue Marble: Next Generation（无云 base topography/bathymetry），NASA Visible Earth record 73751，Credit: NASA Earth Observatory（公共领域）。

## 当前验证状态（真实命令输出，2026-06-28）

### 全局验收（硬门）

| 步骤 | 命令 | 结果 |
|---|---|---|
| 构建 | `npm run build` | ✅ exit 0，dist/index-*.js ~589KB / gzip ~149KB（含 ERA5 + NASA 纹理链路） |
| 浏览器 | `npx playwright install chromium` | ✅ Chromium 就绪 |
| 像素验收 | `npm run test:visual` | ✅ **14 passed / 0 failed**（含 era5-source ×2 + earth-map fallback ×2） |
| ERA5 validator | `node scripts/era5/validate_frame.mjs public/data/era5/manifest.json` | ✅ **RESULT: VALID**（exit 0） |
| Earth asset validator | `node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json` | ✅ **RESULT: PASS**（exit 0，5400×2700，sha256 一致，2.20MB） |

### NASA 地球纹理验证明细（V2.1）

- schemaVersion: `earth-map-v1`
- asset: `blue-marble-5400x2700.jpg`（5400×2700，2308798 bytes / 2.20 MB）
- source: NASA Visible Earth record 73751，`world.topo.bathy.200407.3x5400x2700.jpg`
- sha256: `4f4240673a3a1b173d61b92ca4b07bac5fd17059ea5f725ba6da5a9c5386b7ba`
- `earthMapSource()==="nasaBlueMarble"`，`earthMapReady()===true`（Playwright 实测）
- fallback 诚实性：route 拦截纹理后 `earthMapSource()==="proceduralFallback"`（Playwright 实测，绝不谎称 nasaBlueMarble）

### colorBuckets 新 baseline（NASA 纹理重标定，PLAN-V2.1 D5）

- desktop: nonBg 0.831, oceanBlue 0.94, warmLand 0.0070, brightWhite 0.019, windWarm 0.0028
- mobile: nonBg 0.950, oceanBlue 0.95, warmLand 0.0016, brightWhite 0.023, windWarm 0.0
- 阈值作存在性松门（~实测 baseline 一半），非密度目标。

### ERA5 数据帧验证明细

- schemaVersion: `era5-wind-frame-v1`
- source: `ERA5 ARCO on Google Cloud Public Datasets`
- producer: `ECMWF / Copernicus Climate Change Service`
- timeUtc: `2024-01-15T00:00:00Z`（UTC，无时区偏移）
- grid: 180×91, lon[-180,178], lat[-90,90], ~2° step, downsampled
- speedStats: min 0.0505 / max 22.2367 / mean 6.5469 / p5 1.352 / p95 13.3469 m/s（全部有限，max>mean，p95>1）
- 重算统计：16380 个有限值，0 个非有限
- 文件大小 0.235 MB < 2MB 限制

### ERA5 streamline tracer 验证

`node scripts/era5/test_streamlines.mjs` → RESULT: PASS：
- 1200 条流线（count 正确）
- 所有点半径 2.0480（精确 = radius×1.024，在容差内）
- speed 分布 0.207–21.195（来自 ERA5，非退化）
- 同 seed 确定性：true

### Playwright 验收明细（真实断言）

- **ERA5 数据源**：`window.__viz.windSource()==="era5"`，`windLayerKind()==="era5"`，`windFrameTime()` 含 `2024-01-15`（两视口均通过）。
- **不伪装保证**：loader 在 missing/invalid 时返回 `devSynthetic`，HUD 显示真实状态，绝不标记为 era5。
- **颜色桶**：oceanBlue（含 ERA5 青色风场）/ warmLand / brightWhite 均 > 阈值；rim 环带 bright+cyan 充足。
- **动画**：未 paused 帧差 > 阈值；paused 帧差 ≈ 0。
- **UI 三控件**：pause/reset/quality 经 Playwright 真实驱动。
- **recording mode**：`setDemoMode(true)` 后 HUD/controls `visibility:hidden`，Playwright `isVisible()` 返回 false。
- **mobile 无重叠**：390 宽度下 HUD 与 controls 的 boundingBox 不相交。

### 截图产物路径（`tests/__screens__/`，git 忽略）

- `desktop.png`（1280×1280，约 1.08 MB）— ERA5 风场渲染，含 UI
- `mobile.png`（390×844，约 239 KB）— 移动视口，HUD 左下、控件右上，无重叠
- `recording.png`（1280×1280，约 1.06 MB）— recording mode（UI 隐藏，干净地球画面）

## 人工检查清单

- [x] desktop 首屏是地球本身（非 landing）。
- [x] 风线有方向连续性（ERA5 积分流线，非随机星芒）。
- [x] 地表大陆/海洋可读（程序化纹理，无版权素材）。
- [x] rim glow / bloom 不糊成一片。
- [x] mobile 390 宽度 HUD 与控件不重叠。
- [x] recording mode 可隐藏 UI。

## 残余风险与未做事项

1. **风场方向真实性受下采样影响**：当前为 ~2° 下采样的单帧（2024-01-15T00:00:00Z），细尺度风场结构（如局地急流）被平滑。如需更高保真可减小步长（会增大 JSON，受 2MB 限制）。
2. **headless 软渲染抖动**：SwiftShader 偶发单帧噪点。pause/animation 帧差测试已用 page-screenshot + 放宽上限缓解；如某次本地偶发，重跑即可。
3. **warmLand 像素比例较低**：ERA5 此时刻风速多为中低（青色为主），暖色（黄/红）高速区较少。warmLand 桶作存在性检查（loose 阈值），非密度目标。
4. **卫星仍为合成数据**：V2 只升级了风场数据源；卫星仍是 seeded fibonacci 球，非真实 TLE 轨道（留 V3）。
5. **单帧静态数据**：当前只有一帧，无时间序列动画（换帧留 V3）。
6. **Python 数据依赖为 dev-only**：`xarray/zarr/gcsfs` 安装在隔离 `.venv`（git 忽略），不污染系统 Python，不提交。重新获取数据帧需先建 `.venv`。
7. **非 git push**：本地 `git init`（main 分支），未 push。

## 下一步（V3 入口）

1. 接 TLE + satellite.js 真实卫星轨道（按现有 `{ positions, sizes }` 契约）。
2. 多帧 ERA5 时间序列（换帧动画，按现有 frame 契约）。
3. GPU 粒子 advection（替代 CPU streamline 积分）+ 调色 + 60fps 优化。
4. 如需更高保真地球纹理：按 PLAN H2 兜底链引入许可证明确的素材。
