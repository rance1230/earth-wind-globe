# 实施计划 (GLM 5.2 可执行版)：Three.js 3D 风场地球可视化 V1

> **给执行 agent：** 本文件是**自包含、按序、逐任务可验证**的实施计划。从「任务 0」开始，按顺序做，每个任务做完**必须运行该任务的 Verify 命令并贴出真实输出**才能进入下一个。**禁止在没有 fresh 验证证据时声称完成。**
>
> 目标目录：`/Volumes/vol1/3D 风场地球可视化/`（以下所有路径相对于此）
> 原始交接文档：`PLAN.md`（保留，作决策依据）；本文件是其改进执行版。
> 来源参考：X 视频 [@codetaur](https://x.com/codetaur/status/2070734494915797392)

---

## 0a. 一句话目标

把**已存在的占位 shell** 升级为 V1 视觉近似版：**玻璃质感地球 + 动态风场流线 + 卫星点群 + 室内 HDRI 反射 + bloom 后期 + 可录屏镜头 + 真实像素验收**。真实 ERA5/TLE 留 V2。

## 0b. 关键事实（已用证据核实，2026-06-27）

> 这一节是本计划相对原 `PLAN.md` 的**最重要修正**：项目**不是空白起点**。

| 事实 | 证据 | 对执行的影响 |
|---|---|---|
| **项目已是可构建的 shell** | `package.json`/`vite.config.js`/`index.html`/`src/**`/`tests/` 已存在；`dist/` 已产出 | **不要重新脚手架、不要整体重写**，只升级占位层 |
| `EarthScene.js` 已接好渲染管线 | 已含 renderer + ACESFilmic + RoomEnvironment(PMREM) + OrbitControls + UnrealBloom + 自转 + resize | **保留这条管线**，只改 layer 内部 + 加 UI/状态 |
| 风场是占位 | `windSynthetic.js` 只生成 96 条 9 点折线；`createWindLayer` 只做 opacity 脉动，**无流动动画**，只有 2 色阈值 | 核心升级对象（→ 700-1200 条 + 真流动 + 3 色） |
| 卫星是占位 | `satellitesSynthetic.js`/`createSatelliteLayer` 只有 420 点（config `satelliteCount=420`） | 升到 1000-2000，单 `Points` draw call |
| 大气壳无 rim glow | `createAtmosphere` 只有 `MeshPhysicalMaterial` 加色壳，**无 fresnel** | 加 fresnel rim shader |
| **验收是假的** | `npm run test:visual` = `node tests/visual.spec.js`，**只检查文件存在**，不是 Playwright 像素验收 | **最高优先级**：先建真验收 |
| Playwright 未真正接入 | `@playwright/test@1.61.1` 在 deps 但脚本没用它；浏览器未安装 | 需 `npx playwright install chromium` |
| 无 UI 控件 | 无 pause/play、reset、quality High/Low | 需新增 + 状态接入渲染循环 |
| 参考项目存在且可用 | `/Volumes/vol1/codex/container-3d-tutor` 有 `three@0.184.0` + `vite@8.0.14` + `dist/` | H1 已成立，可借鉴其 vite 配置 |
| 非 git 仓库 | 目录无 `.git` | 回滚靠手动；**建议**本地 `git init` 做检查点（见 §6，不 push） |
| 环境 | `node v22.22.3` / `npm 10.9.8` | 满足 |

---

## 1. 保留原计划的优点（不改）

- ✅ **已锁定决策**：原生 Three.js（非 R3F）、V1 合成数据、RoomEnvironment 反射、预计算短流线（不做实时 advection）。继续锁定。
- ✅ **V1→V2 数据契约**（换数据不动 scene 层）：风场 `{ segments: Array<{ points: Vec3[], speed: number }> }`；卫星 `{ positions: Float32Array, sizes: Float32Array }`。**保留**，但本计划补充：契约里加 `seed` 与 per-vertex color。
- ✅ **明确不做**：实时 ERA5/Copernicus、React/R3F、AR、公网部署/Git push、有版权外部纹理/HDRI、原视频帧入库。**继续不做。**
- ✅ **脆弱假设 H1-H3 + 兜底**：H1 已核实成立；H2（程序化纹理可读性）兜底链保留（canvas → three examples earth texture(BSD) → 自然地球公共领域矢量）。
- ✅ **回滚**：删整个文件夹即可，不影响其他项目。

## 2. 相对原计划的改进项（评估结论 + codex 对抗复核）

> 评估方法：think + writing-plans（策划）→ codex challenge（独立第二意见）→ verification-before-completion（验收门）。下列每条均被 codex 独立复核命中。

| # | 原计划问题 | 改进 |
|---|---|---|
| I1 | **把任务写成「从零搭建」**，agent 可能覆盖已工作的渲染管线 | 重构为「**盘点→保留→只升级占位层**」，新增任务 0 盘点 |
| I2 | **验收是假的**（文件存在检查冒充像素验收），agent 可无视觉证据宣称完成 | **验证优先**：任务 1 先建真 Playwright 像素验收，后续每个视觉任务收紧一条断言 |
| I3 | 验收用「直方图 ≥3 峰」——**易抖**（受 bloom/ACES 曝光、AA、程序化随机、视口构图影响） | 改用 **HSV 颜色桶断言**（海蓝/陆暖/亮白/风场暖色），忽略透明像素与 HUD 区，**固定随机种子**，阈值放宽 |
| I4 | **质量 High/Low 只改 config 常量**——层创建后改常量无效 | 层工厂返回 `{group, update, dispose}` 并接受 quality 参数；`setQuality()` 做 **dispose + rebuild** |
| I5 | 风场升级**欠定义**（几何生命周期/动画模型/性能预算/质量切换都没说） | 明确：**seeded 数据 → 合并几何(单 draw call) → 3 色 vertex color → 真流动动画(相位/dash 偏移) → dispose/rebuild** |
| I6 | UI 控件只在需求里列出，**没说怎么接进渲染循环和测试** | 明确状态机 + **暴露 `window.__viz` 测试钩子**（paused/quality/drawCalls/cameraDistance），让 Playwright 可确定性断言 |
| I7 | 没考虑 **headless WebGL** 下 bloom/PMREM 的坑 | Playwright 加 `--use-gl=angle --ignore-gpu-blocklist --enable-unsafe-swiftshader`；postprocessing **try/catch 降级**；验收**不依赖** bloom 精确亮度 |
| I8 | 卫星 1000-2000 没说实现方式，可能拖垮性能 | 单 `THREE.Points`，一次 draw call，材质 size 有上限，每帧无 CPU 重算 |
| I9 | `vite` 版本不一致（原 §7 写 `8.1.0`，`package.json` 是 `^8.1.0`，参考项目 `8.0.14`） | 锁定 `vite@8.1.0`（去 caret，避免漂移），保留 `three@0.184.0`、`@playwright/test@1.61.1` |
| I10 | 非 git，回滚纪律靠人 | **建议**本地 `git init`（仅本地检查点，不 push）；否则每任务前 cp 备份到 `.handoff-backups/` |

## 3. 目标文件结构（在现有基础上增删，**不重建**）

```
3D 风场地球可视化/
  PLAN.md                  ← 原交接（保留）
  PLAN-GLM5.2.md           ← 本执行计划
  index.html               ← 已存在；加 UI 控件容器 + HUD
  package.json             ← 已存在；锁版本 + 改 test:visual 为 playwright
  vite.config.js           ← 已存在；保留
  playwright.config.js     ← 【新增】真验收配置
  src/
    main.js                ← 已存在；加 UI 事件绑定
    styles.css             ← 已存在；加控件样式
    config.js              ← 已存在；加 quality 预设 + seed
    util/seededRandom.js   ← 【新增】mulberry32 确定性随机
    scene/
      EarthScene.js        ← 已存在；保留管线，加 window.__viz、setQuality、setPaused、resetCamera、postprocessing 降级
      layers/
        createEarth.js         ← 升级纹理可读性（H2 兜底）
        createAtmosphere.js     ← 加 fresnel rim shader
        createWindLayer.js      ← 合并几何 + 3 色 + 流动 + dispose
        createSatelliteLayer.js ← 1000-2000 单 Points + dispose
    data/
      windSynthetic.js     ← seeded + per-segment color + 涡旋中心
      satellitesSynthetic.js ← seeded + 数量按 quality
  tests/
    visual.spec.js         ← 【重写】真 Playwright 像素 + 动画 + UI 烟测
    helpers/colorBuckets.js ← 【新增】PNG → HSV 颜色桶分析
    __screens__/           ← 【新增】录屏/截图产物（desktop.png / mobile.png）
```

## 4. 共享架构契约（所有 layer 必须遵守）

**4.1 Layer 工厂签名**——每个 `createXxxLayer(radius, opts)` 返回：
```js
{
  group,                       // THREE.Object3D，加入 scene
  update(elapsed, delta) {},   // 每帧
  dispose() {}                 // 释放 geometry/material/texture，供 setQuality 重建
}
```

**4.2 质量预设**（`config.js`）——`setQuality(q)` 时 dispose 旧层、按预设重建：
```js
export const QUALITY = {
  high: { windSegments: 1000, windPoints: 14, satelliteCount: 1600, pixelRatioCap: 2 },
  low:  { windSegments: 500,  windPoints: 10, satelliteCount: 800,  pixelRatioCap: 1.5 },
};
export const CONFIG = { radius: 2, cameraDistance: 5.8, seed: 1337, defaultQuality: "high" };
```

**4.3 测试钩子**——`EarthScene.init()` 末尾挂 `window.__viz`，供 Playwright 确定性断言（**这是 I3/I6 的关键**）：
```js
window.__viz = {
  ready: true,
  paused: () => this.paused,
  quality: () => this.quality,
  drawCalls: () => this.renderer.info.render.calls,
  satelliteCount: () => this.currentSatelliteCount,
  windCount: () => this.currentWindCount,
  cameraDistance: () => this.camera.position.length(),
  postprocessing: () => this.postprocessingEnabled,
  setPaused: (v) => this.setPaused(v),
  setQuality: (q) => this.setQuality(q),
  resetCamera: () => this.resetCamera(),
};
```

**4.4 确定性**——所有合成数据用 `seededRandom(CONFIG.seed)`（mulberry32），保证截图/测试稳定。

**4.5 postprocessing 降级**——`init()` 里 `try` 建 `EffectComposer + UnrealBloomPass`；`catch` 时 `this.postprocessingEnabled=false` 并回退 `renderer.render(scene,camera)`。验收不依赖 bloom 亮度。

---

## 5. 任务序列（按序执行，每个含 Files / Spec / Verify / DoD）

> 顺序原则（codex 复核确认）：**先建验收 → 再搭状态/UI/质量架构 → 再升级视觉层 → 纹理润色放最后 → 最后整体调参出图**。这样每个视觉改动都立刻可验证，最小化返工。

### 任务 0：盘点与基线（先看清现状，禁止重写）
- **Files**：只读 `src/**`、`package.json`、`vite.config.js`、`index.html`、`tests/visual.spec.js`。
- **Spec**：
  1. 通读现有 `EarthScene.js`，确认渲染管线（renderer/ACESFilmic/PMREM RoomEnvironment/OrbitControls/UnrealBloom/自转/resize）——**这些保留**。
  2. （建议）本地检查点：`git init && git add -A && git commit -m "baseline: handoff shell"`（仅本地，**不 push**）。若不想用 git，则 `cp -R src .handoff-backups/$(date +%Y%m%d-%H%M%S)-src`。
- **Verify**：`npm install && npm run build` → 必须 exit 0、产出 `dist/`。贴出真实输出。
- **DoD**：build 通过；已记录「保留 vs 升级」清单；已建基线检查点。

### 任务 1：真实验收骨架（验证优先，最高优先级 —— I2）
- **Files**：改 `package.json`（`"test:visual": "playwright test"`，`vite` 去 caret 锁 `8.1.0`）；新增 `playwright.config.js`；新增 `tests/helpers/colorBuckets.js`；重写 `tests/visual.spec.js`；新增 `src/util/seededRandom.js`；在 `EarthScene.init()` 挂 `window.__viz`（§4.3）。
- **Spec**：
  - `playwright.config.js`：`webServer = { command: "npm run preview", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI }`；两个 project：desktop `1280x1280`、mobile `390x844`；
    `use.launchOptions.args = ["--use-gl=angle","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"]`。
  - `tests/visual.spec.js`（每 project）：
    1. `goto('/')`，`waitForFunction(() => window.__viz?.ready === true)`，再等 ~800ms 让动画起来。
    2. `await page.locator('#globe-canvas').screenshot({ path: 'tests/__screens__/<project>.png' })`。
    3. 用 `colorBuckets.js`（`pngjs` 解码 PNG → 转 HSV → 计数桶），断言：
       - 非背景像素占比 `> 0.5`（背景≈`#05070b`，按容差判定）。
       - **颜色多样性**（I3，桶都需 > 阈值，阈值放宽）：`oceanBlue`(H 190-230)、`warmLand`(H 20-60)、`brightWhite`(高 V 低 S)、`windWarm`(H 0-60 高 S，黄/红)。**先只断言 oceanBlue + brightWhite 存在**（占位地球已能满足），其余桶在对应视觉任务里收紧。
    4. **动画**：未 paused 时，间隔 ~700ms 截 canvas 中心区两帧 → 差异 > 阈值；调 `window.__viz.setPaused(true)` 后两帧差异 ≈ 0。
    5. **UI 烟测**（控件存在后收紧，先留 `test.skip`）：quality 切换 → `satelliteCount()` 变化；reset → `cameraDistance()` 回默认（±容差）。
  - `pngjs` 加入 devDeps（`npm i -D pngjs`）。
- **Verify**：
  ```bash
  npx playwright install chromium
  npm run build && npm run test:visual
  ```
  必须：测试**真实启动 Chromium 截图**、两 project 通过、`tests/__screens__/desktop.png` 与 `mobile.png` 存在且非空。贴出输出 + `ls -la tests/__screens__/`。
- **DoD**：假验收已被真验收取代；颜色桶 + 动画 + 截图断言可跑通（基于当前占位视觉的最小集合）；后续任务靠收紧断言驱动。

### 任务 2：状态机 + UI 控件 + 质量 dispose/rebuild 架构（I4/I6/I8 的地基）
- **Files**：`EarthScene.js`（加 `paused`/`quality`/`setPaused`/`setQuality`/`resetCamera`，layer 持有引用以便 dispose）；`config.js`（§4.2 QUALITY）；`index.html`（控件容器）；`src/main.js`（绑定事件）；`src/styles.css`（控件样式，**不遮挡 canvas**）。
- **Spec**：
  - 控件：暂停/播放、重置相机、质量 High/Low（按钮或 select）。
  - `setQuality(q)`：dispose 风场+卫星层 → 按 `QUALITY[q]` 重建 → 更新 `renderer.setPixelRatio(min(dpr, cap))`。
  - `setPaused(true)`：`animate()` 里跳过 `elapsed/delta` 推进（相机阻尼可继续），使帧差≈0。
  - `resetCamera()`：相机回 `CONFIG.cameraDistance` 初始位姿。
  - `window.__viz` 全部接通（§4.3）。
- **Verify**：`npm run build && npm run test:visual`，并**解开任务 1 第 5 步的 UI 烟测 skip**：quality 切换使 `satelliteCount()` 变；reset 使 `cameraDistance()` 回默认；setPaused 使帧差≈0。贴出输出。
- **DoD**：三个控件经 Playwright 真实驱动验证；质量切换走 dispose/rebuild（无内存泄漏式叠加）；UI 不遮挡 canvas。

### 任务 3：风场层升级（核心观感 —— I5）
- **Files**：`data/windSynthetic.js`、`scene/layers/createWindLayer.js`。
- **Spec**（严格按此子顺序，codex 复核）：
  1. **seeded 数据生成**：`windSynthetic(radius, { count, pointsPerSeg, seed })` → `{ segments:[{ points:Vec3[], speed, color:[r,g,b] }] }`；加 2-3 个**涡旋中心**让流线有曲率（避免显假）。
  2. **合并几何（单 draw call）**：所有 segment 合到一个 `THREE.BufferGeometry` 用 `LineSegments`（或 `Line2`/`LineSegmentsGeometry`）；**禁止**每条线一个 `THREE.Line` 对象。
  3. **3 色 vertex color**：按 speed 映射 `cyan → pale yellow → red`，写入 per-vertex color，材质 `vertexColors:true` + `AdditiveBlending`。
  4. **真流动动画**：`update()` 里推进相位/dash offset（`LineDashedMaterial` 的 dashOffset，或 shader uniform `uTime` 沿线方向流动 alpha），形成「流动」而非整条脉动。
  5. **dispose()**：释放合并 geometry/material。
  - 数量：High 1000 / Low 500（§4.2），`windCount()` 暴露给测试。
- **Verify**：`npm run test:visual`，**收紧颜色桶断言**：`windWarm`(黄/红) 桶 > 阈值；动画帧差在「有风场」区域明显。贴出输出 + 看 `desktop.png` 确认流线密集有方向感。
- **DoD**：700-1200 条流线、单 draw call、3 色、肉眼有流动方向；颜色桶 + 动画断言通过。

### 任务 4：卫星层升级（I8）
- **Files**：`data/satellitesSynthetic.js`、`scene/layers/createSatelliteLayer.js`。
- **Spec**：seeded fibonacci-sphere 分布，数量 High 1600 / Low 800；单 `THREE.Points`（已是，保留），高度散布 + 缓慢轨道相位；材质 size 有上限、`depthWrite:false`、加色；`dispose()` 释放；`satelliteCount()` 暴露。
- **Verify**：`npm run test:visual` 通过；`window.__viz.satelliteCount()` High=1600/Low=800；`drawCalls()` 不随卫星数线性暴涨（确认单 draw call）。贴出输出。
- **DoD**：1000-2000 白点、单 draw call、质量切换数量变化、帧率不崩。

### 任务 5：大气壳 fresnel rim glow（I7 的视觉部分）
- **Files**：`scene/layers/createAtmosphere.js`。
- **Spec**：在现有玻璃壳基础上加 **fresnel rim**：`ShaderMaterial`，`side: THREE.BackSide`，fragment 用 `pow(1.0 - dot(normal, viewDir), p)` 算边缘强度，rim 颜色 cyan/暖白，`AdditiveBlending`、`transparent`、`depthWrite:false`。保留原 `MeshPhysicalMaterial` 玻璃质感壳，rim 作为叠加层。
- **Verify**：`npm run test:visual` 通过；**收紧断言**：地球轮廓边缘存在亮 rim 像素（在 silhouette 环带采样，`brightWhite`/cyan 桶在边缘 > 阈值）。看 `desktop.png` 确认有发光边缘。
- **DoD**：可见 fresnel rim glow，与占位壳明显不同；边缘 rim 断言通过。

### 任务 6：地球纹理可读性润色（放最后 —— H2）
- **Files**：`scene/layers/createEarth.js`（必要时 `+ bump`）。
- **Spec**：先尝试**改进程序化 equirect canvas**（更可读的大陆/海洋对比 + 海岸线 + 轻地形/bump）。若程序化达不到「大陆/海洋可读」→ 按 H2 兜底：three examples 自带 earth texture(BSD) → 自然地球公共领域矢量。**不引入有版权纹理。**
- **Verify**：`npm run test:visual` 通过；`oceanBlue` + `warmLand` 两桶都稳定 > 阈值；人工看 `desktop.png` 大陆/海洋可读。贴出输出。
- **DoD**：地球表面大陆/海洋可读；颜色桶稳定；未引入版权素材。

### 任务 7：整体调参 + 录屏出图（验收收口 —— 验收）
- **Files**：微调 `EarthScene.js`（曝光/bloom 强度/相机预设/自转速度）、`config.js`。
- **Spec**：
  1. 调 bloom strength/radius/threshold + ACES 曝光，使「玻璃地球 + 风场 + 卫星 + rim + bloom」整体协调；**不破坏 headless 验收**（验收不依赖精确亮度）。
  2. 相机初始美洲/非洲角度，缓慢自转；`1280x1280` 视觉稳定。
  3. 录屏/截图归档到 `tests/__screens__/`（desktop + mobile），可选录一段 mp4（不入库，路径写回 `TRANSFER_STATUS.md`）。
  4. 更新 `TRANSFER_STATUS.md`：写最终验证状态、截图路径、残余风险、V2 入口。
- **Verify**：完整跑
  ```bash
  npm install && npm run build && npm run test:visual && ls -la tests/__screens__/
  ```
  全绿；两 project 截图存在。贴出完整输出。
- **DoD**：见 §7 验收定义全部满足。

---

## 6. 验收定义（Definition of Done —— 完成才算结束）

> **铁律（verification-before-completion）：没有 fresh 验证证据，不得声称完成。** 每条都要有命令真实输出 / 截图为证。

**自动化（硬门，必须全绿）：**
```bash
cd "/Volumes/vol1/3D 风场地球可视化"
npm install
npm run build                 # exit 0
npx playwright install chromium   # 首次
npm run test:visual           # 两 project 全绿
ls -la tests/__screens__/     # desktop.png + mobile.png 存在且非空
```
Playwright 断言（HSV 颜色桶，非直方图峰；忽略透明 + HUD 区；固定 seed；阈值放宽）：
- canvas 可见且尺寸≈视口；非背景像素 > 50%。
- 颜色多样性：`oceanBlue` + `warmLand` + `brightWhite` + `windWarm` 四桶均 > 阈值。
- 动画：未 paused 帧差 > 阈值；paused 后帧差 ≈ 0。
- UI：quality 切换改变 `satelliteCount()`/`windCount()`；reset 复位 `cameraDistance()`。
- headless 用 `--use-gl=angle --ignore-gpu-blocklist --enable-unsafe-swiftshader`；postprocessing 可降级，验收不依赖 bloom 亮度。

**人工（看图确认）：**
- 首屏即地球（无 landing 页）；大陆/海洋可读、半透明 rim、强室内反射、密集流动风场、密集卫星。
- 本地流畅录屏；`1280x1280` 稳定；UI 不遮挡 canvas。

**完成措辞（codex 要求）：** 「完成 = 两个视口(1280×1280 + 390×844)截图已保存、测试为真实浏览器截图、pause/reset/quality 三控件已被实测驱动、无任何占位视觉层残留、build+test:visual 全绿。」

## 7. 风险与兜底（继承原计划 + 新增）

- 合成风场显假 → 加流线曲率 + 2-3 涡旋中心（任务 3 已含），再考虑 ERA5(V2)。
- 掉帧 → pixelRatio 上限(Low=1.5)、卫星减半、风场合并几何（已在架构里）。
- 反射弱 → 先 RoomEnvironment，再加程序化室内 equirect。
- **headless WebGL 报错/黑屏** → swiftshader 软渲染 flag + postprocessing try/catch 降级 + 验收不依赖 bloom 亮度（任务 1/§4.5）。
- **Playwright 抖动** → 颜色桶替代直方图、固定 seed、阈值放宽、忽略 HUD 区（任务 1）。
- **回滚**：本地 git 检查点（任务 0）或 `.handoff-backups/`；删整个文件夹即可，不影响其他项目。

## 8. 边界（明确不做 / 不碰）

- ❌ 不重新脚手架、不整体重写 `EarthScene` 渲染管线（只升级层 + 加状态/UI）。
- ❌ 不改 `/Volumes/vol1/codex/container-3d-tutor/`（只读参考）。
- ❌ 不接 ERA5/Copernicus/TLE/API key/外部账号/实时服务（V2）。
- ❌ 不 React/R3F、不 AR、不公网部署、不 **git push**（本地 git init 仅作检查点可以）。
- ❌ 不引入有版权外部地球纹理/HDRI，不把原视频帧入库。
- ❌ 不读取/记录任何密钥、cookie、token。

## 9. 来源

- [原帖 @codetaur](https://x.com/codetaur/status/2070734494915797392) · [Three.js 文档](https://threejs.org/docs/) · [satellite.js](https://github.com/shashwatak/satellite-js) · [three-globe](https://github.com/vasturiano/three-globe) · [Copernicus ERA5](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels)（V2）
