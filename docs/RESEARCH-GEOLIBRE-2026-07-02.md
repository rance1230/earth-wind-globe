# GeoLibre 调研报告：对本 3D 风场地球项目的适用性分析

> 调研日期：2026-07-02
> 项目上下文：`/Volumes/vol1/3D 风场地球可视化/`（Three.js 球面地球 + ERA5 风场 + ETOPO1 高程 + 边界/标签）
> 上游仓库：https://github.com/opengeos/GeoLibre （opengeos 组织，维护人 Prof. Qiusheng Wu）

---

## 0. TL;DR（一句话结论）

**GeoLibre 无法作为"地球模型"替换或优化我们项目的球面渲染。** 它是一个基于 **MapLibre GL JS 的平面（Web Mercator）WebGL 地图 GIS 平台**，而我们项目是 **Three.js 球面（orthographic/spherical）3D 地球**——两者渲染范式、坐标系、依赖栈完全不同。直接引入会破坏 PLAN-V3 既有的单 draw call 渲染管线与 `window.__viz` 验收钩子。

但 GeoLibre 背后的 **opengeos 生态（maplibre-gl-extend / leafmap / GeoPandas 工作流）在"数据准备脚本"层面有可借鉴价值**——尤其对我们 `scripts/` 下的构建期取数（边界、标签、ERA5）。

---

## 1. GeoLibre 到底是什么

| 维度 | 事实 |
|---|---|
| **本质** | 轻量、cloud-native 的 GIS 平台，用于可视化/探索/分析地理数据 |
| **运行环境** | Web 浏览器、桌面、移动端、Jupyter notebook |
| **底层渲染** | **MapLibre GL JS**（平面矢量瓦片 + Web Mercator 投影） |
| **作者** | Prof. Qiusheng Wu（opengeos），同时维护 leafmap、geemap、maplibre-gl-extend、maplibre-gl-components、hypercoast 等 |
| **定位** | 类似 leafmap 的"通用 GIS 前端/Python 工具集"，强调跨平台、零后端、云原生数据源（COG/STAC/Zarr） |
| **许可** | 开源（MIT 类宽松许可，free to use and modify） |

**关键澄清**：搜索结果与 opengeos 官网均显示，GeoLibre 的地图能力来自 **MapLibre GL JS 的平面瓦片渲染**，并非三维球体渲染。它没有 Three.js 球面 mesh、没有 displacement 地形、没有昼夜终止线光照——这些都是我们项目的核心。

---

## 2. 我们项目的技术现实（对照基准）

读 `src/scene/layers/createEarth.js` + `package.json` + `PLAN-V3` 确认：

| 我们的项目 | 实现 |
|---|---|
| 渲染范式 | **Three.js 球面 3D**（`SphereGeometry(radius, 320, 240)` + `MeshStandardMaterial`） |
| 地球纹理 | NASA Blue Marble 5400×2700（public domain） |
| 地形 | ETOPO1 heightmap → `displacementMap` + `normalMap`（陆地起伏 3D） |
| 光照 | 真实太阳 `DirectionalLight` + 暗面柔光 + 昼夜终止线（A1 任务） |
| 风场 | ERA5 ARCO（keyless）多帧时间序列 + 流线，**单 draw call** |
| 边界 | Natural Earth → 单 `LineSegments`（countries/states/china-provinces） |
| 标签 | `CSS2DRenderer` DOM 标签 + LOD + 屏幕空间去重 + 背面剔除 |
| 验收 | Playwright + `window.__viz` 钩子 + 颜色桶断言 |

**约束铁律**（PLAN-V3 §6）：❌ 不重建已工作的渲染管线/`__viz`；❌ 运行时不依赖网络；❌ 不接需账号/key 的服务。

---

## 3. 核心结论：GeoLibre ≠ 地球模型

这是本报告最重要的一点，需要明确纠正一个可能的误解：

> **GeoLibre 不能"采用地球模型进行视觉优化"**——它本身不提供任何 3D 球体地球模型。

| 能力 | GeoLibre / MapLibre 平面范式 | 我们 Three.js 球面范式 |
|---|---|---|
| 投影 | Web Mercator（平面，越往极地越拉伸） | 真实球面经纬度→3D 笛卡尔 |
| 地球呈现 | 平铺地图（可 `globe` 投影但仍是瓦片壳） | 实心 3D 球 + 地形 displacement |
| 昼夜光照 | 无（瓦片不自定义着色器光照） | 真实太阳 + 终止线（A1 核心） |
| 风场流线 | 无原生支持 | 自绘 `LineSegments` 流线 |
| 单 draw call 纪律 | 瓦片渲染，draw call 数百 | 严格单 draw call/层 |
| 运行时网络 | **强依赖瓦片服务器** | ❌ 我们的铁律：运行时零网络 |

MapLibre 虽有 `globe` 投影模式（maplibre-gl ≥4.0 把瓦片贴到球壳上），但那是"贴图球"，**没有 displacement 地形起伏、没有自定义太阳光照、没有 ERA5 流线层**——与我们 PLAN-V3 的 A1/C2/B2 三大请求正交。

**若强行把 GeoLibre 引入渲染层**，将直接违反 PLAN-V3 §6 的三条红线（重建渲染管线 / 运行时网络依赖 / 破坏 `__viz`），且无法满足 C2 的 3D 地形、A1 的昼夜光照、B2 的单 draw call 风场。**不推荐。**

---

## 4. 有真实借鉴价值的部分（聚焦 `scripts/` 构建期）

撇开渲染层，opengeos 生态在**数据准备**和**地理处理**上有成熟工具，可作为我们 `scripts/` 取数脚本的参考（注意：是"参考思路/格式"，不是引入运行时依赖）。

### 4.1 边界数据（对应 PLAN-V3 C3）

| opengeos 资产 | 对我们的帮助 |
|---|---|
| `maplibre-gl-extend` 的 GeoJSON 处理 | 我们已用 Natural Earth（`public/assets/boundaries/`），格式思路一致 |
| Natural Earth 矢量 `nvkelso/natural-earth-vector` | **我们已在用**（countries-110m / states-110m / china-provinces-10m 已落地） |

**结论**：C3 已完成，数据源与 opengeos 推荐完全一致，无需借鉴。

### 4.2 标签数据（对应 PLAN-V3 C4）

| opengeos 资产 | 对我们的帮助 |
|---|---|
| `ne_10m_populated_places`（含 `NAME_ZH`） | **我们已在用**（`public/assets/labels/labels-110m.json`） |

**结论**：C4 已用相同数据源，opengeos 没有额外优势。我们的 CSS2D declutter 是自研，比 MapLibre 的瓦片标签更适合球面。

### 4.3 ERA5 风场（对应 PLAN-V3 B1）

| opengeos 资产 | 对我们的帮助 |
|---|---|
| `leafmap` / GeoLibre 对 COG、Zarr、STAC 的云原生访问 | **概念可参考**：ARCO ERA5 本身就是 Zarr on Google Cloud，我们的 `scripts/era5/` keyless 取数与之思路一致 |

**结论**：B1 已用 keyless ARCO，opengeos 的 Zarr 访问模式我们已在用。无需更换。

### 4.4 高程（对应 PLAN-V3 C2）

| opengeos 资产 | 对我们的帮助 |
|---|---|
| COG（Cloud Optimized GeoTIFF）读取、AWS Terrain Tiles | 我们已用 ETOPO1（`public/assets/earth/etopo1-heightmap-720x360.png`） |

**结论**：C2 已完成。COG 思路适合"在线高程瓦片"，但我们铁律是运行时零网络，构建期已烘焙，无优势。

---

## 5. 逐任务对照：GeoLibre 能帮上忙吗？

按 PLAN-V3 任务序列逐一判定：

| 任务 | GeoLibre 帮助度 | 理由 |
|---|---|---|
| **A1 去高亮+真实日照** | ❌ 无 | MapLibre 无自定义太阳光照/终止线；这是 Three.js 着色器/灯光层 |
| **C1 更深 zoom+清晰** | ❌ 无 | 瓦片 LOD 思路不同；我们靠 Blue Marble + anisotropy，已落地 |
| **C2 3D 地形起伏** | ❌ 无 | GeoLibre 无 displacement；ETOPO1 已用 |
| **C3 国界+省界** | ⚠️ 数据源重合 | Natural Earth 我们已用，opengeos 无增量 |
| **C4 标签** | ⚠️ 数据源重合 | populated_places 已用；CSS2D declutter 我们自研更优 |
| **B1 多帧 ERA5** | ⚠️ 思路重合 | keyless ARCO 已用；Zarr 访问思路一致 |
| **B2 风场演变** | ❌ 无 | 流线渲染是 Three.js 自绘，MapLibre 无 |
| **D1 收口** | ❌ 无 | 验收/截图是我们自己的 Playwright 流水线 |

**净结论**：A1/C1/C2/B2/D1 零帮助；C3/C4/B1 仅数据源重合，无增量价值。

---

## 6. 不应引入 GeoLibre 的硬性理由

1. **违反 PLAN-V3 §6 红线**：会重建渲染管线（Three.js→MapLibre）、引入运行时网络依赖（瓦片）、破坏 `window.__viz` 钩子。
2. **范式不兼容**：球面 3D vs 平面 Mercator，无法混合（强行混合 = 两套渲染器并存，体积与复杂度暴涨）。
3. **依赖膨胀**：MapLibre GL JS + 其插件体积 ~1MB+，与我们仅 `three` 单依赖的精简栈冲突。
4. **验收断裂**：现有 Playwright 断言（颜色桶、draw call、displacement 钩子）全部针对 Three.js，迁移 = 重写全部验收。
5. **需求不匹配**：GeoLibre 强在"GIS 分析工具链"（绘制、测量、COG 浏览），我们的需求是"沉浸式 3D 地球可视化"，目标用户场景不同。

---

## 7. 真正值得继续关注的 opengeos 资产（仅作背景知识，不引入）

- **`leafmap`**（Python）：若未来需要**离线数据准备**的 Python 工具链（批量下载 Natural Earth / COG 切片），leafmap 的 API 设计可作 `scripts/` 重构参考。
- **`maplibre-gl-components`**：legend/colorbar UI 组件，若未来要做图例（风速色标），交互设计可参考（但我们用 DOM 自绘更轻）。
- **`hypercoast`**：卫星数据可视化，与风场无关，不适用。

这些都是"看一眼思路"，不构成引入。

---

## 8. 给本项目的建议（可操作）

1. **不引入 GeoLibre / MapLibre**——保持 Three.js 球面管线，继续按 PLAN-V3 A1→C1→C2→C3→C4→B1→B2→D1 推进。
2. **数据层无需变动**——边界/标签/高程/ERA5 的数据源（Natural Earth / ETOPO1 / NASA / ARCO）已是 public-domain + keyless 最优解，与 opengeos 推荐一致。
3. **若未来想做"平面地图副视图"**（例如风场的等距柱状投影侧栏），那时可单独评估 maplibre-gl-extend，作为**独立的副模块**，不影响主球面渲染——但这超出 PLAN-V3 范围，属 V4+ 议题。
4. **视觉优化方向**继续聚焦 Three.js 原生能力：A1 的 `DirectionalLight` 太阳 + `MeshStandardMaterial` 终止线、C2 的 `displacementMap`、B2 的流线着色器——这些 GeoLibre 都帮不上，是 Three.js 自己的事。

---

## 9. 来源

- GeoLibre 主页：https://github.com/opengeos/GeoLibre
- Open Geospatial Solutions（opengeos 组织）：https://opengeos.org/
- maplibre-gl-extend：https://github.com/opengeos/maplibre-gl-extend
- maplibre-gl-components：https://github.com/opengeos/maplibre-gl-components
- MapLibre 官方：https://maplibre.org/
- 本项目 PLAN-V3：`PLAN-V3-WAZA-GLM5.2.md`
- 本项目渲染实现：`src/scene/layers/createEarth.js`

---

*本报告基于公开信息与本项目源码核实，结论为技术适用性判断，无外部数据发送。*
