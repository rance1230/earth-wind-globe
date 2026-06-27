# 实施计划 V3 (GLM 5.2 可执行版)：真实材质 + 实时演变风场 + 清晰带标签地图

> **给执行 agent：** 自包含、按序、逐任务可验证。从「任务 A1」开始，按顺序做；每个任务做完**必须运行该任务 Verify 并贴出真实输出**才能进入下一个。**没有 fresh 验证证据不得声称完成。** 沿用本项目既有纪律：单 draw call、dispose/rebuild、诚实 provenance（manifest 带 source/licenseNote/sha256，绝不把 fallback 标成真数据）、`window.__viz` 测试钩子。
>
> 目标目录：`/Volumes/vol1/3D 风场地球可视化/`（所有路径相对于此）。
> 上游：`PLAN-GLM5.2.md`、`PLAN-ERA5-WAZA-GLM5.2.md`（已执行）。本文件是第三轮改进执行版。
> 验收命令统一：`npm run build && npm run test:visual`（Playwright，desktop 1280x1280 + mobile 390x844，已配 swiftshader flag）。首次需 `npx playwright install chromium`。

---

## 0. 当前状态（已用证据核实，2026-06-28）

| 事实 | 证据 | 影响 |
|---|---|---|
| 地球用 NASA Blue Marble | `public/assets/earth/blue-marble-5400x2700.jpg` + manifest（public domain） | 真实纹理已就位，缺真实光照与地形起伏 |
| **地球自发光造成"高亮"** | `createEarth.js`：`emissive:0xffffff` + `emissiveMap` + `emissiveIntensity:1.25`（D1 仪表盘观感） | **请求 1 的根因**：整面自发光让亮区(沙漠/冰盖)发光显假 |
| 环境反射已压低 | `EarthScene.js`：`environmentIntensity:0.22`，`DirectionalLight 1.6`，`HemisphereLight 0.9` | 改真实日照时一并重调 |
| 风场是**单个静态 ERA5 帧** | `public/data/era5/frames/era5-10m-wind-20240115T0000Z.json`（2024-01-15T00Z），traced 一次后只做相位流动 | **请求 2 的根因**：不随时间更新 |
| ERA5 取数是 **keyless** | manifest `source: ERA5 ARCO on Google Cloud Public Datasets`，匿名访问 | 多帧时间序列**无需账号/key** |
| 无国界/标签/地形起伏 | `src/` 无 geo/label/displacement 相关文件 | **请求 3 全是新建** |
| zoom 受限 | `controls.minDistance:3.2`（radius=2，最近≈距面1.2），无高分辨细节 | 需放开近距 + 提清晰度 |
| 验收/钩子齐备 | `playwright.config.js`、`tests/visual.spec.js`、`tests/era5-source.spec.js`、`tests/helpers/colorBuckets.js`、`window.__viz` | 在此之上扩断言与钩子，不重建 |

## 1. 本轮三项需求 → 已确认决策（不再讨论）

| 需求 | 决策 |
|---|---|
| **1. 去地形高亮、材质更真实** | 移除 emissive 自发光；改**真实太阳平行光 + 昼夜终止线**；**暗面用环境/半球光柔光提亮（不全黑）**，保证地形与标签全球可读 |
| **2. 风场实时更新** | **多帧 ERA5 时间序列**（keyless ARCO 取多个时刻，本地预烘焙）+ 时间轴推进 + 帧间插值，风场随时间演变；**无运行时网络依赖**、确定性、验收稳定 |
| **3. 更清晰 + 更深 zoom + 3D 地形 + 国界/省界 + 国家/城市/省名标签** | 放开近距 zoom + 提清晰度；public-domain 高程做 **displacement 3D 地形**；**Natural Earth**（public domain）国界+省界+居民点；**CSS2DRenderer** 标签：**中国中英文、其他英文**，LOD + 优先级 + 屏幕空间去重 + 背面剔除**防拥挤** |

## 2. 共享契约（所有任务遵守）

**2.1 诚实 provenance（沿用既有模式）** — 任何新外部数据（高程、Natural Earth、ERA5 多帧）都写 `manifest.json`：`source` / `sourceUrl` / `licenseNote` / `sha256` / `generatedAt`。取数失败→保留 fallback 并**如实标注**，绝不把 fallback 当真数据。所有取数脚本放 `scripts/`，是**构建期**行为，运行时不依赖网络。

**2.2 性能纪律** — 国界/省界各自合并为单 `LineSegments`（一次 draw call）；标签用 DOM(CSS2D)不进 WebGL；风场仍单 draw call；质量切换走 dispose+rebuild。

**2.3 新增 `window.__viz` 钩子**（供 Playwright 确定性断言）：
```js
// 光照
lightingMode: () => "realisticSun",
nightFillEnabled: () => this.nightFillEnabled,    // 暗面柔光开
sunDirection: () => [x,y,z],
// 风场时间序列
windFrameCount: () => this.windFrames.length,
windFrameIndex: () => this.windFrameIndex,
windFrameTime: () => this.currentFrameTimeUtc,    // 随播放变化
windPlaying: () => this.windPlaying,
// 地图/zoom/地形
minZoomDistance: () => this.controls.minDistance,
terrainRelief: () => ({ displacement: this.terrainDisplacement, scale: this.terrainScale, source: this.terrainSource }),
// 边界/标签
bordersVisible: () => this.bordersVisible,
borderFeatureCount: () => this.borderFeatureCount,
labelCount: () => document.querySelectorAll(".viz-label").length,
labelLOD: () => this.labelLOD,                     // "far" | "mid" | "near"
```

**2.4 HUD/控件新增**（`index.html` + `main.js` + `styles.css`）：时间显示（风场帧 UTC + 播放/暂停时间轴）、标签开关、边界开关。控件不遮挡 canvas；按 `h` 进 demo 录屏模式（已有）。

---

## 3. 任务序列（按序，每个含 Files / Spec / Verify / DoD）

> 顺序原则：先定**光照地基**(A1) → 再渐进搭**地图细节**(C1 清晰→C2 地形→C3 边界→C4 标签，后者依赖前者半径) → 再做**时间序列风场**(B1 数据→B2 运行时，独立) → 最后**调参收口**(D1)。

### 任务 A1：去高亮 + 真实日照 + 暗面柔光（请求 1）
- **Files**：`src/scene/layers/createEarth.js`、`src/scene/EarthScene.js`、`src/config.js`。
- **Spec**：
  1. `createEarth`：移除 `emissive`/`emissiveMap`/`emissiveIntensity`（或 intensity=0）。保留 `map`（Blue Marble），`metalness:0`，`roughness:~0.9`（陆地哑光、去镜面高亮）。
  2. `EarthScene`：把 `DirectionalLight` 作为**太阳**（强度 ~2.6），方向由**当前风场帧 UTC 推算次太阳点**（subsolar：经度 `λ=-15°×(UTC小时-12)`，纬度用当日太阳赤纬近似），并随 root 自转换算到地球本地系——这样 A1 与 B2 联动：时间推进时昼夜线移动。若暂不接时间，先用固定一个好看的终止线角度。
  3. **暗面柔光**：`HemisphereLight`/`AmbientLight` 抬到能让暗面地形与标签可读但仍明显比昼面暗（终止线可见）；`scene.environmentIntensity` 保持低（~0.15）去室内镜面感。
  4. `__viz`：`lightingMode`、`nightFillEnabled`、`sunDirection`。
- **Verify**：`npm run build && npm run test:visual`。新增/更新断言：① 无整面发光——"过曝高亮"像素占比低于阈值；② **终止线存在**——把球面按光照方向分昼/夜两区采样，昼区平均亮度 > 夜区 + 余量；③ **暗面不全黑**——夜区平均亮度 > 下限（保证标签可读）。贴输出 + 看 `tests/__screens__/desktop.png` 确认无发光高亮、有立体日照。
- **DoD**：地形无自发光高亮；有真实昼夜终止线立体感；暗面柔光可读；断言通过。

### 任务 C1：更深 zoom + 更清晰（请求 3 之一）
- **Files**：`src/scene/EarthScene.js`、`src/config.js`、`src/scene/layers/createEarth.js`。
- **Spec**：`controls.minDistance` 降到可贴近地表（如 2.35，radius=2）；`controls.maxDistance` 适当；`controls.zoomSpeed`/阻尼顺滑；纹理 `anisotropy` 提到 GPU 上限（`renderer.capabilities.getMaxAnisotropy()`）；`SphereGeometry` 细分提到 displacement 够用（如 256×192，配合 C2）；近距时确保不穿模、不裁切。可选：准备更高分辨率 Blue Marble（8192×4096，public domain，写 manifest）作为 high 质量纹理，low 仍用 5400。
- **Verify**：`npm run test:visual`；`__viz.minZoomDistance()` = 新值；脚本里 `setZoom near` 后截图 `tests/__screens__/desktop-zoom.png`，肉眼比对近距细节更清晰、无裁切/穿模。
- **DoD**：可显著拉近；近距清晰无瑕疵；`minZoomDistance` 钩子生效。

### 任务 C2：3D 地形起伏（请求 3 之一）
- **Files**：新增 `scripts/prepElevation.mjs`、`public/assets/earth/elevation-*.png` + manifest；`src/scene/layers/createEarth.js`。
- **Spec**：
  1. **数据**：用 public-domain 高程（GEBCO 2023 / NOAA ETOPO / Natural Earth raster，三选一），prep 脚本下载→降采样为等距灰度高程图（如 4096×2048 与 2048×1024 两档）→写 `public/assets/earth/` + manifest（source/licenseNote/sha256）。**fallback**：取数失败则用 Blue Marble 亮度派生 bump（明确标 `proceduralBumpFallback`，不谎称真高程）。
  2. **应用**：材质加 `displacementMap`（陆地起伏，海洋近 0）+ `displacementScale`（夸张到可见但不破形，如 radius×0.02~0.04）+ `bumpMap`/`normalMap` 增细节；提高 sphere 细分以承载 displacement。注意：边界/标签需贴在 `radius + displacement` 之上（C3/C4 用 `radius×(1+ε)` 安全偏移，ε 略大于最大 displacement 比例）。
  3. `__viz.terrainRelief()`。
- **Verify**：`npm run test:visual`；`__viz.terrainRelief().displacement===true && scale>0 && source` 真实；manifest 存在且 sha256 校验过；近距截图 `desktop-zoom.png` 见山脉/海沟起伏（人工确认）。
- **DoD**：可见 3D 地形起伏；provenance 诚实；不破坏球面与后续贴图层。

### 任务 C3：国界 + 省界（请求 3 之一）
- **Files**：新增 `scripts/prepGeoBoundaries.mjs`、`public/data/geo/`（admin0 + admin1 GeoJSON + manifest）；新增 `src/scene/layers/createBordersLayer.js`；接入 `EarthScene.js`。
- **Spec**：
  1. **数据**：Natural Earth（public domain，来源 `nvkelso/natural-earth-vector`）：国界 `ne_50m_admin_0_countries`、省界 `ne_10m_admin_1_states_provinces`。prep 脚本下载→可选精简坐标→写 `public/data/geo/` + manifest（source/licenseNote/sha256）。
  2. **渲染**：`createBordersLayer` 把每个 feature 的经纬度环转球面点(`radius×(1+ε)`)，**合并成单 `LineSegments`**（国界一组、省界一组），细线、低不透明、轻微加色。**LOD**：远距只显国界；近距(相机距 < 阈值)再显省界。提供 `dispose()`。
  3. `__viz.bordersVisible`、`borderFeatureCount`；HUD 加边界开关。
- **Verify**：`npm run test:visual`；`__viz.borderFeatureCount() > 0`；边界线色像素桶 > 阈值（在球面轮廓内采样）；近距时省界出现、远距时消失（切 zoom 断言）。
- **DoD**：国界全球可见、省界近距出现；单 draw call/组；provenance 诚实；可开关。

### 任务 C4：标签（国家/城市/省名，中国中英文、其他英文，防拥挤）（请求 3 之一）
- **Files**：新增 `scripts/prepLabels.mjs`、`public/data/geo/labels-*.json` + manifest；新增 `src/scene/layers/createLabelLayer.js`（用 `three/examples/jsm/renderers/CSS2DRenderer.js`）；`EarthScene.js`（加 CSS2DRenderer + 每帧同步 + declutter）；`index.html`/`styles.css`（`.viz-label` 样式 + 标签开关）。
- **Spec**：
  1. **数据**：Natural Earth `ne_10m_populated_places`（字段 `NAME`、`NAME_ZH`、`ADM0NAME`、`POP_MAX`、`SCALERANK`、`FEATURECLA`）→ 城市/首都；国家名取 admin0 的 `NAME`/`NAME_ZH` + 质心；省名取 admin1 `name`/`name_zh` + 质心。prep 脚本输出精简 `labels-*.json`（含 `lon,lat,en,zh,tier,priority,adm0`）+ manifest。
  2. **双语规则**：`adm0 === "China"`（或 `ADM0_A3==="CHN"`）→ 显示 `zh + 换行 + en`（中英文）；其他 → 仅 `en`（英文）。缺 `zh` 时退回 `en`。
  3. **CSS2D**：每标签一个 `CSS2DObject`，挂在 `radius×(1+ε)` 的球面点；class `viz-label`（含 tier 修饰类控制字号/颜色）。
  4. **防拥挤 declutter（每帧或节流）**：
     - **背面剔除**：标签世界位置在地球背面（相对相机）则隐藏。
     - **LOD by 相机距 d**：`far` 仅国家(top ~12 按面积/人口) + 巨型城市(~6)；`mid` 加首都 + top ~20 城市；`near` 加面向相机国家的省名 + 更多城市（中国省名中英文）。
     - **优先级 + 屏幕空间去重**：按 优先级(首都>大城市>小城市；大国家优先) 排序，贪心放置，与已放置标签屏幕包围盒间距 < ~36px(desktop)/~28px(mobile) 则跳过。
     - **总量上限**：desktop ≤ ~45、mobile ≤ ~22，避免拥挤。
  5. `__viz.labelCount`、`labelLOD`；HUD 加标签开关。
- **Verify**：`npm run test:visual`；断言：① `labelCount() > 0` 且 ≤ 上限（不拥挤）；② **中国双语**——DOM 存在含中文且含英文的标签（如同时含「北京」与「Beijing」）；③ **他国英文**——某非中国大城市标签(如「Tokyo」)存在且**不含 CJK**；④ **背面剔除**——旋转地球后 `labelCount()` 变化；⑤ LOD——近距 `labelLOD()==="near"` 且出现省名。贴输出 + 看截图确认不拥挤、文字清晰。
- **DoD**：国家/城市/省名标签按规则显示；中国中英文、他国英文；LOD + 去重 + 背面剔除生效、不拥挤；可开关。

### 任务 B1：多帧 ERA5 时间序列数据（请求 2 之一）
- **Files**：`scripts/prepEra5Frames.mjs`（扩展现有取数）、`public/data/era5/frames/era5-10m-wind-*.json`（多帧）、`public/data/era5/manifest.json`（改为 `frames: [...]`）、`src/data/era5/loadEra5WindFrame.js`（支持多帧 manifest）。
- **Spec**：
  1. 用既有 **keyless ERA5 ARCO（Google Cloud 匿名）** 取**同一天多个时刻**（建议每 3h 共 8 帧，或每 1h 共 24 帧）的 10m u/v，降采样到现网格(lonStep 2°)，逐帧写 JSON + 复用 `validateEra5WindFrame`。
  2. manifest 升级：`schemaVersion` 升版，`frames: [{ path, timeUtc }, ...]`（保留单帧字段做向后兼容/回退）；保留 Copernicus license notice。
  3. `loadEra5WindFrame`：返回**全部有效帧**（按时间排序）；任一帧失败如实跳过；全失败→`missing`（沿用诚实状态）。
- **Verify**：`npm run build && npm run test:visual`（`tests/era5-source.spec.js` 扩断言）：`__viz.windFrameCount() >= 8`；每帧 `validateEra5WindFrame` 通过；manifest `frames` 长度匹配；provenance 仍诚实（无谎标）。
- **DoD**：≥8 个有效时间帧本地就位、按时间排序、校验通过、license 诚实。

### 任务 B2：风场随时间演变（运行时）（请求 2 之一）
- **Files**：`src/scene/EarthScene.js`、`src/scene/layers/createWindLayer.js`、`src/data/era5/traceWindStreamlines.js`、`index.html`/`main.js`（时间轴 UI）。
- **Spec**：
  1. **时间控制器**：按可调速度推进 `windFrameIndex`（循环）；当前时刻 = 相邻两帧间插值得到的 u/v 场。
  2. **风场演变**：随时间**重生/形变**流线——为避免每帧全量 retrace 的开销，采用以下其一并说明：(a) 每 N 秒 retrace + 顶点位置插值过渡；或 (b) GPU/CPU 让粒子沿插值场持续平流、寿命到则在新场重生。保持**单 draw call**。
  3. **联动 A1**：把当前帧 UTC 喂给太阳方向（昼夜线随时间移动）。
  4. **UI/HUD**：显示当前帧 UTC + 播放/暂停（复用全局 pause：paused 时时间冻结，帧差≈0）+ 速度档（可选）。
  5. `__viz.windFrameTime/windFrameIndex/windPlaying`。
- **Verify**：`npm run test:visual`：① 播放下 `windFrameTime()` 在数秒内变化、`windFrameIndex` 推进；② 风场区域**前后两次截图有差异**（证明演变），且与 A1 的昼夜线一起移动；③ 全局 pause 后 `windFrameTime()` 冻结、帧差≈0；④ 仍单 draw call（drawCalls 不暴涨）。贴输出 + 抓 `desktop-t0.png`/`desktop-t1.png` 对比。
- **DoD**：风场随时间真实演变、可播放/暂停、单 draw call、与昼夜线联动；断言通过。

### 任务 D1：整体调参 + 录屏出图 + 收口（验收）
- **Files**：微调 `EarthScene.js`/`config.js`/`styles.css`；更新 `TRANSFER_STATUS.md`、`README.md`。
- **Spec**：统调日照强度/暗面柔光/bloom/曝光/标签字号密度/边界透明度，使「真实地球 + 起伏地形 + 国界省界 + 不拥挤标签 + 随时间演变风场」整体协调且 `1280×1280` 稳定；录屏/截图（默认视角 + 近距 + 时间推进 + demo 模式）归档 `tests/__screens__/`；`TRANSFER_STATUS.md` 写最终验证、产物路径、残余风险、V4 入口。
- **Verify**：完整跑
  ```bash
  npm install && npm run build && npx playwright install chromium && npm run test:visual && ls -la tests/__screens__/
  ```
  全绿；截图齐全。贴完整输出。
- **DoD**：见 §4 验收定义全部满足。

---

## 4. 验收定义（Definition of Done）

> **铁律：没有 fresh 验证证据不得声称完成。** 每条须有命令真实输出 / 截图为证。

**自动化（硬门，全绿）：** `npm run build` exit 0；`npm run test:visual` 两 project 全绿；`tests/__screens__/` 含 desktop / mobile / desktop-zoom / desktop-t0 / desktop-t1。Playwright 关键断言：
- **请求 1**：无整面发光高亮（过曝桶 < 阈值）；终止线存在（昼区均亮 > 夜区 + 余量）；暗面均亮 > 下限（可读）。`lightingMode==="realisticSun"`。
- **请求 2**：`windFrameCount() >= 8`；播放下 `windFrameTime()` 变化、风场区域帧差 > 阈值；pause 后冻结；单 draw call。
- **请求 3**：`minZoomDistance()` 已降低、近距清晰；`terrainRelief().displacement===true`；`borderFeatureCount() > 0` 且边界色像素存在；`labelCount()>0 且 ≤ 上限`、中国标签中英文、他国英文(无 CJK)、背面剔除使旋转后 labelCount 变化、近距出现省名。

**人工（看图确认）：** 地球真实无高亮、昼夜立体、近距地形起伏可见、国界省界清晰、标签清晰不拥挤（中国中英文/他国英文）、风场随时间流动演变、UI 不遮挡 canvas、录屏流畅。

**完成措辞：** 「完成 = build + test:visual 两视口全绿、五类截图已存、请求1/2/3 各自断言通过、所有新数据 manifest provenance 诚实(无谎标 fallback)、无回归、TRANSFER_STATUS.md 已更新。」

## 5. 风险与兜底

- 高程/Natural Earth/多帧 ERA5 取数失败 → 各自 fallback 并**如实标注**（proceduralBump / 跳过该帧 / devSynthetic），绝不谎称真数据；prep 是构建期、运行时不依赖网络。
- 标签拥挤/抖动 → LOD + 优先级 + 屏幕空间去重 + 背面剔除 + 总量上限；declutter 计算节流（非每帧全算）。
- 近距穿模/裁切 → displacement 偏移 ε 安全余量；调 `near` 裁剪面与 minDistance。
- headless WebGL 抖动 → 沿用 swiftshader flag + 颜色桶(非精确亮度) + 固定 seed；CSS2D 标签是 DOM，断言走 `document.querySelectorAll(".viz-label")` 稳定。
- 时间演变性能 → 节流 retrace + 顶点插值 + 单 draw call；High/Low 控帧数与流线数。
- **回滚**：本地 git 已建基线 tag `baseline-shell`；本轮开工前先 `git add -A && git commit -m "pre-V3 checkpoint"`（本地，不 push）。

## 6. 边界（不做 / 不碰）

- ❌ 不重建已工作的渲染管线/验收/`__viz`（只扩展）。
- ❌ 不接需账号/key 的服务（Copernicus CDS、付费瓦片）；ERA5 仅用 keyless ARCO，地图/边界/高程仅用 public-domain（NASA / Natural Earth / GEBCO-ETOPO）。
- ❌ 运行时不依赖网络（所有外部数据构建期预烘焙进 `public/`）。
- ❌ 不 git push；不读取/记录任何密钥 cookie token；不引入有版权素材；不把原视频帧入库。

## 7. 来源（均 public-domain / 免账号）

- NASA Blue Marble（已用，public domain）· NASA Black Marble 夜灯（备选）
- Natural Earth `nvkelso/natural-earth-vector`（public domain：admin0/admin1/populated_places）
- 高程：GEBCO 2023 / NOAA ETOPO 2022 / Natural Earth raster（public domain，三选一）
- ERA5 ARCO on Google Cloud Public Datasets（keyless，匿名；Copernicus license notice 保留）
- three.js `CSS2DRenderer`（标签）
