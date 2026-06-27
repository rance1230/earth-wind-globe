# V2.1 高精度地球地图 — GLM 5.2 严格执行文档

目标目录: `/Volumes/vol1/3D 风场地球可视化/`
计划日期: 2026-06-28
适用执行模型: GLM 5.2
上游评估: `docs/EVAL-V2.1-EARTH-MAP-PLAN.md`（先读，本文已吸收其 P0/P1/P2 修正）
前置状态: ERA5 风场主链路已完成（`windSource()` 可返回 `era5`），本阶段**只换地球纹理**，不碰风场。

---

## 0. 一句话目标

把 `src/scene/layers/createEarth.js` 从程序化 canvas 地球，替换为 **NASA Blue Marble 无云真彩 equirectangular 静态纹理**，使首屏能清楚识别非洲、阿拉伯半岛、印度洋、马达加斯加、南美；保留 ERA5 风线、玻璃大气壳、bloom、controls 和 `windSource()==="era5"` 不变；纹理加载失败时诚实降级为 `proceduralFallback`，绝不谎称高精度图。

---

## 1. 已锁定的关键决策（不要再问，直接按此执行）

| # | 决策 | 锁定值 | 理由 |
|---|------|--------|------|
| D1 | 材质/光照 | **emissive 仪表风：整球均匀可读** | 单 DirectionalLight 会让背光半球变黑，非洲可能落在阴影里看不见，与核心目标冲突。用 `emissiveMap` 让大陆自发光。 |
| D2 | 纹理版本 | **NASA Blue Marble NG 无云 base（topography/bathymetry）** | 云会随机遮海岸线、干扰测试桶、与"识别地理"目标相悖。 |
| D3 | bump | **去掉旧程序化 bump** | 旧 bump 的椭圆 blob 不会和真实海岸线对齐，会出现"浮雕在海里"。 |
| D4 | 默认分辨率 | **3600×1800 JPEG 起步**，实测不足再升 5400×2700 | 体积/性能优先，留 fallback 阶梯。 |
| D5 | 颜色测试门 | **重标定 colorBuckets 阈值并改注释** | 旧阈值按程序化地球校准，NASA 调色板不同，不重标会假绿或误红。 |

---

## 2. 文件写入边界

**允许新增/修改:**
- `src/scene/layers/createEarth.js`（核心改造）
- `src/scene/EarthScene.js`（光照/材质接线、`__viz` 新增钩子、async 就绪）
- `src/main.js`、`src/styles.css`、`index.html`（HUD 显示 `NASA Blue Marble`，可选）
- `public/assets/earth/`（纹理 JPEG + `manifest.json`）
- `scripts/earth/validate_earth_assets.mjs`（新增校验脚本）
- `tests/visual.spec.js`、`tests/helpers/colorBuckets.js`（断言 + 阈值重标定）
- `README.md`、`TRANSFER_STATUS.md`、`docs/`

**禁止触碰:**
- `.git/`、`node_modules/`、`dist/`
- 任何 ERA5 风场逻辑：`src/data/era5/`、`src/data/windSource.js`、`src/scene/layers/createWindLayer.js`
- 认证材料、浏览器 profile、LaunchAgent、全局 skill
- unrelated refactor / rename / formatting churn

---

## 3. 资产契约

### 3.1 目录
```
public/assets/earth/
  ├── blue-marble-3600x1800.jpg      （主纹理，D4）
  └── manifest.json
```

### 3.2 `public/assets/earth/manifest.json` 字段（全部必填）
```json
{
  "schemaVersion": "earth-map-v1",
  "asset": "blue-marble-3600x1800.jpg",
  "source": "NASA Blue Marble: Next Generation (base topography/bathymetry, cloud-free)",
  "sourceUrl": "<实际下载 URL，填写下载时的真实地址>",
  "version": "January 2004",
  "credit": "NASA Earth Observatory",
  "licenseNote": "NASA imagery, generally public domain. Credit: NASA Earth Observatory.",
  "dimensions": { "width": 3600, "height": 1800 },
  "fileSizeBytes": 0,
  "sha256": "<下载后计算填入>",
  "generatedAt": "<ISO8601>"
}
```

### 3.3 下载来源（按序尝试，不可达即暂停报告）
- 优先 NASA NEO 3600×1800: https://neo.gsfc.nasa.gov/view.php?datasetId=BlueMarbleNG
- 画质不足再用 NASA Science 5400×2700: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- **禁止第三方镜像**。官方不可达 → 暂停并报告，不替代。

---

## 4. 任务序列（GLM 5.2 逐步执行，每步先读后写）

> 每个任务开头写五行任务卡：目标 / 完成条件 / 验证器 / 安全边界 / 产物位置。
> 每个任务结束跑该任务 Verify，失败只做一轮针对性修复；同一错误连续 2 次失败 → 停止试错、读日志、回根因。

### 任务 0 — Preflight 基线快照（不改代码）
**Skill: waza-check**

动作:
1. `pwd`
2. `git status --short --branch -uall`
3. `node -v && npm -v`
4. 读取本文、`docs/EVAL-V2.1-EARTH-MAP-PLAN.md`、`src/scene/layers/createEarth.js`、`src/scene/EarthScene.js`、`tests/visual.spec.js`、`tests/helpers/colorBuckets.js`
5. `npm run build`
6. `npm run test:visual`（记录当前 5 个测试是否全绿、当前截图）

**完成条件:** 当前轮 transcript 有真实命令输出；写出 Current State Snapshot（dirty 文件数、测试结果、截图路径）。
**暂停条件:** build 或 test 基线就失败且无法解释 → 先诊断，不要叠改动。

---

### 任务 1 — 获取并校验 NASA 纹理资产
**Skill: waza-think + waza-check**

动作:
1. 检查是否已有本地纹理：`ls -la public/assets/earth/ 2>/dev/null`
2. 若无，从 §3.3 优先 URL 下载 3600×1800 JPEG 到 `public/assets/earth/blue-marble-3600x1800.jpg`。
   - 下载工具用 `curl -fSL <url> -o <path>`。
   - **不可达 → 暂停报告**，不找镜像。
3. 计算并记录：
   - `shasum -a 256 public/assets/earth/blue-marble-3600x1800.jpg`
   - `wc -c < public/assets/earth/blue-marble-3600x1800.jpg`
4. 写 `public/assets/earth/manifest.json`（§3.2，填入真实 url/size/sha256/generatedAt）。

**完成条件:** 纹理文件存在且非空，manifest 字段完整、sha256 与文件一致。
**验证器:** 见任务 2 的脚本。
**暂停条件:** 官方 URL 不可达、需要账号/付费、单文件 > 12 MB。

---

### 任务 2 — 资产校验脚本
**Skill: waza-check**

新增 `scripts/earth/validate_earth_assets.mjs`，要求：
- 用 Node 内置模块（`fs`、`crypto`），**不新增 npm 依赖**。
- 读 manifest，校验：
  1. 纹理文件存在且非空；
  2. `dimensions.width >= 3600 && height >= 1800`——用**内联最小 JPEG SOF parser**（扫描 `0xFFC0/0xFFC2` marker 读高宽），不引依赖；
  3. 实际 sha256 == manifest.sha256；
  4. 总资产体积 <= 12 MB。
- 任一不满足 `process.exit(1)` 并打印原因。

**验证器:**
```
node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json
```
**完成条件:** 脚本对当前资产输出 PASS，退出码 0。

---

### 任务 3 — 改造 `createEarth.js` 为异步纹理 + 程序化 fallback
**Skill: waza-design**

要求把 `createEarth(radius)` 改成：**同步返回 mesh（先挂程序化 fallback），异步加载 NASA 纹理，加载完成后替换 map/emissiveMap 并标记就绪**。保留现有 `createEarthTexture()` 作为 `proceduralFallback`，但 `createBumpTexture()` 调用**删除**（D3）。

实现要点（GLM 照此写）：

```js
import * as THREE from "three";

const EARTH_TEXTURE_URL = "/assets/earth/blue-marble-3600x1800.jpg";

// 模块级状态，供 EarthScene/__viz 读取。
let _mapSource = "proceduralFallback"; // "nasaBlueMarble" | "proceduralFallback"
let _mapReady = false;
let _onReadyCbs = [];

export function earthMapSource() { return _mapSource; }
export function earthMapReady() { return _mapReady; }
export function earthMapAttribution() {
  return _mapSource === "nasaBlueMarble"
    ? "NASA Blue Marble — NASA Earth Observatory"
    : "Procedural fallback (not a high-precision map)";
}
export function onEarthMapReady(cb) {
  if (_mapReady) cb();
  else _onReadyCbs.push(cb);
}
function _markReady(source) {
  _mapSource = source;
  _mapReady = true;
  _onReadyCbs.forEach((cb) => cb());
  _onReadyCbs = [];
}

export function createEarth(radius) {
  // 1) 先用程序化 fallback 贴图，保证球体立即可见。
  const fallback = new THREE.CanvasTexture(createEarthTexture());
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.wrapS = THREE.RepeatWrapping;
  fallback.anisotropy = 4;

  // D1: emissive 仪表风 —— 大陆自发光，整球均匀可读，不受 directional 终止线影响。
  const material = new THREE.MeshStandardMaterial({
    map: fallback,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: fallback,
    emissiveIntensity: 0.9,
    roughness: 0.85,
    metalness: 0.0
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), material);

  // 2) 异步加载 NASA 纹理；成功则替换，失败则保留 fallback 并诚实标记。
  const loader = new THREE.TextureLoader();
  loader.load(
    EARTH_TEXTURE_URL,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.anisotropy = 8;
      material.map = tex;
      material.emissiveMap = tex;
      material.needsUpdate = true;
      fallback.dispose();
      _markReady("nasaBlueMarble");
    },
    undefined,
    (err) => {
      // 失败：保留程序化 fallback，但 earthMapReady() 仍 resolve（true + proceduralFallback）。
      // eslint-disable-next-line no-console
      console.warn("[createEarth] NASA texture load failed, using proceduralFallback:", err);
      _markReady("proceduralFallback");
    }
  );

  return mesh;
}
```

> 注意：
> - 保留文件里原 `createEarthTexture()`（程序化大陆），**删除 `createBumpTexture()` 及其使用**（D3）。
> - `emissiveIntensity 0.9` 是初值，任务 6 据截图微调（防 bloom 过曝）。
> - equirect 对齐：NASA 与程序化同为 x:lon−180→180 / y:lat90→−90，`flipY` 用 three 默认（true）即可；任务 6 截图核对接缝与极点。

**完成条件:** `npm run build` 通过；模块导出 `earthMapSource/earthMapReady/earthMapAttribution/onEarthMapReady`。
**暂停条件:** 需重构超过 2 个核心文件，或需新渲染库。

---

### 任务 4 — EarthScene 接线 + `__viz` 钩子 + 就绪传播
**Skill: waza-think**

在 `src/scene/EarthScene.js`:

1. import 新导出：
```js
import { createEarth, earthMapSource, earthMapReady, earthMapAttribution, onEarthMapReady } from "./layers/createEarth.js";
```
2. `attachTestHook()` 的 `window.__viz` 增加三个钩子：
```js
earthMapReady: () => earthMapReady(),
earthMapSource: () => earthMapSource(),
earthMapAttribution: () => earthMapAttribution(),
```
3. `init()` 中调 `onEarthMapReady(() => this.updateEarthMapBadge())`（HUD 可选，无元素则 no-op）。
4. **`resetCamera` / 初始构图确定性**：把现有两处硬编码 `this.root.rotation.y = Math.PI * 0.5` 抽成模块常量 `INTRO_ROTATION_Y`，init 与 resetCamera 共用。任务 6 用截图实测把该值调到非洲/阿拉伯/印度洋正对镜头（emissive 整球可读后不存在阴影问题，只需构图对）。
5. **不要**改 `__viz.ready` 的现有语义（仍表示场景可交互）；纹理就绪单独由 `earthMapReady()` 表达。

**完成条件:** `npm run build` 通过；浏览器 console 无新报错；`__viz.earthMapSource()` 可读。
**暂停条件:** 需要改动 ERA5/风场相关接口。

---

### 任务 5 — 视觉测试门：断言 + colorBuckets 重标定
**Skill: waza-check（D5）**

1. `tests/visual.spec.js` 的 `renders the globe` 测试，在 `waitForFunction(__viz.ready===true)` 之后**追加硬等待**：
```js
await page.waitForFunction(() => window.__viz.earthMapReady() === true, null, { timeout: 15000 });
```
并新增断言（独立行、带 message）：
```js
expect(await page.evaluate(() => window.__viz.earthMapSource()), "earth map is NASA Blue Marble")
  .toBe("nasaBlueMarble");
expect(await page.evaluate(() => window.__viz.windSource()), "wind source stays era5 after earth map upgrade")
  .toBe("era5");
```
2. **重标定 colorBuckets 阈值**：
   - 先跑一次拿到 NASA 纹理下的真实 buckets（测试 attach 的 `*-buckets` JSON）。
   - 据真实值调整 `oceanMin / whiteMin / landMin`（仍作"存在性"松门，不做密度目标）。
   - 把 `tests/helpers/colorBuckets.js` 顶部注释里"按当前程序化地球 baseline 校准"改成"按 NASA Blue Marble (3600×1800, Jan 2004) 校准"，并在 `TRANSFER_STATUS.md` 记录新 baseline 数值。
3. 新增 fallback 单测（可在 visual.spec 或新建）：纹理 URL 不可达时 `earthMapSource()==="proceduralFallback"` 且 `earthMapReady()===true`，**绝不**报 `nasaBlueMarble`。

**完成条件:** `npm run test:visual` 5+ 测试全绿；阈值注释已更新；fallback 诚实性被测试覆盖。
**暂停条件:** 阈值反复调仍红 → 停，读 buckets JSON 找真实原因（可能是 bloom/exposure 需任务 6 先调）。

---

### 任务 6 — 视觉验收与微调（最多 2 轮）
**Skill: waza-design**

动作:
1. 桌面 1280×1280、移动 390×844 截图：`tests/__screens__/desktop.png`、`mobile.png`（已有 recording 流程则也存 `recording.png`）。
2. 人工检查清单（写进 `TRANSFER_STATUS.md`）：
   - [ ] 可识别非洲轮廓、阿拉伯半岛、马达加斯加、印度洋海岸；
   - [ ] **目标地理区落在可读视角**（emissive 下整球可读，确认构图正对，对应任务 4.4 的 `INTRO_ROTATION_Y`）；
   - [ ] ERA5 风线仍悬浮在地表之上，未被纹理吞掉；
   - [ ] rim/bloom 未把海岸线糊成一圈亮边（必要时降 `emissiveIntensity` 到 0.7 或调 bloom threshold/strength）；
   - [ ] 经度 0 接缝无错位、极点无明显挤压；
   - [ ] 移动端无 HUD/controls 重叠。
3. 仅在上述某项不达标时做针对性微调（`emissiveIntensity` / bloom 参数 / `INTRO_ROTATION_Y` / 大气壳不透明度），**最多 2 轮**，每轮后重跑截图。

**完成条件:** 清单全部勾选；截图存在；`npm run test:visual` 通过。
**暂停条件:** 2 轮微调后仍不达标 → 报告剩余风险，不无限调。

---

### 任务 7 — 文档更新
**Skill: waza-check**

1. `README.md` 地球层描述从"程序化真实大陆轮廓"改为"NASA Blue Marble official texture + procedural fallback"，写明 credit `NASA Earth Observatory`。
2. `TRANSFER_STATUS.md` 增加：纹理来源 URL、文件路径、sha256、新 colorBuckets baseline 数值、截图路径、残余风险。
3. README/TRANSFER 不得把 `proceduralFallback` 描述成高精度图。

**验证器:**
```
rg -n "Blue Marble|NASA|proceduralFallback|nasaBlueMarble|earthMapSource" README.md TRANSFER_STATUS.md docs src tests
```
**完成条件:** 文档声明与代码行为一致，无 misleading claim。

---

### 任务 8 — 收口 sign-off
**Skill: waza-check**

按序运行并把真实输出贴回:
```
git status --short --branch -uall
git diff --stat
npm run build
npm run test:visual
node scripts/era5/validate_frame.mjs public/data/era5/manifest.json
node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json
```
输出 sign-off:
```
files changed:    N
scope:            on target (earth map only, wind untouched)
hard stops:       N found / N fixed / N deferred
new tests:        earthMapSource assertion + fallback honesty
verification:     build / test:visual / era5 validator / earth validator —— pass or fail（贴真实结果）
doc debt:         none or named item
```

**完成条件:** build + visual tests + 两个 validator 全通过；截图存在；文档一致。
**暂停条件:** 需要 commit/push/发布/外发、需要付费/账号、纹理许可证不清、需破坏性清理。

---

## 5. 质量门（硬约束）

**资产门:** NASA 纹理为本地静态资产；无运行时网络请求；manifest 有 source/credit/license/sha256；官方不可达即暂停不找镜像。
**诚实门:** `earthMapSource()` 只在真实纹理上屏时返回 `nasaBlueMarble`，失败必返 `proceduralFallback`；HUD/README 不得把 fallback 当高精度图。
**风场门:** `windSource()==="era5"` 不被本次改动打断；不触碰 `src/data/era5/`、`windSource.js`、`createWindLayer.js`。
**视觉门:** 首屏可识别非洲/印度洋；ERA5 风线仍可见；移动端无重叠；验收必须含截图。
**工程门:** 不新增 npm 依赖（validator 用内置模块）；总资产 <= 12 MB；不新增账号/后端/云。
**试错门:** 同一错误连续 2 次失败必须停止试错，读日志或换证据来源。

---

## 6. `/goal` 循环执行提示词

### 推荐执行版（中文，可直接复制）

```text
/goal 将 `/Volumes/vol1/3D 风场地球可视化/` 的地球纹理从程序化 canvas 替换为 NASA Blue Marble 无云真彩 equirectangular 本地静态纹理，使首屏能清楚识别非洲、阿拉伯半岛、印度洋、马达加斯加、南美；保留 ERA5 风线、玻璃大气壳、bloom、controls 和 `windSource()==="era5"` 不变；纹理加载失败时诚实降级为 proceduralFallback，绝不谎称高精度图。严格按 `docs/PLAN-V2.1-EARTH-MAP-EXEC-GLM5.2.md` 的任务 0 到 8 顺序执行。
验证：先运行 `git status --short --branch -uall`、`npm run build`、`npm run test:visual` 记录基线；实现后运行 `node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json`、`node scripts/era5/validate_frame.mjs public/data/era5/manifest.json`、`npm run build`、`npm run test:visual`，并保存 desktop、mobile 截图；Playwright 必须断言 `earthMapReady()===true`、`earthMapSource()==="nasaBlueMarble"`、`windSource()==="era5"`，并在替换纹理后重标定 colorBuckets 阈值。
约束：不使用 Windy 或任何运行时网络请求；不引入新 npm 依赖（资产校验脚本只用 Node 内置 fs/crypto）；不触碰 ERA5 风场逻辑（`src/data/era5/`、`src/data/windSource.js`、`src/scene/layers/createWindLayer.js`）；不把 proceduralFallback 描述成高精度图；NASA 官方下载不可达时暂停报告，禁止用第三方镜像替代；不读取或记录任何认证材料。
边界：只写入 `src/scene/layers/createEarth.js`、`src/scene/EarthScene.js`、`src/main.js`、`src/styles.css`、`index.html`、`public/assets/earth/`、`scripts/earth/`、`tests/visual.spec.js`、`tests/helpers/colorBuckets.js`、`README.md`、`TRANSFER_STATUS.md`、`docs/`；禁止触碰 `.git/`、`node_modules/`、`dist/`、ERA5 风场文件、认证材料、浏览器 profile、LaunchAgent、全局 skill 和无关文件。
迭代策略：按文档任务顺序，每个任务开头写五行任务卡（目标/完成条件/验证器/安全边界/产物位置），每次有意义改动后重跑该任务的最小验证命令；视觉微调最多 2 轮；同一错误连续 2 次失败必须停止试错，读日志或换证据来源；最多 3 轮聚焦改进后报告剩余风险。
完成条件：NASA 纹理本地资产存在且 `validate_earth_assets.mjs` 通过；`earthMapSource()` 返回 `nasaBlueMarble` 且 `earthMapReady()===true`；`windSource()` 仍为 `era5` 且 era5 validator 通过；`npm run build` 和 `npm run test:visual` 全绿（含重标定后的 colorBuckets）；desktop、mobile 截图存在且首屏可识别非洲/印度洋、移动端无控件重叠；README、TRANSFER_STATUS、docs 声明与代码真实状态一致。
暂停条件：NASA 官方下载不可达或需要账号/付费、单文件或总资产超过 12 MB、需要安装新依赖、纹理许可证不清、2 轮视觉微调后仍不达标、需要 commit/push/发布/外发、需要破坏性清理，或发现任务必须重构超过 2 个核心文件或触碰风场逻辑。
```

### Goal Draft (English-compatible)

```text
/goal Replace the earth texture in `/Volumes/vol1/3D 风场地球可视化/` from a procedural canvas to a local static NASA Blue Marble cloud-free true-color equirectangular texture so the first screen clearly shows Africa, the Arabian Peninsula, the Indian Ocean, Madagascar, and South America; keep ERA5 wind streamlines, the glass atmosphere, bloom, controls, and `windSource()==="era5"` unchanged; on texture load failure degrade honestly to proceduralFallback and never claim it is a high-precision map. Follow `docs/PLAN-V2.1-EARTH-MAP-EXEC-GLM5.2.md` tasks 0 through 8 strictly in order.
Verification: first run `git status --short --branch -uall`, `npm run build`, `npm run test:visual` as baseline; after implementation run `node scripts/earth/validate_earth_assets.mjs public/assets/earth/manifest.json`, `node scripts/era5/validate_frame.mjs public/data/era5/manifest.json`, `npm run build`, `npm run test:visual`, and save desktop and mobile screenshots; Playwright must assert `earthMapReady()===true`, `earthMapSource()==="nasaBlueMarble"`, and `windSource()==="era5"`, and recalibrate the colorBuckets thresholds after swapping the texture.
Constraints: no Windy or any runtime network request; no new npm dependency (the asset validator uses only Node built-in fs/crypto); do not touch ERA5 wind logic (`src/data/era5/`, `src/data/windSource.js`, `src/scene/layers/createWindLayer.js`); never describe proceduralFallback as a high-precision map; pause and report if the official NASA download is unreachable and do not substitute third-party mirrors; do not read or persist any credentials.
Boundaries: write only `src/scene/layers/createEarth.js`, `src/scene/EarthScene.js`, `src/main.js`, `src/styles.css`, `index.html`, `public/assets/earth/`, `scripts/earth/`, `tests/visual.spec.js`, `tests/helpers/colorBuckets.js`, `README.md`, `TRANSFER_STATUS.md`, `docs/`; do not touch `.git/`, `node_modules/`, `dist/`, ERA5 wind files, credentials, browser profiles, LaunchAgents, global skills, or unrelated files.
Iteration policy: follow the document task order, write a five-line task card at the start of each task (goal/done/verifier/boundary/artifact), rerun the task's smallest verify command after each meaningful change, cap visual tuning at 2 rounds, stop retrying after the same error fails twice and gather new evidence, and make at most 3 focused improvement rounds before reporting remaining risks.
Stop when: the local NASA texture asset exists and `validate_earth_assets.mjs` passes; `earthMapSource()` returns `nasaBlueMarble` with `earthMapReady()===true`; `windSource()` stays `era5` and the era5 validator passes; `npm run build` and `npm run test:visual` are green (including recalibrated colorBuckets); desktop and mobile screenshots exist with recognizable Africa/Indian Ocean and no mobile control overlap; README, TRANSFER_STATUS, and docs match the actual code state.
Pause if: the official NASA download is unreachable or needs an account/payment, a single file or total assets exceed 12 MB, a new dependency is required, texture licensing is unclear, two rounds of visual tuning still fail, commit/push/release/external send is requested, destructive cleanup is needed, or the task would require refactoring more than 2 core files or touching wind logic.
```

---

## 7. 给 GLM 5.2 的每轮循环协议

1. 读本文当前任务。
2. 写五行任务卡：目标 / 完成条件 / 验证器 / 安全边界 / 产物位置。
3. 声明本轮 Waza skill（think/hunt/design/check）。
4. 只读检查现状，含 `git status --short --branch -uall`。
5. 做最小可逆改动。
6. 跑本任务 Verify 命令，贴真实输出。
7. 失败只做一轮针对性修复；同一错误第 2 次失败 → 停止、读日志、回根因。
8. 任务完成记录：changed files / 命令输出摘要 / artifacts / remaining risk。
9. 进下一任务前确认无夸大声明。

完成全部任务后输出 closeout：已完成、验证命令与结果、资产路径、截图路径、文档路径、前后状态、未提交状态、残余风险、下次入口。
