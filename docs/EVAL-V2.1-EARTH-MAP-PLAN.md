# V2.1 高精度地球地图计划 — 评估与优化建议

评估对象: Codex 提出的《V2.1 高精度地球地图计划》（NASA Blue Marble 替换程序化地球纹理）
评估日期: 2026-06-28
评估者: Claude Code（基于现有代码证据，非终局结论）
目标目录: `/Volumes/vol1/3D 风场地球可视化/`

---

## 0. 一句话结论

方向正确、provenance 纪律到位、honest-fallback 设计与现有 `windSource` 模式一致，**可以执行**。
但计划在“可见性物理学”和“视觉测试门”两处有**会直接决定首屏成败的硬缺口**，必须在动工前补齐，否则很可能出现“贴了 NASA 纹理但非洲在阴影里看不见 / 或测试假绿”的结果。

证据基础（已读代码）:
- `src/scene/layers/createEarth.js`: 当前为 2048×1024 程序化 canvas，`MeshStandardMaterial` + 程序化 bump（`bumpScale 0.05`, `roughness 0.62`）。
- `src/scene/EarthScene.js`: 单 `DirectionalLight`("#ffffff",1.6) key 光在 (3,4,3) + `HemisphereLight` 0.9 fill；`ACESFilmicToneMapping`，`toneMappingExposure 0.95`；`scene.environmentIntensity 0.22`；`UnrealBloomPass(strength 0.38, radius 0.5, threshold 0.32)`；`root.rotation.y = Math.PI*0.5`（init 与 `resetCamera` 各设一次）。`__viz.ready` 在纹理加载前已同步置 true。
- `tests/visual.spec.js` + `tests/helpers/colorBuckets.js`: 视觉门用 HSV 桶 `oceanBlue / warmLand / brightWhite / windWarm`，阈值显式标注为“按当前程序化地球 baseline 校准”。
- `public/data/era5/manifest.json` + frame 已存在，`__viz.windSource()` 当前可返回 `era5`。

---

## 1. 计划做对的地方（保留，不要动）

1. **方向取舍正确**：不碰 ERA5 主链路，只替换地球纹理，范围收敛、可独立 merge。
2. **honest-fallback 接口设计**：`earthMapSource()` 返回 `nasaBlueMarble | proceduralFallback`，与既有 `windSource()` 的 `era5 | devSynthetic | missing` 同构，不把 fallback 美化成高精度图——这条与现有代码哲学一致，强烈保留。
3. **provenance 纪律**：manifest 记录 source/credit/license/dimensions/sha256/generatedAt，复用了 `era5/manifest.json` 已有模式。
4. **离线静态资产 + 不可达即暂停**：不引入运行时网络请求、付费 API、第三方镜像，符合工程门。
5. **季节匹配**：Blue Marble January 2004 对齐 ERA5 sample `2024-01-15`，是加分项（虽非必要，但低成本）。
6. **不做行政边界/displacement**：守住原科学可视化风格，避免 scope 膨胀，V2.2 再议合理。

---

## 2. 必须在动工前补齐的硬缺口（P0）

### P0-1 光照地形学：半球阴影会吃掉“首屏识别非洲”这个目标 ★最高优先

**问题**：当前场景只有一个 `DirectionalLight` key 光（外加弱 hemisphere fill 与 `environmentIntensity 0.22`）。程序化地球颜色平、容差大，半明半暗看不出来；但换成真实 Blue Marble 后，`MeshStandardMaterial` 会产生明显的**明暗终止线（terminator）**——朝光半球亮、背光半球暗。叠加 `ACESFilmicToneMapping` + `exposure 0.95`，背光侧会压成接近黑。

**后果**：计划的核心验收是“首屏清楚识别非洲、阿拉伯半岛、马达加斯加、印度洋”。如果这片区域恰好转到背光侧，就是一团暗，纹理再高清也白搭。这是**计划目标与渲染物理的直接冲突，计划完全没提**。

**建议（择一，按推荐序）**:
1. **首选**：地球日面用 `emissiveMap`=Blue Marble 贴图（`emissive` 白、`emissiveIntensity ~1`，`map` 同图或留作受光细节），让大陆自发光、不依赖单一方向光。这是 photographic globe 场景的标准做法，能保证整球可读，同时玻璃大气壳/bloom/ERA5 风线仍叠在上层。
2. 次选：保留 `MeshStandardMaterial` 但大幅抬升 `HemisphereLight`/`AmbientLight` 并降低 directional 对比，接受“接近全亮、弱明暗”的仪表风。
3. 不推荐：保留强 directional 制造写实昼夜——除非 `resetCamera` 同时锁定让目标区域恒定落在受光侧，但那会牺牲自转观感。

**决策点**：要“整球均匀可读的仪表风”还是“写实昼夜 + 锁定受光面”？这个取舍影响材质与光照写法，应在计划里显式定，而不是留给实现时即兴。

### P0-2 视觉测试门没有重新校准——会假绿或误红 ★

**问题**：`colorBuckets.js` 的阈值（`oceanBlue / warmLand / brightWhite` 的 min 值）注释明确写着“按当前程序化地球 baseline 校准”。NASA Blue Marble 的调色板与程序化地球完全不同：
- 真实海洋更深、Blue Marble NG **base 版无云**（NEO 某些版本带云会引入大片 `brightWhite`）；
- 真实陆地以绿/棕为主，撒哈拉/阿拉伯是高反照率亮黄——`warmLand` 桶的命中率会大幅变化；
- 极冰、云会推高 `brightWhite`。

计划的 Test Plan **只加了 `earthMapSource==="nasaBlueMarble"` 和 `earthMapReady()` 断言，完全没提 colorBuckets 阈值重标定**。结果二选一：要么旧阈值碰巧过（假绿，门失效），要么 `warmLand/oceanBlue` 漂移导致既有 5 个测试中的 `renders the globe` 误红。

**建议**:
- 在计划任务里**显式加一步“重采集 baseline + 重标定 colorBuckets 阈值”**，并在注释里把“按程序化地球校准”改成“按 NASA Blue Marble 校准”，留下迁移记录。
- 决定用**有云还是无云**版本（强烈建议 **base topography/bathymetry 无云版**）：云会随机遮挡海岸线、干扰 `brightWhite` 桶、也和“识别地理位置”目标相悖。计划现在 NEO 3600×1800 与 Science 5400×2700 两个候选没说清是否带云，必须定死。
- `analyzeRing` 的 rim 断言（`bright + cyan > 8`）也依赖球体边缘亮度，材质改动后需复核。

### P0-3 异步纹理就绪与 `__viz.ready` 的时序

**问题**：当前 `createEarth()` 是**同步**返回 mesh，`__viz.ready` 在 `init()` 里同步置 true。改成 `TextureLoader` 异步加载后，`ready===true` 时纹理可能还没到，Playwright（现在就是 `waitForFunction(__viz.ready===true)` + 固定 `waitForTimeout(900)`）会**拍到 procedural fallback 或裸球**，截图验收失真。

**建议**:
- `earthMapReady()` 必须真实反映纹理 onLoad/onError 完成，且测试 `waitForFunction(__viz.earthMapReady()===true)` 要作为截图前的**硬等待**，而不是叠在 900ms timeout 上赌。
- 明确 `ready` 与 `earthMapReady` 语义边界：建议 `ready` 仍表示“场景可交互”，`earthMapReady` 表示“高精度纹理已上屏或已确定走 fallback”。fallback 情况下 `earthMapReady` 也应 resolve（true + source=proceduralFallback），否则测试会 15s 超时。

---

## 3. 应当修正的实现级问题（P1）

### P1-1 程序化 bump 与真实海岸线错位
当前 bump 来自 `createBumpTexture()` 的 6 个椭圆 blob（按程序化大陆经纬度摆放）。换上真实纹理后，**老 bump 的凸起不会和真实海岸线对齐**，会出现“浮雕在海里、平地在陆上”的违和。
**建议**：要么**直接去掉 bump**（最稳，Blue Marble 本身有明暗暗示地形），要么从 Blue Marble **亮度通道派生 bump/roughness**（陆地略糙、海洋略滑），不要保留旧的程序化 blob bump。计划里“轻量 bump/roughness 调整”这句太含糊，需指明 bump 数据来源。

### P1-2 等距投影对齐 / flipY / 接缝 / 极点
Blue Marble 是标准 equirectangular（x: lon −180→180，y: lat 90→−90），与现有 `lon2x/lat2y` 约定一致，**但仍需显式验证**：`texture.flipY`、`wrapS=RepeatWrapping`、`colorSpace=SRGBColorSpace`、经度 0 接缝位置、极点贴图收敛。`SphereGeometry(radius,96,64)` 在极点会有纹理挤压，真实照片比程序化更容易看出来——可考虑提到 `128×96` 段数（成本可忽略）。

### P1-3 `resetCamera` / 初始构图的确定性
计划要求“校准地球旋转使非洲/印度洋可识别”，但当前 `root.rotation.y = Math.PI*0.5` 在 `init()` 和 `resetCamera()` 两处硬编码，注释却说“Americas + Africa”。
**建议**：抽成具名常量 `INTRO_ROTATION_Y`，用一次截图实测确定能让非洲/阿拉伯/印度洋正对镜头的角度，两处共用。否则截图验收会因为“到底转到哪”反复返工。注意这也和 P0-1 的受光面决策耦合（如果走写实昼夜，受光面必须 == 目标地理区）。

### P1-4 tone mapping / bloom 让 Blue Marble 发灰发暗
`ACESFilmic + exposure 0.95 + environmentIntensity 0.22 + bloom threshold 0.32` 是为程序化地球调的。真实照片经 ACES 会去饱和、压暗，海岸线易被 rim/bloom 糊成亮边（计划自己在人工清单里也担心这点）。
**建议**：把“截图后按需微调 exposure / bloom threshold / 大气壳不透明度”列成计划内的一轮显式迭代（最多 1–2 轮），而不是留作隐性 polish。若走 P0-1 的 emissive 方案，需复核 emissive 是否过度喂给 bloom 导致整球过曝。

### P1-5 `windSource()==="era5"` 断言耦合进地图测试的代价
计划在地图验收里继续断言 `windSource()==="era5"`，方向对（防止地图升级顺手打断风场）。但要注意：`era5` 状态依赖 frame 加载成功 **且** `traceWindStreamlines` 返回非空 segments。把它放进“地球地图”测试会让该测试在 ERA5 数据出问题时一起红，定位变难。
**建议**：保留断言，但作为**独立 expect 行并附 message**（如 `"wind source stays era5 after earth map upgrade"`），失败时一眼能区分是地图问题还是风场回归。

### P1-6 validator 读取 JPEG 尺寸不要引新依赖
`validate_earth_assets.mjs` 要校验“尺寸 ≥ 3600×1800”。纯 Node 读 JPEG 宽高需要解析 SOF0 头（几十行）或引依赖。
**建议**：计划里写死“用内联最小 JPEG header parser，不新增 npm 依赖”，与工程门“新依赖须直接服务核心需求”一致。同理 sha256 用 node 内置 `crypto`。

---

## 4. 工程 / 仓库卫生（P2）

- **二进制入库**：`public/` 当前是 untracked（`?? public/`）。提交 JPEG 前确认 `.gitignore` 不会误伤，且这是有意把纹理纳入版本控制。12 MB 总预算合理，但单张 5400×2700 JPEG 若带云体积会涨，建议**默认 3600×1800，5400×2700 仅当 3600 实测不足时再上**（计划已有此 fallback 阶梯，保留）。
- **manifest sha256 校验闭环**：validator 必须真正比对 sha256 与文件，不能只检查字段存在——否则 provenance 是装饰。
- **下载来源固化**：把 NASA NEO / Science 的确切下载 URL、版本（January 2004）、license note 写进 manifest 和 `docs/`，并在 README 写 credit `NASA Earth Observatory`。NASA 影像一般属公共领域，但**仍要逐条标注，不自行下合规终局结论**（基于现有资料）。

---

## 5. 建议补充的验收清单（叠加到计划 Test Plan）

在计划已有断言基础上增加：

1. `await page.waitForFunction(() => window.__viz.earthMapReady() === true)` 作为截图前硬门（替代/前置于裸 `waitForTimeout`）。
2. fallback 路径单测：模拟纹理加载失败 → `earthMapSource()==="proceduralFallback"` 且 `earthMapReady()===true`，**绝不**报 `nasaBlueMarble`。
3. colorBuckets 阈值**重标定记录**：在 `colorBuckets.js` 注释和 `TRANSFER_STATUS.md` 写明新 baseline 来源（NASA Blue Marble，日期/分辨率）。
4. 人工截图清单补一条：**确认目标地理区（非洲/印度洋）落在受光/可读侧**，而非终止线阴影里（对应 P0-1）。
5. `windSource()==="era5"` 独立断言带 message（P1-5）。

回归命令（计划已列，确认沿用）:
```
npm run build
npm run test:visual
node scripts/era5/validate_frame.mjs public/data/era5/manifest.json
node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json
```

---

## 6. 需要计划作者明确回答的决策点（开工前）

| # | 决策 | 为什么必须先定 | 建议默认 |
|---|------|----------------|----------|
| D1 | 材质/光照：整球均匀可读（emissive 仪表风）vs 写实昼夜 + 锁定受光面 | 直接决定“首屏能否看见非洲”，影响材质与光照写法 | emissive 仪表风（P0-1 首选） |
| D2 | 纹理用**无云** base topography/bathymetry 还是带云版 | 决定 colorBuckets 重标定与“可识别地理”目标 | 无云 base 版 |
| D3 | bump：去掉 vs 从亮度派生 | 老程序化 bump 会与真实海岸线错位 | 去掉或亮度派生（P1-1） |
| D4 | 默认分辨率 3600×1800 vs 5400×2700 | 性能/体积 vs 清晰度 | 3600×1800 起步，不足再升 |

---

## 7. 总体评级

| 维度 | 评价 |
|------|------|
| 方向与范围收敛 | ✅ 好 |
| provenance / license 纪律 | ✅ 好 |
| honest-fallback 接口设计 | ✅ 好，与现有架构一致 |
| 渲染可见性（光照/材质） | ⚠️ **关键缺口 P0-1**，与核心目标冲突，必须补 |
| 视觉测试门有效性 | ⚠️ **关键缺口 P0-2**，未重标定会假绿/误红 |
| 异步加载时序 | ⚠️ P0-3，需硬等待 earthMapReady |
| 实现细节（bump/对齐/构图/tone map） | 🔧 P1 多处需写清，不致命但会反复返工 |

**结论**：计划值得执行，但**不要按现稿直接动工**。先把 P0-1/P0-2/P0-3 三条写进计划（特别是 D1 材质决策和 colorBuckets 重标定），再让执行 agent 跑。否则最可能的失败模式是：“NASA 纹理贴上去了、测试还是绿的、但首屏非洲在阴影里看不清”——即满足了字面任务却没达成真实目标。

---

## 8. 产物与下一步

- 本评估文档: `docs/EVAL-V2.1-EARTH-MAP-PLAN.md`
- 验证：基于已读代码证据（createEarth.js / EarthScene.js / visual.spec.js / colorBuckets.js / config.js / era5 manifest），未运行构建或修改源码。
- 下次入口：
  1. 与计划作者确认第 6 节 D1–D4 决策；
  2. 据此把 P0-1/P0-2/P0-3 补进 V2.1 计划任务序列；
  3. 再进入实现（建议沿用 waza-think → waza-design → waza-check 循环）。
- 残余风险：NASA 下载实际带云/分辨率/许可证细节需下载时逐条核验（基于现有资料，未联网确认）。
