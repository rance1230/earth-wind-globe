# ERA5 数据驱动风场地球 V2 任务计划书, GLM 5.2 严格执行版

目标目录: `/Volumes/vol1/3D 风场地球可视化/`

计划日期: 2026-06-27

适用执行模型: GLM 5.2

工作台: Deck / Visual Artifacts

## 0. 一句话目标

把当前 V1 的 synthetic wind prototype 升级为 V2 第一版: 使用 Google 托管的 ERA5 数据生成真实 10m 风场帧, 用项目自研 Three.js wind visualization shader 渲染, 并用数据溯源、截图、Playwright、构建测试证明结果。明确不使用 Windy API。

## 1. 当前结论和边界

### 1.1 已知事实

- 当前项目是 Vite 加原生 Three.js, 命令来自 `package.json`: `npm run dev`, `npm run build`, `npm run preview`, `npm run test:visual`。
- 当前仓库工作树已有大量未提交修改, 执行前必须运行 `git status --short --branch -uall`, 把这些视为用户或前序 agent 工作, 不得清理、隐藏、回滚、stash 或覆盖。
- 当前根目录未发现仓库内 `AGENTS.md` 或 `CLAUDE.md`, 但本对话内 AGENTS 指令有效。
- 当前 V1 视觉差距的主因不是 Windy API 缺失, 而是风场仍为 `src/data/windSynthetic.js` 的 seeded random 合成数据, 地球纹理和卫星也都是程序化近似。
- 原作者补充信息指出: wind data 来自 Google 上的 ERA5, 自己的 wind visualization shader 使用这些数据, 不使用 Windy。

### 1.2 官方数据依据

- Google Research ARCO-ERA5: Google Cloud Public Datasets 中的 ERA5 curated copy, README 说明 ERA5 是 hourly global coverage, 约 30 km, 1979 至今, bucket 为 `gcp-public-data-arco-era5`。
- ARCO-ERA5 推荐读取路径: `gs://gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3`, 可使用 anonymous storage 方式读取。
- 10m 风变量名: `10m_u_component_of_wind`, `10m_v_component_of_wind`, 单位 `m s**-1`。
- Google Earth Engine 备选数据集: `ECMWF/ERA5/HOURLY`, 其说明 ERA5 由 Copernicus Climate Change Service at ECMWF 生产, hourly, 全球约 31 km 网格。
- Copernicus CDS ERA5 single levels 是权威源, 引用和免责声明必须保留: results contain modified Copernicus Climate Change Service information, European Commission 和 ECMWF 不对下游使用负责。

参考 URL, 只作数据来源, 不把网页正文复制进项目:

- https://github.com/google-research/arco-era5
- https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_HOURLY
- https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels

## 2. Skill 编排规则

GLM 5.2 必须按下面顺序显式调用或模拟执行这些 Waza 和 Qiaomu 约束。每个阶段开始时写明当前使用的 skill 和为什么使用。

### 2.1 waza-think, 方案锁定

用途: 在写代码前把目标、非目标、数据来源、依赖、验证命令和失败边界定清楚。

必须输出:

- Building: 本阶段要建什么。
- Not building: 不做什么。
- Approach: 选择方案和理由。
- Key decisions: 3 到 5 条关键决策。
- Unknowns: 只列明确延期且有 owner 的未知项。

硬门:

- 不得在 `waza-think` 输出前修改源码。
- 若需要新增 Python 或其他非 JS 工具链, 必须说明它是 dev-only preprocessing, 并在安装依赖前暂停请求用户确认, 除非本机已有可用依赖。

### 2.2 waza-hunt, 根因调查和复现门

用途: 先把“为什么不像参考视频”变成可验证根因, 再改代码。

必须先写一句根因句:

I believe the root cause is that the current wind layer is synthetic seeded streamline data rather than ERA5-driven wind vectors, because `src/data/windSynthetic.js` generates random lat/lon seeds and `createWindLayer.js` only animates a shader bright band over those synthetic segments.

必须覆盖症状:

- 风线随机短直线, 缺少真实气象连续性。
- README 声称复现核心观感, 但 V2 真实 ERA5/TLE 仍未接。
- Playwright 10/10 只证明有颜色、有动画、有控件, 不证明风场来自 ERA5。
- 移动端截图中控件和 HUD 可能挤压, 构图不是参考画面。

硬门:

- 根因句必须能解释所有症状。
- 若同一视觉问题在一次修复后仍存在, 停止叠补丁, 重新执行 `waza-hunt`。

### 2.3 waza-design, 视觉方向和截图验收

用途: 把“像原帖”翻译为可检查的视觉标准。

视觉方向:

- Visual thesis: scientific glass globe, data-instrument aesthetic, ERA5-driven wind flow, cinematic but not cartoon.
- Content plan: first screen is the globe itself, UI only辅助控制, not a landing page.
- Interaction thesis: slow rotation, wind flow phase movement, optional demo mode hides HUD and controls for recording.

硬门:

- 不允许用“高级”“有质感”“像原帖”作为完成标准。
- 必须保存 desktop 和 mobile 截图。
- desktop 截图要能看到完整球体轮廓、真实数据风场纹理、地表可读、rim 或 bloom 不糊成一片。
- mobile 截图不得出现 HUD 和 controls 互相遮挡或主要信息被挤压。
- 如果使用外部地球纹理或 HDRI, 必须先确认许可证和 attribution, 无法确认就暂停。

### 2.4 waza-check, 收口审查

用途: 审查 diff、依赖、数据产物、文档声明和验证证据。

必须执行:

- `git status --short --branch -uall`
- `git diff --stat`
- `npm run build`
- `npm run test:visual`
- 如果新增 data preprocessing script, 运行对应的 dry-run 或 sample 输出检查。

硬门:

- 不得声称 tests pass, verified, fixed, done, 除非本轮真实输出里有对应命令。
- 任何新增 dependency 都必须能解释为 ERA5 数据读取、预处理、渲染或验收直接需要。
- 若 source 变更需要 generated data, 必须验证 generated data 已生成并被读取。

### 2.5 qiaomu-goal-meta-skill, 循环目标提示词

用途: 把本计划压缩成可复制 `/goal`, 控制 GLM 5.2 持续执行、何时停止、何时暂停。

计划书末尾提供中文推荐版和 English-compatible 版。执行 agent 必须优先复制中文推荐版。

## 3. 推荐技术路线

### 3.1 数据路线

首选: ARCO-ERA5 on Google Cloud Public Datasets。

理由:

- 与原作者“pulls ERA5 data from google”匹配。
- 可匿名读取 public bucket。
- 变量名和单位清晰。
- 可以离线预处理成前端小文件, 避免浏览器直接读巨大 Zarr。

备选: Google Earth Engine `ECMWF/ERA5/HOURLY`。

仅在 ARCO-ERA5 public Zarr 无法访问时使用。因为 Earth Engine 常需要账号授权, 执行 agent 不得要求用户提供账号或认证材料, 只能输出 GEE 导出脚本和暂停条件。

不采用: Windy API。

理由: 原作者明确不使用 Windy, Windy 也会引入第三方 API、配额、授权和视觉抽象, 不利于自研 shader。

### 3.2 前端数据契约

新增本地 ERA5 frame 契约, 推荐目录:

- `public/data/era5/manifest.json`
- `public/data/era5/frames/era5-10m-wind-YYYYMMDDTHHZ.json`
- `src/data/era5/loadEra5WindFrame.js`
- `src/data/era5/traceWindStreamlines.js`
- `src/data/windSource.js`

每个 frame 必须包含这些字段:

- `schemaVersion`: 固定为 `era5-wind-frame-v1`。
- `source`: 固定为 `ERA5 ARCO on Google Cloud Public Datasets` 或明确的备选来源。
- `producer`: 固定说明 `ECMWF / Copernicus Climate Change Service`。
- `access`: 固定说明 `Google Cloud Public Datasets` 或 `Google Earth Engine`。
- `variables`: 说明 `10m_u_component_of_wind` 和 `10m_v_component_of_wind`。
- `units`: 固定为 `m s**-1`。
- `timeUtc`: 数据对应 UTC 小时。
- `grid`: 说明经纬度范围、步长、宽高和是否下采样。
- `u` 和 `v`: 数值序列, 必须可计算风速。
- `speedStats`: min, max, mean, p95。
- `preprocess`: 说明下采样、裁剪、归一化和生成命令。
- `licenseNotice`: Copernicus / ECMWF 免责声明简写。

### 3.3 渲染路线

第一版不要直接跳 GPU particle simulation。先做可验证的 ERA5 streamlines:

1. 从 ERA5 frame 做 bilinear sampling。
2. 在经纬度网格上用 Euler 或 RK2 积分生成 streamline。
3. 输出给现有 `createWindLayer` 的 merged geometry。
4. shader 继续做流动 phase 和色彩, 但颜色、方向和密度必须来自 ERA5 speed/vector。
5. `window.__viz` 新增 `windSource`, `windFrameTime`, `windFrameStats`, `era5Ready`。

这样每一阶段可独立 merge。GPU 粒子 advection 留到 V3, 不阻塞 V2 第一版。

## 4. 文件写入边界

允许修改:

- `README.md`
- `TRANSFER_STATUS.md`
- `package.json`
- `package-lock.json`
- `src/data/`
- `src/scene/layers/createWindLayer.js`
- `src/scene/EarthScene.js`
- `src/config.js`
- `src/main.js`
- `src/styles.css`
- `index.html`
- `tests/`
- `public/data/era5/`
- `scripts/era5/`
- `docs/`

禁止触碰:

- `.git/`
- `node_modules/`
- `dist/`, 除非是 build 输出且不提交
- 任何认证材料、敏感配置、浏览器 profile、系统 LaunchAgent、全局 Codex 或 Waza skill
- unrelated refactor, rename, formatting churn

## 5. 任务序列

### 任务 0, Preflight and evidence snapshot

Skill: `waza-think` + `waza-check`

动作:

1. 运行 `pwd`。
2. 运行 `git status --short --branch -uall`。
3. 运行 `rg --files -g '!node_modules' -g '!dist' -g '!build'`。
4. 读取 `package.json`, `README.md`, `PLAN-GLM5.2.md`, `src/data/windSynthetic.js`, `src/scene/layers/createWindLayer.js`, `tests/visual.spec.js`。
5. 运行 `npm run build` 和 `npm run test:visual`, 记录当前基线。

验证:

- 命令真实输出在当前轮 transcript。
- 写出 Current State Snapshot, 包含 dirty worktree、当前测试结果、当前截图路径。

完成条件:

- 不改代码完成现状证据。

暂停条件:

- build 或 test 失败且无法解释, 转 `waza-hunt` 先诊断。

### 任务 1, Root cause report before implementation

Skill: `waza-hunt`

动作:

1. 写 `docs/ERA5-V2-ROOT-CAUSE.md`。
2. 报告必须包含症状、根因句、代码证据、测试证据、不能证明的事项、改进方向。
3. 根因句必须明确指向当前 synthetic wind 数据和宽松视觉验收。

验证:

- 文件存在。
- 文件中包含 `Root cause:`、`Evidence:`、`Not proven by current tests:`、`Fix direction:`。
- 不得使用“可能”“大概”作为根因结论。

完成条件:

- 根因报告能解释用户截图和测试全绿之间的矛盾。

暂停条件:

- 找不到 `src/data/windSynthetic.js` 或实际代码已经不是 synthetic wind。

### 任务 2, Data provenance and source contract

Skill: `waza-think`

动作:

1. 新增 `docs/ERA5-DATA-PROVENANCE.md`。
2. 说明不使用 Windy API。
3. 说明首选 ARCO-ERA5, 备选 Google Earth Engine, 权威源 Copernicus CDS。
4. 说明变量、单位、bucket、Zarr 路径、license notice 和引用格式。
5. 设计 `era5-wind-frame-v1` schema。

验证:

- `docs/ERA5-DATA-PROVENANCE.md` 包含 `gcp-public-data-arco-era5`。
- 包含 `10m_u_component_of_wind` 和 `10m_v_component_of_wind`。
- 包含 `No Windy API`。
- 包含 Copernicus / ECMWF disclaimer。

完成条件:

- 数据引用不再模糊, README 后续能引用该文档。

暂停条件:

- 官方来源无法访问或变量名与官方文档冲突。

### 任务 3, Local ERA5 frame loader with fallback disabled by default

Skill: `waza-think`

动作:

1. 新增 `src/data/era5/loadEra5WindFrame.js`。
2. 新增 `src/data/era5/validateEra5WindFrame.js`。
3. 新增 `src/data/windSource.js`, 统一输出 active source。
4. 默认优先加载 `public/data/era5/manifest.json` 指向的 ERA5 frame。
5. 如果 frame 不存在, UI 必须显示明确状态 `ERA5 data missing`, 不得悄悄把 synthetic wind 当作 ERA5。
6. synthetic wind 只能作为 `devSynthetic` fallback, 并且 HUD 和 `window.__viz.windSource()` 必须如实显示。

验证:

- 新增或更新测试, 覆盖 missing frame 不会伪装成 ERA5。
- `window.__viz.windSource()` 能返回 `era5`, `devSynthetic`, 或 `missing`。
- `npm run build` 通过。

完成条件:

- 数据源状态可被 UI 和 Playwright 读取。

暂停条件:

- 需要改变现有 public API 或大面积重写 scene 架构超过 5 个核心文件。

### 任务 4, Real ERA5 sample acquisition

Skill: `waza-hunt` + `waza-check`

动作:

1. 先检查本机是否已有数据读取依赖:
   - `python3 --version`
   - `python3 -c "import xarray, zarr, gcsfs; print('era5 deps ok')"`
2. 如果依赖存在, 新增 `scripts/era5/fetch_arco_era5_sample.py`。
3. 脚本使用 ARCO-ERA5 public Zarr, 匿名读取, 选一个固定 UTC 小时, 只读取 `10m_u_component_of_wind` 和 `10m_v_component_of_wind`。
4. 输出一个下采样全球 frame 到 `public/data/era5/frames/`。
5. 输出 `public/data/era5/manifest.json`。
6. 输出后运行 frame validator, 计算 speedStats。

固定默认样例:

- 时间: `2024-01-15T00:00:00Z`
- 下采样目标: 经度约 2 度, 纬度约 2 度
- 最大输出 JSON: 2 MB

验证:

- `python3 scripts/era5/fetch_arco_era5_sample.py --time 2024-01-15T00:00:00Z --out public/data/era5 --max-json-mb 2`
- `node scripts/era5/validate_frame.mjs public/data/era5/manifest.json`
- frame 文件存在且非空。
- speedStats 全部有限, max 大于 mean, p95 大于 1。

完成条件:

- 项目存在一帧真实 ERA5 10m wind 数据, 并且有 provenance。

暂停条件:

- 本机缺少 Python ERA5 依赖且需要安装。
- GCS public bucket 无法匿名访问。
- 数据读取需要账号、认证材料、付费、2FA 或代理配置。

### 任务 5, ERA5 streamline generation

Skill: `waza-hunt`

动作:

1. 新增 `src/data/era5/traceWindStreamlines.js`。
2. 从 ERA5 frame 采样 u/v, 在 lat/lon 网格上生成 streamline。
3. 每条 streamline 输出 points, speed, color, phase。
4. 点位必须沿球面投影, 不允许用随机切线替代真实方向。
5. 保留 seeded 仅用于 seed point 分布和 phase, 不得用于风向。

建议参数:

- high: 1200 streamlines, 18 points each。
- low: 600 streamlines, 12 points each。
- integration step: 以经纬度角度为单位, 根据 speed clamp。
- color: speed p5 到 p95 映射 cyan, white, amber, red。

验证:

- 单元测试或脚本检查: 给定 frame, 输出 count 正确, 所有点在球面半径容差内, speed 有非零分布。
- Playwright 检查: `window.__viz.windSource()` 为 `era5`, `windFrameTime()` 为 sample time。
- `npm run build` 通过。

完成条件:

- 风场方向由 ERA5 u/v 决定, synthetic random 只控制采样种子。

暂停条件:

- streamlines 生成导致首屏超过 3 秒或内存明显异常。

### 任务 6, Wind shader and visual layer upgrade

Skill: `waza-design`

动作:

1. 改造 `createWindLayer.js`, 消费 ERA5 streamlines。
2. shader 使用 per-line phase、speed、progress, 让亮带沿真实方向流动。
3. 增强线条层次: 近处更亮, 远处更淡, 高速区域更暖。
4. 若继续使用 `THREE.LineSegments`, 必须说明线宽限制和 V3 可升级到 Line2 或 GPU particles。
5. 不允许出现“随机星芒线段覆盖海面”的视觉。

验证:

- desktop screenshot 存在: `tests/__screens__/desktop.png`。
- mobile screenshot 存在: `tests/__screens__/mobile.png`。
- 截图人工检查清单写入 `TRANSFER_STATUS.md`。
- Playwright 检查 active source 为 ERA5。
- `npm run test:visual` 通过。

完成条件:

- 画面上风线方向、密度、颜色由 ERA5 frame 决定。

暂停条件:

- 视觉需要引入新渲染库、GPU compute 或大规模重构。

### 任务 7, Earth material and recording mode

Skill: `waza-design`

动作:

1. 增加 `demo` 或 `recording` 模式, 可以隐藏 HUD 和 controls。
2. 修复 mobile 控件和 HUD 互相挤压。
3. 评估当前程序化地球是否足够。若不够, 使用许可证明确的公开纹理或 Three examples 可用纹理。
4. README 记录 texture 或 HDRI 来源, 未确认许可证不得使用。

验证:

- desktop 截图, mobile 截图, recording mode 截图均保存。
- mobile 宽度 390 下无 HUD/control overlap。
- 若新增素材, 文档包含 source URL、license、attribution。
- `npm run build && npm run test:visual` 通过。

完成条件:

- UI 不再干扰参考画面, 录屏模式可用。

暂停条件:

- 素材版权不清。
- 需要下载大文件超过 20 MB。

### 任务 8, Documentation update

Skill: `waza-check`

动作:

1. 更新 `README.md`, 把状态从 V1 synthetic prototype 调整为 V2 ERA5 data-driven first version 或当前真实状态。
2. README 必须明确: no Windy API。
3. README 必须明确: ERA5 produced by ECMWF / Copernicus Climate Change Service, accessed through Google-hosted ARCO-ERA5 or GEE。
4. 更新 `TRANSFER_STATUS.md`, 记录命令输出、截图路径、数据文件路径、未做事项。
5. 如果还有 synthetic fallback, README 不得把它描述成真实 ERA5。

验证:

- `rg -n "Windy|ERA5|Copernicus|ECMWF|synthetic|devSynthetic|windSource" README.md TRANSFER_STATUS.md docs src`
- 不存在 misleading claim。
- `npm run build && npm run test:visual` 通过。

完成条件:

- 文档声明和代码行为一致。

暂停条件:

- 无法生成真实 ERA5 frame, 只能更新为 partial status, 不得夸大完成。

### 任务 9, Final check and closeout

Skill: `waza-check`

动作:

1. 运行 `git status --short --branch -uall`。
2. 运行 `git diff --stat`。
3. 运行 `npm run build`。
4. 运行 `npm run test:visual`。
5. 运行 frame validator。
6. 查看最新 screenshot。
7. 输出 sign-off。

必须包含 sign-off:

```text
files changed:    N
scope:            on target
review depth:     deep
hard stops:       N found, N fixed, N deferred
specialists:      waza-think, waza-hunt, waza-design, waza-check
new tests:        N
doc debt:         none or named item
verification:     run exact build, test, validator commands and report pass or fail
```

完成条件:

- build 和 visual tests 通过。
- ERA5 frame validator 通过。
- README 和 TRANSFER_STATUS 与真实状态一致。
- desktop 和 mobile 截图存在。

暂停条件:

- 需要 commit, push, 发布, 外发, paid service, 账号认证, Google account, Copernicus account, 版权不清素材, 或破坏性清理。

## 6. 质量门

### 6.1 数据门

- `windSource` 不得伪装。
- 无真实 ERA5 frame 时, UI 和 README 必须显示 partial 或 missing。
- 所有 ERA5 frame 必须有 source, producer, access, variables, units, timeUtc, grid, speedStats, licenseNotice。
- 不得使用 Windy API、Windy tiles、Windy 文案或 Windy branding。

### 6.2 视觉门

- desktop 首屏必须是地球本身, 不是 landing page。
- wind flow 必须沿 ERA5 方向, 不能主要表现为随机短线。
- mobile 390 宽度下 controls 和 HUD 不重叠。
- recording mode 可隐藏 UI。
- 视觉验收必须包括 screenshot, 不能只用 build 或 unit test。

### 6.3 工程门

- 不新增账号系统、后端服务或云部署。
- 不提交巨大原始 ERA5 数据。
- 单个 sample JSON 默认小于 2 MB。
- 新依赖必须直接服务于 ERA5 读取、预处理、渲染或测试。
- 同一错误连续失败 2 次后必须停止重复尝试, 读取日志或换证据来源。

## 7. 推荐执行版, 中文可直接复制

```text
/goal 将 `/Volumes/vol1/3D 风场地球可视化/` 从 synthetic wind prototype 升级为第一版 ERA5 数据驱动的 Three.js 风场地球, 使用 Google 托管的 ERA5 数据生成真实 10m u/v 风场帧, 用项目自研 wind visualization shader 渲染, 并用数据溯源、截图、Playwright 和构建测试证明结果；明确不使用 Windy API。
验证：先运行 `pwd`, `git status --short --branch -uall`, `npm run build`, `npm run test:visual` 记录基线；实现后运行 ERA5 frame validator, `npm run build`, `npm run test:visual`, 保存 desktop、mobile、recording 截图, 并在 README 和 TRANSFER_STATUS 中记录数据来源、截图路径、命令输出和未做事项。
约束：不得使用 Windy API；不得把 synthetic fallback 描述成 ERA5；不得读取、打印、复制或持久记录任何认证材料；不得新增账号系统、后端服务、云部署、paid service、破坏性操作或 unrelated refactor；外部素材必须先确认许可证和 attribution。
边界：允许写入 `README.md`, `TRANSFER_STATUS.md`, `package.json`, `package-lock.json`, `src/data/`, `src/scene/`, `src/config.js`, `src/main.js`, `src/styles.css`, `index.html`, `tests/`, `public/data/era5/`, `scripts/era5/`, `docs/`；禁止触碰 `.git/`, `node_modules/`, unrelated global Codex/Waza skills, authentication material, browser profiles, LaunchAgent, and unrelated files。
迭代策略：按 `PLAN-ERA5-WAZA-GLM5.2.md` 顺序执行, 每阶段开始写明使用 `waza-think`, `waza-hunt`, `waza-design`, `waza-check` 中哪个 skill 及原因；每次有意义改动后重跑最小相关检查；同一错误连续失败 2 次后必须停止重复尝试, 读取日志、重建根因句或换证据来源；最多做 3 轮聚焦视觉改进后报告剩余风险。
完成条件：真实 ERA5 sample frame 存在且 validator 通过；`window.__viz.windSource()` 显示 ERA5；风场方向来自 ERA5 u/v；build 和 visual tests 通过；desktop、mobile、recording 截图存在且 mobile 无控件重叠；README、TRANSFER_STATUS、docs 的数据声明与代码真实状态一致。
暂停条件：需要安装新的 Python 或系统依赖、需要 Google/Copernicus 账号或认证材料、GCS public bucket 无法匿名访问、需要 paid service、需要下载超过 20 MB 的素材或数据、素材许可证不清、需要 commit/push/发布/外发、需要破坏性清理或发现任务范围必须重构超过 5 个核心文件。
```

默认选择理由：先做本地 ERA5 sample frame 加自研 shader 的第一版, 能直接消除“synthetic 风场不像参考”的主因, 同时避免账号、云服务和大规模 GPU 重构拖慢验证。

## 8. Goal Draft, English-compatible

```text
/goal Upgrade `/Volumes/vol1/3D 风场地球可视化/` from a synthetic wind prototype to a first ERA5 data-driven Three.js wind globe, generate a real 10m u/v wind frame from Google-hosted ERA5 data, render it with the project's own wind visualization shader, and prove the result with data provenance, screenshots, Playwright, and build checks; do not use the Windy API.
Verification: first run `pwd`, `git status --short --branch -uall`, `npm run build`, and `npm run test:visual` as the baseline; after implementation run the ERA5 frame validator, `npm run build`, `npm run test:visual`, save desktop, mobile, and recording screenshots, and document data source, screenshot paths, command output, and remaining work in README and TRANSFER_STATUS.
Constraints: do not use the Windy API; do not describe any synthetic fallback as ERA5; do not read, print, copy, or persist authentication material; do not add account systems, backend services, cloud deployment, paid services, destructive operations, or unrelated refactors; verify license and attribution before using external visual assets.
Boundaries: write only `README.md`, `TRANSFER_STATUS.md`, `package.json`, `package-lock.json`, `src/data/`, `src/scene/`, `src/config.js`, `src/main.js`, `src/styles.css`, `index.html`, `tests/`, `public/data/era5/`, `scripts/era5/`, and `docs/`; do not touch `.git/`, `node_modules/`, unrelated global Codex or Waza skills, authentication material, browser profiles, LaunchAgents, or unrelated files.
Iteration policy: follow `PLAN-ERA5-WAZA-GLM5.2.md` in order, state which of `waza-think`, `waza-hunt`, `waza-design`, or `waza-check` is active at the start of each phase and why, rerun the smallest relevant check after every meaningful change, stop repeating after the same error fails twice and gather new evidence, and make at most 3 focused visual improvement rounds before reporting remaining risks.
Stop when: a real ERA5 sample frame exists and passes validation; `window.__viz.windSource()` reports ERA5; wind direction comes from ERA5 u/v; build and visual tests pass; desktop, mobile, and recording screenshots exist with no mobile control overlap; README, TRANSFER_STATUS, and docs match the actual code and data state.
Pause if: new Python or system dependency installation is required, Google or Copernicus account or authentication material is required, the GCS public bucket cannot be accessed anonymously, paid services are needed, assets or data over 20 MB are required, asset licensing is unclear, commit/push/release/external sending is requested, destructive cleanup is needed, or the task requires refactoring more than 5 core files.
```

## 9. 给 GLM 5.2 的循环执行协议

每一轮必须按这个循环执行, 不得跳步:

1. 读本计划当前任务。
2. 写五行任务卡: 目标, 完成条件, 验证器, 安全边界, 产物位置。
3. 声明本轮使用的 Waza skill。
4. 只读检查现状, 包括 `git status --short --branch -uall`。
5. 若是 `waza-hunt` 阶段, 先写根因句再改代码。
6. 若是 `waza-design` 阶段, 先写视觉 thesis 和截图验收标准。
7. 做最小可逆改动。
8. 运行本任务 Verify 命令。
9. 若失败, 读取错误原文, 只做一轮针对性修复。
10. 同一错误第二次失败, 停止试错并回到根因调查。
11. 任务完成后记录: changed files, command output summary, artifacts, remaining risk。
12. 进入下一任务前确认没有夸大声明。

## 10. 最终 Closeout-L2 要求

最终回复必须包含:

- 已完成。
- 验证命令和结果。
- 数据产物路径。
- 截图路径。
- 文档路径。
- 前后状态。
- 未提交状态。
- 风险与未做事项。
- 下次入口。

不得包含:

- 未验证的“已复现原帖”。
- 未经确认的版权或数据授权声明。
- 任何敏感认证内容。
- 要求用户手动复制本机已有文件。
